/**
 * @file      playwright.config.ts
 * @author    Dante Loi
 * @date      2026-05-17
 * @brief     Playwright E2E configuration for FidoCadJS.
 * @details   Runs against the production build served by `vite preview`
 *            (not the dev server) so tests catch base-path, minification,
 *            and env-replacement bugs that dev mode hides. Defines three
 *            projects so CI can select an engine via `--project=<name>`.
 * @copyright (c) 2026 Dante Loi
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './test/e2e',
    timeout: 60_000,
    expect: { timeout: 10_000 },
    retries: 0,
    workers: 3,
    reporter: [['list'], ['html', { outputFolder: 'test/e2e/report' }]],
    use: {
        baseURL: 'http://localhost:4173',
        viewport: { width: 1280, height: 900 },
        actionTimeout: 10_000,
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    ],
    webServer: {
        command: 'npm run preview -- --host 0.0.0.0 --port 4173 --strictPort',
        url: 'http://localhost:4173/FidoCadJS/',
        reuseExistingServer: true,
        timeout: 30_000,
    },
});
