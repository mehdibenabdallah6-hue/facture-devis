import { ensureFirebaseAdmin } from './_firebase-admin.js';
import { requireAdmin, handleAdminAuthError } from './_lib/adminAuth.js';
import { buildAdminErrors, loadAdminDataset } from './_lib/adminMetrics.js';

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
    const { db, auth } = ensureFirebaseAdmin();
    const dataset = await loadAdminDataset(db, auth);
    const errors = buildAdminErrors(dataset);
    return res.status(200).json({
      ok: true,
      ...errors,
      warning: errors.recent.length === 0 ? 'Aucune erreur agrégée disponible pour le moment.' : '',
    });
  } catch (error) {
    console.error('admin-errors failed:', error);
    return res.status(200).json({
      ok: true,
      recent: [],
      byType: {},
      byRoute: {},
      bySeverity: {},
      affectedUsers: 0,
      warning: 'Aucune source erreurs agrégée disponible pour le moment.',
    });
  }
}
