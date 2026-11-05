// Service worker minimal — installe la PWA « Mon espace » + secours hors-ligne.
// Stratégie : réseau d'abord (toujours frais quand connecté), cache en secours.
const CACHE = "tl-espace-v3";
const SHELL = ["espace.html", "assets/pwa/admin-icon-192.png?v=2", "manifest.json"];
// La bibliothèque Supabase vient d'un AUTRE domaine. Sans elle, espace.js ne
// s'exécute pas du tout : hors connexion, l'app ne démarrait donc jamais. On
// la met en cache comme le reste (esm.sh répond avec les en-têtes CORS, donc
// la réponse est lisible et non « opaque »).
const EXTERNES_A_GARDER = ["https://esm.sh/"];
const aGarder = (url) => url.origin === self.location.origin || EXTERNES_A_GARDER.some((p) => url.href.startsWith(p));

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
  const cachable = aGarder(new URL(req.url));
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && cachable) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => {
        if (r) return r;
        // Le repli vers espace.html ne vaut que pour une NAVIGATION. Le servir
        // à une requête de script renvoyait du HTML à la place du JavaScript :
        // le module explosait, et l'app restait blanche — précisément la panne
        // qu'on croyait corriger en posant ce repli.
        if (req.mode === "navigate") return caches.match("espace.html");
        return Response.error();
      }))
  );
});
