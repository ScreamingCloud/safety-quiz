const CACHE_NAME = 'safety-quiz-2026-v2';
const ASSETS = ['./', './index.html', './styles.css', './app.mjs?v=2026-2', './scheduler.mjs', './questions.mjs?v=2026-2', './manifest.webmanifest?v=2026-2', './icon.svg', './apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const olderQuizCache = keys.some(key => key.startsWith('safety-quiz-') && key !== CACHE_NAME);
    await Promise.all(keys.filter(key => key.startsWith('safety-quiz-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
    if (olderQuizCache) {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.all(windows.map(client => client.navigate(client.url).catch(() => {})));
    }
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
