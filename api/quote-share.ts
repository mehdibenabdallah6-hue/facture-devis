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
import { createShareToken, hashShareToken } from './_lib/quoteShare.js';
import { sanitizeText } from './_lib/validators.js';
import { writeAuditEvent } from './_lib/audit.js';

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
    const limited = await checkRateLimit(`uid:quote-share:${authCtx.uid}`, 30, 60 * 60 * 1000);
    if (!limited.ok) return tooManyRequests(res, 'Trop de liens de signature créés récemment.');

    const body = parseJsonBody(req);
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
      tx.update(invoiceRef, {
        shareUrl,
        sharedQuoteId: shareRef.id,
        updatedAt: now,
      });
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
  } catch (error) {
    return serverError(res, error);
  }
}
