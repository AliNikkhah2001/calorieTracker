// Bump the cache name to ensure clients pick up the refreshed bundle when redeployed.
const CACHE_NAME = 'calorie-tracker-v3';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './data.json',
  './manifest.webmanifest',
  './icon.svg',
  'https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const { url } = event.request;
  const sameOrigin = url.startsWith(self.location.origin);

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && (sameOrigin || networkResponse.type === 'basic')) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
