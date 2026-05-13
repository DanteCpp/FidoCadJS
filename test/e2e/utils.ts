/**
 * @file utils.ts
 * @author Dante Loi
 * @date   2026-05-10
 * @brief  Shared helpers for FidoCadJS Playwright E2E tests
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import type { Page, BrowserContext } from '@playwright/test';

/** Navigate to the app and wait for it to fully initialise. */
export async function gotoApp(page: Page): Promise<void> {
  await page.goto('/FidoCadJS/', { waitUntil: 'networkidle' });
  // Wait for the canvas to be rendered and the libraries to load
  await page.waitForSelector('[data-testid="editor-canvas"]', { timeout: 10_000 });
  // Give async library loading time to finish (675 macros)
  await page.waitForTimeout(800);
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
export async function clickCanvasScreen(page: Page, sx: number, sy: number, button: 'left' | 'right' | 'middle' = 'left'): Promise<void> {
  const box = await canvasBox(page);
  if (!box) throw new Error('Canvas not found');
  const btn = button === 'right' ? 'right' : button === 'middle' ? 'middle' : 'left';
  await page.mouse.click(box.x + sx, box.y + sy, { button: btn });
}

/** Press a key while the canvas is focused, with a settle delay. */
export async function pressKey(page: Page, key: string): Promise<void> {
  await page.locator('[data-testid="editor-canvas"]').focus();
  await page.keyboard.press(key);
  await page.waitForTimeout(200);
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
  await page.evaluate(
    (circuit) => {
      const panel = (window as any).__FidoCadJS__.circuitPanel;
      panel.loadCircuit(circuit);
    },
    fcd,
  );
  await page.waitForTimeout(300);
}

/** Clear the circuit. */
export async function clearCircuit(page: Page): Promise<void> {
  await page.evaluate(() => {
    const panel = (window as any).__FidoCadJS__.circuitPanel;
    panel.clearCircuit();
  });
  await page.waitForTimeout(200);
}

/** Get the list of button text labels in the toolbar. */
export async function getToolbarButtonLabels(page: Page): Promise<string[]> {
  return page.$$eval('button', els => els.map(e => (e.textContent || '').trim()).filter(Boolean));
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
