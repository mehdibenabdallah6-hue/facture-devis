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
import { buildContactHtml, sendResendEmail } from './_lib/email.js';
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
    if (action === 'contact') return handleContact(req, res, body);
    if (action === 'welcome') return handleWelcome(req, res, body);
    if (action === 'send-invoice') return handleInvoiceEmail(req, res, body);
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
  let authCtx;
  try {
    authCtx = await verifyAuth(req);
  } catch (error: any) {
    return unauthorized(res, error?.message || 'Authentification requise.');
  }

  const limited = await checkRateLimit(`uid:invoice-email:${authCtx.uid}`, 20, 60 * 60 * 1000);
  if (!limited.ok) return tooManyRequests(res, 'Trop d’e-mails envoyés récemment. Réessayez plus tard.');
  if (Array.isArray(body.attachments) && body.attachments.length > 0) {
    return badRequest(res, 'Les pièces jointes envoyées depuis le navigateur ne sont pas acceptées.');
  }

  const invoiceId = sanitizeText(body.invoiceId, 120);
  const requestedTo = sanitizeText(body.to, 254).toLowerCase();
  const optionalMessage = sanitizeText(body.message, 900);
  const sendCopyToMe = body.sendCopyToMe === true;
  if (!invoiceId) return badRequest(res, 'Document manquant pour l’envoi.');

  const { db } = ensureFirebaseAdmin();
  const invoiceRef = db.collection('invoices').doc(invoiceId);
  const invoiceSnap = await invoiceRef.get();
  if (!invoiceSnap.exists) return badRequest(res, 'Document introuvable.');
  const invoice = invoiceSnap.data() as any;
  if (invoice.ownerId !== authCtx.uid) return forbidden(res, 'Vous ne pouvez pas envoyer ce document.');

  const companySnap = await db.collection('companies').doc(authCtx.uid).get();
  const company = companySnap.exists ? (companySnap.data() as any) : {};
  const clientEmail = await resolveClientEmail(db, invoice, authCtx.uid);
  if (!clientEmail) return badRequest(res, 'Ajoutez un e-mail valide au client avant l’envoi.');
  if (requestedTo && requestedTo !== clientEmail.toLowerCase()) {
    return forbidden(res, 'Le destinataire doit être l’e-mail du client lié au document.');
  }

  const recipients = [clientEmail];
  if (sendCopyToMe && isEmail(authCtx.email)) recipients.push(authCtx.email);
  const kind = invoice.type === 'quote' ? 'devis' : invoice.type === 'credit' ? 'avoir' : 'facture';
  const resendData = await sendResendEmail({
    to: recipients,
    subject: buildSubject(kind, invoice),
    html: buildInvoiceEmailHtml({ kind, invoice, company, message: optionalMessage }),
    fromName: company.name || company.legalName || authCtx.email || 'Photofacto',
    replyTo: isEmail(company.email) ? company.email : authCtx.email,
  });

  await invoiceRef.set({
    emailSentAt: new Date().toISOString(),
    lastReminderAt: body.kind === 'reminder' ? new Date().toISOString() : invoice.lastReminderAt || null,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  await writeAuditEvent({
    ownerId: authCtx.uid,
    actorUid: authCtx.uid,
    type: body.kind === 'reminder' ? 'reminder_sent' : 'email_sent',
    resourceType: 'invoice',
    resourceId: invoiceId,
    metadata: { invoiceId, recipientDomain: clientEmail.split('@')[1] || '', hasPdf: false },
  });
  return ok(res, { success: true, data: resendData });
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
  const companyName = escapeHtml(company.name || company.legalName || 'Votre artisan');
  const clientName = escapeHtml(invoice.clientName || 'Bonjour');
  const number = escapeHtml(invoice.number || invoice.draftNumber || 'sans numéro');
  const amount = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(invoice.totalTTC || 0));
  const shareUrl = invoice.type === 'quote' && invoice.shareUrl ? sanitizeText(invoice.shareUrl, 1000) : '';
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937;max-width:620px">
      <p>Bonjour ${clientName},</p>
      <p>${message ? escapeHtml(message).replace(/\n/g, '<br/>') : `Veuillez trouver votre ${escapeHtml(kind)} ${number}.`}</p>
      <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:18px 0;background:#f9fafb">
        <p style="margin:0 0 8px"><strong>${escapeHtml(kind.toUpperCase())} :</strong> ${number}</p>
        <p style="margin:0"><strong>Montant :</strong> ${amount}</p>
      </div>
      ${shareUrl ? `<p><a href="${escapeHtml(shareUrl)}" style="display:inline-block;background:#0f766e;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Voir et signer le devis</a></p>` : ''}
      <p>Cordialement,<br/>${companyName}</p>
    </div>
  `;
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
