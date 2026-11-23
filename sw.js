// Service worker for the VMW organisation app.
// BUMP `VERSION` on every release: phones then show "Update available" and load the new files.
var VERSION = "org-v1";
var SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).catch(function () { /* offline install is best effort */ }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("message", function (e) { if (e.data === "SKIP_WAITING") self.skipWaiting(); });

// Same-origin files only: network first (so a fresh page is used when online), cache as the offline fallback.
// API calls go to another origin and are never touched here.
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(function (res) {
    var copy = res.clone();
    caches.open(VERSION).then(function (c) { c.put(req, copy); }).catch(function () {});
    return res;
  }).catch(function () { return caches.match(req).then(function (m) { return m || caches.match("./index.html"); }); }));
});
