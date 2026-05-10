/**
 * @file selection-and-transform.test.ts
 * @author Dante Loi
 * @date   2026-05-10
 * @brief  E2E — Selection, move, rotate, mirror, nudge, and delete
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { test, expect } from '@playwright/test';
import {
  gotoApp, pressKey, primitiveCount, getCircuitText,
  clickCanvasScreen, canvasBox, clearCircuit, loadCircuit,
} from './utils';

/** Standard two-line FCD fixture for selection/transform tests. */
const TWO_LINES_FCD = `FJC A 1
FJC B 1
LI 50 50 150 50 0
LI 100 100 200 100 1
`;

/** Select all primitives via the panel API. */
async function selectAll(page: ReturnType<typeof test['info']> extends never ? never : any) {
  // Use the API directly since Ctrl+A is not wired as a keyboard shortcut
  await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="editor-canvas"]') as HTMLCanvasElement;
    const panel = (canvas as any).__circuitPanel;
    panel.selectAll();
  });
  await page.waitForTimeout(200);
}

test.describe('Selection', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await loadCircuit(page, TWO_LINES_FCD);
    // Switch to selection tool explicitly
    await pressKey(page, 'a');
  });

  test('click selects a single primitive for deletion', async ({ page }) => {
    // Click approximately on the first line (canvas pixel coords around center)
    const box = await canvasBox(page);
    // The lines are at logical coords around 50-200, which map to screen coords
    // centered at 0. Just click at a reasonable spot and verify behavior
    await page.mouse.click(box!.x + 400, box!.y + 300);
    await page.waitForTimeout(200);

    // Should have 2 primitives still
    expect(await primitiveCount(page)).toBe(2);
  });

  test('Escape deselects all and switches to Selection tool', async ({ page }) => {
    await selectAll(page);
    await page.waitForTimeout(200);

    await pressKey(page, 'Escape');
    await page.waitForTimeout(200);

    // Delete should do nothing now (Escape deselects)
    await pressKey(page, 'Delete');
    await page.waitForTimeout(200);
    expect(await primitiveCount(page)).toBe(2);
  });

  test('rubber-band selection selects primitives in rect', async ({ page }) => {
    const box = await canvasBox(page);
    expect(box).not.toBeNull();

    // Drag a selection rect across the canvas
    await page.mouse.move(box!.x + 50, box!.y + 50);
    await page.mouse.down();
    await page.mouse.move(box!.x + 700, box!.y + 500, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    // Press Delete — should remove selected primitives
    await pressKey(page, 'Delete');
    await page.waitForTimeout(200);
    // At least one primitive should have been selected and deleted
    expect(await primitiveCount(page)).toBeLessThan(2);
  });
});

test.describe('Transform Operations', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await loadCircuit(page, TWO_LINES_FCD);
  });

  test('rotate selected primitives with R key', async ({ page }) => {
    await selectAll(page);
    const before = await getCircuitText(page);

    await pressKey(page, 'r');
    await page.waitForTimeout(200);

    const after = await getCircuitText(page);
    expect(after).not.toBe(before);
    expect(await primitiveCount(page)).toBe(2);
  });

  test('mirror selected primitives with S key', async ({ page }) => {
    await selectAll(page);
    const before = await getCircuitText(page);

    await pressKey(page, 's');
    await page.waitForTimeout(200);

    const after = await getCircuitText(page);
    expect(after).not.toBe(before);
    expect(await primitiveCount(page)).toBe(2);
  });

  test('Delete key removes selected primitives', async ({ page }) => {
    await selectAll(page);
    expect(await primitiveCount(page)).toBe(2);

    await pressKey(page, 'Delete');
    await page.waitForTimeout(200);
    expect(await primitiveCount(page)).toBe(0);
  });

  test('Backspace also removes selected primitives', async ({ page }) => {
    await selectAll(page);
    expect(await primitiveCount(page)).toBe(2);

    await pressKey(page, 'Backspace');
    await page.waitForTimeout(200);
    expect(await primitiveCount(page)).toBe(0);
  });

  test('nudge selected with Alt+Arrow keys', async ({ page }) => {
    await selectAll(page);
    const before = await getCircuitText(page);

    await pressKey(page, 'Alt+ArrowRight');
    await page.waitForTimeout(200);

    const after = await getCircuitText(page);
    expect(after).not.toBe(before);
    expect(await primitiveCount(page)).toBe(2);
  });

  test('R does nothing when nothing is selected', async ({ page }) => {
    // Ensure nothing selected by deselecting via Escape
    await pressKey(page, 'Escape');
    await page.waitForTimeout(200);

    const before = await getCircuitText(page);
    await pressKey(page, 'r');
    await page.waitForTimeout(200);

    const after = await getCircuitText(page);
    expect(after).toBe(before);
    expect(await primitiveCount(page)).toBe(2);
  });

  test('move mode via M key changes cursor when selection exists', async ({ page }) => {
    await selectAll(page);

    await pressKey(page, 'm');
    await page.waitForTimeout(200);

    const cursor = await page.locator('[data-testid="editor-canvas"]').evaluate(
      el => (el as HTMLCanvasElement).style.cursor,
    );
    expect(cursor).toBe('move');
  });
});
