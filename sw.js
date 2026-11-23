/* csh2020.com 앱 아이콘(설치)용 서비스 워커 (2026-11-23)
   페이지는 항상 인터넷에서 새로 받는다(내용을 오래 저장하지 않음). 인터넷이 끊겼을 때만 저장해 둔 홈 화면을 보여 준다. */
var CACHE = 'csh2020-shell-v1';
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(['/', '/icon-192.png']); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.mode !== 'navigate') return;   // 그림·광고·자료 요청은 건드리지 않음
  e.respondWith(fetch(e.request).catch(function () { return caches.match('/'); }));
});
