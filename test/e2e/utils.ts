/**
 * @file utils.ts
 * @author Dante Loi
 * @date   2026-05-10
 * @brief  Shared helpers for FidoCadJS Playwright E2E tests
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import type { Page, BrowserContext } from '@playwright/test';

/** Navigate to the app and wait for it to fully initialise.
 *  In production builds the locale bundle is a lazy-loaded chunk, so we
 *  cannot rely on a fixed delay — we wait for a known localized
 *  toolbar/menu element to confirm i18n + UI build are complete. */
export async function gotoApp(page: Page): Promise<void> {
    await page.goto('/FidoCadJS/', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="editor-canvas"]', { timeout: 10_000 });
    // Wait for the localized menu bar (File button) to confirm i18n has
    // populated the toolbar/menu, then for the standard-library readiness
    // flag (675 macros) that app.ts sets once initLibraries() resolves.
    await page
        .locator('button', { hasText: 'File' })
        .first()
        .waitFor({ state: 'visible', timeout: 10_000 });
    await page.waitForFunction(
        () => (window as any).__FidoCadJS__?.librariesLoaded === true,
        undefined,
        { timeout: 15_000 },
    );
    await settle(page);
}

/** Wait until the browser has produced a paint frame. App actions mutate
 *  the model synchronously and schedule a repaint, so two animation
 *  frames are a sufficient barrier — unlike a fixed sleep, this costs
 *  ~16 ms instead of hundreds and cannot hide slower regressions. */
export async function settle(page: Page): Promise<void> {
    await page.evaluate(
        () =>
            new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            ),
    );
}

/** Grant clipboard permissions needed for copy/paste operations. */
export async function grantClipboardPermissions(context: BrowserContext): Promise<void> {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
}

/** Get the canvas bounding box (used for coordinate calculations). */
export async function canvasBox(page: Page) {
    return page.locator('[data-testid="editor-canvas"]').boundingBox();
}

/** Click at screen coordinates relative to the canvas element. */
export async function clickCanvasScreen(
    page: Page,
    sx: number,
    sy: number,
    button: 'left' | 'right' | 'middle' = 'left',
): Promise<void> {
    const box = await canvasBox(page);
    if (!box) throw new Error('Canvas not found');
    const btn = button === 'right' ? 'right' : button === 'middle' ? 'middle' : 'left';
    await page.mouse.click(box.x + sx, box.y + sy, { button: btn });
}

/** Press a key while the canvas is focused, then wait for a repaint. */
export async function pressKey(page: Page, key: string): Promise<void> {
    await page.locator('[data-testid="editor-canvas"]').focus();
    await page.keyboard.press(key);
    await settle(page);
}

/** Get the number of currently selected primitives. */
export async function selectedCount(page: Page): Promise<number> {
    return page.evaluate(() => {
        const panel = (window as any).__FidoCadJS__.circuitPanel;
        return panel.getSelectedPrimitives().length;
    });
}

/** Map a logical circuit coordinate to canvas-relative CSS pixels. */
export async function logicalToScreen(
    page: Page,
    x: number,
    y: number,
): Promise<{ x: number; y: number }> {
    return page.evaluate(
        ([lx, ly]) => {
            const panel = (window as any).__FidoCadJS__.circuitPanel;
            const mc = panel.getMapCoordinates();
            const dpr = window.devicePixelRatio || 1;
            return { x: mc.mapXr(lx, ly) / dpr, y: mc.mapYr(lx, ly) / dpr };
        },
        [x, y],
    );
}

/** Get the number of primitives in the model. */
export async function primitiveCount(page: Page): Promise<number> {
    return page.evaluate(() => {
        const panel = (window as any).__FidoCadJS__.circuitPanel;
        return panel.getModel().getPrimitiveVector().length;
    });
}

/** Get the circuit text (FCD format). */
export async function getCircuitText(page: Page): Promise<string> {
    return page.evaluate(() => {
        const panel = (window as any).__FidoCadJS__.circuitPanel;
        return panel.getCircuitText();
    });
}

/** Get the current zoom percentage. */
export async function getZoomPercent(page: Page): Promise<number> {
    return page.evaluate(() => {
        const panel = (window as any).__FidoCadJS__.circuitPanel;
        return panel.getZoomPercent();
    });
}

/** Get the current active tool ID. */
export async function getCurrentTool(page: Page): Promise<number> {
    return page.evaluate(() => {
        const panel = (window as any).__FidoCadJS__.circuitPanel;
        return panel.getTool();
    });
}

/** Check if undo is available. */
export async function canUndo(page: Page): Promise<boolean> {
    return page.evaluate(() => {
        const panel = (window as any).__FidoCadJS__.circuitPanel;
        return panel.canUndo();
    });
}

/** Check if redo is available. */
export async function canRedo(page: Page): Promise<boolean> {
    return page.evaluate(() => {
        const panel = (window as any).__FidoCadJS__.circuitPanel;
        return panel.canRedo();
    });
}

/** Get the exported SVG string. */
export async function exportSVG(page: Page): Promise<string> {
    return page.evaluate(() => {
        const panel = (window as any).__FidoCadJS__.circuitPanel;
        return panel.exportSVG();
    });
}

/** Get the exported PGF string. */
export async function exportPGF(page: Page): Promise<string> {
    return page.evaluate(() => {
        const panel = (window as any).__FidoCadJS__.circuitPanel;
        return panel.exportPGF();
    });
}

/** Get the exported TikZ string. */
export async function exportTikZ(page: Page): Promise<string> {
    return page.evaluate(() => {
        const panel = (window as any).__FidoCadJS__.circuitPanel;
        return panel.exportTikZ();
    });
}

/** Load an FCD circuit string into the editor. */
export async function loadCircuit(page: Page, fcd: string): Promise<void> {
    await page.evaluate((circuit) => {
        const panel = (window as any).__FidoCadJS__.circuitPanel;
        panel.loadCircuit(circuit);
    }, fcd);
    await settle(page);
}

/** Clear the circuit. */
export async function clearCircuit(page: Page): Promise<void> {
    await page.evaluate(() => {
        const panel = (window as any).__FidoCadJS__.circuitPanel;
        panel.clearCircuit();
    });
    await settle(page);
}

/** Get the list of button text labels in the toolbar. */
export async function getToolbarButtonLabels(page: Page): Promise<string[]> {
    return page.$$eval('button', (els) =>
        els.map((e) => (e.textContent || '').trim()).filter(Boolean),
    );
}

/** Get the text content of the coords display in the toolbar. */
export async function getCoordsDisplay(page: Page): Promise<string> {
    const el = page.locator('[data-testid="coords-display"]');
    return (await el.textContent()) || '';
}

/** Tool ID constants — must match ElementsEdtActions */
export const Tools = {
    NONE: 0,
    SELECTION: 1,
    ZOOM: 2,
    HAND: 3,
    LINE: 4,
    TEXT: 5,
    BEZIER: 6,
    POLYGON: 7,
    ELLIPSE: 8,
    RECTANGLE: 9,
    CONNECTION: 10,
    PCB_LINE: 11,
    PCB_PAD: 12,
    MACRO: 13,
    COMPLEXCURVE: 14,
} as const;
