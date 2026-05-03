import { ensureFirebaseAdmin } from './_firebase-admin.js';
import { requireAdmin, handleAdminAuthError } from './_lib/adminAuth.js';
import { loadAdminDataset } from './_lib/adminMetrics.js';
import { buildAdminUserRows } from './_lib/adminUsers.js';
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
    const users = buildAdminUserRows(dataset, posthog).slice(0, 500);
    return res.status(200).json({
      ok: true,
      users,
      posthog: {
        configured: posthog.configured,
        warning: posthog.warning || '',
      },
    });
  } catch (error) {
    console.error('admin-users failed:', error);
    return res.status(500).json({ error: 'Impossible de charger les utilisateurs admin.' });
  }
}
