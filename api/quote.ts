import * as crypto from 'crypto';
import { verifyAuth } from './_lib/auth.js';
import { ensureFirebaseAdmin } from './_lib/firebaseAdmin.js';
import {
  applyCors,
  badRequest,
  conflict,
  forbidden,
  methodNotAllowed,
  notFound,
  ok,
  parseJsonBody,
  serverError,
  tooManyRequests,
  unauthorized,
} from './_lib/http.js';
import { checkRateLimit, getClientIp } from './_lib/rateLimit.js';
import { createShareToken, hashShareToken, safeCompare } from './_lib/quoteShare.js';
import { sendResendEmail } from './_lib/email.js';
import { writeAuditEvent } from './_lib/audit.js';
import { escapeHtml, isEmail, sanitizeText } from './_lib/validators.js';

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

  try {
    if (req.method === 'GET' && req.query?.action === 'public') return handlePublicQuote(req, res);
    if (req.method === 'POST') {
      const body = parseJsonBody(req);
      if (body.action === 'share') return handleShare(req, res, body);
      if (body.action === 'sign') return handleSign(req, res, body);
      return badRequest(res, 'Action devis invalide.');
    }
    return methodNotAllowed(res);
  } catch (error) {
    return serverError(res, error);
  }
}

async function handleShare(req: any, res: any, body: any) {
  let authCtx;
  try {
    authCtx = await verifyAuth(req);
  } catch (error: any) {
    return unauthorized(res, error?.message || 'Authentification requise.');
  }
  const limited = await checkRateLimit(`uid:quote-share:${authCtx.uid}`, 30, 60 * 60 * 1000);
  if (!limited.ok) return tooManyRequests(res, 'Trop de liens de signature créés récemment.');

  const invoiceId = sanitizeText(body.invoiceId, 120);
  if (!invoiceId) return badRequest(res, 'Devis manquant.');
  const { db } = ensureFirebaseAdmin();
  const invoiceRef = db.collection('invoices').doc(invoiceId);
  const invoiceSnap = await invoiceRef.get();
  if (!invoiceSnap.exists) return badRequest(res, 'Devis introuvable.');
  const invoice = invoiceSnap.data() as any;
  if (invoice.ownerId !== authCtx.uid) return forbidden(res, 'Vous ne pouvez pas partager ce devis.');
  if (invoice.type !== 'quote') return badRequest(res, 'Le lien de signature est réservé aux devis.');

  const companySnap = await db.collection('companies').doc(authCtx.uid).get();
  const company = companySnap.exists ? (companySnap.data() as any) : {};
  const token = createShareToken();
  const tokenHash = hashShareToken(token);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const shareRef = db.collection('sharedQuotes').doc();
  const baseUrl = (process.env.APP_URL || `${req.headers?.['x-forwarded-proto'] || 'https'}://${req.headers?.host || 'photofacto.fr'}`).replace(/\/$/, '');
  const shareUrl = `${baseUrl}/sign/${shareRef.id}?token=${encodeURIComponent(token)}`;
  const now = new Date().toISOString();

  await db.runTransaction(async tx => {
    tx.set(shareRef, {
      originalInvoiceId: invoiceId,
      quoteId: invoiceId,
      companyId: authCtx.uid,
      ownerId: authCtx.uid,
      tokenHash,
      number: invoice.number || '',
      clientName: invoice.clientName || '',
      clientEmail: invoice.clientEmail || '',
      date: invoice.date || '',
      dueDate: invoice.dueDate || '',
      items: Array.isArray(invoice.items) ? invoice.items : [],
      totalHT: Number(invoice.totalHT || 0),
      totalTTC: Number(invoice.totalTTC || 0),
      totalVAT: Number(invoice.totalVAT || 0),
      vatRegime: invoice.vatRegime || 'standard',
      notes: invoice.notes || '',
      companyName: company.name || company.legalName || '',
      companyAddress: company.address || '',
      companyEmail: company.email || authCtx.email || '',
      companyPhone: company.phone || '',
      companySiret: company.siret || '',
      status: 'pending_signature',
      createdAt: now,
      expiresAt,
      signedAt: null,
    });
    tx.update(invoiceRef, { shareUrl, sharedQuoteId: shareRef.id, updatedAt: now });
  });

  await writeAuditEvent({
    ownerId: authCtx.uid,
    actorUid: authCtx.uid,
    type: 'quote_shared',
    resourceType: 'invoice',
    resourceId: invoiceId,
    metadata: { shareId: shareRef.id, expiresAt },
  });
  return ok(res, { shareUrl, shareId: shareRef.id, expiresAt });
}

