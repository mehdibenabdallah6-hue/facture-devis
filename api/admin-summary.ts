import { requireAdmin, handleAdminAuthError } from './_lib/adminAuth.js';
import { ensureFirebaseAdmin } from './_firebase-admin.js';
import {
  incrementCounter,
  safeDocumentStatus,
  safePlan,
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
    const [companiesSnap, invoicesSnap] = await Promise.all([
      db.collection('companies').limit(1000).get(),
      db.collection('invoices').limit(5000).get(),
    ]);

    const plans: Record<string, number> = {};
    const subscriptions: Record<string, number> = {};
    companiesSnap.docs.forEach((doc: any) => {
      const data = doc.data() || {};
      incrementCounter(plans, safePlan(data.plan));
      incrementCounter(subscriptions, safeSubscriptionStatus(data.subscriptionStatus));
    });

    const documentsByType: Record<string, number> = {};
    const documentsByStatus: Record<string, number> = {};
    invoicesSnap.docs.forEach((doc: any) => {
      const data = doc.data() || {};
      const type = data.type === 'quote' ? 'quote' : data.type === 'credit' ? 'credit' : 'invoice';
      incrementCounter(documentsByType, type);
      incrementCounter(documentsByStatus, safeDocumentStatus(data.status));
    });

    return res.status(200).json({
      ok: true,
      users: {
        total: companiesSnap.size,
        plans,
        subscriptions,
      },
      documents: {
        total: invoicesSnap.size,
        byType: documentsByType,
        byStatus: documentsByStatus,
      },
    });
  } catch (error) {
    console.error('admin-summary failed:', error);
    return res.status(500).json({ error: 'Impossible de charger le résumé admin.' });
  }
}
