/**
 * Analytics configuration — PostHog + Sentry.
 *
 * V1 rule: only explicit funnel/admin events, only non-sensitive props.
 * No autocapture, no session replay, no heatmap/mouse tracking.
 */

export const ALLOWED_ANALYTICS_EVENTS = [
  'user_signed_up',
  'company_created',
  'client_created',
  'quote_created',
  'quote_sent',
  'quote_signed',
  'invoice_created',
  'invoice_validated',
  'ai_extraction_started',
  'ai_extraction_succeeded',
  'ai_extraction_failed',
  'email_sent',
  'email_failed',
  'checkout_started',
  'subscription_started',
  'quota_limit_reached',
  'clicked_create_invoice',
  'clicked_create_quote',
  'clicked_ai_photo_upload',
  'clicked_send_email',
  'clicked_validate_invoice',
  'clicked_upgrade_plan',
  'demo_viewed',
  'demo_cta_clicked',
] as const;

export type AnalyticsEvent = typeof ALLOWED_ANALYTICS_EVENTS[number];
export type AnalyticsProps = Record<string, unknown>;

const ALLOWED_EVENT_SET = new Set<string>(ALLOWED_ANALYTICS_EVENTS);
const SAFE_STRING_PROPS = new Set([
  'provider',
  'plan',
  'billing_cycle',
  'document_type',
  'source',
  'surface',
  'ai_source',
  'error_type',
  'quota_resource',
  'status',
  'mode',
  'page',
  'cta',
]);
const SAFE_BOOLEAN_PROPS = new Set(['has_catalog', 'is_first', 'used_catalog']);
const SAFE_BUCKET_PROPS = new Set([
  'total_bucket',
  'item_count_bucket',
  'line_count_bucket',
  'usage_bucket',
  'limit_bucket',
]);
const AMOUNT_KEYS = new Set([
  'amount',
  'total',
  'totalTTC',
  'total_ttc',
  'totalHT',
  'total_ht',
  'totalVAT',
  'total_vat',
  'price',
  'unitPrice',
  'unit_price',
]);
const COUNT_KEY_TO_BUCKET: Record<string, string> = {
  item_count: 'item_count_bucket',
  items_count: 'item_count_bucket',
  line_count: 'line_count_bucket',
  lines_count: 'line_count_bucket',
  usage_count: 'usage_bucket',
  used: 'usage_bucket',
  limit: 'limit_bucket',
};

// ─── PostHog ──────────────────────────────────────────────
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com';

export function initPostHog() {
  if (!POSTHOG_KEY) return null;

  return import('posthog-js').then(({ default: posthog }) => {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: false,
      persistence: 'localStorage',
      disable_session_recording: true,
      autocapture: false,
      person_profiles: 'identified_only',
    });
    return posthog;
  });
}

export function identifyUser(userId: string) {
  if (!POSTHOG_KEY) return;
  import('posthog-js').then(({ default: posthog }) => {
    posthog.identify(userId);
  });
}

/**
 * Funnel-event helper. Fire-and-forget — never throws, never blocks the UI.
 * If PostHog is not configured, falls back to a debug log so we still get
 * signal in dev consoles. Use snake_case event names for PostHog dashboards.
 *
 * Example:
 *   track('invoice_created', { plan: 'free', total_ttc: 1200 });
 *   → PostHog receives { plan: 'free', total_bucket: '501_2000' }
 */
export function track(event: string, props: AnalyticsProps = {}) {
  try {
    if (!isAllowedAnalyticsEvent(event)) return;
    const safeProps = sanitizeAnalyticsProps(props);
    if (!POSTHOG_KEY) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug('[analytics:noop]', event, safeProps);
      }
      return;
    }
    import('posthog-js').then(({ default: posthog }) => {
      posthog.capture(event, safeProps);
    }).catch(() => { /* silent — analytics must never break the app */ });
  } catch {
    /* swallow */
  }
}

export function isAllowedAnalyticsEvent(event: string): event is AnalyticsEvent {
  return ALLOWED_EVENT_SET.has(event);
}

export function sanitizeAnalyticsProps(props: AnalyticsProps = {}): Record<string, string | boolean> {
  const safe: Record<string, string | boolean> = {};

  for (const [key, value] of Object.entries(props)) {
    if (AMOUNT_KEYS.has(key)) {
      if (safe.total_bucket === undefined) safe.total_bucket = bucketAmount(value);
      continue;
    }

    const bucketKey = COUNT_KEY_TO_BUCKET[key];
    if (bucketKey) {
      safe[bucketKey] = bucketCount(value);
      continue;
    }

    if (SAFE_BUCKET_PROPS.has(key)) {
      if (safe[key] === undefined && isKnownBucket(value)) safe[key] = String(value);
      continue;
    }

    if (SAFE_BOOLEAN_PROPS.has(key) && typeof value === 'boolean') {
      safe[key] = value;
      continue;
    }

    if (!SAFE_STRING_PROPS.has(key)) continue;
    const safeString = sanitizeEnumLikeString(value);
    if (safeString) safe[key] = safeString;
  }

  return safe;
}

export function bucketAmount(value: unknown): string {
  const amount = parseNumber(value);
  if (amount <= 0) return '0';
  if (amount <= 100) return '1_100';
  if (amount <= 500) return '101_500';
  if (amount <= 2000) return '501_2000';
  return '2001_plus';
}

function bucketCount(value: unknown): string {
  const count = Math.max(0, Math.round(parseNumber(value)));
  if (count === 0) return '0';
  if (count <= 2) return '1_2';
  if (count <= 5) return '3_5';
  if (count <= 10) return '6_10';
  if (count <= 20) return '11_20';
  return '21_plus';
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return 0;
  const parsed = Number.parseFloat(value.replace(/\s/g, '').replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizeEnumLikeString(value: unknown): string | null {
  const normalized = String(value || '').toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_').slice(0, 40);
  return /^[a-z0-9][a-z0-9_-]{0,39}$/.test(normalized) ? normalized : null;
}

function isKnownBucket(value: unknown): boolean {
  return typeof value === 'string' && /^(0|1_2|3_5|6_10|11_20|21_plus|1_100|101_500|501_2000|2001_plus)$/.test(value);
}

// ─── Sentry ───────────────────────────────────────────────
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const IS_PRODUCTION = Boolean(import.meta.env.PROD);

export function initSentry() {
  if (!SENTRY_DSN) return;

  import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: IS_PRODUCTION ? 'production' : 'development',
      tracesSampleRate: IS_PRODUCTION ? 0.5 : 1.0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
    });
  });
}
