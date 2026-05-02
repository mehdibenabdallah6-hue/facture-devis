import {
  applyCors,
  badRequest,
  conflict,
  methodNotAllowed,
  notFound,
  ok,
  serverError,
  tooManyRequests,
} from './_lib/http.js';
import { ensureFirebaseAdmin } from './_lib/firebaseAdmin.js';
import { checkRateLimit, getClientIp } from './_lib/rateLimit.js';
import { hashShareToken, safeCompare } from './_lib/quoteShare.js';
import { sanitizeText } from './_lib/validators.js';

export default async function handler(req: any, res: any) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return methodNotAllowed(res);

  const shareId = sanitizeText(req.query?.shareId, 160);
  const token = sanitizeText(req.query?.token, 500);
  if (!shareId || !token) return badRequest(res, 'Lien de signature incomplet.');

  try {
    const limited = await checkRateLimit(`ip:quote-public:${getClientIp(req)}`, 30, 10 * 60 * 1000);
    if (!limited.ok) return tooManyRequests(res, 'Trop de tentatives. Réessayez plus tard.');

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
  } catch (error) {
    return serverError(res, error);
  }
}
