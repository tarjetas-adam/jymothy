const CACHE = 'jymothy-v2';
const ASSETS = [
  '/jymothy/',
  '/jymothy/index.html',
  '/jymothy/manifest.json',
  '/jymothy/icon-192.png',
  '/jymothy/icon-512.png',
  '/jymothy/icon-512-maskable.png',
  '/jymothy/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  // Only touch JYMOTHY's own caches; other apps on this origin keep theirs.
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('jymothy-') && k !== CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Sheet sync requests go straight to the network, untouched.
  if (url.hostname === 'script.google.com' || url.hostname === 'script.googleusercontent.com') return;

  // The app itself (index.html / navigations): always try the network first so
  // updates show up right away; fall back to the cached copy when offline.
  const isAppShell =
    req.mode === 'navigate' ||
    (url.origin === self.location.origin &&
      (url.pathname === '/jymothy/' || url.pathname === '/jymothy/index.html'));

  if (isAppShell) {
    e.respondWith(
      // cache: 'no-store' skips the browser's own 10-minute copy (GitHub Pages allows one),
      // so a freshly uploaded index.html shows up on the very next open.
      fetch(req.url, { cache: 'no-store' }).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put('/jymothy/index.html', clone));
        }
        return res;
      }).catch(() =>
        caches.match('/jymothy/index.html').then(r => r || caches.match('/jymothy/'))
      )
    );
    return;
  }

  // Fonts: network first, cached copy when offline.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Everything else (icons, manifest): cache first.
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      });
    })
  );
});
