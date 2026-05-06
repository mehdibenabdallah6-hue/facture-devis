// Vercel Cron — daily payment reminders.
//
// Schedule (configured in vercel.json): once a day, around 09:00 Europe/Paris.
//
// Logic:
//   1. Query every `invoice` (type === 'invoice') whose dueDate is in the past
//      and whose status is still pending payment ('sent' or 'overdue').
//   2. For each invoice, compute days-overdue and decide whether a reminder
//      is due (J+7 → first, J+15 → second, J+30 → final).
//   3. Send the reminder email through Resend, then atomically increment
//      `remindersSent` and store `lastReminderAt`. If the send fails we do
//      NOT bump the counter, so the next cron run will retry.
//   4. Flip status to 'overdue' the first time we see an invoice past due.
//
// Per-invoice opt-outs:
//   - `remindersDisabled === true` → never sent.
//   - `clientEmail` missing → skipped (we still flip status to 'overdue').
//
// Authorization:
//   - Vercel sets `Authorization: Bearer ${CRON_SECRET}` on cron invocations.
//     We accept either that secret or `?secret=...` for manual triggers.

import { ensureFirebaseAdmin } from './_firebase-admin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin, handleAdminAuthError } from './_lib/adminAuth.js';
import { buildAdminErrors, buildAdminSummary, loadAdminDataset } from './_lib/adminMetrics.js';
import { buildAdminUserRows } from './_lib/adminUsers.js';
import { fetchAdminPostHogOverview, type PostHogPeriod } from './_lib/adminPosthog.js';
import { ADMIN_ALLOWED_EVENTS, incrementCounter } from './_lib/adminSanitize.js';
import { effectivePlanForCompany } from './_lib/billing.js';

const REMINDER_FROM = 'Photofacto <factures@photofacto.fr>';

type ReminderStage = {
  /** Inclusive lower bound (days overdue). */
  fromDays: number;
  /** Exclusive upper bound (days overdue). Use Infinity for the final stage. */
  toDays: number;
  /** Number of reminders already sent that this stage targets. */
  index: 0 | 1 | 2;
  /** Subject line + opening tone. */
  label: string;
  tone: 'gentle' | 'firm' | 'final';
};

const STAGES: ReminderStage[] = [
  { fromDays: 7, toDays: 15, index: 0, label: 'Première relance', tone: 'gentle' },
  { fromDays: 15, toDays: 30, index: 1, label: 'Deuxième relance', tone: 'firm' },
  { fromDays: 30, toDays: Infinity, index: 2, label: 'Dernière relance avant recouvrement', tone: 'final' },
];

function pickStage(daysOverdue: number, remindersSent: number): ReminderStage | null {
  for (const stage of STAGES) {
    if (daysOverdue >= stage.fromDays && daysOverdue < stage.toDays && remindersSent <= stage.index) {
      return stage;
    }
  }
  return null;
}

function formatEuro(value: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
}

function buildEmail(opts: {
  stage: ReminderStage;
  invoiceNumber: string;
  totalTTC: number;
  dueDate: Date;
  daysOverdue: number;
  companyName?: string;
  signerName?: string;
}) {
  const { stage, invoiceNumber, totalTTC, dueDate, daysOverdue, companyName, signerName } = opts;
  const dueDateStr = dueDate.toLocaleDateString('fr-FR');
  const sender = companyName || signerName || 'Photofacto';

  const intro = stage.tone === 'gentle'
    ? "Sauf erreur de notre part, nous n'avons pas encore reçu le règlement de la facture suivante :"
    : stage.tone === 'firm'
      ? "Malgré une première relance, votre facture reste impayée à ce jour :"
      : "Sans règlement de votre part sous 8 jours, le dossier sera transmis à un service de recouvrement. Facture concernée :";

  const closing = stage.tone === 'final'
    ? `<p style="color:#A8420C;"><strong>Action requise sous 8 jours.</strong> Au-delà, des pénalités de retard et l'indemnité forfaitaire de recouvrement de 40 € (art. L441-10 du Code de commerce) seront appliquées.</p>`
    : `<p>Merci de procéder au règlement dans les meilleurs délais. Si le paiement a déjà été effectué, vous pouvez ignorer ce message.</p>`;

  const subject = `${stage.label} — Facture ${invoiceNumber}${stage.tone === 'final' ? ' (action requise)' : ''}`;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;color:#2E3440;">
      <h2 style="color:#CC4F12;margin-bottom:8px;">${stage.label}</h2>
      <p>Bonjour,</p>
      <p>${intro}</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#FAFAF9;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:10px 14px;color:#6B7280;">Numéro</td><td style="padding:10px 14px;font-weight:600;">${invoiceNumber}</td></tr>
        <tr><td style="padding:10px 14px;color:#6B7280;">Montant TTC</td><td style="padding:10px 14px;font-weight:600;">${formatEuro(totalTTC)}</td></tr>
        <tr><td style="padding:10px 14px;color:#6B7280;">Date d'échéance</td><td style="padding:10px 14px;font-weight:600;">${dueDateStr}</td></tr>
        <tr><td style="padding:10px 14px;color:#6B7280;">Retard</td><td style="padding:10px 14px;font-weight:600;color:#A8420C;">${daysOverdue} jour${daysOverdue > 1 ? 's' : ''}</td></tr>
      </table>
      ${closing}
      <p style="margin-top:24px;">Cordialement,<br/><strong>${sender}</strong></p>
      <hr style="border:none;border-top:1px solid #E9EBEF;margin:24px 0;" />
      <p style="font-size:11px;color:#9CA3AF;">Email envoyé automatiquement par Photofacto au nom de ${sender}.</p>
    </div>
  `.trim();

  return { subject, html };
}

async function sendEmail(payload: {
  to: string;
  subject: string;
  html: string;
  apiKey: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${payload.apiKey}`,
      },
      body: JSON.stringify({
        from: REMINDER_FROM,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `${res.status} ${text}` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'unknown error' };
  }
}

