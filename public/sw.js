const CACHE_NAME = 'photofacto-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET and Firebase/API calls
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('firestore.googleapis.com')) return;
  if (event.request.url.includes('identitytoolkit.googleapis.com')) return;
  if (event.request.url.includes('googleapis.com/oauth')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and cache successful responses
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
