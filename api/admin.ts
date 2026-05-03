import { requireAdmin, handleAdminAuthError } from './_lib/adminAuth.js';
import { ensureFirebaseAdmin } from './_firebase-admin.js';
import {
  ADMIN_ALLOWED_EVENTS,
  anonymizeId,
  bucketCount,
  incrementCounter,
  monthBucket,
  safeDocumentStatus,
  safePlan,
  safeProfession,
  safeSubscriptionStatus,
  sanitizeErrorType,
} from './_lib/adminSanitize.js';

type AdminResource = 'summary' | 'users' | 'events' | 'errors';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await requireAdmin(req);
  } catch (error) {
    return handleAdminAuthError(res, error);
  }

  const resource = getResource(req);
  if (!resource) {
    return res.status(404).json({ error: 'Route admin inconnue.' });
  }

  if (resource === 'summary') return adminSummary(res);
  if (resource === 'users') return adminUsers(res);
  if (resource === 'events') return adminEvents(res);
  return adminErrors(res);
}

function getResource(req: any): AdminResource | null {
  const queryResource = String(req.query?.resource || '').toLowerCase();
  if (isAdminResource(queryResource)) return queryResource;

  const url = String(req.url || '');
  if (url.includes('/admin-summary')) return 'summary';
  if (url.includes('/admin-users')) return 'users';
  if (url.includes('/admin-events')) return 'events';
  if (url.includes('/admin-errors')) return 'errors';
  return null;
}

function isAdminResource(value: string): value is AdminResource {
  return value === 'summary' || value === 'users' || value === 'events' || value === 'errors';
}

async function adminSummary(res: any) {
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

async function adminUsers(res: any) {
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

async function adminEvents(res: any) {
  const projectId = process.env.POSTHOG_PROJECT_ID;
  const personalKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const host = process.env.POSTHOG_HOST || 'https://eu.posthog.com';
  if (!projectId || !personalKey) {
    return res.status(200).json({
      ok: true,
      configured: false,
      events: ADMIN_ALLOWED_EVENTS.map(event => ({ event, count: 0 })),
    });
  }

  try {
    const response = await fetch(`${host.replace(/\/$/, '')}/api/projects/${encodeURIComponent(projectId)}/events/?limit=200`, {
      headers: { Authorization: `Bearer ${personalKey}` },
    });
    if (!response.ok) {
      throw new Error(`PostHog API failed (${response.status})`);
    }
    const payload = await response.json().catch(() => null);
    const counts: Record<string, number> = {};
    const allowed = new Set<string>(ADMIN_ALLOWED_EVENTS);
    const rows = Array.isArray(payload?.results) ? payload.results : [];
    rows.forEach((row: any) => {
      const event = String(row?.event || row?.name || '');
      if (allowed.has(event)) incrementCounter(counts, event);
    });

    return res.status(200).json({
      ok: true,
      configured: true,
      events: ADMIN_ALLOWED_EVENTS.map(event => ({ event, count: counts[event] || 0 })),
    });
  } catch (error) {
    console.error('admin-events failed:', error);
    return res.status(200).json({
      ok: true,
      configured: false,
      events: ADMIN_ALLOWED_EVENTS.map(event => ({ event, count: 0 })),
      warning: 'PostHog indisponible ou non configuré côté serveur.',
    });
  }
}

async function adminErrors(res: any) {
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
