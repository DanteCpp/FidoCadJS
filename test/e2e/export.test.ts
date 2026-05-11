/**
 * @file export.test.ts
 * @author Dante Loi
 * @date   2026-05-10
 * @brief  E2E — Export to SVG, PGF, and TikZ formats
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { test, expect } from '@playwright/test';
import { gotoApp, loadCircuit, exportSVG, exportPGF, exportTikZ, clearCircuit } from './utils';

const TEST_FCD = `FJC A 1
FJC B 1
LI 10 10 90 10 0
RV 20 50 80 80 2
EV 40 90 70 120 3
SA 50 50 0
`;

test.describe('Export — SVG', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await loadCircuit(page, TEST_FCD);
  });

  test('exportSVG produces valid XML wrapper', async ({ page }) => {
    const svg = await exportSVG(page);
    expect(svg).toContain('<?xml');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  test('exportSVG contains line element', async ({ page }) => {
    const svg = await exportSVG(page);
    expect(svg).toContain('<line');
  });

  test('exportSVG contains rect element', async ({ page }) => {
    const svg = await exportSVG(page);
    expect(svg).toContain('<rect');
  });

  test('exportSVG contains ellipse element', async ({ page }) => {
    const svg = await exportSVG(page);
    expect(svg).toContain('<ellipse');
  });

  test('exportSVG contains circle for connection', async ({ page }) => {
    const svg = await exportSVG(page);
    expect(svg).toContain('<circle');
  });

  test('empty circuit exports valid SVG wrapper only', async ({ page }) => {
    await clearCircuit(page);
    const svg = await exportSVG(page);
    expect(svg).toContain('<?xml');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    // No drawing elements
    expect(svg).not.toContain('<line');
    expect(svg).not.toContain('<rect');
  });
});

test.describe('Export — PGF', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await loadCircuit(page, TEST_FCD);
  });

  test('exportPGF produces valid PGF wrapper', async ({ page }) => {
    const pgf = await exportPGF(page);
    expect(pgf).toContain('\\begin{pgfpicture}');
    expect(pgf).toContain('\\end{pgfpicture}');
  });

  test('exportPGF contains line command', async ({ page }) => {
    const pgf = await exportPGF(page);
    expect(pgf).toContain('\\pgfline');
  });

  test('exportPGF contains rect command', async ({ page }) => {
    const pgf = await exportPGF(page);
    expect(pgf).toContain('\\pgflineto');
  });

  test('exportPGF contains ellipse command', async ({ page }) => {
    const pgf = await exportPGF(page);
    expect(pgf).toContain('\\pgfellipse');
  });

  test('empty circuit exports valid PGF wrapper only', async ({ page }) => {
    await clearCircuit(page);
    const pgf = await exportPGF(page);
    expect(pgf).toContain('\\begin{pgfpicture}');
    expect(pgf).toContain('\\end{pgfpicture}');
    expect(pgf).not.toContain('\\pgfpathlineto');
  });
});

test.describe('Export — TikZ', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await loadCircuit(page, TEST_FCD);
  });

  test('exportTikZ produces valid TikZ wrapper', async ({ page }) => {
    const tikz = await exportTikZ(page);
    expect(tikz).toContain('\\begin{tikzpicture}');
    expect(tikz).toContain('\\end{tikzpicture}');
  });

  test('exportTikZ contains draw command for line', async ({ page }) => {
    const tikz = await exportTikZ(page);
    expect(tikz).toContain('\\draw');
  });

  test('exportTikZ contains fill command for connection', async ({ page }) => {
    const tikz = await exportTikZ(page);
    expect(tikz).toContain('\\fill');
  });

  test('empty circuit exports valid TikZ wrapper only', async ({ page }) => {
    await clearCircuit(page);
    const tikz = await exportTikZ(page);
    expect(tikz).toContain('\\begin{tikzpicture}');
    expect(tikz).toContain('\\end{tikzpicture}');
  });
});

test.describe('Export — Round-trip consistency', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await loadCircuit(page, TEST_FCD);
  });

  test('exportSVG is deterministic (same FCD → same SVG)', async ({ page }) => {
    const svg1 = await exportSVG(page);
    const svg2 = await exportSVG(page);
    expect(svg1).toBe(svg2);
  });

  test('exportPGF is deterministic', async ({ page }) => {
    const pgf1 = await exportPGF(page);
    const pgf2 = await exportPGF(page);
    expect(pgf1).toBe(pgf2);
  });

  test('exportTikZ is deterministic', async ({ page }) => {
    const tikz1 = await exportTikZ(page);
    const tikz2 = await exportTikZ(page);
    expect(tikz1).toBe(tikz2);
  });
});
