// F5.1: versión inyectada por scripts/build-config.js. Default 1.3.0 si no se inyecta.
const ENOTE_VERSION = '1.3.0';
const CACHE_VERSION = 'enote-' + ENOTE_VERSION;
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/robots.txt',
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
  '/js/ui/print.js',
  '/icons/icon-192.png',
  '/icons/icon-192-maskable.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('Failed to cache:', url, err))
        )
      ))
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
  const isAsset = ['style', 'script', 'font', 'image', 'manifest'].includes(request.destination);

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
    // stale-while-revalidate: sirve caché inmediato y actualiza en background
    e.respondWith(
      caches.match(request).then(cached => {
        const fetchPromise = fetch(request)
          .then(res => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_VERSION).then(c => c.put(request, clone));
            }
            return res;
          })
          .catch(() => {
            if (request.destination === 'image') {
              return new Response('', { status: 503, statusText: 'Offline — image not cached' });
            }
            return cached;
          });
        return cached || fetchPromise;
      })
    );
  }
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
