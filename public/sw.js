const CACHE_NAME = 'goalos-shell-v4-20261031';
const PRECACHE_URLS = [
  '/',
  '/offline',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/manifest.webmanifest',
];
const ICON_PATH = '/icon.svg';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Do NOT auto skipWaiting. Wait for SKIP_WAITING message from the user.
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache /api routes or cross-origin requests
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) {
    return;
  }

  // 1. Navigation requests: Network-first with offline fallback page (/offline)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkResp) => {
          if (networkResp && networkResp.status === 200) {
            const clone = networkResp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkResp;
        })
        .catch(() => {
          return caches.match(req).then((cached) => {
            return cached || caches.match('/offline') || caches.match('/');
          });
        })
    );
    return;
  }

  // 2. Next.js static chunks, assets, and images: Cache-first
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.webmanifest');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((networkResp) => {
          if (networkResp && networkResp.status === 200) {
            const clone = networkResp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkResp;
        });
      })
    );
    return;
  }

  // 3. Stale-while-revalidate for other same-origin assets
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((networkResp) => {
          if (networkResp && networkResp.status === 200) {
            const clone = networkResp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkResp;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'AbhiOS Reminder',
    body: 'Aaj ka routine check karein.',
    tag: 'goalos-reminder',
    url: '/?tab=today',
    actions: [],
    data: {},
  };

  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch {
    // Fallback to default payload
  }

  const notificationData = {
    url: payload.url || '/?tab=today',
    ...(payload.data || {}),
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag || 'goalos-reminder',
      icon: ICON_PATH,
      badge: ICON_PATH,
      actions: payload.actions || [],
      data: notificationData,
      requireInteraction: false,
    })
  );
});

function openTodayWindow(targetUrl) {
  const fallbackUrl = targetUrl || '/?tab=today';
  return self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(fallbackUrl);
    });
}

self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  const data = event.notification.data || {};
  event.notification.close();

  const token =
    (data.tokens && action && data.tokens[action]) || data.token || null;

  if (
    (action === 'done' || action === 'water' || action === 'snooze') &&
    token
  ) {
    event.waitUntil(
      fetch('/api/done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
        .then((res) => {
          if (!res.ok) {
            return openTodayWindow('/?tab=today');
          }
          const confirmTitle =
            action === 'done'
              ? '✓ Routine Ho Gaya!'
              : action === 'water'
                ? '💧 +250 ml Paani Jud Gaya!'
                : '⏰ 15 Min Snooze Ho Gaya';
          const confirmBody =
            action === 'done'
              ? 'Aaj ke log me done mark ho gaya.'
              : action === 'water'
                ? 'Hydration progress update ho gayi.'
                : '15 minute baad dobara yaad dilaya jayega.';

          return self.registration.showNotification(confirmTitle, {
            body: confirmBody,
            tag: 'goalos-done-confirm',
            icon: ICON_PATH,
            badge: ICON_PATH,
            requireInteraction: false,
            data: { url: '/?tab=today' },
          });
        })
        .catch(() => {
          return openTodayWindow('/?tab=today');
        })
    );
    return;
  }

  event.waitUntil(openTodayWindow(data.url || '/?tab=today'));
});
