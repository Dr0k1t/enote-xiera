// F5.1: versión inyectada por scripts/build-config.js. Default 1.3.2 si no se inyecta.
const ENOTE_VERSION = '1.6.1';
const CACHE_VERSION = 'enote-' + ENOTE_VERSION;

// Assets de Typst (recibo PDF). NO van en el precache de install: el compiler
// WASM pesa ~27MB y bloquearía el primer arranque offline. Se cachean diferido
// vía mensaje WARM_TYPST_CACHE (app.js los pide en idle tras boot online).
const TYPST_ASSETS = [
  '/js/vendor/typst.ts.esm.js',
  '/assets/typst/typst_ts_web_compiler_bg.wasm',
  '/assets/typst/fonts/Jost-VF.ttf',
  '/assets/typst/fonts/Caveat-VF.ttf',
];
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/robots.txt',
  '/css/variables.css',
  '/css/main.css',
  '/css/print.css',
  '/js/boot.js',
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
  '/js/typstReceipt.js',
  '/js/typstAssets.js',
  '/js/vendor/supabase-js.esm.js',
  '/icons/icon-192.png',
  '/icons/icon-192-maskable.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/icons/splash/splash-1125x2436.png',
  '/icons/splash/splash-1170x2532.png',
  '/icons/splash/splash-1179x2556.png',
  '/icons/splash/splash-1284x2778.png',
  '/icons/splash/splash-1290x2796.png',
  '/icons/splash/splash-1536x2048.png',
  '/icons/splash/splash-2048x2732.png',
  '/assets/fonts/fonts.css',
  '/assets/fonts/92zatBhPNqw73oDd4iYl.woff2',
  '/assets/fonts/92zatBhPNqw73oTd4g.woff2',
  '/assets/fonts/92zatBhPNqw73ord4iYl.woff2',
  '/assets/fonts/Wnz6HAc5bAfYB2Q7YjYYmg8.woff2',
  '/assets/fonts/Wnz6HAc5bAfYB2Q7ZjYY.woff2',
  '/assets/fonts/Wnz6HAc5bAfYB2Q7aDYYmg8.woff2',
  '/assets/fonts/Wnz6HAc5bAfYB2Q7azYYmg8.woff2',
  '/assets/fonts/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYp3tKgS4.woff2',
  '/assets/fonts/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYpHtKgS4.woff2',
  '/assets/fonts/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYpntKgS4.woff2',
  '/assets/fonts/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYqXtK.woff2',
  '/assets/fonts/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYrXtKgS4.woff2',
  '/assets/fonts/co3smX5slCNuHLi8bLeY9MK7whWMhyjYrGFEsdtdc62E6zd58jD-h9M8Efs.woff2',
  '/assets/fonts/co3smX5slCNuHLi8bLeY9MK7whWMhyjYrGFEsdtdc62E6zd58jD-hdM8Efs.woff2',
  '/assets/fonts/co3smX5slCNuHLi8bLeY9MK7whWMhyjYrGFEsdtdc62E6zd58jD-htM8Efs.woff2',
  '/assets/fonts/co3smX5slCNuHLi8bLeY9MK7whWMhyjYrGFEsdtdc62E6zd58jD-iNM8.woff2',
  '/assets/fonts/co3smX5slCNuHLi8bLeY9MK7whWMhyjYrGFEsdtdc62E6zd58jD-jNM8Efs.woff2',
  '/assets/fonts/rP2Yp2ywxg089UriI5-g4vlH9VoD8Cmcqbu0-K4.woff2',
  '/assets/fonts/rP2Yp2ywxg089UriI5-g4vlH9VoD8Cmcqbu6-K6h9Q.woff2',
];

self.addEventListener('install', e => {
  // F5.2: usar {cache: 'reload'} para bypassear el HTTP cache del browser.
  // Sin esto, cache.add() hereda respuestas inmutables (max-age=1yr) y puede
  // precargar versiones stale de archivos que cambiaron sin cambiar URL.
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache =>
        Promise.allSettled(
          STATIC_ASSETS.map(url =>
            fetch(url, { cache: 'reload' })
              .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return cache.put(url, res);
              })
              .catch(err => console.warn('[SW] Failed to cache:', url, err))
          )
        )
      )
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

  // Assets de Typst (wasm/fuentes/template/vendor): request.destination suele
  // ser '' (fetch). Cache-first: una vez warm-cacheados, sirven offline.
  if (url.pathname.startsWith('/assets/typst/') ||
      url.pathname.startsWith('/templates/') ||
      url.pathname === '/js/vendor/typst.ts.esm.js') {
    e.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(request, clone));
        }
        return res;
      }))
    );
    return;
  }

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
            if (cached) return cached;
            if (request.destination === 'image') {
              return new Response('', { status: 503, statusText: 'Offline — image not cached' });
            }
            // scripts/fonts: empty body causes NS_ERROR_CORRUPTED_CONTENT in Firefox
            if (request.destination === 'script' || request.destination === 'font') {
              return Response.error();
            }
            return new Response('', { status: 503, statusText: 'Offline' });
          });
        return cached || fetchPromise;
      })
    );
  }
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
  // Warm-cache diferido de los assets pesados de Typst (recibo PDF).
  if (e.data?.type === 'WARM_TYPST_CACHE') {
    e.waitUntil(
      caches.open(CACHE_VERSION).then(cache =>
        Promise.allSettled(
          TYPST_ASSETS.map(url =>
            cache.match(url).then(hit =>
              hit || fetch(url, { cache: 'reload' }).then(res => {
                if (res.ok) return cache.put(url, res);
              }).catch(err => console.warn('[SW] Typst warm-cache failed:', url, err))
            )
          )
        )
      )
    );
  }
});
