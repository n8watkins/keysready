/* KeysReady service worker — Web Push + click handling. Vanilla, no deps. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'KeysReady';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag,
    data: { url: data.url || '/' },
    vibrate: [80, 40, 80],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  // Resolve to an absolute URL so we can compare path/search precisely instead of
  // doing a loose substring match (which focused stale tabs and made '/' match every tab).
  const target = new URL(url, self.location.origin);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        const current = new URL(client.url);
        // Same page (ignoring hash): focus the existing tab and navigate it to refresh.
        if (current.pathname === target.pathname && current.search === target.search) {
          if (typeof client.navigate === 'function') {
            return client.navigate(target.href).then((navigated) => {
              const c = navigated || client;
              return 'focus' in c ? c.focus() : c;
            });
          }
          return 'focus' in client ? client.focus() : client;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target.href);
    }),
  );
});

// Present so the app meets PWA installability heuristics; lets the network handle requests.
self.addEventListener('fetch', () => {});
