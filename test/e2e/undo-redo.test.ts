/**
 * @file undo-redo.test.ts
 * @author Dante Loi
 * @date   2026-05-10
 * @brief  E2E — Undo/redo state tracking and keyboard shortcuts
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { test, expect } from '@playwright/test';
import { gotoApp, pressKey } from './utils';

test.describe('Undo / Redo', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => {
      const panel = (window as any).__FidoCadJS__.circuitPanel;
      panel.clearCircuit();
    });
    await page.waitForTimeout(200);
  });

  test('rotate creates undo entry (canUndo becomes true)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const panel = (window as any).__FidoCadJS__.circuitPanel;
      panel.loadCircuit('FJC A 1\nFJC B 1\nLI 10 10 90 10 0\n');
      if (panel.canUndo()) return 'undo should not be available after loadCircuit';
      panel.selectAll();
      panel.rotateSelected();
      if (!panel.canUndo()) return 'rotate should create undo entry';
      return 'ok';
    });
    expect(result).toBe('ok');
  });

  test('Ctrl+Shift+Z redo shortcut works', async ({ page }) => {
    await page.evaluate(() => {
      const panel = (window as any).__FidoCadJS__.circuitPanel;
      panel.loadCircuit('FJC A 1\nFJC B 1\nLI 10 10 90 10 0\n');
      panel.selectAll();
      panel.rotateSelected();
    });
    await page.waitForTimeout(200);

    // Undo via keyboard
    await pressKey(page, 'Control+z');
    await page.waitForTimeout(200);

    const canRedoNow = await page.evaluate(() => {
      const panel = (window as any).__FidoCadJS__.circuitPanel;
      return panel.canRedo();
    });
    expect(canRedoNow).toBe(true);

    // Redo via keyboard (Ctrl+Shift+Z)
    await pressKey(page, 'Control+Shift+z');
    await page.waitForTimeout(200);

    const canUndoNow = await page.evaluate(() => {
      const panel = (window as any).__FidoCadJS__.circuitPanel;
      return panel.canUndo();
    });
    expect(canUndoNow).toBe(true);
  });

  test('delete creates undo entry', async ({ page }) => {
    const result = await page.evaluate(() => {
      const panel = (window as any).__FidoCadJS__.circuitPanel;
      panel.loadCircuit('FJC A 1\nFJC B 1\nLI 10 10 90 10 0\nLI 20 20 100 20 1\n');
      panel.selectAll();
      panel.deleteSelected();
      if (!panel.canUndo()) return 'delete should create undo entry';
      return 'ok';
    });
    expect(result).toBe('ok');
  });

  test('mirror creates undo entry', async ({ page }) => {
    const result = await page.evaluate(() => {
      const panel = (window as any).__FidoCadJS__.circuitPanel;
      panel.loadCircuit('FJC A 1\nFJC B 1\nLI 10 10 90 10 0\n');
      panel.selectAll();
      panel.mirrorSelected();
      if (!panel.canUndo()) return 'mirror should create undo entry';
      return 'ok';
    });
    expect(result).toBe('ok');
  });

  test('multiple operations stack undo entries', async ({ page }) => {
    const result = await page.evaluate(() => {
      const panel = (window as any).__FidoCadJS__.circuitPanel;
      panel.loadCircuit('FJC A 1\nFJC B 1\nLI 10 10 90 10 0\n');
      panel.selectAll();
      panel.rotateSelected();
      if (!panel.canUndo()) return 'no undo after rotate';
      panel.mirrorSelected();
      if (!panel.canUndo()) return 'no undo after mirror';
      return 'ok';
    });
    expect(result).toBe('ok');
  });

  test('clearCircuit resets undo stack', async ({ page }) => {
    const result = await page.evaluate(() => {
      const panel = (window as any).__FidoCadJS__.circuitPanel;
      panel.loadCircuit('FJC A 1\nFJC B 1\nLI 10 10 90 10 0\n');
      panel.selectAll();
      panel.rotateSelected();
      if (!panel.canUndo()) return 'no undo after rotate';
      panel.clearCircuit();
      if (panel.canUndo()) return 'undo still available after clear';
      if (panel.canRedo()) return 'redo still available after clear';
      return 'ok';
    });
    expect(result).toBe('ok');
  });
});
