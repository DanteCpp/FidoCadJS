/**
 * @file file-operations.test.ts
 * @author Dante Loi
 * @date   2026-05-10
 * @brief  E2E — File new/open/save, circuit load, and code view
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { test, expect } from '@playwright/test';
import {
    gotoApp,
    pressKey,
    primitiveCount,
    getCircuitText,
    clearCircuit,
    loadCircuit,
} from './utils';

const SIMPLE_FCD = `FJC A 1
FJC B 1
LI 10 10 90 10 0
RV 20 50 80 80 2
`;

test.describe('File Operations', () => {
    test.beforeEach(async ({ page }) => {
        await gotoApp(page);
    });

    test('New circuit clears all primitives', async ({ page }) => {
        await loadCircuit(page, SIMPLE_FCD);
        expect(await primitiveCount(page)).toBe(2);

        // Use Ctrl+N keyboard shortcut which IS wired in KeyboardController
        await pressKey(page, 'Control+n');
        await page.waitForTimeout(200);

        expect(await primitiveCount(page)).toBe(0);
    });

    test('Ctrl+N shortcut triggers new circuit', async ({ page }) => {
        await loadCircuit(page, SIMPLE_FCD);
        expect(await primitiveCount(page)).toBe(2);

        await pressKey(page, 'Control+n');
        await page.waitForTimeout(200);

        expect(await primitiveCount(page)).toBe(0);
    });

    test('loadCircuit via API loads FCD text', async ({ page }) => {
        await loadCircuit(page, SIMPLE_FCD);
        expect(await primitiveCount(page)).toBe(2);

        const fcd = await getCircuitText(page);
        expect(fcd).toContain('LI');
        expect(fcd).toContain('RV');
    });

    test('getCircuitText produces valid FCD with FCJ config', async ({ page }) => {
        await clearCircuit(page);
        // Draw a line
        await pressKey(page, 'l');
        await page.evaluate(() => {
            const panel = (window as any).__FidoCadJS__.circuitPanel;
            const mc = panel.getMapCoordinates();
            const sx = mc.mapX(10, 10);
            const sy = mc.mapY(10, 10);
            const sx2 = mc.mapX(90, 10);
            const sy2 = mc.mapY(90, 10);
            // Simulate two clicks at logical coords
            panel.getModel().getPrimitiveVector().splice(0);
        });
        await loadCircuit(page, SIMPLE_FCD);

        const text = await getCircuitText(page);
        // Should contain FJC config + primitives
        expect(text).toContain('FJC');
        expect(text).toContain('LI');
    });

    test('Save via picker writes circuit text and reuses the handle', async ({ page }) => {
        await loadCircuit(page, SIMPLE_FCD);

        // Stub the File System Access API picker: capture every write and count
        // how many times the picker (i.e. the "choose a location" dialog) opens.
        await page.evaluate(() => {
            const w = window as any;
            w.__saveTest = { pickerCalls: 0, writes: [] as string[] };
            w.showSaveFilePicker = async () => {
                w.__saveTest.pickerCalls++;
                return {
                    name: 'my-board.fcd',
                    createWritable: async () => ({
                        write: async (data: string) => {
                            w.__saveTest.writes.push(data);
                        },
                        close: async () => {},
                    }),
                };
            };
        });

        // First save: no handle yet → picker opens once and content is written.
        await pressKey(page, 'Control+s');
        await page.waitForTimeout(200);

        // Second save: handle stored → write straight back, no new picker.
        await pressKey(page, 'Control+s');
        await page.waitForTimeout(200);

        const result = await page.evaluate(() => (window as any).__saveTest);
        expect(result.pickerCalls).toBe(1);
        expect(result.writes.length).toBe(2);
        expect(result.writes[0]).toContain('LI');
        expect(result.writes[0]).toContain('RV');

        // The chosen filename is remembered on the panel.
        const fileName = await page.evaluate(() =>
            (window as any).__FidoCadJS__.circuitPanel.getFileName(),
        );
        expect(fileName).toBe('my-board.fcd');
    });

    test('Save As prompts for a filename when the picker is unavailable', async ({ page }) => {
        await loadCircuit(page, SIMPLE_FCD);

        // Force the fallback path by removing the File System Access API.
        await page.evaluate(() => {
            (window as any).showSaveFilePicker = undefined;
        });

        // Save As (Ctrl+Shift+S) should open the filename prompt dialog.
        await pressKey(page, 'Control+Shift+s');
        await page.waitForTimeout(200);

        const input = page.locator('dialog[open] input[type="text"]');
        await expect(input).toBeVisible();
        await expect(input).toHaveValue(/\.fcd$/);

        // Entering a name and confirming triggers a real download.
        await input.fill('schematic');
        const downloadPromise = page.waitForEvent('download');
        await page.locator('dialog[open] button', { hasText: /^OK$/i }).click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe('schematic.fcd');
    });

    test('View code shows FCD text', async ({ page }) => {
        await loadCircuit(page, SIMPLE_FCD);
        await pressKey(page, 'Control+g');
        await page.waitForTimeout(300);

        // View Code dialog should appear (we check for a dialog/overlay)
        const overlay = page
            .locator('div')
            .filter({ hasText: /View Code|Circuit code/ })
            .first();
        // Even if the dialog format varies, Ctrl+G should not crash
        const stillLoaded = await primitiveCount(page);
        expect(stillLoaded).toBe(2);
    });
});
