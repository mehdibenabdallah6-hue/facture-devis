import * as crypto from 'crypto';
import { ensureFirebaseAdmin } from './_lib/firebaseAdmin.js';
import {
  applyCors,
  badRequest,
  conflict,
  methodNotAllowed,
  notFound,
  ok,
  parseJsonBody,
  serverError,
  tooManyRequests,
} from './_lib/http.js';
import { checkRateLimit, getClientIp } from './_lib/rateLimit.js';
import { sendResendEmail } from './_lib/email.js';
import { escapeHtml, isEmail, sanitizeText } from './_lib/validators.js';
import { hashShareToken, safeCompare } from './_lib/quoteShare.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '3mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const clientIp = getClientIp(req);
    const limited = await checkRateLimit(`ip:quote-sign:${clientIp}`, 10, 10 * 60 * 1000);
    if (!limited.ok) return tooManyRequests(res, 'Trop de tentatives de signature. Réessayez plus tard.');

    const body = parseJsonBody(req);
    const quoteId = sanitizeText(body.quoteId || body.shareId, 160);
    const token = sanitizeText(body.token, 500);
    const signerName = sanitizeText(body.signerName, 120);
    const signatureDataUrl = typeof body.signatureDataUrl === 'string' ? body.signatureDataUrl : '';

    if (!quoteId || !token || !signerName || !signatureDataUrl) {
      return badRequest(res, 'Lien, nom du signataire et signature requis.');
    }
    if (!signatureDataUrl.startsWith('data:image/png;base64,')) {
      return badRequest(res, 'Format de signature invalide.');
    }
    if (signatureDataUrl.length > 2_500_000) {
      return res.status(413).json({ error: 'Signature trop lourde.' });
    }

    const { db } = ensureFirebaseAdmin();
    const nowIso = new Date().toISOString();
    const sharedRef = db.collection('sharedQuotes').doc(quoteId);
    const ipHash = hashIp(clientIp);
    const userAgent = sanitizeText(req.headers?.['user-agent'], 300);

    const result = await db.runTransaction(async tx => {
      const sharedSnap = await tx.get(sharedRef);
      if (!sharedSnap.exists) throw withStatus(new Error('Ce lien de signature est invalide.'), 404);

      const shared = sharedSnap.data() as any;
      if (!shared.tokenHash || !safeCompare(hashShareToken(token), shared.tokenHash)) {
        throw withStatus(new Error('Ce lien de signature est invalide.'), 404);
      }
      const expiresAt = Date.parse(shared.expiresAt || '');
      if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
        throw withStatus(new Error('Ce lien a expiré, demandez un nouveau lien.'), 409);
      }
      if (shared.signedAt || shared.status === 'accepted') {
        throw withStatus(new Error('Ce devis a déjà été signé.'), 409);
      }
      if (shared.status !== 'pending_signature') {
        throw withStatus(new Error('Ce devis ne peut plus être signé.'), 409);
      }

      const invoiceId = shared.originalInvoiceId || shared.quoteId;
      const ownerId = shared.ownerId;
      if (!invoiceId || !ownerId) throw withStatus(new Error('Lien de signature incomplet.'), 400);

      const invoiceRef = db.collection('invoices').doc(invoiceId);
      const invoiceSnap = await tx.get(invoiceRef);
      if (!invoiceSnap.exists) throw withStatus(new Error('Devis introuvable.'), 404);
      const invoice = invoiceSnap.data() as any;
      if (invoice.ownerId !== ownerId || invoice.type !== 'quote') {
        throw withStatus(new Error('Lien de signature invalide.'), 403);
      }

      const proof = {
        signedAt: nowIso,
        signerName,
        ipHash,
        userAgent,
        consentText: 'Le signataire accepte le devis et autorise l’enregistrement de sa signature.',
      };

      tx.update(sharedRef, {
        signature: signatureDataUrl,
        signedAt: nowIso,
        signedByName: signerName,
        status: 'accepted',
        proof,
      });

      tx.update(invoiceRef, {
        status: 'accepted',
        signature: signatureDataUrl,
        signedAt: nowIso,
        signedByName: signerName,
        signatureProof: proof,
        updatedAt: nowIso,
      });

      tx.set(db.collection('invoiceEvents').doc(), {
        invoiceId,
        companyId: ownerId,
        ownerId,
        actorId: `public:${quoteId}`,
        type: 'quote_signed',
        resourceType: 'invoice',
        resourceId: invoiceId,
        timestamp: nowIso,
        metadata: {
          shareId: quoteId,
          signerName,
          ipHash,
          clientName: shared.clientName || '',
        },
      });

      return {
        invoiceId,
        ownerId,
        number: shared.number || invoice.number || '',
        clientName: shared.clientName || invoice.clientName || '',
        companyName: shared.companyName || '',
        companyEmail: shared.companyEmail || '',
        totalTTC: Number(shared.totalTTC || invoice.totalTTC || 0),
      };
    });

    const notification = await sendSignatureNotification({
      to: result.companyEmail,
      companyName: result.companyName,
      clientName: result.clientName,
      signerName,
      quoteNumber: result.number,
      totalTTC: result.totalTTC,
    });

    return ok(res, {
      ok: true,
      signedAt: nowIso,
      notification,
      invoiceId: result.invoiceId,
    });
  } catch (error: any) {
    if (error?.status === 400) return badRequest(res, error.message);
    if (error?.status === 404) return notFound(res, error.message);
    if (error?.status === 409) return conflict(res, error.message);
    if (error?.status === 403) return res.status(403).json({ error: error.message });
    return serverError(res, error);
  }
}

async function sendSignatureNotification(opts: {
  to: string;
  companyName: string;
  clientName: string;
  signerName: string;
  quoteNumber: string;
  totalTTC: number;
}) {
  if (!isEmail(opts.to)) return { sent: false, reason: 'missing_company_email' };
  try {
    await sendResendEmail({
      fromName: 'Photofacto',
      to: [opts.to],
      subject: `Devis ${opts.quoteNumber || ''} signé par ${opts.signerName}`.trim(),
      html: buildNotificationHtml(opts),
    });
    return { sent: true };
  } catch (error: any) {
    console.error('quote-sign: notification failed', error?.message || error);
    return { sent: false, reason: 'resend_error' };
  }
}

function buildNotificationHtml(opts: {
  companyName: string;
  clientName: string;
  signerName: string;
  quoteNumber: string;
  totalTTC: number;
}) {
  const amount = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(opts.totalTTC || 0);
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937;max-width:560px">
      <p>Bonjour ${escapeHtml(opts.companyName || 'Votre entreprise')},</p>
      <h2 style="margin:0 0 12px;color:#111827">Votre devis a été signé</h2>
      <p>Le devis <strong>${escapeHtml(opts.quoteNumber || 'sans numéro')}</strong> a été signé par <strong>${escapeHtml(opts.signerName)}</strong>.</p>
      <ul>
        <li><strong>Client :</strong> ${escapeHtml(opts.clientName || 'Client')}</li>
        <li><strong>Montant :</strong> ${amount}</li>
      </ul>
      <p>La signature a été ajoutée automatiquement au devis dans Photofacto.</p>
    </div>
  `;
}

function hashIp(ip: string) {
  return crypto
    .createHash('sha256')
    .update(`${process.env.AUDIT_IP_SALT || 'photofacto'}:${ip}`)
    .digest('hex')
    .slice(0, 32);
}

function withStatus(error: Error, status: number) {
  (error as any).status = status;
  return error;
}
