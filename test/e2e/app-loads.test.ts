/**
 * @file app-loads.test.ts
 * @author Dante Loi
 * @date   2026-05-10
 * @brief  E2E — App initialisation, rendering, and basic smoke checks
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { test, expect } from '@playwright/test';
import { gotoApp, getToolbarButtonLabels, getCoordsDisplay, primitiveCount } from './utils';

test.describe('App Initialisation', () => {
  test('page title is FidoCadJS', async ({ page }) => {
    await gotoApp(page);
    await expect(page).toHaveTitle('FidoCadJS');
  });

  test('canvas element renders in the DOM', async ({ page }) => {
    await gotoApp(page);
    const canvas = page.locator('[data-testid="editor-canvas"]');
    await expect(canvas).toBeVisible();
  });

  test('toolbar container exists', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('[data-testid="toolbar"]')).toBeVisible();
  });

  test('zoom select dropdown exists', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('[data-testid="zoom-select"]')).toBeVisible();
  });

  test('coordinates display shows initial value', async ({ page }) => {
    await gotoApp(page);
    const coords = await getCoordsDisplay(page);
    expect(coords).toContain('X:');
    expect(coords).toContain('Y:');
  });

  test('toolbar contains expected buttons', async ({ page }) => {
    await gotoApp(page);
    const labels = await getToolbarButtonLabels(page);
    expect(labels).toContain('Fit');
    expect(labels).toContain('Show Grid');
    expect(labels).toContain('Snap');
    expect(labels).toContain('Libs');
  });

  test('library panel is rendered', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('[data-testid="library-panel"]')).toBeVisible();
  });

  test('no page errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await gotoApp(page);
    expect(errors).toEqual([]);
  });

  test('circuit starts empty', async ({ page }) => {
    await gotoApp(page);
    const count = await primitiveCount(page);
    expect(count).toBe(0);
  });

  test('window.__FidoCadJS__ exposes circuitPanel for E2E', async ({ page }) => {
    await gotoApp(page);
    const hasPanel = await page.evaluate(() => {
      return !!(window as any).__FidoCadJS__?.circuitPanel;
    });
    expect(hasPanel).toBe(true);
  });
});
