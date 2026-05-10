/**
 * @file grid-snap.test.ts
 * @author Dante Loi
 * @date   2026-05-10
 * @brief  E2E — Grid visibility and snap-to-grid toggles
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { test, expect } from '@playwright/test';
import { gotoApp } from './utils';

test.describe('Grid Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('Show Grid button toggles grid', async ({ page }) => {
    const gridBtn = page.locator('button', { hasText: 'Show Grid' });
    await expect(gridBtn).toBeVisible();

    // Click to toggle off
    await gridBtn.click();
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => {
      const canvas = document.querySelector('[data-testid="editor-canvas"]') as HTMLCanvasElement;
      const panel = (canvas as any).__circuitPanel;
      return panel.isGridVisible();
    })).toBe(false);

    // Click to toggle back on
    await gridBtn.click();
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => {
      const canvas = document.querySelector('[data-testid="editor-canvas"]') as HTMLCanvasElement;
      const panel = (canvas as any).__circuitPanel;
      return panel.isGridVisible();
    })).toBe(true);
  });
});

test.describe('Snap Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('Snap button toggles snap-to-grid', async ({ page }) => {
    const snapBtn = page.locator('button', { hasText: 'Snap' });
    await expect(snapBtn).toBeVisible();

    // Default: snap active
    expect(await page.evaluate(() => {
      const canvas = document.querySelector('[data-testid="editor-canvas"]') as HTMLCanvasElement;
      const panel = (canvas as any).__circuitPanel;
      return panel.isSnapActive();
    })).toBe(true);

    // Toggle off
    await snapBtn.click();
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => {
      const canvas = document.querySelector('[data-testid="editor-canvas"]') as HTMLCanvasElement;
      const panel = (canvas as any).__circuitPanel;
      return panel.isSnapActive();
    })).toBe(false);

    // Toggle back on
    await snapBtn.click();
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => {
      const canvas = document.querySelector('[data-testid="editor-canvas"]') as HTMLCanvasElement;
      const panel = (canvas as any).__circuitPanel;
      return panel.isSnapActive();
    })).toBe(true);
  });
});
