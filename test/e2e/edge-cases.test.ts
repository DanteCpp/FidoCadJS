/**
 * @file edge-cases.test.ts
 * @author Dante Loi
 * @date   2026-05-10
 * @brief  E2E — Edge cases, regression guards, and stress tests
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { test, expect } from '@playwright/test';
import {
    gotoApp,
    pressKey,
    primitiveCount,
    getCircuitText,
    clickCanvasScreen,
    clearCircuit,
    loadCircuit,
    exportSVG,
    exportPGF,
    exportTikZ,
    canUndo,
    getCurrentTool,
    getZoomPercent,
    settle,
    Tools,
} from './utils';

test.describe('Edge Cases — Empty/Degenerate', () => {
    test.beforeEach(async ({ page }) => {
        await gotoApp(page);
        await clearCircuit(page);
    });

    test('empty circuit exports valid formats without crashing', async ({ page }) => {
        const svg = await exportSVG(page);
        expect(svg).toContain('<svg');

        const pgf = await exportPGF(page);
        expect(pgf).toContain('\\begin{pgfpicture}');

        const tikz = await exportTikZ(page);
        expect(tikz).toContain('\\begin{tikzpicture}');
    });

    test('empty circuit renders without errors', async ({ page }) => {
        expect(await primitiveCount(page)).toBe(0);
    });

    test('empty circuit zoom in/out still adjusts zoom', async ({ page }) => {
        const initial = await getZoomPercent(page);
        await pressKey(page, '+');
        await pressKey(page, '+');
        await pressKey(page, '-');
        // Two zoom-ins and one zoom-out must leave us above the initial zoom.
        expect(await getZoomPercent(page)).toBeGreaterThan(initial);
    });

    test('empty circuit Ctrl+Z does nothing', async ({ page }) => {
        const before = await canUndo(page);
        await pressKey(page, 'Control+z');
        expect(await primitiveCount(page)).toBe(0);
        expect(await canUndo(page)).toBe(before);
    });

    test('zero-length line (same start/end point) produces empty output', async ({ page }) => {
        await pressKey(page, 'l');
        // Click same position twice
        await clickCanvasScreen(page, 300, 300);
        await settle(page);
        await clickCanvasScreen(page, 300, 300);
        await settle(page);

        // Zero-length lines are dropped on serialisation
        expect(await primitiveCount(page)).toBe(0);
    });
});

test.describe('Edge Cases — Rapid Operations', () => {
    test.beforeEach(async ({ page }) => {
        await gotoApp(page);
        await clearCircuit(page);
    });

    test('rapid tool switching does not crash', async ({ page }) => {
        const keys = ['a', 'l', 'g', 'e', 'b', 'p', 'o', 'c', 'i', 'z', 'a'];
        for (const k of keys) {
            await pressKey(page, k);
        }
        // Should end on selection tool
        expect(await getCurrentTool(page)).toBe(Tools.SELECTION);
    });

    test('rapid draw/undo/redo cycle', async ({ page }) => {
        for (let i = 0; i < 3; i++) {
            await pressKey(page, 'l');
            await clickCanvasScreen(page, 200, 200 + i * 50);
            await settle(page);
            await clickCanvasScreen(page, 400, 200 + i * 50);
            await settle(page);
            await pressKey(page, 'Control+z');
            await pressKey(page, 'Control+y');
        }
        // After 3 create/undo/redo cycles, we should have 3 lines (all re-done)
        expect(await primitiveCount(page)).toBe(3);
    });

    test('draw, select all, delete — undo entry created', async ({ page }) => {
        const result = await page.evaluate(() => {
            const panel = (window as any).__FidoCadJS__.circuitPanel;

            let fcd = 'FJC A 1\nFJC B 1\n';
            for (let i = 0; i < 5; i++) {
                fcd += `LI ${10 + i * 5} ${10 + i * 5} ${90 + i * 5} ${10 + i * 5} ${i % 16}\n`;
            }
            panel.loadCircuit(fcd);
            panel.selectAll();
            panel.rotateSelected();
            panel.deleteSelected();

            if (panel.getModel().getPrimitiveVector().length !== 0) return 'delete failed';
            if (!panel.canUndo()) return 'no undo after delete';
            return 'ok';
        });
        expect(result).toBe('ok');
    });
});

test.describe('Edge Cases — Long FCD Documents', () => {
    test.beforeEach(async ({ page }) => {
        await gotoApp(page);
        await clearCircuit(page);
    });

    test('loads and exports a circuit with many primitives', async ({ page }) => {
        let fcd = 'FJC A 1\nFJC B 1\n';
        for (let i = 0; i < 20; i++) {
            fcd += `LI ${10 + i * 5} ${10 + i * 5} ${90 + i * 5} ${10 + i * 5} ${i % 16}\n`;
        }

        await loadCircuit(page, fcd);
        expect(await primitiveCount(page)).toBe(20);

        const svg = await exportSVG(page);
        expect(svg).toContain('<line');
    });

    test('circuit with all primitive types round-trips via getCircuitText', async ({ page }) => {
        const allTypesFCD = `FJC A 1
FJC B 1
LI 10 10 90 10 0
BE 50 5 20 60 70 35 50 70 0
RV 25 20 95 75 0
EV 45 15 95 65 0
PV 10 10 50 10 30 50 0
SA 50 50 0
PL 10 110 90 110 5 0
PA 100 100 2 20 20 0 0
`;

        await loadCircuit(page, allTypesFCD);
        expect(await primitiveCount(page)).toBe(8);

        const text = await getCircuitText(page);
        expect(text).toContain('LI');
        expect(text).toContain('BE');
        expect(text).toContain('RV');
        expect(text).toContain('EV');
        expect(text).toContain('PV');
        expect(text).toContain('SA');
        expect(text).toContain('PL');
        expect(text).toContain('PA');
    });
});

test.describe('Edge Cases — Negative Coordinates', () => {
    test.beforeEach(async ({ page }) => {
        await gotoApp(page);
        await clearCircuit(page);
    });

    test('clamps negative coordinates to zero on read', async ({ page }) => {
        // Negative coordinates are not supported: the parser clamps them to 0.
        // These lines span from negative into positive space, so after clamping
        // they remain valid (non-degenerate) primitives.
        const fcd = `FJC A 1
FJC B 1
LI -50 -50 50 50 0
LI -100 10 100 10 1
`;
        await loadCircuit(page, fcd);
        expect(await primitiveCount(page)).toBe(2);

        const text = await getCircuitText(page);
        // No negative values survive serialization.
        expect(text).not.toContain('-');
        // The clamped endpoints are present (e.g. the first line now starts at 0 0).
        expect(text).toContain('LI 0 0 50 50');
    });
});

test.describe('Edge Cases — Text', () => {
    test.beforeEach(async ({ page }) => {
        await gotoApp(page);
        await clearCircuit(page);
    });

    test('text primitive created via tool contains default string', async ({ page }) => {
        await pressKey(page, 't');
        await clickCanvasScreen(page, 300, 300);
        await settle(page);

        const count = await primitiveCount(page);
        expect(count).toBe(1);

        const fcd = await getCircuitText(page);
        expect(fcd).toContain('TY');
    });
});

test.describe('Edge Cases — Canvas Resize', () => {
    test.beforeEach(async ({ page }) => {
        await gotoApp(page);
        await clearCircuit(page);
    });

    test('resizing viewport does not crash app', async ({ page }) => {
        const fcd = `FJC A 1
FJC B 1
LI 10 10 90 10 0
`;
        await loadCircuit(page, fcd);

        await page.setViewportSize({ width: 800, height: 600 });
        await settle(page);

        expect(await primitiveCount(page)).toBe(1);

        await page.setViewportSize({ width: 1280, height: 900 });
        await settle(page);

        expect(await primitiveCount(page)).toBe(1);
    });
});

test.describe('Edge Cases — Layer Switching', () => {
    test.beforeEach(async ({ page }) => {
        await gotoApp(page);
        await clearCircuit(page);
    });

    test('primitives on different layers are preserved', async ({ page }) => {
        const fcd = `FJC A 1
FJC B 1
LI 10 10 90 10 0
LI 10 20 90 20 1
LI 10 30 90 30 2
`;
        await loadCircuit(page, fcd);
        expect(await primitiveCount(page)).toBe(3);

        const text = await getCircuitText(page);
        expect(text).toContain('LI');
    });

    test('right-click cancels active drawing tool', async ({ page }) => {
        // Start line tool
        await pressKey(page, 'l');
        expect(await getCurrentTool(page)).toBe(Tools.LINE);

        // Right-click to cancel — should fall back to SELECTION
        await clickCanvasScreen(page, 300, 300, 'right');
        await expect.poll(() => getCurrentTool(page)).toBe(Tools.SELECTION);
    });
});
