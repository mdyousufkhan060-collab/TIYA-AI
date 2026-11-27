// ROSE: lets phones and PCs install ROSE as an app (also used by the Microsoft Store package).
// Pages always come from the network as usual; only when there is no internet a small "You are offline" page shows.
var OFFLINE = '/offline.html';
var CACHE = 'rose-offline-v1';
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll([OFFLINE, '/icons/icon-192.png']); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(function () { return caches.match(OFFLINE); }));
});
