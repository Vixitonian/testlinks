"use strict";
// Caches only the static app shell so the PWA still loads (with cached
// data, if any was ever fetched successfully) when offline. Calls to
// SupaBein's Data API always go to the network — device status must
// never be served stale from a cache.

const CACHE_NAME = "device-control-shell-v3";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./supabein.js",
  "./app.js",
  "./manifest.json"
];
// Icons are embedded as base64 data URIs in index.html/manifest.json
// rather than served as separate files (see scripts/embed-icons.js) — so
// there's nothing extra to precache for them.

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Only ever serve same-origin static shell files from cache; anything
  // else (in particular, calls to the configured cloud API's own origin)
  // passes straight through to the network untouched.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
