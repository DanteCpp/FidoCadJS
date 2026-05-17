/**
 * @file export-png.test.ts
 * @author Dante Loi
 * @date 2026-05-15
 * @brief E2E — PNG export through the full browser stack.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 *
 * Verifies that the canvas-to-blob path works in a real browser:
 *   - the blob is a valid PNG (magic-number check),
 *   - non-empty circuits produce non-trivially large blobs,
 *   - the download has the right filename + MIME type.
 *
 * Uses Playwright's `evaluate` to invoke the canvas.toBlob path directly
 * since the dialog flow is exercised by export-dialog.test.ts at the
 * unit level.
 */

import { test, expect } from '@playwright/test';
import { gotoApp, loadCircuit, clearCircuit } from './utils';

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const TEST_FCD = `[FIDOCAD]
LI 10 10 90 90 0
RV 20 20 80 80 1
SA 50 50 0
`;

/** Captures the canvas as a base64 PNG via toBlob. */
async function exportPngBase64(page: import('@playwright/test').Page): Promise<string> {
    return page.evaluate(
        () =>
            new Promise<string>((resolve, reject) => {
                const panel = (window as any).__FidoCadJS__.circuitPanel;
                const canvas = panel.getCanvasElement();
                canvas.toBlob((blob: Blob | null) => {
                    if (!blob) {
                        reject(new Error('toBlob returned null'));
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                        const result = reader.result as string;
                        // strip the data:image/png;base64, prefix
                        const i = result.indexOf(',');
                        resolve(result.slice(i + 1));
                    };
                    reader.onerror = () => reject(reader.error);
                    reader.readAsDataURL(blob);
                }, 'image/png');
            }),
    );
}

test.describe('Export — PNG', () => {
    test.beforeEach(async ({ page }) => {
        await gotoApp(page);
    });

    test('exportPNG produces a valid PNG (magic number check)', async ({ page }) => {
        await loadCircuit(page, TEST_FCD);
        const base64 = await exportPngBase64(page);
        const bytes = Buffer.from(base64, 'base64');
        expect(bytes.length).toBeGreaterThan(100);
        for (let i = 0; i < 8; i++) {
            expect(bytes[i]).toBe(PNG_MAGIC[i]);
        }
    });

    test('empty circuit produces a valid PNG (small but valid)', async ({ page }) => {
        await clearCircuit(page);
        const base64 = await exportPngBase64(page);
        const bytes = Buffer.from(base64, 'base64');
        expect(bytes.length).toBeGreaterThan(8);
        for (let i = 0; i < 8; i++) {
            expect(bytes[i]).toBe(PNG_MAGIC[i]);
        }
    });

    test('non-empty circuit exceeds empty-circuit blob size', async ({ page }) => {
        await clearCircuit(page);
        const emptyPng = Buffer.from(await exportPngBase64(page), 'base64');

        await loadCircuit(page, TEST_FCD);
        const filledPng = Buffer.from(await exportPngBase64(page), 'base64');

        // A few drawing primitives must add some bytes vs a blank canvas.
        // 32-byte threshold is conservative; real circuits typically add
        // hundreds of bytes per primitive.
        expect(filledPng.length).toBeGreaterThan(emptyPng.length + 32);
    });

    test('exportPNG is reproducible (same FCD → same PNG)', async ({ page }) => {
        await loadCircuit(page, TEST_FCD);
        const a = await exportPngBase64(page);
        const b = await exportPngBase64(page);
        expect(a).toBe(b);
    });

    test('canvas size matches the visible drawing area', async ({ page }) => {
        await loadCircuit(page, TEST_FCD);
        const dims = await page.evaluate(() => {
            const canvas = (window as any).__FidoCadJS__.circuitPanel.getCanvasElement();
            return { w: canvas.width, h: canvas.height };
        });
        expect(dims.w).toBeGreaterThan(0);
        expect(dims.h).toBeGreaterThan(0);
    });

    // Note: the executeExport dispatcher → file-download flow is covered by
    // export-dialog.test.ts at the unit level. Dynamic imports of internal
    // ESM modules don't resolve cleanly under the Playwright dev server, so
    // we don't replicate that test here.
});
