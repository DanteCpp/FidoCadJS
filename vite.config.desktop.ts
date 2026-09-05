import { defineConfig } from 'vite';
import { rm } from 'node:fs/promises';
import { resolve } from 'path';

/**
 * Renderer build for the Electron app. Differs from the web build in two ways:
 * assets are addressed relatively (the bundle is served from app://, not from a
 * path on a web server), and the service worker is dropped — the desktop app
 * never registers one, and `generate-sw-precache` does not run over this
 * output, so shipping sw.js would ship its unfilled placeholders.
 */
export default defineConfig({
    base: './',
    root: '.',
    publicDir: 'public',
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
    },
    build: {
        target: 'es2022',
        outDir: 'dist-desktop',
        emptyOutDir: true,
        sourcemap: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
            },
        },
    },
    plugins: [
        {
            name: 'fidocadjs-strip-service-worker',
            apply: 'build',
            closeBundle() {
                return rm(resolve(__dirname, 'dist-desktop', 'sw.js'), { force: true });
            },
        },
    ],
});