export default async function handler(req: any, res: any) {
  const adminResource = getAdminResource(req);
  if (adminResource) {
    return handleAdminRequest(req, res, adminResource);
  }

  // ── Auth ───────────────────────────────────────────────────────────
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  const authHeader = req.headers.authorization || '';
  const queryToken = typeof req.query?.secret === 'string' ? req.query.secret : '';
  const allowed =
    process.env.NODE_ENV !== 'production' ||
    authHeader === expected ||
    (process.env.CRON_SECRET && queryToken === process.env.CRON_SECRET);

  if (!allowed) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.error('Missing RESEND_API_KEY');
    return res.status(500).json({ error: 'Configuration manquante (Resend)' });
  }

  let db: ReturnType<typeof ensureFirebaseAdmin>['db'];
  try {
    ({ db } = ensureFirebaseAdmin());
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err?.message || 'Firebase admin init failed' });
  }

  const now = new Date();
  const todayIso = now.toISOString();

  try {
    // Pull every overdue-or-becoming-overdue invoice. We avoid filtering on
    // status here because Firestore can't combine `<` and `in` on different
    // fields without a composite index — easier to filter in memory.
    const snap = await db
      .collection('invoices')
      .where('type', '==', 'invoice')
      .where('dueDate', '<', todayIso)
      .get();

    if (snap.empty) {
      return res.status(200).json({ success: true, processed: 0, emailsSent: 0 });
    }

    // Cache company docs by ownerId so we only fetch each one once per run.
    const companyCache = new Map<string, any>();
    const getCompany = async (ownerId: string) => {
      if (companyCache.has(ownerId)) return companyCache.get(ownerId);
      const cSnap = await db.collection('companies').doc(ownerId).get();
      const data = cSnap.exists ? cSnap.data() : null;
      companyCache.set(ownerId, data);
      return data;
    };

    let emailsSent = 0;
    let statusFlipped = 0;
    let skipped = 0;

    // Sequential to keep the function under quota and to avoid rate limits.
    for (const docSnap of snap.docs) {
      const data = docSnap.data() as any;
      const status = data.status;
      // Only chase invoices the user actually expects to be paid.
      if (status !== 'sent' && status !== 'overdue') {
        skipped++;
        continue;
      }
      if (data.remindersDisabled === true) {
        skipped++;
        continue;
      }

      const dueDate = new Date(data.dueDate);
      if (isNaN(dueDate.getTime())) {
        skipped++;
        continue;
      }

      const diffMs = now.getTime() - dueDate.getTime();
      const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (daysOverdue < 0) continue; // safety net

      const remindersSent: number = data.remindersSent || 0;

      // First time we see this invoice as past due → mark overdue.
      if (status === 'sent') {
        await docSnap.ref.update({
          status: 'overdue',
          updatedAt: todayIso,
        });
        statusFlipped++;
      }

      const stage = pickStage(daysOverdue, remindersSent);
      if (!stage) continue;

      if (!data.clientEmail) {
        skipped++;
        continue;
      }

      const company = data.ownerId ? await getCompany(data.ownerId) : null;
      if (effectivePlanForCompany(company) !== 'pro') {
        skipped++;
        continue;
      }

      const { subject, html } = buildEmail({
        stage,
        invoiceNumber: data.number || data.id || '—',
        totalTTC: Number(data.totalTTC || 0),
        dueDate,
        daysOverdue,
        companyName: company?.companyName,
        signerName: company?.signerName || company?.ownerName,
      });

      const sendResult = await sendEmail({
        to: data.clientEmail,
        subject,
        html,
        apiKey: RESEND_API_KEY,
      });

      if (sendResult.ok) {
        emailsSent++;
        await docSnap.ref.update({
          remindersSent: FieldValue.increment(1),
          lastReminderAt: todayIso,
          lastReminderStage: stage.label,
          updatedAt: todayIso,
        });
      } else {
        console.error(
          `[cron-reminders] send failed invoice=${docSnap.id} owner=${data.ownerId} err=${sendResult.error}`,
        );
        // Do NOT bump remindersSent — next run will retry.
      }
    }

    return res.status(200).json({
      success: true,
      processed: snap.docs.length,
      emailsSent,
      statusFlipped,
      skipped,
    });
  } catch (err: any) {
    console.error('[cron-reminders] fatal', err);
    return res.status(500).json({ error: err?.message || 'cron failed' });
  }
}

type AdminResource = 'summary' | 'users' | 'events' | 'errors';

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

async function handleAdminRequest(req: any, res: any, resource: AdminResource) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await requireAdmin(req);
  } catch (error) {
    return handleAdminAuthError(res, error);
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
