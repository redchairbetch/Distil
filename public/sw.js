// Aided service worker
// Scoped to /aided via registration; hand-rolled (no vite-plugin-pwa).
// Strategy:
//   - Navigations  → network-first, fall back to cached app shell (offline tolerance)
//   - Same-origin static assets → cache-first, populate on first fetch (Vite hashes filenames)
//   - Cross-origin (Supabase, Google Fonts) → pass through, never cached
//   - Web Push (RFC 8030): payload arrives encrypted, decrypted by the browser before
//     the `push` event fires. We render the notification and route clicks back to /aided.

const CACHE = 'aided-v2';
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
  if (url.origin !== self.location.origin) return; // never intercept Supabase / fonts CDN

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

// ── Web Push ────────────────────────────────────────────────────────────────
// Payload schema (set by the send-push edge function):
//   { title, body, url?, tag? }
// `tag` dedupes notifications of the same category (e.g. only one
// "appointment_reminder" visible at a time per device).

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { body: event.data ? event.data.text() : '' }; }

  const title = data.title || 'Aided';
  const body = data.body || '';
  const url = data.url || '/aided';
  const tag = data.tag;

  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/icons/aided.svg',
    badge: '/icons/aided.svg',
    tag,
    renotify: !!tag,
    data: { url },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/aided';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if (client.url.includes('/aided') && 'focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(url);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});

// Browser may rotate the subscription (key compromise, expiry, etc).
// Re-subscribe wiring lives in the client (Phase 2) — this stub keeps the
// event from firing as unhandled.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(Promise.resolve());
});
