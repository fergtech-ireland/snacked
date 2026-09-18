const CACHE = "snacked-v1";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png", "./icon-512-maskable.png", "./apple-touch-icon.png"];

// Cached one by one: addAll is all-or-nothing, so a single missing file
// would stop the worker installing and silently kill offline support.
self.addEventListener("install", e => e.waitUntil(
  caches.open(CACHE)
    .then(c => Promise.all(ASSETS.map(a => c.add(a).catch(err => console.warn("skipped", a, err)))))
    .then(() => self.skipWaiting())
));

self.addEventListener("activate", e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Google Fonts: cache on first use so the type still loads offline.
  if (url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("gstatic.com")) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const c = res.clone();
      caches.open(CACHE).then(cache => cache.put(req, c));
      return res;
    }).catch(() => new Response("", {status: 504}))));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Page loads: network first, so a new version lands as soon as it ships.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(res => {
      const c = res.clone();
      caches.open(CACHE).then(cache => cache.put("./index.html", c));
      return res;
    }).catch(() => caches.match("./index.html").then(r => r || caches.match("./"))));
    return;
  }

  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok && res.type === "basic") {
      const c = res.clone();
      caches.open(CACHE).then(cache => cache.put(req, c));
    }
    return res;
  })));
});
