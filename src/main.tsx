import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// ─── Global chunk-load error recovery ──────────────────────────────────────
// When a deploy lands while a user has the app open, the service worker may
// serve a stale index.html / chunk path. The browser then refuses to execute
// the response with: "'text/html' is not a valid JavaScript MIME type".
// We catch those errors here, flag a one-time reload, and let the new SW take
// over on the next pageview. The reload flag prevents an infinite loop.
const RELOAD_KEY = 'photofacto:chunk-reload';
const isChunkError = (msg: string) =>
  /Loading chunk \d+ failed/i.test(msg) ||
  /Failed to fetch dynamically imported module/i.test(msg) ||
  /'text\/html' is not a valid JavaScript MIME type/i.test(msg) ||
  /MIME type of "text\/html"/i.test(msg) ||
  /ChunkLoadError/i.test(msg);

const tryReload = () => {
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === '1') return false;
    sessionStorage.setItem(RELOAD_KEY, '1');
  } catch {
    // sessionStorage unavailable — reload anyway, worst case is a loop the user can stop
  }
  window.location.reload();
  return true;
};

window.addEventListener('error', (event) => {
  const msg = (event?.message || event?.error?.message || '').toString();
  if (isChunkError(msg)) tryReload();
});

window.addEventListener('unhandledrejection', (event) => {
  const reason: any = event?.reason;
  const msg = (reason?.message || String(reason || '')).toString();
  if (isChunkError(msg)) tryReload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
