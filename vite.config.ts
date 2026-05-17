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
            // Starting thresholds — chosen against the present coverage
            // numbers so the gate is enforcing the current floor rather
            // than aspirational. Ratchet upward as Phase 5+ work lands.
            // Failures here block `npm run test:coverage`.
            thresholds: {
                lines: 55,
                statements: 55,
                functions: 58,
                branches: 75,
            },
        },
    },
});
