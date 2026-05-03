import { ADMIN_ALLOWED_EVENTS, anonymizeId, incrementCounter, safeIsoDate } from './adminSanitize.js';

export type PostHogPeriod = '24h' | '7d' | '30d';

export type AdminPostHogEventCount = {
  event: string;
  count: number;
  users: number;
};

export type AdminPostHogRecentEvent = {
  event: string;
  userKey: string;
  timestamp: string;
};

export type AdminPostHogOverview = {
  configured: boolean;
  counts24h: AdminPostHogEventCount[];
  counts7d: AdminPostHogEventCount[];
  counts30d: AdminPostHogEventCount[];
  recent: AdminPostHogRecentEvent[];
  warning?: string;
};

const PERIOD_DAYS: Record<PostHogPeriod, number> = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
};

export function emptyPostHogOverview(warning?: string): AdminPostHogOverview {
  const emptyCounts = ADMIN_ALLOWED_EVENTS.map(event => ({ event, count: 0, users: 0 }));
  return {
    configured: false,
    counts24h: emptyCounts,
    counts7d: emptyCounts,
    counts30d: emptyCounts,
    recent: [],
    warning,
  };
}

export async function fetchAdminPostHogOverview(opts: {
  event?: string;
  period?: PostHogPeriod;
} = {}): Promise<AdminPostHogOverview> {
  const projectId = process.env.POSTHOG_PROJECT_ID;
  const personalKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const host = process.env.POSTHOG_HOST || 'https://eu.posthog.com';
  if (!projectId || !personalKey) {
    return emptyPostHogOverview();
  }

  try {
    const [counts24h, counts7d, counts30d, recent] = await Promise.all([
      queryEventCounts({ projectId, personalKey, host, days: 1 }),
      queryEventCounts({ projectId, personalKey, host, days: 7 }),
      queryEventCounts({ projectId, personalKey, host, days: 30 }),
      queryRecentEvents({ projectId, personalKey, host, days: PERIOD_DAYS[opts.period || '7d'], event: opts.event }),
    ]);

    return {
      configured: true,
      counts24h,
      counts7d,
      counts30d,
      recent,
    };
  } catch (error) {
    console.error('admin posthog failed:', error);
    return emptyPostHogOverview('PostHog indisponible ou non configuré côté serveur.');
  }
}

export function usersForEvent(rows: AdminPostHogEventCount[], event: string): number {
  return rows.find(row => row.event === event)?.users || 0;
}

export function countForEvent(rows: AdminPostHogEventCount[], event: string): number {
  return rows.find(row => row.event === event)?.count || 0;
}

export function buildEventUserSets(recent: AdminPostHogRecentEvent[]): Record<string, Set<string>> {
  const sets: Record<string, Set<string>> = {};
  recent.forEach(row => {
    if (!sets[row.event]) sets[row.event] = new Set<string>();
    sets[row.event].add(row.userKey);
  });
  return sets;
}

async function queryEventCounts(opts: {
  projectId: string;
  personalKey: string;
  host: string;
  days: number;
}): Promise<AdminPostHogEventCount[]> {
  const events = ADMIN_ALLOWED_EVENTS.map(event => `'${event.replace(/'/g, "''")}'`).join(', ');
  const query = `
    SELECT event, count() AS count, uniq(distinct_id) AS users
    FROM events
    WHERE event IN (${events})
      AND timestamp >= now() - INTERVAL ${opts.days} DAY
    GROUP BY event
    ORDER BY count DESC
  `;
  const payload = await postHogQuery(opts, query);
  const byEvent: Record<string, AdminPostHogEventCount> = {};
  (payload.results || []).forEach((row: any[]) => {
    const event = String(row?.[0] || '');
    if (!ADMIN_ALLOWED_EVENTS.includes(event as any)) return;
    byEvent[event] = {
      event,
      count: Number(row?.[1] || 0),
      users: Number(row?.[2] || 0),
    };
  });
  return ADMIN_ALLOWED_EVENTS.map(event => byEvent[event] || { event, count: 0, users: 0 });
}

async function queryRecentEvents(opts: {
  projectId: string;
  personalKey: string;
  host: string;
  days: number;
  event?: string;
}): Promise<AdminPostHogRecentEvent[]> {
  const selected = opts.event && ADMIN_ALLOWED_EVENTS.includes(opts.event as any)
    ? [opts.event]
    : ADMIN_ALLOWED_EVENTS;
  const events = selected.map(event => `'${event.replace(/'/g, "''")}'`).join(', ');
  const query = `
    SELECT event, distinct_id, timestamp
    FROM events
    WHERE event IN (${events})
      AND timestamp >= now() - INTERVAL ${opts.days} DAY
    ORDER BY timestamp DESC
    LIMIT 100
  `;
  const payload = await postHogQuery(opts, query);
  return (payload.results || []).map((row: any[]) => ({
    event: String(row?.[0] || ''),
    userKey: anonymizeId(row?.[1]),
    timestamp: safeIsoDate(row?.[2]),
  })).filter((row: AdminPostHogRecentEvent) => ADMIN_ALLOWED_EVENTS.includes(row.event as any));
}

async function postHogQuery(opts: {
  projectId: string;
  personalKey: string;
  host: string;
}, query: string): Promise<{ results?: any[] }> {
  const response = await fetch(`${opts.host.replace(/\/$/, '')}/api/projects/${encodeURIComponent(opts.projectId)}/query/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.personalKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: {
        kind: 'HogQLQuery',
        query,
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`PostHog Query API failed (${response.status})`);
  }
  return response.json().catch(() => ({}));
}
