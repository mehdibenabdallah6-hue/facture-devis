import { lazy, ComponentType } from 'react';

const RELOAD_KEY = 'photofacto:chunk-reload';

/**
 * lazyWithRetry — wraps React.lazy so a failed dynamic import (typically caused
 * by a stale service-worker cache after a deploy) auto-recovers instead of
 * crashing the route with "text/html is not a valid JavaScript MIME type".
 *
 * Strategy:
 *  1. On first failure within a session, set a flag and force a hard reload —
 *     the new index.html ships with the new chunk hashes, so the next try works.
 *  2. On the *next* successful chunk load, clear the flag so future deploys
 *     can re-use the recovery (clearing immediately on app start would defeat
 *     the loop guard).
 *  3. If a load fails AGAIN with the flag still set (real network/build
 *     problem), let the error bubble up to ErrorBoundary so we don't loop.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      // Success — safe to clear the flag so a future deploy can re-trigger
      // the auto-reload recovery.
      try { sessionStorage.removeItem(RELOAD_KEY); } catch {}
      return mod;
    } catch (err) {
      let alreadyReloaded = false;
      try { alreadyReloaded = sessionStorage.getItem(RELOAD_KEY) === '1'; } catch {}
      if (!alreadyReloaded && typeof window !== 'undefined') {
        try { sessionStorage.setItem(RELOAD_KEY, '1'); } catch {}
        // Bust caches and reload — gives us a clean shot at the new chunks.
        window.location.reload();
        // Return a never-resolving promise so React stays in Suspense fallback
        // until the reload kicks in.
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}

/**
 * No-op kept for API stability — the flag is now cleared on first successful
 * lazy load (see lazyWithRetry above), not on app startup.
 */
export function clearChunkReloadFlag() {
  // intentionally empty
}
