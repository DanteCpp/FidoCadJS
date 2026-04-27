import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './test/e2e',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: [['html', { outputFolder: 'playwright-report' }]],
    use: {
        baseURL: 'http://localhost:4173',
        headless: true,
        viewport: { width: 1280, height: 720 },
    },
    webServer: {
        command: 'npm run preview',
        port: 4173,
        reuseExistingServer: !process.env.CI,
    },
});
