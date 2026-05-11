import { verifyAuth } from './_lib/auth.js';
import { ensureFirebaseAdmin } from './_lib/firebaseAdmin.js';
import {
  applyCors,
  badRequest,
  forbidden,
  methodNotAllowed,
  ok,
  parseJsonBody,
  serverError,
  tooManyRequests,
  unauthorized,
} from './_lib/http.js';
import { buildContactHtml, sendResendEmail, verifiedFromEmail } from './_lib/email.js';
import { generateInvoicePdfAttachment } from './_lib/invoicePdf.js';
import { writeAuditEvent } from './_lib/audit.js';
import { checkRateLimit, getClientIp } from './_lib/rateLimit.js';
import { escapeHtml, isEmail, sanitizeText } from './_lib/validators.js';

export default async function handler(req: any, res: any) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const body = parseJsonBody(req);
    const action = sanitizeText(body.action, 40);
    if (action === 'contact') return await handleContact(req, res, body);
    if (action === 'welcome') return await handleWelcome(req, res, body);
    if (action === 'send-invoice') return await handleInvoiceEmail(req, res, body);
    return badRequest(res, 'Action email invalide.');
  } catch (error) {
    return serverError(res, error);
  }
}

async function handleContact(req: any, res: any, body: any) {
  const ip = getClientIp(req);
  const limited = await checkRateLimit(`ip:contact:${ip}`, 5, 60 * 60 * 1000);
  if (!limited.ok) return tooManyRequests(res, 'Trop de messages envoyés. Réessayez plus tard.');
  if (body.website || body.companyWebsite) return ok(res, { success: true });

  const name = sanitizeText(body.name || body.fromName, 120);
  const email = sanitizeText(body.email || body.fromEmail, 254);
  const phone = sanitizeText(body.phone, 50);
  const message = sanitizeText(body.message, 3000);
  const subject = sanitizeText(body.subject, 120) || 'Message Photofacto';
  const to = process.env.CONTACT_TO_EMAIL || 'contact@photofacto.fr';
  if (!name || !isEmail(email) || !message) return badRequest(res, 'Nom, email valide et message sont requis.');

  await sendResendEmail({
    to: [to],
    fromName: 'Photofacto',
    replyTo: email,
    subject: `[Photofacto] ${subject}`,
    html: buildContactHtml({ name, email, phone, message }),
  });
  return ok(res, { success: true });
}

