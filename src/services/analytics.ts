/**
 * Analytics configuration — PostHog + Sentry
 *
 * Both services are opt-in via environment variables.
 * If the env vars are not set, the services are silently disabled (no-op).
 */

// ─── PostHog ──────────────────────────────────────────────
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com';

export function initPostHog() {
  if (!POSTHOG_KEY) return null;

  return import('posthog-js').then(({ default: posthog }) => {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: true,
      persistence: 'localStorage',
      // Respect DNT
      disable_session_recording: true,
      autocapture: false, // We manually track what matters
    });
    return posthog;
  });
}

export function identifyUser(userId: string, email?: string) {
  if (!POSTHOG_KEY) return;
  import('posthog-js').then(({ default: posthog }) => {
    posthog.identify(userId, { email });
  });
}

// ─── Sentry ───────────────────────────────────────────────
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

export function initSentry() {
  if (!SENTRY_DSN) return;

  import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: import.meta.env.PROD ? 'production' : 'development',
      tracesSampleRate: import.meta.env.PROD ? 0.5 : 1.0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
    });
  });
}
