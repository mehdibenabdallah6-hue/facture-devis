import { ensureFirebaseAdmin } from './_firebase-admin.js';
import { requireAdmin, handleAdminAuthError } from './_lib/adminAuth.js';
import { buildAdminSummary, loadAdminDataset } from './_lib/adminMetrics.js';
import { fetchAdminPostHogOverview } from './_lib/adminPosthog.js';

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
    const [dataset, posthog] = await Promise.all([
      loadAdminDataset(db, auth),
      fetchAdminPostHogOverview(),
    ]);

    return res.status(200).json({
      ok: true,
      ...buildAdminSummary(dataset, posthog),
    });
  } catch (error) {
    console.error('admin-summary failed:', error);
    return res.status(500).json({ error: 'Impossible de charger le résumé admin.' });
  }
}
