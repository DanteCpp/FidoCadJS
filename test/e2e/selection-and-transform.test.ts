import { test, expect } from '@playwright/test';
import {
    gotoApp,
    pressKey,
    primitiveCount,
    getCircuitText,
    selectedCount,
    logicalToScreen,
    canvasBox,
    loadCircuit,
} from './utils';

/** Standard two-line FCD fixture for selection/transform tests. */
const TWO_LINES_FCD = `FJC A 1
FJC B 1
LI 50 50 150 50 0
LI 100 100 200 100 1
`;

/** Select all primitives via the panel API. */
async function selectAll(page: ReturnType<(typeof test)['info']> extends never ? never : any) {
    // Use the API directly since Ctrl+A is not wired as a keyboard shortcut
    await page.evaluate(() => {
        const panel = (window as any).__FidoCadJS__.circuitPanel;
        panel.selectAll();
    });
}

test.describe('Selection', () => {
    test.beforeEach(async ({ page }) => {
        await gotoApp(page);
        await loadCircuit(page, TWO_LINES_FCD);
        // Switch to selection tool explicitly
        await pressKey(page, 'a');
    });

    test('click on a primitive selects exactly that one', async ({ page }) => {
        // Click on the midpoint of the first line (logical 100,50), mapped to
        // screen coordinates through the live coordinate system.
        const box = await canvasBox(page);
        const pt = await logicalToScreen(page, 100, 50);
        await page.mouse.click(box!.x + pt.x, box!.y + pt.y);
        await expect.poll(() => selectedCount(page)).toBe(1);

        // Clicking empty canvas space deselects again.
        await page.mouse.click(box!.x + pt.x, box!.y + pt.y + 200);
        await expect.poll(() => selectedCount(page)).toBe(0);
    });

    test('Escape deselects all and switches to Selection tool', async ({ page }) => {
        await selectAll(page);
        expect(await selectedCount(page)).toBe(2);

        await pressKey(page, 'Escape');
        expect(await selectedCount(page)).toBe(0);

        // Delete should do nothing now (Escape deselects)
        await pressKey(page, 'Delete');
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
        await expect.poll(() => selectedCount(page)).toBeGreaterThan(0);

        // Press Delete — should remove selected primitives
        await pressKey(page, 'Delete');
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

        const after = await getCircuitText(page);
        expect(after).not.toBe(before);
        expect(await primitiveCount(page)).toBe(2);
    });

    test('mirror selected primitives with S key', async ({ page }) => {
        await selectAll(page);
        const before = await getCircuitText(page);

        await pressKey(page, 's');

        const after = await getCircuitText(page);
        expect(after).not.toBe(before);
        expect(await primitiveCount(page)).toBe(2);
    });

    test('Delete key removes selected primitives', async ({ page }) => {
        await selectAll(page);
        expect(await primitiveCount(page)).toBe(2);

        await pressKey(page, 'Delete');
        expect(await primitiveCount(page)).toBe(0);
    });

    test('Backspace also removes selected primitives', async ({ page }) => {
        await selectAll(page);
        expect(await primitiveCount(page)).toBe(2);

        await pressKey(page, 'Backspace');
        expect(await primitiveCount(page)).toBe(0);
    });

    test('nudge selected with Alt+Arrow keys', async ({ page }) => {
        await selectAll(page);
        const before = await getCircuitText(page);

        await pressKey(page, 'Alt+ArrowRight');

        const after = await getCircuitText(page);
        expect(after).not.toBe(before);
        expect(await primitiveCount(page)).toBe(2);
    });

    test('R does nothing when nothing is selected', async ({ page }) => {
        // Ensure nothing selected by deselecting via Escape
        await pressKey(page, 'Escape');

        const before = await getCircuitText(page);
        await pressKey(page, 'r');

        const after = await getCircuitText(page);
        expect(after).toBe(before);
        expect(await primitiveCount(page)).toBe(2);
    });

    test('move mode via M key changes cursor when selection exists', async ({ page }) => {
        await selectAll(page);

        await pressKey(page, 'm');

        const cursor = await page
            .locator('[data-testid="editor-canvas"]')
            .evaluate((el) => (el as HTMLCanvasElement).style.cursor);
        expect(cursor).toBe('move');
    });
});
