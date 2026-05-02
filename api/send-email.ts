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
import { checkRateLimit } from './_lib/rateLimit.js';
import { sendResendEmail } from './_lib/email.js';
import { escapeHtml, isEmail, sanitizeText } from './_lib/validators.js';
import { writeAuditEvent } from './_lib/audit.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return methodNotAllowed(res);

  let authCtx;
  try {
    authCtx = await verifyAuth(req);
  } catch (error: any) {
    return unauthorized(res, error?.message || 'Authentification requise.');
  }

  try {
    const limited = await checkRateLimit(`uid:invoice-email:${authCtx.uid}`, 20, 60 * 60 * 1000);
    if (!limited.ok) return tooManyRequests(res, 'Trop d’e-mails envoyés récemment. Réessayez plus tard.');

    const body = parseJsonBody(req);
    const invoiceId = sanitizeText(body.invoiceId, 120);
    const optionalMessage = sanitizeText(body.message, 900);
    const sendCopyToMe = body.sendCopyToMe === true;
    const requestedTo = sanitizeText(body.to, 254).toLowerCase();
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];

    if (!invoiceId) return badRequest(res, 'Document manquant pour l’envoi.');
    if (attachments.length > 0) {
      return badRequest(res, 'Les pièces jointes envoyées depuis le navigateur ne sont pas autorisées.');
    }

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
    const subject = buildSubject(kind, invoice);
    const html = buildInvoiceEmailHtml({
      kind,
      invoice,
      company,
      message: optionalMessage,
    });

    const resendData = await sendResendEmail({
      to: recipients,
      subject,
      html,
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
      metadata: {
        invoiceId,
        recipientDomain: clientEmail.split('@')[1] || '',
        hasPdf: false,
      },
    });

    return ok(res, { success: true, data: resendData });
  } catch (error: any) {
    if (error?.status === 429) return tooManyRequests(res);
    if (error?.status === 401) return unauthorized(res);
    if (error?.status === 403) return forbidden(res);
    if (error?.message?.includes('RESEND_API_KEY')) {
      return serverError(res, new Error('RESEND_API_KEY missing'));
    }
    if (error?.message) {
      return res.status(error.status || 500).json({ error: humanResendError(error.message) });
    }
    return serverError(res, error);
  }
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

function humanResendError(detail: string): string {
  const lower = String(detail || '').toLowerCase();
  if (lower.includes('domain') && (lower.includes('verify') || lower.includes('verified'))) {
    return 'Le domaine d’envoi Resend n’est pas encore vérifié. Vérifiez RESEND_FROM_EMAIL / le domaine dans Resend.';
  }
  if (lower.includes('api key') || lower.includes('unauthorized')) {
    return 'La clé Resend est invalide ou non autorisée.';
  }
  if (lower.includes('to') || lower.includes('recipient') || lower.includes('email')) {
    return 'Adresse e-mail destinataire invalide ou refusée par Resend.';
  }
  if (lower.includes('attachment')) {
    return 'La pièce jointe PDF est invalide ou trop lourde pour l’envoi.';
  }
  return detail || 'Resend a refusé l’envoi de l’e-mail.';
}
