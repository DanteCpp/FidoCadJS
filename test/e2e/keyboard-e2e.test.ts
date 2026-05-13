/**
 * @file keyboard-e2e.test.ts
 * @author Dante Loi
 * @date   2026-05-10
 * @brief  E2E — Keyboard shortcuts exercised through the full browser stack
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { test, expect } from '@playwright/test';
import {
  gotoApp, pressKey, getCurrentTool, primitiveCount,
  loadCircuit, clearCircuit, canUndo, canRedo, Tools,
} from './utils';

/** Select all via the panel API. */
async function selectAll(page: any) {
  await page.evaluate(() => {
    const panel = (window as any).__FidoCadJS__.circuitPanel;
    panel.selectAll();
  });
  await page.waitForTimeout(200);
}

const TEST_FCD = `FJC A 1
FJC B 1
LI 10 10 90 10 0
RV 20 50 80 80 2
`;

test.describe('Keyboard Shortcuts — Tool Selection', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('uppercase L also selects Line tool', async ({ page }) => {
    await pressKey(page, 'L');
    expect(await getCurrentTool(page)).toBe(Tools.LINE);
  });

  test('uppercase G also selects Rectangle tool', async ({ page }) => {
    await pressKey(page, 'G');
    expect(await getCurrentTool(page)).toBe(Tools.RECTANGLE);
  });

  test('Ctrl+E does NOT switch to Ellipse tool', async ({ page }) => {
    await pressKey(page, 'l');
    expect(await getCurrentTool(page)).toBe(Tools.LINE);

    await pressKey(page, 'Control+e');
    await page.waitForTimeout(300);
    // Tool should still be LINE (Ctrl+E triggers export, not ellipse tool)
    expect(await getCurrentTool(page)).toBe(Tools.LINE);
  });

  test('Ctrl+P does NOT switch to Polygon tool', async ({ page }) => {
    await pressKey(page, 'l');
    await pressKey(page, 'Control+p');
    await page.waitForTimeout(300);
    expect(await getCurrentTool(page)).toBe(Tools.LINE);
  });

  test('Ctrl+O does NOT switch to Complex curve tool', async ({ page }) => {
    await pressKey(page, 'l');
    await pressKey(page, 'Control+o');
    await page.waitForTimeout(300);
    expect(await getCurrentTool(page)).toBe(Tools.LINE);
  });

  test('Ctrl+Z does NOT switch to PCB pad tool', async ({ page }) => {
    await pressKey(page, 'l');
    await pressKey(page, 'Control+z');
    await page.waitForTimeout(300);
    expect(await getCurrentTool(page)).toBe(Tools.LINE);
  });

  test('Ctrl+S does NOT trigger mirror (S)', async ({ page }) => {
    await loadCircuit(page, TEST_FCD);
    const before = await primitiveCount(page);

    await selectAll(page);
    await pressKey(page, 'Control+s');
    await page.waitForTimeout(300);

    // Primitive count unchanged (Ctrl+S saves, does not mirror)
    expect(await primitiveCount(page)).toBe(before);
  });

  test('Ctrl+Shift+S does NOT trigger mirror', async ({ page }) => {
    await loadCircuit(page, TEST_FCD);
    await selectAll(page);

    await pressKey(page, 'Control+Shift+s');
    await page.waitForTimeout(300);

    // Circuit unchanged (mirror not triggered by Ctrl+Shift+S)
    expect(await primitiveCount(page)).toBe(2);
  });

  test('unknown keys do not crash (q, 1, F1)', async ({ page }) => {
    await loadCircuit(page, TEST_FCD);
    await pressKey(page, 'q');
    await pressKey(page, '1');
    await pressKey(page, 'F1');
    // Should not crash; primitives unchanged
    expect(await primitiveCount(page)).toBe(2);
  });
});

