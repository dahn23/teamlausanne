// Service worker minimal — installe la PWA « Mon espace » + secours hors-ligne.
// Stratégie : réseau d'abord (toujours frais quand connecté), cache en secours.
const CACHE = "tl-espace-v1";
const SHELL = ["espace.html", "assets/pwa/icon-192.png", "manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const sameOrigin = new URL(req.url).origin === self.location.origin;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && sameOrigin) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("espace.html")))
  );
});
