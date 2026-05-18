const CACHE_VERSION = 'enote-' + (typeof self.ENOTE_VERSION !== 'undefined' ? self.ENOTE_VERSION : Date.now());
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/css/variables.css',
  '/css/main.css',
  '/css/print.css',
  '/js/app.js',
  '/js/config.js',
  '/js/auth.js',
  '/js/store.js',
  '/js/imageUtils.js',
  '/js/logger.js',
  '/js/supabase.js',
  '/js/offline.js',
  '/js/ui/shared.js',
  '/js/ui/login.js',
  '/js/ui/dashboard.js',
  '/js/ui/form.js',
  '/js/ui/detail.js',
  '/js/ui/repartidor.js',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.hostname.endsWith('.supabase.co')) return;

  const isDoc = request.destination === 'document';
  const isAsset = ['style', 'script', 'font', 'image'].includes(request.destination);

  if (isDoc) {
    e.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then(c => c.put(request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(request).then(cached => cached || caches.match('/offline.html'))
        )
    );
  } else if (isAsset) {
    e.respondWith(
      caches.match(request)
        .then(r => r || fetch(request)
          .then(res => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_VERSION).then(c => c.put(request, clone));
            }
            return res;
          })
        )
        .catch(() => caches.match(request))
    );
  }
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});