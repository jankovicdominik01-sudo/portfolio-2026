// Minimálny service worker: iba aby sa dal Lead Engine nainštalovať ako aplikácia.
// Nič nekešuje, dáta leadov vždy idú zo siete (sú citlivé a musia byť aktuálne).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
