import { requireAdmin, handleAdminAuthError } from './_lib/adminAuth.js';
import { ADMIN_ALLOWED_EVENTS, incrementCounter } from './_lib/adminSanitize.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await requireAdmin(req);
  } catch (error) {
    return handleAdminAuthError(res, error);
  }

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
