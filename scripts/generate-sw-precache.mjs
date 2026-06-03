/*
 * Filename:    generate-sw-precache.mjs
 * Author:      Dante Loi
 * Date:        2026-06-03
 * Description: Post-build step that injects the precache manifest and a
 *              content-derived cache name into the built service worker so the
 *              FidoCadJS PWA works fully offline.
 * Copyright:   (c) 2026 Dante Loi. Released under the GPL v3 license.
 * Details:     Runs after `vite build`. Recursively scans dist/, collects every
 *              servable asset (skipping the service worker itself, source maps,
 *              and the directory index), and rewrites the `__CACHE_NAME__` and
 *              `__PRECACHE_URLS__` placeholders left in dist/sw.js. The cache
 *              name embeds a hash of the manifest, so any asset change (already
 *              reflected by Vite's content-hashed filenames) yields a new cache
 *              name and the activate handler evicts the previous one.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = fileURLToPath(new URL('../dist', import.meta.url));
const swPath = join(distDir, 'sw.js');

// Files we never want in the precache: the worker itself, source maps (large,
// not needed offline), and the manifest placeholder file if any.
const EXCLUDE = new Set(['sw.js']);
const isSourceMap = (name) => name.endsWith('.map');

/** Recursively list files under `dir`, returned as paths relative to distDir. */
function listFiles(dir) {
    const out = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            out.push(...listFiles(full));
        } else {
            out.push(relative(distDir, full));
        }
    }
    return out;
}

const files = listFiles(distDir)
    .filter((rel) => {
        const name = rel.split(sep).pop();
        // Skip the worker, source maps, and dotfiles (e.g. macOS .DS_Store).
        return !EXCLUDE.has(name) && !isSourceMap(name) && !name.startsWith('.');
    })
    // Normalize to forward slashes and make scope-relative URLs.
    .map((rel) => './' + rel.split(sep).join('/'))
    .sort();

if (files.length === 0) {
    console.error('[sw-precache] No assets found under dist/. Did `vite build` run?');
    process.exit(1);
}

// Always serve "./" (the directory index) from cache for offline navigations.
const precacheUrls = ['./', ...files];

// Cache name derived from the actual file CONTENTS, not just the names. Most
// assets are content-hashed by Vite, but index.html, manifest.webmanifest and
// the .fcl libraries are not — so a content-only change to those must still
// produce a new cache name, otherwise the activate handler would keep serving
// the stale copies. Hashing contents covers every case. ("./" mirrors
// index.html, which is already hashed via its own entry, so skip it.)
const digest = createHash('sha256');
for (const url of precacheUrls) {
    digest.update(url);
    if (url !== './') digest.update(readFileSync(join(distDir, url.slice(2))));
}
const cacheName = `fidocadjs-${digest.digest('hex').slice(0, 12)}`;

let sw = readFileSync(swPath, 'utf8');

if (!sw.includes('__CACHE_NAME__') || !sw.includes('/* __PRECACHE_URLS__ */')) {
    console.error('[sw-precache] Placeholders not found in dist/sw.js — aborting.');
    process.exit(1);
}

const urlsLiteral = precacheUrls.map((u) => `    ${JSON.stringify(u)},`).join('\n');

sw = sw
    .replaceAll('__CACHE_NAME__', cacheName)
    .replace('    /* __PRECACHE_URLS__ */', urlsLiteral);

writeFileSync(swPath, sw);

console.log(
    `[sw-precache] Injected ${precacheUrls.length} URLs into dist/sw.js (cache: ${cacheName}).`,
);
