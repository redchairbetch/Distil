// Aided service worker
// Scoped to /aided via registration; hand-rolled (no vite-plugin-pwa).
// Strategy:
//   - Navigations  → network-first, fall back to cached app shell (offline tolerance)
//   - Same-origin static assets → cache-first, populate on first fetch (Vite hashes filenames)
//   - Cross-origin (Supabase, Anthropic, Google Fonts) → pass through, never cached

const CACHE = 'aided-v1';
const SHELL = [
  '/aided',
  '/manifest.webmanifest',
  '/icons/aided.svg',
  '/icons/aided-maskable.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // never intercept Supabase / Anthropic / fonts CDN

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/aided'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        if (resp.ok && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE).then((c) => c.put(event.request, clone));
        }
        return resp;
      }).catch(() => cached);
    })
  );
});
