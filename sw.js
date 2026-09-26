/**
 * Offline support. Each request goes to the network first, and each good answer goes into the
 * cache. If the network fails or is slow, the cache answers. Thus the app opens in airplane
 * mode, and a new version on GitHub Pages shows on the next launch that is online.
 * If the app loads a new file, add it to FILES.
 */
const CACHE = 'mattbid';
const FILES = ['./', 'index.html', 'parse.js', 'manifest.json', 'vendor/Sortable.min.js'];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const network = fetch(req);
  e.waitUntil(network.then(res => res.ok && caches.open(CACHE).then(c => c.put(req, res.clone()))).catch(() => {}));
  const slow = new Promise((_, reject) => setTimeout(reject, 4000)); // in-flight Wi-Fi can hang
  e.respondWith(Promise.race([network, slow]).catch(() =>
    caches.match(req, { ignoreSearch: true }).then(hit => hit || network)));
});
