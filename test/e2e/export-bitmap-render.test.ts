/**
 * @file export-bitmap-render.test.ts
 * @author Dante Loi
 * @date 2026-06-03
 * @brief E2E — the PNG/JPG bitmap export (renderToOffscreen) renders filled
 *        primitives, not just strokes. Regression test for a white-on-white
 *        bug where the direct background fill desynced the GraphicsCanvas
 *        colour cache, making black text and math fills invisible.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { gotoApp, loadCircuit } from './utils';

// Black text on layer 0 (the colour that used to be skipped) inside a frame.
const TEXT_FCD = `[FIDOCAD]
RV 20 20 220 120 1
TY 40 50 24 16 0 0 0 * HELLO
`;
const MATH_FCD = `[FIDOCAD]
RV 20 20 240 120 1
TY 40 55 24 16 0 0 0 * $\\frac{a}{b}+\\sqrt{x}$
`;

/** Export a PNG through the real dialog and return its decoded pixels. */
async function exportPng(page: import('@playwright/test').Page): Promise<PNG> {
    await page.keyboard.press('Control+e');
    await page.waitForTimeout(300);
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('button', { hasText: 'Export' }).click(),
    ]);
    const path = await download.path();
    const fs = await import('node:fs');
    return PNG.sync.read(fs.readFileSync(path));
}

/** Count near-black pixels (the ink that text/math fills should produce). */
function darkPixelCount(png: PNG): number {
    let n = 0;
    for (let i = 0; i < png.data.length; i += 4) {
        const r = png.data[i],
            g = png.data[i + 1],
            b = png.data[i + 2];
        if (r < 80 && g < 80 && b < 80) n++;
    }
    return n;
}

test.describe('Bitmap export rendering', () => {
    test.beforeEach(async ({ page }) => {
        await gotoApp(page);
    });

    test('exported PNG contains the (black) text — not white-on-white', async ({ page }) => {
        await loadCircuit(page, TEXT_FCD);
        const png = await exportPng(page);
        // "HELLO" at 24pt produces many ink pixels; the old bug yielded ~0.
        expect(darkPixelCount(png)).toBeGreaterThan(200);
    });

    test('exported PNG contains typeset math ink', async ({ page }) => {
        await loadCircuit(page, MATH_FCD);
        const png = await exportPng(page);
        expect(darkPixelCount(png)).toBeGreaterThan(200);
    });
});
