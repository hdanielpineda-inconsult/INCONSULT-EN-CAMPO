/* Croquis de Campo — service worker para uso sin conexión.
   Si cambias index.html, sube el número de VERSION para que los teléfonos tomen la nueva versión. */
const VERSION = 'croquis-v1';
const LOCAL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png'
];
/* Librería 3D y fuentes: se guardan la primera vez que se abre la app con internet */
const REMOTE = [
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Condensed:wght@400;500;600&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(LOCAL);
    await Promise.all(REMOTE.map(async u => {
      try { const r = await fetch(new Request(u, { mode: 'no-cors' })); await c.put(u, r); } catch (_) {}
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* Página principal: intenta la red (para recibir actualizaciones) y si no hay, usa la copia guardada */
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const r = await fetch(req);
        const c = await caches.open(VERSION); c.put('./index.html', r.clone());
        return r;
      } catch (_) {
        return (await caches.match('./index.html')) || (await caches.match('./'));
      }
    })());
    return;
  }

  /* Archivos propios, fuentes y librería 3D: primero la copia guardada */
  const cacheable = url.origin === location.origin ||
    /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) ||
    url.hostname === 'cdnjs.cloudflare.com';
  if (!cacheable) return;

  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreVary: true }) || await caches.match(req.url);
    if (hit) return hit;
    try {
      const r = await fetch(req);
      if (r && (r.ok || r.type === 'opaque')) { const c = await caches.open(VERSION); c.put(req, r.clone()); }
      return r;
    } catch (_) {
      return new Response('', { status: 504 });
    }
  })());
});
