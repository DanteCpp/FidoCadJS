/*
 * Filename:    sw.js
 * Author:      Dante Loi
 * Date:        2026-06-03
 * Description: Service worker for the FidoCadJS PWA. Provides installability
 *              (a prerequisite for the File Handling API) and full offline
 *              support via build-time precaching.
 * Copyright:   (c) 2026 Dante Loi. Released under the GPL v3 license.
 * Details:     On install the worker precaches the complete set of built
 *              assets (app shell, hashed JS, libraries, icons, manifest).
 *              The precache list and CACHE_NAME are injected at build time by
 *              scripts/generate-sw-precache.mjs — the placeholders below are
 *              replaced against the freshly built dist/ tree, so the cache is
 *              invalidated automatically whenever any asset changes.
 *
 *              Runtime strategy:
 *                - Navigations (HTML): network-first, falling back to the
 *                  cached app shell so the editor still launches offline while
 *                  preferring fresh markup when the network is available.
 *                - Other same-origin GETs: cache-first. Built assets are
 *                  content-hashed and therefore immutable, so a cache hit is
 *                  always correct; misses are fetched and cached at runtime.
 */

// Both placeholders are replaced at build time by generate-sw-precache.mjs.
// An un-rewritten copy is harmless: the SW is only registered for PROD builds,
// and an empty precache list simply disables precaching.
const CACHE_NAME = '__CACHE_NAME__';

// Replaced at build time with the list of precache URLs (relative to scope).
const PRECACHE_URLS = [
    /* __PRECACHE_URLS__ */
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        (async () => {
            if (PRECACHE_URLS.length > 0) {
                const cache = await caches.open(CACHE_NAME);
                await cache.addAll(PRECACHE_URLS);
            }
            // Activate this worker immediately rather than waiting for old tabs.
            await self.skipWaiting();
        })(),
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            // Drop stale caches from previous versions.
            const keys = await caches.keys();
            await Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
            );
            await self.clients.claim();
        })(),
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Only handle same-origin GET requests; let everything else pass through.
    if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
        return;
    }

    // Vite tags its module scripts and stylesheets with `crossorigin`, so the
    // browser sends an `Origin` header on those requests at runtime. The same
    // assets are served with `Vary: Origin`, and the precache fetch carried no
    // such header — so a default cache.match (which honours Vary) would MISS
    // and the worker would fall through to the network, breaking offline use.
    // Filenames are content-hashed, so a URL always maps to identical bytes;
    // ignoring Vary is therefore both safe and necessary.
    const matchOpts = { ignoreVary: true };

    // Navigations: prefer the network, fall back to the cached app shell.
    if (request.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    return await fetch(request);
                } catch {
                    const cache = await caches.open(CACHE_NAME);
                    return (
                        (await cache.match(request, matchOpts)) ||
                        (await cache.match('./index.html', matchOpts)) ||
                        (await cache.match('./', matchOpts)) ||
                        Response.error()
                    );
                }
            })(),
        );
        return;
    }

    // Assets: cache-first. Immutable hashed filenames make hits always valid.
    event.respondWith(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            const cached = await cache.match(request, matchOpts);
            if (cached) return cached;
            const response = await fetch(request);
            if (response && response.ok && response.type === 'basic') {
                cache.put(request, response.clone());
            }
            return response;
        })(),
    );
});
