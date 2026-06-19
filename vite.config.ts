import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    base: '/FidoCadJS/',
    root: '.',
    publicDir: 'public',
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
    },
    build: {
        target: 'es2022',
        outDir: 'dist',
        sourcemap: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
            },
        },
    },
    test: {
        environment: 'jsdom',
        include: ['test/**/*.test.ts'],
        exclude: ['test/e2e/**/*.test.ts'],
        setupFiles: ['./test/setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'html'],
            include: ['src/**/*.ts'],
            exclude: ['src/vendor/**'],
            // Ratcheting thresholds — set ~1 pt under the measured coverage
            // (66.9 % lines, 60.9 % functions, 80.4 % branches as of
            // 2026-06-11) so the gate enforces the current floor without
            // flaking on minor refactors. Bump these after every PR that
            // raises coverage; never lower them to make a build pass.
            // Failures here block `npm run test:coverage`.
            thresholds: {
                lines: 65,
                statements: 65,
                functions: 60,
                branches: 79,
            },
        },
    },
});
