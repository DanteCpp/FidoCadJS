import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
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

        await expect(page.locator('div', { hasText: 'New' }).first()).toBeVisible();
        await expect(page.locator('div', { hasText: 'Open file' }).first()).toBeVisible();
        await expect(page.locator('div', { hasText: 'Save' }).first()).toBeVisible();
        const preferencesLabel = page.getByText('Preferences', { exact: true });
        await expect(preferencesLabel).toBeVisible();
        const preferencesItem = preferencesLabel.locator('..').locator('..');
        await expect(preferencesItem.locator('xpath=preceding-sibling::*[1]')).toHaveAttribute(
            'role',
            'separator',
        );

        const menuLabels = await page.locator('[data-menu-label]').allTextContents();
        expect(menuLabels.every((label) => !/(?:\.{3}|…)$/.test(label))).toBe(true);
    });

    test('Edit menu shows Undo/Redo/Cut/Copy/Paste', async ({ page }) => {
        const editBtn = page.locator('button', { hasText: 'Edit' });
        await editBtn.hover();

        await expect(page.locator('div', { hasText: 'Undo' }).first()).toBeVisible();
        await expect(page.locator('div', { hasText: 'Redo' }).first()).toBeVisible();
        await expect(page.locator('div', { hasText: 'Cut' }).first()).toBeVisible();
        await expect(page.locator('div', { hasText: 'Copy' }).first()).toBeVisible();
        await expect(page.locator('div', { hasText: 'Paste' }).first()).toBeVisible();
    });

    test('View menu shows zoom actions without Preferences', async ({ page }) => {
        const viewBtn = page.locator('button', { hasText: 'View' });
        await viewBtn.hover();

        await expect(page.locator('div', { hasText: 'Zoom In' }).first()).toBeVisible();
        await expect(page.locator('div', { hasText: 'Zoom Out' }).first()).toBeVisible();
        await expect(page.locator('div', { hasText: 'Fit' }).first()).toBeVisible();
        await expect(page.getByText('Preferences', { exact: true })).toBeHidden();
    });

    test('Circuit menu shows View code', async ({ page }) => {
        const circuitBtn = page.locator('button', { hasText: 'Circuit' });
        await circuitBtn.hover();

        await expect(page.locator('div', { hasText: 'View code' }).first()).toBeVisible();
    });

    test('menu items show shortcut text', async ({ page }) => {
        const editBtn = page.locator('button', { hasText: 'Edit' });
        await editBtn.hover();

        await expect(page.locator('span', { hasText: 'Ctrl+Z' }).first()).toBeVisible();
        await expect(page.locator('span', { hasText: 'Ctrl+Y' }).first()).toBeVisible();
        await expect(page.locator('span', { hasText: 'Ctrl+X' }).first()).toBeVisible();
    });

    test('Preferences dialog has a Libraries tab with a folder picker', async ({ page }) => {
        // Open File ▸ Preferences.
        await page.locator('button', { hasText: 'File' }).hover();
        await page.getByText('Preferences', { exact: true }).click();

        const dialog = page.locator('dialog[open]');
        await expect(dialog).toBeVisible();

        // Switch to the Libraries tab.
        await dialog.getByRole('button', { name: 'Libraries', exact: true }).click();

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

    test('Preferences separates theme colors from text defaults', async ({ page }) => {
        await page.locator('button', { hasText: 'File' }).hover();
        await page.getByText('Preferences', { exact: true }).click();

        const dialog = page.locator('dialog[open]');
        const themeTab = dialog.getByRole('button', { name: 'Theme and Colors', exact: true });
        const textTab = dialog.getByRole('button', { name: 'Text', exact: true });
        await expect(themeTab).toBeVisible();
        await expect(textTab).toBeVisible();

        await themeTab.click();
        await expect(dialog.getByLabel('Render LaTeX math in editor')).toBeHidden();

        await textTab.click();
        await dialog.getByLabel('Default font:').selectOption('Georgia');
        await dialog.getByLabel('Default font size:').fill('12');
        await dialog.getByLabel('Font for name and value:').selectOption('Helvetica');
        await dialog.getByLabel('Size of name and value:').fill('5');
        await dialog.getByLabel('Render LaTeX math in editor').check();
        await dialog.getByRole('button', { name: 'OK', exact: true }).click();

        const settings = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('fidocadts.settings.v1') ?? '{}'),
        );
        expect(settings).toMatchObject({
            defaultFont: 'Georgia',
            defaultFontSize: 12,
            nameValueFont: 'Helvetica',
            nameValueFontSize: 5,
            renderTeX: true,
        });

        const modelDefaults = await page.evaluate(() => {
            const model = (window as any).__FidoCadJS__.circuitPanel.getModel();
            return {
                defaultFont: model.getDefaultTextFont(),
                defaultFontSize: model.getDefaultTextFontSize(),
                nameValueFont: model.getTextFont(),
                nameValueFontSize: model.getTextFontSize(),
            };
        });
        expect(modelDefaults).toEqual({
            defaultFont: 'Georgia',
            defaultFontSize: 12,
            nameValueFont: 'Helvetica',
            nameValueFontSize: 5,
        });
    });

    test('Libraries tab imports FCL files and exports one backup', async ({ page }) => {
        await page.locator('button', { hasText: 'File' }).hover();
        await page.getByText('Preferences', { exact: true }).click();

        const dialog = page.locator('dialog[open]');
        await dialog.getByRole('button', { name: 'Libraries', exact: true }).click();

        const importBtn = dialog.getByTestId('import-user-libraries');
        const exportBtn = dialog.getByTestId('export-user-libraries');
        await expect(importBtn).toBeEnabled();
        await expect(exportBtn).toBeDisabled();

        const fileChooserPromise = page.waitForEvent('filechooser');
        await importBtn.click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles([
            {
                name: 'test-library.fcl',
                mimeType: 'text/plain',
                buffer: Buffer.from('[FIDOLIB Test library]\n{Test}\n[BOX Box]\nRV 0 0 20 20 0\n'),
            },
        ]);

        await expect
            .poll(() => page.evaluate(() => localStorage.getItem('fidocadts.lib.v1.test-library')))
            .toContain('[FIDOLIB Test library]');
        await expect(exportBtn).toBeEnabled();

        const downloadPromise = page.waitForEvent('download');
        await exportBtn.click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe('fidocadjs-libraries-backup.json');

        const downloadPath = await download.path();
        expect(downloadPath).not.toBeNull();
        const backup = JSON.parse(await readFile(downloadPath!, 'utf8'));
        expect(backup).toMatchObject({
            format: 'fidocadjs-user-libraries',
            version: 1,
            libraries: [
                {
                    prefix: 'test-library',
                },
            ],
        });
        expect(backup.libraries[0].content).toContain('[FIDOLIB Test library]');
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
        await expect.poll(() => primitiveCount(page)).toBe(0);
    });

    test('Ctrl+S triggers save (does not modify circuit)', async ({ page }) => {
        expect(await primitiveCount(page)).toBe(2);
        await pressKey(page, 'Control+s');
        expect(await primitiveCount(page)).toBe(2);
    });

    test('Ctrl+E opens the export dialog without modifying the circuit', async ({ page }) => {
        expect(await primitiveCount(page)).toBe(2);
        await pressKey(page, 'Control+e');
        // The export dialog must actually appear (format dropdown visible)…
        await expect(page.locator('select option', { hasText: 'PNG (Bitmap)' })).toHaveCount(1);
        // …and the circuit must be unchanged.
        expect(await primitiveCount(page)).toBe(2);
    });
});
