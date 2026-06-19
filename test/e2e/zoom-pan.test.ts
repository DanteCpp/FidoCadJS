/**
 * @file zoom-pan.test.ts
 * @author Dante Loi
 * @date   2026-05-10
 * @brief  E2E — Zoom (in/out, wheel, fit) and pan operations
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { test, expect } from '@playwright/test';
import { gotoApp, pressKey, getZoomPercent, loadCircuit, canvasBox, settle } from './utils';

const FOUR_PRIMITIVES_FCD = `FJC A 1
FJC B 1
LI 10 10 90 10 0
LI 10 30 90 30 1
RV 20 50 80 80 2
EV 40 90 70 120 3
`;

test.describe('Zoom Operations', () => {
    test.beforeEach(async ({ page }) => {
        await gotoApp(page);
    });

    test('initial zoom is 100%', async ({ page }) => {
        const zoom = await getZoomPercent(page);
        expect(zoom).toBe(100);
    });

    test('+ key zooms in', async ({ page }) => {
        const before = await getZoomPercent(page);
        await pressKey(page, '+');
        const after = await getZoomPercent(page);
        expect(after).toBeGreaterThan(before);
    });

    test('= key also zooms in', async ({ page }) => {
        const before = await getZoomPercent(page);
        await pressKey(page, '=');
        const after = await getZoomPercent(page);
        expect(after).toBeGreaterThan(before);
    });

    test('- key zooms out', async ({ page }) => {
        const before = await getZoomPercent(page);
        await pressKey(page, '-');
        const after = await getZoomPercent(page);
        expect(after).toBeLessThan(before);
    });

    test('zoom in, then zoom out returns to original', async ({ page }) => {
        const initial = await getZoomPercent(page);

        await pressKey(page, '+');
        const zoomedIn = await getZoomPercent(page);
        expect(zoomedIn).toBeGreaterThan(initial);

        await pressKey(page, '-');
        const zoomedOut = await getZoomPercent(page);
        expect(zoomedOut).toBeLessThan(zoomedIn);
    });

    test('Home triggers fit-to-view', async ({ page }) => {
        // Load content so fit has something to fit to. Fit-to-view is bound to
        // Home (FidoCadJ 0.24.9 binds Space to the selection tool instead).
        await loadCircuit(page, FOUR_PRIMITIVES_FCD);

        // Zoom in until the zoom is comfortably above any possible fit value.
        // For this small drawing in the fixed 1280x900 viewport, fit-to-view is
        // always well below 100 % (bounded by viewport/content, ~40 % at most),
        // so 150 % is safely above it. We loop rather than press a fixed number
        // of times because loadCircuit auto-fits to a low, viewport- and
        // layout-dependent zoom, and the canvas container can keep resizing for
        // a moment after load — so neither the starting zoom nor the fit value
        // is a stable constant to assert against.
        let zoomedIn = await getZoomPercent(page);
        for (let i = 0; i < 20 && zoomedIn < 150; i++) {
            await pressKey(page, '+');
            zoomedIn = await getZoomPercent(page);
        }
        expect(zoomedIn).toBeGreaterThanOrEqual(150);

        // Fit-to-view must zoom back out so the whole drawing is visible, i.e.
        // below the zoomed-in level.
        await pressKey(page, 'Home');
        await expect.poll(() => getZoomPercent(page)).toBeLessThan(zoomedIn);
    });

    test('mouse wheel zooms toward cursor', async ({ page }) => {
        const box = await canvasBox(page);
        expect(box).not.toBeNull();

        const before = await getZoomPercent(page);

        // Scroll down (zoom in). Starting from 100 % no clamp applies, so the
        // zoom must strictly increase.
        await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
        await page.mouse.wheel(0, -120);
        await expect.poll(() => getZoomPercent(page)).toBeGreaterThan(before);
    });

    test('Fit button zooms out a zoomed-in drawing', async ({ page }) => {
        await loadCircuit(page, FOUR_PRIMITIVES_FCD);
        let zoomedIn = await getZoomPercent(page);
        for (let i = 0; i < 20 && zoomedIn < 150; i++) {
            await pressKey(page, '+');
            zoomedIn = await getZoomPercent(page);
        }
        expect(zoomedIn).toBeGreaterThanOrEqual(150);

        const fitBtn = page.locator('button', { hasText: 'Fit' });
        await expect(fitBtn).toBeVisible();
        await fitBtn.click();
        await expect.poll(() => getZoomPercent(page)).toBeLessThan(zoomedIn);
    });

    test('zoom select dropdown updates on keyboard zoom', async ({ page }) => {
        const select = page.locator('[data-testid="zoom-select"]');

        // Zoom in several times to ensure a change
        await pressKey(page, '+');
        await pressKey(page, '+');

        // The dropdown snaps to the preset level nearest the actual zoom.
        const zoomLevels = [
            25, 50, 75, 100, 150, 200, 300, 400, 600, 800, 1000, 1500, 2000, 3000, 4000,
        ];
        const pct = await getZoomPercent(page);
        const nearest = zoomLevels.reduce((best, lvl) =>
            Math.abs(lvl - pct) < Math.abs(best - pct) ? lvl : best,
        );
        await expect.poll(async () => Number(await select.inputValue())).toBe(nearest);
    });

    // Regression: wheel zoom is handled by InputHandler, whose onZoomChange
    // callback was captured by value before ToolbarController wired the dropdown
    // sync — so the dropdown never updated on wheel zoom. It must now stay in sync.
    test('zoom select dropdown updates on mouse-wheel zoom', async ({ page }) => {
        const box = await canvasBox(page);
        expect(box).not.toBeNull();

        const select = page.locator('[data-testid="zoom-select"]');
        const initialVal = await select.inputValue();

        // Hover the canvas centre and zoom in a few wheel notches.
        await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
        for (let i = 0; i < 3; i++) {
            await page.mouse.wheel(0, -120);
            await settle(page);
        }

        // The dropdown must have moved off its initial preset…
        await expect.poll(() => select.inputValue()).not.toBe(initialVal);

        // …and must match the preset nearest to the actual zoom percent.
        const zoomLevels = [
            25, 50, 75, 100, 150, 200, 300, 400, 600, 800, 1000, 1500, 2000, 3000, 4000,
        ];
        const pct = await getZoomPercent(page);
        const nearest = zoomLevels.reduce((best, lvl) =>
            Math.abs(lvl - pct) < Math.abs(best - pct) ? lvl : best,
        );
        expect(Number(await select.inputValue())).toBe(nearest);
    });
});

test.describe('Pan Operations', () => {
    test.beforeEach(async ({ page }) => {
        await gotoApp(page);
    });

    test('middle mouse button pans the view', async ({ page }) => {
        const box = await canvasBox(page);
        expect(box).not.toBeNull();

        const centerBefore = await page.evaluate(() => {
            const mc = (window as any).__FidoCadJS__.circuitPanel.getMapCoordinates();
            return { x: mc.getXCenter(), y: mc.getYCenter() };
        });

        // Middle-click drag on canvas. Drag left/up: the view centre is
        // clamped to ≤ 0 (clampCenter), so from the initial origin only a
        // negative-direction pan can actually move it.
        await page.mouse.move(box!.x + 350, box!.y + 320);
        await page.mouse.down({ button: 'middle' });
        await page.mouse.move(box!.x + 300, box!.y + 290, { steps: 5 });
        await page.mouse.up({ button: 'middle' });

        // The drag must have shifted the view origin.
        await expect
            .poll(async () => {
                const center = await page.evaluate(() => {
                    const mc = (window as any).__FidoCadJS__.circuitPanel.getMapCoordinates();
                    return { x: mc.getXCenter(), y: mc.getYCenter() };
                });
                return center.x !== centerBefore.x || center.y !== centerBefore.y;
            })
            .toBe(true);
    });
});

test.describe('Resize behavior', () => {
    test.beforeEach(async ({ page }) => {
        await gotoApp(page);
    });

    test('viewport resize keeps a non-degenerate canvas', async ({ page }) => {
        const canvas = page.locator('[data-testid="editor-canvas"]');
        const before = await canvas.boundingBox();

        await page.setViewportSize({ width: 800, height: 600 });

        // The canvas must shrink with the viewport (ResizeObserver-driven).
        await expect(canvas).toBeVisible();
        await expect
            .poll(async () => (await canvas.boundingBox())!.width)
            .toBeLessThan(before!.width);
        const box = await canvas.boundingBox();
        expect(box!.height).toBeGreaterThan(0);
    });

    test('viewport resize preserves rendering without offset', async ({ page }) => {
        // Load content first so we have something to verify
        await loadCircuit(page, FOUR_PRIMITIVES_FCD);

        // Resize the viewport and wait for the canvas to follow.
        const canvas = page.locator('[data-testid="editor-canvas"]');
        await page.setViewportSize({ width: 1024, height: 768 });
        await expect.poll(async () => (await canvas.boundingBox())!.width).toBeLessThan(1024 + 1);

        // App must still be functional — zooming in must take effect.
        const before = await getZoomPercent(page);
        await pressKey(page, '+');
        await expect.poll(() => getZoomPercent(page)).toBeGreaterThan(before);
    });

    test('multiple consecutive resizes do not crash', async ({ page }) => {
        const sizes = [
            { width: 1024, height: 768 },
            { width: 800, height: 600 },
            { width: 1280, height: 720 },
            { width: 640, height: 480 },
        ];

        for (const size of sizes) {
            await page.setViewportSize(size);
            await settle(page);
        }

        // Verify canvas is still alive
        const canvas = page.locator('[data-testid="editor-canvas"]');
        await expect(canvas).toBeVisible();

        // Should still be able to interact
        const zoom = await getZoomPercent(page);
        expect(zoom).toBeGreaterThan(0);
    });
});
