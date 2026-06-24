import { test, expect } from '@playwright/test';
import {
    gotoApp,
    clickCanvasScreen,
    primitiveCount,
    getCircuitText,
    getCurrentTool,
    settle,
    Tools,
} from './utils';

test.describe('Macro Library', () => {
    test.beforeEach(async ({ page }) => {
        await gotoApp(page);
    });

    test('library panel is visible and contains macro entries', async ({ page }) => {
        const panel = page.locator('[data-testid="library-panel"]');
        await expect(panel).toBeVisible();

        // After loading, there should be text content for macro libraries
        const text = await panel.innerText();
        // At least some content from the standard libraries
        expect(text.length).toBeGreaterThan(10);
    });

    test('Libs button toggles library panel visibility', async ({ page }) => {
        const libBtn = page.locator('button', { hasText: 'Libs' });

        // Initially visible
        await expect(page.locator('[data-testid="library-panel"]')).toBeVisible();

        // Click to hide
        await libBtn.click();
        await expect(page.locator('[data-testid="library-panel"]')).toBeHidden();

        // Click to show again
        await libBtn.click();
        await expect(page.locator('[data-testid="library-panel"]')).toBeVisible();
    });

    test('searching and clicking a macro arms the macro tool', async ({ page }) => {
        const panel = page.locator('[data-testid="library-panel"]');

        // Filter the tree; matching rows become visible without manual expansion.
        await panel.locator('input[type="search"]').fill('resistor');
        const firstMatch = panel.locator('[data-macro-key]:visible').first();
        await expect(firstMatch).toBeVisible();

        await firstMatch.click();
        await expect.poll(() => getCurrentTool(page)).toBe(Tools.MACRO);

        // Placing the armed macro on the canvas adds an MC primitive.
        await clickCanvasScreen(page, 300, 300);
        await expect.poll(() => primitiveCount(page)).toBe(1);
        expect(await getCircuitText(page)).toContain('MC');
    });
});

test.describe('Macro — Load and Place via API', () => {
    test.beforeEach(async ({ page }) => {
        await gotoApp(page);
    });

    test('can load a simple macro library and place it', async ({ page }) => {
        // Register a simple test macro library
        await page.evaluate(() => {
            const panel = (window as any).__FidoCadJS__.circuitPanel;
            const libraryFCL = `
[RESISTOR]
R=Resistor
LI 100 100 120 100 0
LI 120 100 125 95 0
LI 125 95 135 105 0
LI 135 105 125 115 0
LI 125 115 120 110 0
LI 120 110 100 100 0
SA 100 100 0
SA 140 100 0
`;
            panel.loadLibraryString(libraryFCL, 'testlib');
        });

        // Arm the macro tool with the registered key ([RESISTOR] under the
        // 'testlib' prefix registers as 'testlib.resistor').
        await page.evaluate(() => {
            const panel = (window as any).__FidoCadJS__.circuitPanel;
            panel.setMacroTool('testlib.resistor');
        });

        // Place the macro on the canvas
        await clickCanvasScreen(page, 300, 300);
        await settle(page);

        const count = await primitiveCount(page);
        expect(count).toBe(1);

        const fcd = await getCircuitText(page);
        expect(fcd).toContain('MC');
        expect(fcd).toContain('testlib.resistor');
    });

    test('placing unknown macro key silently drops', async ({ page }) => {
        // Try placing a macro with a key that doesn't exist
        await page.evaluate(() => {
            const panel = (window as any).__FidoCadJS__.circuitPanel;
            panel.clearCircuit();
            panel.setMacroTool('nonexistent.unknown');
        });

        await clickCanvasScreen(page, 300, 300);
        await settle(page);

        // Nothing is added and the app keeps responding to API calls.
        expect(await primitiveCount(page)).toBe(0);
        expect(await getCircuitText(page)).not.toContain('MC');
    });
});
