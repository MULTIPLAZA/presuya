// ============================================
// Service Worker básico — solo shell caching
// ============================================
const CACHE_NAME = 'presuya-v1';
const ASSETS = [
    './',
    './index.html',
    './dashboard.html',
    './editor.html',
    './perfil.html',
    './css/styles.css',
    './manifest.json',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS).catch(() => {}))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);
    // No cachear llamadas a supabase ni a CDNs dinámicos
    if (url.origin.includes('supabase.co') || url.pathname.includes('/auth/')) {
        return;
    }
    if (e.request.method !== 'GET') return;

    e.respondWith(
        caches.match(e.request).then(cached => {
            return cached || fetch(e.request).then(resp => {
                if (resp && resp.status === 200 && url.origin === location.origin) {
                    const clone = resp.clone();
                    caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                }
                return resp;
            }).catch(() => cached);
        })
    );
});
