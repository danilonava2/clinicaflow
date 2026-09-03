const CACHE_NAME = 'clinicaflow-shell-v1';

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './favicon.png',
  './logo-clinicaflow.png',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './src/main.js',
  './src/store.js',
  './src/firebase/config.js',
  './src/firebase/authService.js',
  './src/firebase/firestoreDataService.js',
  './src/firebase/migration.js',
  './src/firebase/realtimeDataService.js',
  './src/ui/navigation.js',
  './src/ui/modals.js',
  './src/modules/centros.js',
  './src/modules/pacientes.js',
  './src/modules/dashboard.js',
  './src/modules/reportes.js',
  './src/modules/backup.js',
  './src/utils/rut.js',
  './src/utils/format.js',
  './src/utils/download.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Solo se cachea la interfaz (HTML/CSS/JS/iconos) para que la app abra
// rapido e instalada. Los datos (Firestore/Auth) siempre van directo a la
// red, sin pasar por este cache.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
