/*
 * Filename:    sw.js
 * Author:      Dante Loi
 * Date:        2026-06-03
 * Description: Service worker for the FidoCadJS PWA. Provides installability
 *              (a prerequisite for the File Handling API) and basic offline
 *              support via runtime caching.
 * Copyright:   (c) 2026 Dante Loi. Released under the GPL v3 license.
 * Details:     Uses a network-first strategy: fresh responses are served and
 *              cached on success; on network failure the cached copy (if any)
 *              is returned. Asset filenames are content-hashed by Vite, so a
 *              runtime cache avoids hard-coding build-specific names. Bump
 *              CACHE_NAME to invalidate previously cached responses.
 */

const CACHE_NAME = 'fidocadjs-v1';

self.addEventListener('install', () => {
    // Activate this worker immediately rather than waiting for old tabs.
    self.skipWaiting();
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

    event.respondWith(
        (async () => {
            try {
                const response = await fetch(request);
                // Cache successful basic responses for offline fallback.
                if (response && response.ok && response.type === 'basic') {
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(request, response.clone());
                }
                return response;
            } catch {
                const cached = await caches.match(request);
                if (cached) return cached;
                // Last resort for navigations: serve the cached app shell.
                if (request.mode === 'navigate') {
                    const shell = await caches.match('./');
                    if (shell) return shell;
                }
                throw new Error('Network error and no cached response available.');
            }
        })(),
    );
});
