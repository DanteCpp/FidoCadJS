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
import pixelmatch from 'pixelmatch';
import { gotoApp, loadCircuit, settle } from './utils';

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
    // The Export button click below auto-waits for the dialog to be actionable.
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

    test('exported PNG contains the (black) text — not white-on-white', async ({
        page,
        browserName,
    }) => {
        // The headless WebKitGTK build Playwright ships on Linux does not
        // rasterize canvas fillText (it produces a blank result regardless of
        // font family or fallback), although Path2D fills — including the
        // typeset-math path exercised by the next test — render correctly.
        // macOS/iOS Safari and all other engines render fillText fine, so no
        // real user is affected. This assertion guards the (browser-independent)
        // white-on-white colour-cache desync regression, which stays covered on
        // Chromium and Firefox.
        test.skip(
            browserName === 'webkit',
            'WebKitGTK headless on Linux does not rasterize canvas fillText',
        );
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

    test('exporting does not corrupt the on-screen render', async ({ page }) => {
        // Export renders primitives into its own coordinate space; if it leaves
        // the shared per-primitive cache stale, the next on-screen redraw
        // (triggered here by a click) shrinks/displaces the drawing.
        await loadCircuit(page, TEXT_FCD);
        await page.evaluate(() => (window as any).__FidoCadJS__.circuitPanel.zoomToFit?.());
        await settle(page);

        const canvas = page.locator('[data-testid="editor-canvas"]');
        const before = PNG.sync.read(await canvas.screenshot());

        await exportPng(page);
        const box = (await canvas.boundingBox())!;
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await settle(page);
        const after = PNG.sync.read(await canvas.screenshot());

        // The render must be essentially unchanged (a selection click may tint a
        // few pixels, so allow a small tolerance — the bug changed thousands).
        expect(before.width).toBe(after.width);
        expect(before.height).toBe(after.height);
        const diff = pixelmatch(before.data, after.data, null, before.width, before.height, {
            threshold: 0.1,
        });
        expect(diff).toBeLessThan(before.width * before.height * 0.02);
    });
});
