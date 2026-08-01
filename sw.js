// 应用壳缓存：本地资源缓存优先，天气/书目/播客等跨域请求只走网络
const CACHE = 'wb-v13';
const ASSETS = [
  './', './index.html', './app.css',
  './js/core.js', './js/app.js', './js/db.js', './js/demo.js', './js/lunar.js',
  './js/topics.js', './js/books.js', './js/podcast.js', './js/sport.js', './js/meal.js',
  './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit =>
      hit ||
      fetch(e.request).then(res => {
        const cp = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, cp));
        return res;
      }).catch(() => caches.match('./index.html'))
    )
  );
});