async function handleWelcome(req: any, res: any, body: any) {
  let authCtx;
  try {
    authCtx = await verifyAuth(req);
  } catch (error: any) {
    return unauthorized(res, error?.message || 'Authentification requise.');
  }
  if (!isEmail(authCtx.email)) return badRequest(res, 'Email utilisateur introuvable.');

  const limited = await checkRateLimit(`uid:welcome-email:${authCtx.uid}`, 3, 24 * 60 * 60 * 1000);
  if (!limited.ok) return tooManyRequests(res, 'Email de bienvenue déjà demandé récemment.');

  const { db } = ensureFirebaseAdmin();
  const companyRef = db.collection('companies').doc(authCtx.uid);
  const companySnap = await companyRef.get();
  const company = companySnap.exists ? (companySnap.data() as any) : {};
  const lastSentAt = Date.parse(company.welcomeEmailSentAt || '');
  if (Number.isFinite(lastSentAt) && Date.now() - lastSentAt < 7 * 24 * 60 * 60 * 1000) {
    return ok(res, { success: true, skipped: true });
  }

  const name = sanitizeText(body.name, 100) || company.name || authCtx.email.split('@')[0] || 'Artisan';
  const firstName = sanitizeText(String(name).split(' ')[0], 60) || 'Artisan';
  await sendResendEmail({
    to: [authCtx.email],
    subject: `Bienvenue sur Photofacto, ${firstName}`,
    fromName: 'Photofacto',
    html: buildWelcomeHtml(firstName),
  });
  await companyRef.set({
    ownerId: authCtx.uid,
    welcomeEmailSentAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  return ok(res, { success: true });
}

async function handleInvoiceEmail(req: any, res: any, body: any) {
  let step = 'auth';
  let authCtx;
  try {
    authCtx = await verifyAuth(req);
  } catch (error: any) {
    return unauthorized(res, error?.message || 'Authentification requise.');
  }

  let invoiceId = '';
  let recipientDomain = '';
  let replyTo = '';
  const fromEmail = verifiedFromEmail();

  try {
    step = 'rate_limit';
    const limited = await checkRateLimit(`uid:invoice-email:${authCtx.uid}`, 20, 60 * 60 * 1000);
    if (!limited.ok) return tooManyRequests(res, 'Trop d’e-mails envoyés récemment. Réessayez plus tard.');
    if (Array.isArray(body.attachments) && body.attachments.length > 0) {
      return badRequest(res, 'Les pièces jointes envoyées depuis le navigateur ne sont pas acceptées.');
    }

    step = 'validate_body';
    invoiceId = sanitizeText(body.invoiceId, 120);
    const requestedTo = sanitizeText(body.to, 254).toLowerCase();
    const optionalMessage = sanitizeText(body.message, 900);
    const sendCopyToMe = body.sendCopyToMe === true;
    if (!invoiceId) return badRequest(res, 'Document manquant pour l’envoi.');

    step = 'firebase_admin';
    const { db } = ensureFirebaseAdmin();
    const invoiceRef = db.collection('invoices').doc(invoiceId);

    step = 'load_invoice';
    const invoiceSnap = await invoiceRef.get();
    if (!invoiceSnap.exists) return badRequest(res, 'Document introuvable.');
    const invoice = invoiceSnap.data() as any;
    if (invoice.ownerId !== authCtx.uid) return forbidden(res, 'Vous ne pouvez pas envoyer ce document.');

    step = 'load_company';
    const companySnap = await db.collection('companies').doc(authCtx.uid).get();
    const company = companySnap.exists ? (companySnap.data() as any) : {};

    step = 'resolve_recipient';
    const clientEmail = await resolveClientEmail(db, invoice, authCtx.uid);
    if (!clientEmail) return badRequest(res, 'Ajoutez un e-mail valide au client avant l’envoi.');
    if (requestedTo && requestedTo !== clientEmail.toLowerCase()) {
      return forbidden(res, 'Le destinataire doit être l’e-mail du client lié au document.');
    }
    recipientDomain = clientEmail.split('@')[1] || '';

    const recipients = [clientEmail];
    if (sendCopyToMe && isEmail(authCtx.email)) recipients.push(authCtx.email);
    const kind = invoice.type === 'quote' ? 'devis' : invoice.type === 'credit' ? 'avoir' : 'facture';
    replyTo = isEmail(company.email) ? company.email : authCtx.email;

    step = 'generate_pdf';
    const pdfAttachment = await generateInvoicePdfAttachment({ invoice, company });

    step = 'send_resend';
    const resendData = await sendResendEmail({
      to: recipients,
      subject: buildSubject(kind, invoice),
      html: buildInvoiceEmailHtml({ kind, invoice, company, message: optionalMessage }),
      fromName: company.name || company.legalName || authCtx.email || 'Photofacto',
      replyTo,
      attachments: [pdfAttachment],
    });

    step = 'mark_invoice_sent';
    await invoiceRef.set({
      emailSentAt: new Date().toISOString(),
      lastReminderAt: body.kind === 'reminder' ? new Date().toISOString() : invoice.lastReminderAt || null,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    step = 'audit';
    await writeAuditEvent({
      ownerId: authCtx.uid,
      actorUid: authCtx.uid,
      type: body.kind === 'reminder' ? 'reminder_sent' : 'email_sent',
      resourceType: 'invoice',
      resourceId: invoiceId,
      metadata: { invoiceId, recipientDomain, hasPdf: true },
    });
    return ok(res, { success: true, data: resendData });
  } catch (error: any) {
    const detail = safeEmailErrorDetail(error);
    console.error('[email] send-invoice failed', {
      uid: authCtx.uid,
      invoiceId,
      step,
      status: error?.status,
      code: error?.code,
      message: detail,
      recipientDomain,
      hasReplyTo: Boolean(replyTo),
      fromEmail,
    });
    return res.status(500).json({
      error: 'L’e-mail n’a pas pu être envoyé.',
      code: 'email_send_failed',
      detail,
    });
  }
}

function safeEmailErrorDetail(error: any) {
  const message = sanitizeText(error?.message || error?.code || 'Erreur serveur pendant l’envoi.', 240);
  if (!message) return 'Erreur serveur pendant l’envoi.';
  if (/api[_-]?key|token|secret|bearer/i.test(message)) return 'Erreur de configuration du service e-mail.';
  return message;
}

async function resolveClientEmail(db: any, invoice: any, ownerId: string): Promise<string | null> {
  const clientId = sanitizeText(invoice.clientId, 120);
  if (clientId) {
    const clientSnap = await db.collection('clients').doc(clientId).get();
    if (clientSnap.exists) {
      const client = clientSnap.data() as any;
      if (client.ownerId === ownerId && isEmail(client.email)) return client.email;
    }
  }
  const invoiceEmail = sanitizeText(invoice.clientEmail, 254);
  return isEmail(invoiceEmail) ? invoiceEmail : null;
}

function buildSubject(kind: string, invoice: any) {
  const number = sanitizeText(invoice.number || invoice.draftNumber || '', 80);
  const label = kind.charAt(0).toUpperCase() + kind.slice(1);
  return number ? `${label} ${number}` : `${label} Photofacto`;
}

function buildInvoiceEmailHtml(input: { kind: string; invoice: any; company: any; message: string }) {
  const { kind, invoice, company, message } = input;
  const companyName = sanitizeText(company.name || company.legalName || 'Votre artisan', 160);
  const clientName = sanitizeText(invoice.clientName || 'client', 160);
  const number = sanitizeText(invoice.number || invoice.draftNumber || 'sans numéro', 80);
  const amount = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(invoice.totalTTC || 0));
  const shareUrl = invoice.type === 'quote' && invoice.shareUrl ? sanitizeText(invoice.shareUrl, 1000) : '';
  const dueDate = formatEmailDate(invoice.dueDate);
  const date = formatEmailDate(invoice.date);
  const title = `${kind.charAt(0).toUpperCase()}${kind.slice(1)} ${number}`;
  return `
    <div style="margin:0;padding:0;background:#f8f5f1;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
      <div style="max-width:640px;margin:0 auto;padding:28px 18px">
        <div style="background:#ffffff;border:1px solid #eadfd4;border-radius:22px;overflow:hidden;box-shadow:0 14px 40px rgba(31,41,55,.08)">
          <div style="height:8px;background:#e95d18"></div>
          <div style="padding:30px 28px 22px">
            <p style="margin:0 0 12px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#e95d18;font-weight:700">Pièce jointe PDF</p>
            <h1 style="margin:0 0 12px;font-size:25px;line-height:1.2;color:#1c1917">${escapeHtml(title)}</h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#57534e">Bonjour ${escapeHtml(clientName)},</p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#57534e">
              ${message ? escapeHtml(message).replace(/\n/g, '<br/>') : `Votre ${escapeHtml(kind)} est disponible en PDF en pièce jointe.`}
            </p>

            <div style="border:1px solid #f0dfcf;border-radius:18px;background:#fff8f2;padding:18px 18px 4px;margin:0 0 24px">
              <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#e95d18">Récapitulatif</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;color:#44403c">
                <tr>
                  <td style="padding:8px 0;border-top:1px solid #f3e7dc">Document</td>
                  <td style="padding:8px 0;border-top:1px solid #f3e7dc;text-align:right;font-weight:700;color:#1c1917">${escapeHtml(number)}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-top:1px solid #f3e7dc">Date</td>
                  <td style="padding:8px 0;border-top:1px solid #f3e7dc;text-align:right">${escapeHtml(date)}</td>
                </tr>
                ${dueDate !== '-' ? `
                <tr>
                  <td style="padding:8px 0;border-top:1px solid #f3e7dc">Échéance</td>
                  <td style="padding:8px 0;border-top:1px solid #f3e7dc;text-align:right">${escapeHtml(dueDate)}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding:10px 0;border-top:1px solid #f3e7dc;font-weight:700">Montant TTC</td>
                  <td style="padding:10px 0;border-top:1px solid #f3e7dc;text-align:right;font-size:18px;font-weight:800;color:#e95d18">${escapeHtml(amount)}</td>
                </tr>
              </table>
            </div>

            ${shareUrl ? `<p style="margin:0 0 24px"><a href="${escapeHtml(shareUrl)}" style="display:inline-block;background:#e95d18;color:#ffffff;padding:13px 18px;border-radius:12px;text-decoration:none;font-weight:800">Voir et signer le devis</a></p>` : ''}
            <p style="margin:0;font-size:14px;line-height:1.6;color:#57534e">Le PDF joint a été généré automatiquement par Photofacto depuis les données du compte ${escapeHtml(companyName)}.</p>
          </div>
          <div style="padding:18px 28px;background:#faf7f3;border-top:1px solid #eadfd4">
            <p style="margin:0;font-size:13px;line-height:1.5;color:#78716c">Cordialement,<br/><strong style="color:#1c1917">${escapeHtml(companyName)}</strong></p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function formatEmailDate(value: unknown) {
  const time = Date.parse(String(value || ''));
  if (!Number.isFinite(time)) return '-';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(time));
}

function buildWelcomeHtml(firstName: string) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#1f2937;max-width:620px">
      <h1 style="margin:0 0 12px;color:#0f766e">Bienvenue sur Photofacto, ${escapeHtml(firstName)}</h1>
      <p>Votre compte est activé. Photofacto vous aide à préparer des devis et factures plus vite, avec une validation finale toujours entre vos mains.</p>
      <ol>
        <li>Complétez vos informations entreprise.</li>
        <li>Ajoutez vos clients et vos tarifs habituels.</li>
        <li>Créez votre premier document et vérifiez les lignes avant validation.</li>
      </ol>
      <p><a href="${escapeHtml(process.env.APP_URL || 'https://photofacto.fr')}/app/invoices/new" style="display:inline-block;background:#0f766e;color:white;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">Créer mon premier document</a></p>
      <p style="font-size:13px;color:#6b7280">Besoin d’aide ? Répondez simplement à cet email.</p>
    </div>
  `;
}
