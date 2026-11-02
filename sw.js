const CACHE = 'tarjetas-v23';
const ASSETS = [
  '/tarjetas/',
  '/tarjetas/index.html',
  '/tarjetas/manifest.json',
  '/tarjetas/icon-192.png',
  '/tarjetas/icon-512.png',
  '/tarjetas/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  // Only touch Tarjetas' own caches; other apps on this origin keep theirs.
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('tarjetas-') && k !== CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Network-first for API calls and fonts
  if (e.request.url.includes('script.google.com') ||
      e.request.url.includes('fonts.googleapis.com') ||
      e.request.url.includes('fonts.gstatic.com')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // The app itself (index.html / navigations): network first so updates show
  // up right away; fall back to the cached copy when offline.
  const isAppShell =
    e.request.method === 'GET' &&
    (e.request.mode === 'navigate' ||
      (url.origin === self.location.origin &&
        (url.pathname === '/tarjetas/' || url.pathname === '/tarjetas/index.html')));
  if (isAppShell) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put('/tarjetas/index.html', clone));
        }
        return res;
      }).catch(() =>
        caches.match('/tarjetas/index.html').then(r => r || caches.match('/tarjetas/'))
      )
    );
    return;
  }

  // Everything else: cache first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('/tarjetas/'));
    })
  );
});
