const VERSION = "2.0.0";
const CACHE = `lamp-dashboard-${VERSION}`;
const PRECACHE = [
  "./",
  "./index.html",
  "./css/styles.css?v=2.0.0",
  "./js/config.js?v=2.0.0",
  "./js/api.js?v=2.0.0",
  "./js/realtime.js?v=2.0.0",
  "./js/ui.js?v=2.0.0",
  "./js/chart.js?v=2.0.0",
  "./js/app.js?v=2.0.0",
  "./manifest.json?v=2.0.0",
  "./icons/icon.svg?v=2.0.0"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Network First: evita que GitHub Pages entregue una versión vieja del dashboard.
  event.respondWith(
    fetch(request, { cache: "no-store" })
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match("./index.html")))
  );
});
