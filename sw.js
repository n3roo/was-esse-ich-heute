/*
 * Service Worker: hält die App offline verfügbar.
 * Bei jeder Änderung an den Dateien die CACHE-Version erhöhen,
 * damit installierte Apps die neue Version laden.
 */
const CACHE = 'was-esse-ich-heute-v4';
const DATEIEN = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './vorschlag.js',
  './lebensmittel.js',
  './gerichte-katalog.js',
  './manifest.json',
  './fonts/playfair-display-500-normal.woff2',
  './fonts/playfair-display-500-italic.woff2',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

// Erst Netz, dann Cache: Online gibt es immer die neueste Version,
// offline die zuletzt gespeicherte.
self.addEventListener('fetch', (e) => {
  const anfrage = e.request;
  if (anfrage.method !== 'GET' || new URL(anfrage.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(anfrage)
      .then((antwort) => {
        if (antwort.ok) {
          const kopie = antwort.clone();
          caches.open(CACHE).then((c) => c.put(anfrage, kopie));
        }
        return antwort;
      })
      .catch(() => caches.match(anfrage, { ignoreSearch: true })
        .then((treffer) => treffer || (anfrage.mode === 'navigate' ? caches.match('./index.html') : Response.error()))),
  );
});