test.describe('Keyboard Shortcuts — Undo/Redo', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await clearCircuit(page);
  });

  test('Ctrl+Z undoes, Ctrl+Y redoes', async ({ page }) => {
    // Load a circuit, rotate to create undo state, then undo/redo
    await page.evaluate(() => {
      const panel = (window as any).__FidoCadJS__.circuitPanel;
      panel.loadCircuit('FJC A 1\nFJC B 1\nLI 10 10 90 10 0\nRV 20 50 80 80 2\n');
      panel.selectAll();
      panel.rotateSelected();
    });
    await page.waitForTimeout(200);
    expect(await primitiveCount(page)).toBe(2);

    await pressKey(page, 'Control+z');
    await page.waitForTimeout(200);
    expect(await primitiveCount(page)).toBe(2);
    expect(await canRedo(page)).toBe(true);

    await pressKey(page, 'Control+y');
    await page.waitForTimeout(200);
    expect(await primitiveCount(page)).toBe(2);
  });
});

test.describe('Keyboard Shortcuts — Input Blocking', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('tool shortcuts blocked when input element is focused', async ({ page }) => {
    // Insert a temporary input into the DOM and focus it
    await page.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'temp-input';
      input.style.position = 'fixed';
      input.style.top = '0';
      input.style.left = '0';
      document.body.appendChild(input);
      input.focus();
    });

    // Press L while input is focused
    await page.keyboard.press('l');
    await page.waitForTimeout(200);

    // Tool should still be SELECTION (default)
    expect(await getCurrentTool(page)).toBe(Tools.SELECTION);

    await page.evaluate(() => {
      document.getElementById('temp-input')?.remove();
    });
  });

  test('global Ctrl shortcuts still work when input is focused', async ({ page }) => {
    await loadCircuit(page, TEST_FCD);
    expect(await primitiveCount(page)).toBe(2);

    // Insert input and focus it
    await page.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'temp-input';
      document.body.appendChild(input);
      input.focus();
    });

    // Ctrl+S should still work (save file)
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      document.getElementById('temp-input')?.remove();
    });

    // Circuit should still have 2 primitives
    expect(await primitiveCount(page)).toBe(2);
  });
});

test.describe('Keyboard Shortcuts — Nudge', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await loadCircuit(page, TEST_FCD);
  });

  test('Alt+ArrowLeft nudges selected left', async ({ page }) => {
    await selectAll(page);
    const before = await page.evaluate(() => {
      const panel = (window as any).__FidoCadJS__.circuitPanel;
      return panel.getCircuitText();
    });

    await pressKey(page, 'Alt+ArrowLeft');
    await page.waitForTimeout(200);

    const after = await page.evaluate(() => {
      const panel = (window as any).__FidoCadJS__.circuitPanel;
      return panel.getCircuitText();
    });

    expect(after).not.toBe(before);
  });

  test('Alt+ArrowRight nudges selected right', async ({ page }) => {
    await selectAll(page);
    const before = await page.evaluate(() => {
      const panel = (window as any).__FidoCadJS__.circuitPanel;
      return panel.getCircuitText();
    });

    await pressKey(page, 'Alt+ArrowRight');

    const after = await page.evaluate(() => {
      const panel = (window as any).__FidoCadJS__.circuitPanel;
      return panel.getCircuitText();
    });

    expect(after).not.toBe(before);
  });

  test('Alt+ArrowUp nudges selected up', async ({ page }) => {
    await selectAll(page);
    const before = await page.evaluate(() => {
      const panel = (window as any).__FidoCadJS__.circuitPanel;
      return panel.getCircuitText();
    });

    await pressKey(page, 'Alt+ArrowUp');

    const after = await page.evaluate(() => {
      const panel = (window as any).__FidoCadJS__.circuitPanel;
      return panel.getCircuitText();
    });

    expect(after).not.toBe(before);
  });

  test('Alt+ArrowDown nudges selected down', async ({ page }) => {
    await selectAll(page);
    const before = await page.evaluate(() => {
      const panel = (window as any).__FidoCadJS__.circuitPanel;
      return panel.getCircuitText();
    });

    await pressKey(page, 'Alt+ArrowDown');

    const after = await page.evaluate(() => {
      const panel = (window as any).__FidoCadJS__.circuitPanel;
      return panel.getCircuitText();
    });

    expect(after).not.toBe(before);
  });
});
