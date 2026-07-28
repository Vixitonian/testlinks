"use strict";
// This app deliberately does NOT cache anything anymore. A cache-first
// service worker plus a code change that got pushed to git but not
// actually redeployed once meant a phone kept showing old app.js even
// after the live site was fixed — not worth the offline-shell benefit
// for an app whose whole point is showing live device state anyway.
//
// This file's only job now is to clean up after the old caching version
// on any phone that already installed it: delete every cache it left
// behind, unregister itself, and reload any open window so it recovers
// immediately without the user having to manually close/reopen the app.
// app.js still calls navigator.serviceWorker.register() on load — for a
// phone with nothing registered yet that's a harmless no-op (installs
// this, which immediately unregisters itself); for a phone with the old
// caching version already active, that's what triggers the browser to
// fetch this file fresh and notice it changed.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll())
      .then((clients) => clients.forEach((client) => client.navigate(client.url)))
  );
});
