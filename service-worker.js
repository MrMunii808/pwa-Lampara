const VERSION = "4.0.0";
const CACHE = `lamp-dashboard-${VERSION}`;
const PRECACHE = [
  "./",
  "./index.html",
  "./css/styles.css?v=4.0.0",
  "./js/config.js?v=4.0.0",
  "./js/api.js?v=4.0.0",
  "./js/realtime.js?v=4.0.0",
  "./js/ui.js?v=4.0.0",
  "./js/chart.js?v=4.0.0",
  "./js/app.js?v=4.0.0",
  "./manifest.json?v=4.0.0",
  "./icons/icon.svg?v=4.0.0"
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
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html")))
  );
});
