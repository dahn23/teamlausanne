// Service worker de la CONSOLE (staff) — sert au Web Push (notifs nouveaux mails).
// Distinct de sw.js (Mon espace). Ne fait PAS de cache offline : juste les notifs.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: "Nouveau mail", body: e.data ? e.data.text() : "" }; }
  const title = d.title || "Nouveau mail";
  const options = {
    body: d.body || "",
    icon: d.icon || "assets/pwa/admin-icon-192.png",
    badge: d.badge || "assets/pwa/admin-badge.png?v=5",
    tag: d.tag || "mail",
    renotify: true,
    data: { url: d.url || "/console" },
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/console";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cl) => {
      for (const c of cl) { if (c.url.includes("/console") && "focus" in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
