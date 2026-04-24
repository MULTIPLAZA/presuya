// ============================================
// Service Worker básico — solo shell caching
// ============================================
const CACHE_NAME = 'presuya-v3';
const ASSETS = [
    './',
    './index.html',
    './dashboard.html',
    './editor.html',
    './perfil.html',
    './css/styles.css',
    './manifest.json',
    './assets/icons/icon.svg',
    './assets/icons/icon-maskable.svg',
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
    if (url.origin.includes('supabase.co') || url.pathname.includes('/auth/')) {
        return;
    }
    if (e.request.method !== 'GET') return;

    // Navegaciones top-level: network-first, y si hay redirect reconstruimos el
    // Response para evitar "a redirected response was used for a request whose
    // redirect mode is not 'follow'". Cache como fallback offline.
    if (e.request.mode === 'navigate') {
        e.respondWith((async () => {
            try {
                const resp = await fetch(e.request.url, { credentials: 'same-origin' });
                if (resp.redirected) {
                    const body = await resp.blob();
                    return new Response(body, {
                        status: resp.status,
                        statusText: resp.statusText,
                        headers: resp.headers,
                    });
                }
                if (resp.ok && url.origin === location.origin) {
                    const clone = resp.clone();
                    caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                }
                return resp;
            } catch {
                const cached = await caches.match(e.request);
                return cached || caches.match('./index.html');
            }
        })());
        return;
    }

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
