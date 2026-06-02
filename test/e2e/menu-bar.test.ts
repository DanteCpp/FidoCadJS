/**
 * @file menu-bar.test.ts
 * @author Dante Loi
 * @date   2026-05-10
 * @brief  E2E — Menu bar dropdown interactions and commands
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { test, expect } from '@playwright/test';
import { gotoApp, loadCircuit, primitiveCount, pressKey } from './utils';

const TEST_FCD = `FJC A 1
FJC B 1
LI 10 10 90 10 0
RV 20 50 80 80 2
`;

test.describe('Menu Bar — File Menu', () => {
    test.beforeEach(async ({ page }) => {
        await gotoApp(page);
    });

    test('File menu opens and shows items', async ({ page }) => {
        const fileBtn = page.locator('button', { hasText: 'File' });
        await fileBtn.hover();
        await page.waitForTimeout(200);

        await expect(page.locator('div', { hasText: 'New' }).first()).toBeVisible();
        await expect(page.locator('div', { hasText: 'Open file' }).first()).toBeVisible();
        await expect(page.locator('div', { hasText: 'Save' }).first()).toBeVisible();
    });

    test('Edit menu shows Undo/Redo/Cut/Copy/Paste', async ({ page }) => {
        const editBtn = page.locator('button', { hasText: 'Edit' });
        await editBtn.hover();
        await page.waitForTimeout(200);

        await expect(page.locator('div', { hasText: 'Undo' }).first()).toBeVisible();
        await expect(page.locator('div', { hasText: 'Redo' }).first()).toBeVisible();
        await expect(page.locator('div', { hasText: 'Cut' }).first()).toBeVisible();
        await expect(page.locator('div', { hasText: 'Copy' }).first()).toBeVisible();
        await expect(page.locator('div', { hasText: 'Paste' }).first()).toBeVisible();
    });

    test('View menu shows Zoom and Options', async ({ page }) => {
        const viewBtn = page.locator('button', { hasText: 'View' });
        await viewBtn.hover();
        await page.waitForTimeout(200);

        await expect(page.locator('div', { hasText: 'Zoom In' }).first()).toBeVisible();
        await expect(page.locator('div', { hasText: 'Zoom Out' }).first()).toBeVisible();
        await expect(page.locator('div', { hasText: 'Fit' }).first()).toBeVisible();
    });

    test('Circuit menu shows View code', async ({ page }) => {
        const circuitBtn = page.locator('button', { hasText: 'Circuit' });
        await circuitBtn.hover();
        await page.waitForTimeout(200);

        await expect(page.locator('div', { hasText: 'View code' }).first()).toBeVisible();
    });

    test('menu items show shortcut text', async ({ page }) => {
        const editBtn = page.locator('button', { hasText: 'Edit' });
        await editBtn.hover();
        await page.waitForTimeout(200);

        await expect(page.locator('span', { hasText: 'Ctrl+Z' }).first()).toBeVisible();
        await expect(page.locator('span', { hasText: 'Ctrl+Y' }).first()).toBeVisible();
        await expect(page.locator('span', { hasText: 'Ctrl+X' }).first()).toBeVisible();
    });

    test('Options dialog has a Libraries tab with a folder picker', async ({ page }) => {
        // Open View ▸ Options.
        await page.locator('button', { hasText: 'View' }).hover();
        await page.waitForTimeout(200);
        await page.getByText('Options...', { exact: true }).click();

        const dialog = page.locator('dialog[open]');
        await expect(dialog).toBeVisible();

        // Switch to the Libraries tab.
        await dialog.locator('button', { hasText: 'Libraries' }).click();

        // The folder picker only renders where the File System Access API is
        // available (Chromium). On Firefox/WebKit the panel instead shows an
        // "unsupported" message — assert whichever applies to this browser.
        const supported = await page.evaluate(
            () =>
                typeof (window as { showDirectoryPicker?: unknown }).showDirectoryPicker ===
                    'function' && typeof indexedDB !== 'undefined',
        );
        if (supported) {
            await expect(dialog.locator('button', { hasText: 'Choose folder' })).toBeVisible();
        } else {
            await expect(dialog.getByText('does not support saving libraries')).toBeVisible();
        }
    });
});

test.describe('Menu Bar — Actions via API', () => {
    test.beforeEach(async ({ page }) => {
        await gotoApp(page);
        await loadCircuit(page, TEST_FCD);
    });

    test('Ctrl+N clears circuit (new)', async ({ page }) => {
        expect(await primitiveCount(page)).toBe(2);
        await pressKey(page, 'Control+n');
        await page.waitForTimeout(200);
        expect(await primitiveCount(page)).toBe(0);
    });

    test('Ctrl+S triggers save (does not modify circuit)', async ({ page }) => {
        expect(await primitiveCount(page)).toBe(2);
        await pressKey(page, 'Control+s');
        await page.waitForTimeout(300);
        expect(await primitiveCount(page)).toBe(2);
    });

    test('Ctrl+E triggers export dialog (does not modify circuit)', async ({ page }) => {
        expect(await primitiveCount(page)).toBe(2);
        await pressKey(page, 'Control+e');
        await page.waitForTimeout(300);
        // Export dialog should appear, circuit unchanged
        expect(await primitiveCount(page)).toBe(2);
    });
});
