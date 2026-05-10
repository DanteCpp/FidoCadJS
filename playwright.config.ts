/**
 * @file playwright.config.ts
 * @author Dante Loi
 * @date   2026-05-10
 * @brief  Playwright E2E configuration for FidoCadJS
 */

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 3,
  reporter: [['list'], ['html', { outputFolder: 'test/e2e/report' }]],
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1280, height: 900 },
    actionTimeout: 10_000,
  },
  webServer: {
    command: 'npm run dev -- --host 0.0.0.0',
    url: 'http://localhost:5173/FidoCadJS/',
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