async function handlePublicQuote(req: any, res: any) {
  const ip = getClientIp(req);
  const limited = await checkRateLimit(`ip:quote-public:${ip}`, 60, 60 * 60 * 1000);
  if (!limited.ok) return tooManyRequests(res, 'Trop de tentatives. Réessayez plus tard.');

  const shareId = sanitizeText(req.query?.shareId, 160);
  const token = sanitizeText(req.query?.token, 500);
  if (!shareId || !token) return badRequest(res, 'Lien de signature incomplet.');

  const { db } = ensureFirebaseAdmin();
  const snap = await db.collection('sharedQuotes').doc(shareId).get();
  if (!snap.exists) return notFound(res, 'Ce lien de signature est invalide.');
  const shared = snap.data() as any;
  if (!shared.tokenHash || !safeCompare(hashShareToken(token), shared.tokenHash)) {
    return notFound(res, 'Ce lien de signature est invalide.');
  }
  const expiresAt = Date.parse(shared.expiresAt || '');
  if (Number.isFinite(expiresAt) && expiresAt < Date.now() && !shared.signedAt) {
    return conflict(res, 'Ce lien a expiré, demandez un nouveau lien.');
  }
  if (!['pending_signature', 'accepted'].includes(shared.status)) {
    return conflict(res, 'Ce devis ne peut plus être signé.');
  }
  return ok(res, {
    quote: {
      number: shared.number || '',
      clientName: shared.clientName || '',
      clientEmail: shared.clientEmail || '',
      date: shared.date || '',
      dueDate: shared.dueDate || '',
      items: Array.isArray(shared.items) ? shared.items : [],
      totalHT: Number(shared.totalHT || 0),
      totalTTC: Number(shared.totalTTC || 0),
      totalVAT: Number(shared.totalVAT || 0),
      companyName: shared.companyName || '',
      companyAddress: shared.companyAddress || '',
      companyEmail: shared.companyEmail || '',
      companyPhone: shared.companyPhone || '',
      companySiret: shared.companySiret || '',
      notes: shared.notes || '',
      vatRegime: shared.vatRegime || 'standard',
      signature: shared.signature || '',
      signedAt: shared.signedAt || '',
      signedByName: shared.signedByName || '',
      status: shared.status || 'pending_signature',
      originalInvoiceId: shared.originalInvoiceId || '',
    },
  });
}

async function handleSign(req: any, res: any, body: any) {
  const ip = getClientIp(req);
  const limited = await checkRateLimit(`ip:quote-sign:${ip}`, 20, 60 * 60 * 1000);
  if (!limited.ok) return tooManyRequests(res, 'Trop de tentatives de signature. Réessayez plus tard.');

  const quoteId = sanitizeText(body.quoteId || body.shareId, 160);
  const token = sanitizeText(body.token, 500);
  const signerName = sanitizeText(body.signerName, 120);
  const signatureDataUrl = typeof body.signatureDataUrl === 'string' ? body.signatureDataUrl : '';
  if (!quoteId || !token || !signerName || !signatureDataUrl) return badRequest(res, 'Lien, nom du signataire et signature requis.');
  if (!signatureDataUrl.startsWith('data:image/png;base64,')) return badRequest(res, 'Format de signature invalide.');
  if (signatureDataUrl.length > 2_500_000) return res.status(413).json({ error: 'Signature trop lourde.' });

  const { db } = ensureFirebaseAdmin();
  const nowIso = new Date().toISOString();
  const sharedRef = db.collection('sharedQuotes').doc(quoteId);
  const ipHash = hashIp(ip);
  const userAgent = sanitizeText(req.headers?.['user-agent'], 300);

  try {
    const result = await db.runTransaction(async tx => {
      const sharedSnap = await tx.get(sharedRef);
      if (!sharedSnap.exists) throw withStatus(new Error('Ce lien de signature est invalide.'), 404);
      const shared = sharedSnap.data() as any;
      if (!shared.tokenHash || !safeCompare(hashShareToken(token), shared.tokenHash)) {
        throw withStatus(new Error('Ce lien de signature est invalide.'), 404);
      }
      const expiresAt = Date.parse(shared.expiresAt || '');
      if (Number.isFinite(expiresAt) && expiresAt < Date.now()) throw withStatus(new Error('Ce lien a expiré, demandez un nouveau lien.'), 409);
      if (shared.signedAt || shared.status === 'accepted') throw withStatus(new Error('Ce devis a déjà été signé.'), 409);
      if (shared.status !== 'pending_signature') throw withStatus(new Error('Ce devis ne peut plus être signé.'), 409);

      const invoiceId = shared.originalInvoiceId || shared.quoteId;
      const ownerId = shared.ownerId;
      if (!invoiceId || !ownerId) throw withStatus(new Error('Lien de signature incomplet.'), 400);
      const invoiceRef = db.collection('invoices').doc(invoiceId);
      const invoiceSnap = await tx.get(invoiceRef);
      if (!invoiceSnap.exists) throw withStatus(new Error('Devis introuvable.'), 404);
      const invoice = invoiceSnap.data() as any;
      if (invoice.ownerId !== ownerId || invoice.type !== 'quote') throw withStatus(new Error('Lien de signature invalide.'), 403);

      const proof = {
        signedAt: nowIso,
        signerName,
        ipHash,
        userAgent,
        consentText: 'Le signataire accepte le devis et autorise l’enregistrement de sa signature.',
      };
      tx.update(sharedRef, { signature: signatureDataUrl, signedAt: nowIso, signedByName: signerName, status: 'accepted', proof });
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
        metadata: { shareId: quoteId, signerName, ipHash, clientName: shared.clientName || '' },
      });
      return {
        invoiceId,
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
    return ok(res, { ok: true, signedAt: nowIso, notification, invoiceId: result.invoiceId });
  } catch (error: any) {
    if (error?.status === 400) return badRequest(res, error.message);
    if (error?.status === 404) return notFound(res, error.message);
    if (error?.status === 409) return conflict(res, error.message);
    if (error?.status === 403) return res.status(403).json({ error: error.message });
    throw error;
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
  } catch {
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
  return crypto.createHash('sha256').update(`${process.env.AUDIT_IP_SALT || 'photofacto'}:${ip}`).digest('hex').slice(0, 32);
}

function withStatus(error: Error, status: number) {
  (error as any).status = status;
  return error;
}
