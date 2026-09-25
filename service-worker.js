// Fonctionnement hors connexion : les fichiers de l'application (jamais les données)
// sont gardés sur l'appareil. Changer VERSION à chaque mise à jour de l'application.
const VERSION = 'v1';
const CACHE = `mes-acquereurs-${VERSION}`;
const FICHIERS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/db.js',
  'js/donnees.js',
  'js/ui.js',
  'js/dictee.js',
  'js/acquereurs.js',
  'js/echanges.js',
  'js/relances.js',
  'js/messages.js',
  'js/biens.js',
  'js/agenda.js',
  'js/sauvegarde.js',
  'js/reglages.js',
  'js/app.js',
  'icones/icone.svg',
  'icones/icone-192.png',
  'icones/icone-512.png',
  'icones/icone-maskable-512.png',
  'icones/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((c) => c.startsWith('mes-acquereurs-') && c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

// Réponse immédiate depuis l'appareil, puis mise à jour en arrière-plan quand il y a du réseau.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const enCache = await cache.match(req, { ignoreSearch: true });
      const reseau = fetch(req)
        .then((rep) => {
          if (rep.ok) cache.put(req, rep.clone());
          return rep;
        })
        .catch(() => null);
      if (enCache) {
        e.waitUntil(reseau);
        return enCache;
      }
      const rep = await reseau;
      if (rep) return rep;
      if (req.mode === 'navigate') return cache.match('index.html');
      return Response.error();
    }),
  );
});
