import { test, expect } from '@playwright/test';
import {
    gotoApp,
    loadCircuit,
    pressKey,
    getCurrentTool,
    Tools,
    canvasBox,
    getCircuitText,
} from './utils';

test.beforeEach(async ({ page }) => {
    await gotoApp(page);
});

test('FidoCadAI tools and the additional Shift tool bindings', async ({ page }) => {
    for (const [key, tool] of [
        ['s', Tools.SELECTION],
        ['l', Tools.LINE],
        ['b', Tools.RECTANGLE],
        ['e', Tools.ELLIPSE],
        ['j', Tools.CONNECTION],
        ['t', Tools.TEXT],
        ['Shift+b', Tools.BEZIER],
        ['Shift+p', Tools.POLYGON],
        ['Shift+t', Tools.PCB_LINE],
    ] as const) {
        await pressKey(page, key);
        expect(await getCurrentTool(page)).toBe(tool);
    }
});

test('grid, snap, library and info shortcuts toggle their visible controls', async ({ page }) => {
    const state = () =>
        page.evaluate(() => {
            const panel = (window as any).__FidoCadJS__.circuitPanel;
            return [panel.isGridVisible(), panel.isSnapActive()];
        });
    expect(await state()).toEqual([true, true]);
    await pressKey(page, 'g');
    expect(await state()).toEqual([false, true]);
    await pressKey(page, 'Shift+g');
    expect(await state()).toEqual([false, false]);
    await pressKey(page, 'g');
    await pressKey(page, 'Shift+g');
    expect(await state()).toEqual([true, true]);
    const coords = page.getByTestId('coords-display');
    await pressKey(page, 'i');
    await expect(coords).toBeHidden();
    await pressKey(page, 'i');
    await expect(coords).toBeVisible();
    const library = page.getByTestId('library-toggle');
    await pressKey(page, 'Control+b');
    await expect(library).toHaveCSS('background-color', 'rgb(232, 232, 232)');
    await pressKey(page, 'Control+b');
    await expect(library).toHaveCSS('background-color', 'rgb(176, 200, 232)');
});

test('layer cycling moves selected objects, wraps and is undoable', async ({ page }) => {
    await loadCircuit(page, 'LI 10 10 30 20 0\n');
    await pressKey(page, 'Control+a');
    await pressKey(page, ']');
    expect(await getCircuitText(page)).toContain('LI 10 10 30 20 1');
    await pressKey(page, 'Control+z');
    expect(await getCircuitText(page)).toContain('LI 10 10 30 20 0');
    await pressKey(page, 'Escape');
    await pressKey(page, '[');
    await pressKey(page, '[');
    expect(
        await page.evaluate(() => (window as any).__FidoCadJS__.circuitPanel.getCurrentLayer()),
    ).toBe(15);
    await expect(page.getByTestId('layer-dropdown').locator(':scope > div').first()).toHaveText(
        'Other 12▾',
    );
});

test('arrows nudge by the configured grid and Alt nudges by one unit', async ({ page }) => {
    await loadCircuit(page, 'LI 20 20 40 30 0\n');
    await page.evaluate(() => {
        const panel = (window as any).__FidoCadJS__.circuitPanel;
        panel.getMapCoordinates().setXGridStep(5);
        panel.getMapCoordinates().setYGridStep(10);
    });
    await pressKey(page, 'Control+a');
    await pressKey(page, 'ArrowRight');
    await pressKey(page, 'ArrowUp');
    expect(await getCircuitText(page)).toContain('LI 25 10 45 20 0');
    await pressKey(page, 'Alt+ArrowDown');
    expect(await getCircuitText(page)).toContain('LI 25 11 45 21 0');
});

test('P and F2 open selection properties', async ({ page }) => {
    await loadCircuit(page, 'LI 20 20 40 30 0\n');
    await pressKey(page, 'Control+a');
    await pressKey(page, 'p');
    await expect(page.getByTestId('properties-sidebar')).toBeVisible();
    await pressKey(page, 'Escape');
    await pressKey(page, 'Control+a');
    await pressKey(page, 'F2');
    await expect(page.getByTestId('properties-sidebar')).toBeVisible();
});

test('K opens a searchable sheet that shields the drawing from shortcuts', async ({ page }) => {
    await pressKey(page, 'l');
    await pressKey(page, 'k');
    const dialog = page.getByTestId('shortcuts-dialog');
    await expect(dialog).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search shortcuts' }).fill('rectangle');
    await expect(dialog.getByText('Rectangle', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Undo', { exact: true })).toBeHidden();
    expect(await getCurrentTool(page)).toBe(Tools.LINE);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(await getCurrentTool(page)).toBe(Tools.LINE);
});

test('F creates filled rectangles and ellipses; Enter finishes a line without leaving the tool', async ({
    page,
}) => {
    await pressKey(page, 'f');
    await pressKey(page, 'b');
    const box = (await canvasBox(page))!;
    await page.mouse.click(box.x + 100, box.y + 100);
    await page.mouse.click(box.x + 200, box.y + 200);
    expect(await getCircuitText(page)).toMatch(/^RP /m);
    await pressKey(page, 'e');
    await page.mouse.click(box.x + 250, box.y + 100);
    await page.mouse.click(box.x + 350, box.y + 200);
    expect(await getCircuitText(page)).toMatch(/^EP /m);
    await pressKey(page, 'l');
    await page.mouse.click(box.x + 100, box.y + 300);
    await page.mouse.click(box.x + 200, box.y + 300);
    const before = await getCircuitText(page);
    await pressKey(page, 'Enter');
    expect(await getCurrentTool(page)).toBe(Tools.LINE);
    await page.mouse.click(box.x + 300, box.y + 300);
    expect(await getCircuitText(page)).toBe(before);
    await pressKey(page, 'Escape');
    expect(await getCurrentTool(page)).toBe(Tools.LINE);
    await pressKey(page, 'Escape');
    expect(await getCurrentTool(page)).toBe(Tools.SELECTION);
});

test('Shift+I opens the image picker and Ctrl+Enter starts saving', async ({ page }) => {
    const chooser = page.waitForEvent('filechooser');
    await pressKey(page, 'Shift+i');
    const input = await chooser;
    expect(await input.element().getAttribute('accept')).toBe('image/*');
    await page.evaluate(() => {
        (window as any).showSaveFilePicker = undefined;
    });
    await pressKey(page, 'Control+Enter');
    await expect(page.locator('dialog')).toBeVisible();
    // The dialog owns Enter: accepting it must not launch another save.
    const download = page.waitForEvent('download');
    await page.keyboard.press('Control+Enter');
    await download;
    await expect(page.locator('dialog')).toHaveCount(0);
});
