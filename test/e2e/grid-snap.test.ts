import { test, expect } from '@playwright/test';
import { gotoApp } from './utils';

test.describe('Grid Toggle', () => {
    test.beforeEach(async ({ page }) => {
        await gotoApp(page);
    });

    test('Show Grid button toggles grid', async ({ page }) => {
        const gridBtn = page.locator('button', { hasText: 'Show grid' });
        await expect(gridBtn).toBeVisible();

        // Click to toggle off
        await gridBtn.click();
        await expect
            .poll(() =>
                page.evaluate(() => (window as any).__FidoCadJS__.circuitPanel.isGridVisible()),
            )
            .toBe(false);

        // Click to toggle back on
        await gridBtn.click();
        await expect
            .poll(() =>
                page.evaluate(() => (window as any).__FidoCadJS__.circuitPanel.isGridVisible()),
            )
            .toBe(true);
    });
});

test.describe('Snap Toggle', () => {
    test.beforeEach(async ({ page }) => {
        await gotoApp(page);
    });

    test('Snap button toggles snap-to-grid', async ({ page }) => {
        const snapBtn = page.locator('button', { hasText: 'Snap' });
        await expect(snapBtn).toBeVisible();

        // Default: snap active
        expect(
            await page.evaluate(() => {
                const panel = (window as any).__FidoCadJS__.circuitPanel;
                return panel.isSnapActive();
            }),
        ).toBe(true);

        // Toggle off
        await snapBtn.click();
        await expect
            .poll(() =>
                page.evaluate(() => (window as any).__FidoCadJS__.circuitPanel.isSnapActive()),
            )
            .toBe(false);

        // Toggle back on
        await snapBtn.click();
        await expect
            .poll(() =>
                page.evaluate(() => (window as any).__FidoCadJS__.circuitPanel.isSnapActive()),
            )
            .toBe(true);
    });
});
