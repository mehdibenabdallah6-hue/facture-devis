import { requireAdmin, handleAdminAuthError } from './_lib/adminAuth.js';
import { ensureFirebaseAdmin } from './_firebase-admin.js';
import {
  anonymizeId,
  bucketCount,
  monthBucket,
  safePlan,
  safeProfession,
  safeSubscriptionStatus,
} from './_lib/adminSanitize.js';

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
    const snap = await db.collection('companies').limit(200).get();
    const users = snap.docs.map((doc: any) => {
      const data = doc.data() || {};
      return {
        userKey: anonymizeId(doc.id),
        createdMonth: monthBucket(data.createdAt),
        plan: safePlan(data.plan),
        subscriptionStatus: safeSubscriptionStatus(data.subscriptionStatus),
        profession: safeProfession(data.profession),
        invoiceUsageBucket: bucketCount(data.monthlyInvoiceCount),
        aiUsageBucket: bucketCount(data.monthlyAiUsageCount),
      };
    });

    return res.status(200).json({ ok: true, users });
  } catch (error) {
    console.error('admin-users failed:', error);
    return res.status(500).json({ error: 'Impossible de charger les utilisateurs admin.' });
  }
}
