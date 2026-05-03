import { requireAdmin, handleAdminAuthError } from './_lib/adminAuth.js';
import { ADMIN_ALLOWED_EVENTS, incrementCounter } from './_lib/adminSanitize.js';
import { fetchAdminPostHogOverview, type PostHogPeriod } from './_lib/adminPosthog.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await requireAdmin(req);
  } catch (error) {
    return handleAdminAuthError(res, error);
  }

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
