import { ensureFirebaseAdmin } from './_firebase-admin.js';
import { requireAdmin, handleAdminAuthError } from './_lib/adminAuth.js';
import { buildAdminErrors, buildAdminSummary, loadAdminDataset } from './_lib/adminMetrics.js';
import { buildAdminUserRows } from './_lib/adminUsers.js';
import { fetchAdminPostHogOverview, type PostHogPeriod } from './_lib/adminPosthog.js';
import { ADMIN_ALLOWED_EVENTS, incrementCounter } from './_lib/adminSanitize.js';

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

  const resource = getAdminResource(req);
  if (!resource) {
    return res.status(404).json({ error: 'Route admin inconnue.' });
  }

  if (resource === 'summary') return adminSummary(res);
  if (resource === 'users') return adminUsers(res);
  if (resource === 'events') return adminEvents(req, res);
  return adminErrors(res);
}

async function adminSummary(res: any) {
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

async function adminUsers(res: any) {
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

async function adminEvents(req: any, res: any) {
  const event = sanitizeEventQuery(req.query?.event);
  const period = sanitizePeriodQuery(req.query?.period);

  try {
    const posthog = await fetchAdminPostHogOverview({ event, period });
    return res.status(200).json({
      ok: true,
      configured: posthog.configured,
      warning: posthog.warning || '',
      events: posthog.counts7d,
      top24h: posthog.counts24h.filter(row => row.count > 0).slice(0, 12),
      top7d: posthog.counts7d.filter(row => row.count > 0).slice(0, 12),
      top30d: posthog.counts30d.filter(row => row.count > 0).slice(0, 12),
      grouped: countRecentByEvent(posthog.recent),
      recent: posthog.recent,
    });
  } catch (error) {
    console.error('admin-events failed:', error);
    return res.status(200).json({
      ok: true,
      configured: false,
      warning: 'PostHog indisponible ou non configuré côté serveur.',
      events: ADMIN_ALLOWED_EVENTS.map(name => ({ event: name, count: 0, users: 0 })),
      top24h: [],
      top7d: [],
      top30d: [],
      grouped: {},
      recent: [],
    });
  }
}

async function adminErrors(res: any) {
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

function getAdminResource(req: any): AdminResource | null {
  const queryResource = String(req.query?.adminResource || req.query?.resource || '').toLowerCase();
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

function sanitizeEventQuery(value: unknown): string | undefined {
  const event = String(Array.isArray(value) ? value[0] : value || '');
  return ADMIN_ALLOWED_EVENTS.includes(event as any) ? event : undefined;
}

function sanitizePeriodQuery(value: unknown): PostHogPeriod {
  const period = String(Array.isArray(value) ? value[0] : value || '7d');
  return period === '24h' || period === '30d' ? period : '7d';
}

function countRecentByEvent(rows: Array<{ event: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  rows.forEach(row => incrementCounter(counts, row.event));
  return counts;
}
