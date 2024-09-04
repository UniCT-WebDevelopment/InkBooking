const CACHE_NAME = 'inkbooking-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/scripts.js',
    '/logo-192x192.png',
    '/logo-512x512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                return response || fetch(event.request);
            })
    );
});