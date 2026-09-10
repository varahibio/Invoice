// Varahi Invoices — Service Worker
// Bump CACHE_VERSION whenever app-shell files change so returning users
// pick up the new version instead of a stale cached copy.
const CACHE_VERSION = 'varahi-invoices-v5-roboto';

const APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './img/Logo.svg',
    './img/icons/apple-touch-icon.png',
    './img/icons/icon-192.png',
    './img/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// Network-first for same-origin app-shell files (so fixes/deploys show up
// immediately on next load), falling back to cache when offline.
// Everything else (Firebase SDK, Firestore calls, Google auth, the
// external font/CDN requests) is left untouched and goes straight to the
// network — this SW intentionally does not try to cache or intercept
// those, since getting that wrong could break sign-in or invoice data.
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    const isSameOrigin = url.origin === self.location.origin;
    const isGet = event.request.method === 'GET';

    if (!isSameOrigin || !isGet) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                const clone = response.clone();
                caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});