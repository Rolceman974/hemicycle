/*
 * Hemicycle — service worker
 * Rend le site installable comme une application et utilisable hors connexion :
 *  - la coquille du site (page, styles, scripts, polices, icônes) est gardée en cache ;
 *  - les données (data/…) s'affichent tout de suite depuis le cache, puis se mettent à jour en arrière-plan ;
 *  - les pages s'ouvrent depuis le réseau quand il est là, sinon depuis le cache ;
 *  - les photos des eurodéputés sont gardées (300 au plus).
 * VERSION et SHELL sont réécrits à chaque publication par scripts/build-pages.js.
 */
const VERSION = 'dev';
const SHELL = ['./', 'index.html', 'styles.css', 'i18n.js', 'groups-info.js', 'groups-old.js', 'explain.js', 'themes.js', 'guide.js', 'about.js', 'app.js', 'favicon.svg', 'manifest.webmanifest', 'icon-192.png', 'fonts/manrope-latin-400-normal.woff2', 'fonts/manrope-latin-700-normal.woff2', 'data/meta.json', 'data/members.json'];

const SHELL_CACHE = `hemi-shell-${VERSION}`;
const DATA_CACHE = 'hemi-data-v1';
const PHOTO_CACHE = 'hemi-photos-v1';
const PHOTO_MAX = 300;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => null)))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = [SHELL_CACHE, DATA_CACHE, PHOTO_CACHE];
    for (const k of await caches.keys()) if (k.startsWith('hemi-') && !keep.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

// la page demande d'utiliser tout de suite la nouvelle version
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

async function networkFirst(req) {
  const c = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) c.put(req, res.clone());
    return res;
  } catch {
    return (await c.match(req, { ignoreSearch: true })) || (await c.match('./')) || (await c.match('index.html')) || Response.error();
  }
}

async function staleWhileRevalidate(req, event) {
  const c = await caches.open(DATA_CACHE);
  const hit = await c.match(req);
  const fresh = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
  if (hit) { event.waitUntil(fresh); return hit; }
  return (await fresh) || Response.error();
}

async function cacheFirst(req, cacheName) {
  const c = await caches.open(cacheName);
  const hit = await c.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') c.put(req, res.clone());
    return res;
  } catch {
    return Response.error();
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // photos officielles des eurodéputés
  if (url.hostname === 'www.europarl.europa.eu' && url.pathname.startsWith('/mepphoto/')) {
    e.respondWith(cacheFirst(req, PHOTO_CACHE).then((r) => { e.waitUntil(trim(PHOTO_CACHE, PHOTO_MAX)); return r; }));
    return;
  }
  if (url.origin !== self.location.origin) return; // Wikipédia, Wikidata… : directement le réseau
  if (req.mode === 'navigate') { e.respondWith(networkFirst(req)); return; }
  if (/\/data\//.test(url.pathname) || /feed\.xml$/.test(url.pathname)) { e.respondWith(staleWhileRevalidate(req, e)); return; }
  e.respondWith(cacheFirst(req, SHELL_CACHE));
});
