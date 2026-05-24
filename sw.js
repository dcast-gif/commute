const CACHE = 'commute-shell-v2';
const ASSETS = ['.', 'index.html', 'styles.css', 'manifest.json', 'icons/icon.svg', 'src/app.js', 'src/config.js', 'src/storage.js', 'src/tfl.js', 'src/notifications.js'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if(url.origin === location.origin){
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
  }
});
