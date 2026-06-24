import { test, expect } from '@playwright/test';
import {
    gotoApp,
    pressKey,
    primitiveCount,
    getCircuitText,
    getCurrentTool,
    clickCanvasScreen,
    canvasBox,
    clearCircuit,
    settle,
    Tools,
} from './utils';

test.describe('Drawing Tools — Keyboard Selection', () => {
    const toolKeys: Array<[string, number, string]> = [
        ['a', Tools.SELECTION, 'Selection'],
        ['l', Tools.LINE, 'Line'],
        ['t', Tools.TEXT, 'Text'],
        ['b', Tools.BEZIER, 'Bezier'],
        ['p', Tools.POLYGON, 'Polygon'],
        ['o', Tools.COMPLEXCURVE, 'Complex Curve'],
        ['e', Tools.ELLIPSE, 'Ellipse'],
        ['g', Tools.RECTANGLE, 'Rectangle'],
        ['c', Tools.CONNECTION, 'Connection'],
        ['i', Tools.PCB_LINE, 'PCB Line'],
        ['z', Tools.PCB_PAD, 'PCB Pad'],
    ];

    for (const [key, toolId, label] of toolKeys) {
        test(`${key} selects the ${label} tool`, async ({ page }) => {
            await gotoApp(page);
            await pressKey(page, key);
            expect(await getCurrentTool(page)).toBe(toolId);
        });
    }
});

test.describe('Drawing Primitives', () => {
    test.beforeEach(async ({ page }) => {
        await gotoApp(page);
        await clearCircuit(page);
    });

    test('draw a line with two clicks', async ({ page }) => {
        await pressKey(page, 'l');
        await clickCanvasScreen(page, 200, 200);
        await settle(page);
        await clickCanvasScreen(page, 400, 300);

        expect(await primitiveCount(page)).toBe(1);
        const fcd = await getCircuitText(page);
        expect(fcd).toContain('LI');
    });

    test('draw a rectangle with two clicks', async ({ page }) => {
        await pressKey(page, 'g');
        await clickCanvasScreen(page, 150, 150);
        await settle(page);
        await clickCanvasScreen(page, 400, 400);
        await settle(page);

        expect(await primitiveCount(page)).toBe(1);
        const fcd = await getCircuitText(page);
        expect(fcd).toContain('RV');
    });

    test('draw an ellipse with two clicks', async ({ page }) => {
        await pressKey(page, 'e');
        await clickCanvasScreen(page, 200, 200);
        await settle(page);
        await clickCanvasScreen(page, 500, 400);
        await settle(page);

        expect(await primitiveCount(page)).toBe(1);
        const fcd = await getCircuitText(page);
        expect(fcd).toContain('EV');
    });

    test('draw a bezier with four clicks', async ({ page }) => {
        await pressKey(page, 'b');
        await clickCanvasScreen(page, 100, 200);
        await settle(page);
        await clickCanvasScreen(page, 200, 100);
        await settle(page);
        await clickCanvasScreen(page, 400, 100);
        await settle(page);
        await clickCanvasScreen(page, 500, 300);
        await settle(page);

        expect(await primitiveCount(page)).toBe(1);
        const fcd = await getCircuitText(page);
        expect(fcd).toContain('BE');
    });

    test('draw a polygon and finish with double-click', async ({ page }) => {
        await pressKey(page, 'p');
        // 3 points + double-click to finish
        await clickCanvasScreen(page, 100, 100);
        await settle(page);
        await clickCanvasScreen(page, 300, 100);
        await settle(page);
        await clickCanvasScreen(page, 200, 300);
        await settle(page);
        // Double-click on last point to finish
        const box = await canvasBox(page);
        await page.mouse.click(box!.x + 200, box!.y + 300, { clickCount: 2 });
        await settle(page);

        expect(await primitiveCount(page)).toBe(1);
        const fcd = await getCircuitText(page);
        expect(fcd).toContain('PV');
    });

    test('draw a connection dot with one click', async ({ page }) => {
        await pressKey(page, 'c');
        await clickCanvasScreen(page, 300, 300);
        await settle(page);

        expect(await primitiveCount(page)).toBe(1);
        const fcd = await getCircuitText(page);
        expect(fcd).toContain('SA');
    });

    test('draw a PCB line with two clicks', async ({ page }) => {
        await pressKey(page, 'i');
        await clickCanvasScreen(page, 150, 200);
        await settle(page);
        await clickCanvasScreen(page, 500, 250);
        await settle(page);

        expect(await primitiveCount(page)).toBe(1);
        const fcd = await getCircuitText(page);
        expect(fcd).toContain('PL');
    });

    test('draw a PCB pad with one click', async ({ page }) => {
        await pressKey(page, 'z');
        await clickCanvasScreen(page, 350, 300);
        await settle(page);

        expect(await primitiveCount(page)).toBe(1);
        const fcd = await getCircuitText(page);
        expect(fcd).toContain('PA');
    });

    test('draw a text with one click (text primitive created)', async ({ page }) => {
        await pressKey(page, 't');
        await clickCanvasScreen(page, 300, 300);
        await settle(page);

        // A TY primitive should be created (contains default text "String")
        expect(await primitiveCount(page)).toBe(1);
        const fcd = await getCircuitText(page);
        expect(fcd).toContain('TY');
    });

    test('draw a complex curve and finish with double-click', async ({ page }) => {
        await pressKey(page, 'o');
        await clickCanvasScreen(page, 100, 200);
        await settle(page);
        await clickCanvasScreen(page, 200, 100);
        await settle(page);
        await clickCanvasScreen(page, 300, 150);
        await settle(page);
        await clickCanvasScreen(page, 400, 100);
        await settle(page);
        // Double-click on last point to finish
        const box = await canvasBox(page);
        await page.mouse.click(box!.x + 400, box!.y + 100, { clickCount: 2 });
        await settle(page);

        expect(await primitiveCount(page)).toBe(1);
        const fcd = await getCircuitText(page);
        expect(fcd).toContain('CV');
    });

    test('multiple primitives of different types coexist', async ({ page }) => {
        // Draw a line
        await pressKey(page, 'l');
        await clickCanvasScreen(page, 100, 200);
        await settle(page);
        await clickCanvasScreen(page, 300, 200);
        await settle(page);

        // Draw a rectangle
        await pressKey(page, 'g');
        await clickCanvasScreen(page, 400, 100);
        await settle(page);
        await clickCanvasScreen(page, 600, 300);
        await settle(page);

        // Draw an ellipse
        await pressKey(page, 'e');
        await clickCanvasScreen(page, 100, 400);
        await settle(page);
        await clickCanvasScreen(page, 300, 550);
        await settle(page);

        expect(await primitiveCount(page)).toBe(3);
        const fcd = await getCircuitText(page);
        expect(fcd).toContain('LI');
        expect(fcd).toContain('RV');
        expect(fcd).toContain('EV');
    });
});
