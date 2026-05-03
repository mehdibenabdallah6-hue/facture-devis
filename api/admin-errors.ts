import { requireAdmin, handleAdminAuthError } from './_lib/adminAuth.js';
import { ensureFirebaseAdmin } from './_firebase-admin.js';
import { incrementCounter, monthBucket, sanitizeErrorType } from './_lib/adminSanitize.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await requireAdmin(req);
  } catch (error) {
    return handleAdminAuthError(res, error);
  }

  try {
    const { db } = ensureFirebaseAdmin();
    const snap = await db.collection('auditTrail').limit(300).get();
    const byType: Record<string, number> = {};
    const byMonth: Record<string, number> = {};

    snap.docs.forEach((doc: any) => {
      const data = doc.data() || {};
      const type = String(data.type || '');
      if (!/(failed|error|quota_exceeded)/i.test(type)) return;
      incrementCounter(byType, sanitizeErrorType(type));
      incrementCounter(byMonth, monthBucket(data.createdAt || data.timestamp));
    });

    return res.status(200).json({
      ok: true,
      errors: Object.entries(byType).map(([type, count]) => ({ type, count })),
      byMonth,
    });
  } catch (error) {
    console.error('admin-errors failed:', error);
    return res.status(200).json({
      ok: true,
      errors: [],
      byMonth: {},
      warning: 'Aucune source erreurs agrégée disponible pour le moment.',
    });
  }
}
