import { test, expect, type Page } from '@playwright/test';
import {
    gotoApp,
    loadCircuit,
    getCircuitText,
    canvasBox,
    logicalToScreen,
    pressKey,
    grantClipboardPermissions,
} from './utils';

const macro = 'MC 100 100 0 0 080\nFCJ\nTY 110 110 4 3 0 0 0 * R1\nTY 110 115 4 3 0 0 0 * 10k\n';

async function moveTo(page: Page, x: number, y: number) {
    const box = (await canvasBox(page))!;
    const screen = await logicalToScreen(page, x, y);
    const position = { x: box.x + screen.x, y: box.y + screen.y };
    await page.mouse.move(position.x, position.y);
    return position;
}

async function ghostText(page: Page) {
    return page.evaluate(() => (window as any).__FidoCadJS__.circuitPanel.pastePlacement.getText());
}

test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await loadCircuit(page, macro);
    await page.evaluate(() => {
        const panel = (window as any).__FidoCadJS__.circuitPanel;
        const map = panel.getMapCoordinates();
        map.setMagnitudes(1, 1);
        map.setXCenter(0);
        map.setYCenter(0);
        panel.render();
    });
    await pressKey(page, 'Control+a');
});

test('copied macro rotates and mirrors before click placement, preserving the original', async ({
    page,
    context,
    browserName,
}) => {
    test.skip(browserName !== 'chromium', 'System clipboard permissions require Chromium');
    await grantClipboardPermissions(context);
    const original = await getCircuitText(page);
    await moveTo(page, 200, 200);
    await pressKey(page, 'Control+c');
    await pressKey(page, 'Control+v');
    await expect
        .poll(() =>
            page.evaluate(() => (window as any).__FidoCadJS__.circuitPanel.isPastePlacing()),
        )
        .toBe(true);
    await pressKey(page, 'r');
    expect(await ghostText(page)).toContain('MC 200 200 1 0 080');
    await pressKey(page, 'm');
    expect(await ghostText(page)).toContain('MC 200 200 1 1 080');
    const position = await moveTo(page, 300, 300);
    const preview = await ghostText(page);
    expect(preview).toContain('MC 300 300 1 1 080');
    expect(preview).toContain('TY 310 310 4 3 0 0 0 * R1');
    expect(await getCircuitText(page)).toBe(original);
    await page.mouse.click(position.x, position.y);
    const placed = await getCircuitText(page);
    expect(placed).toContain(macro);
    for (const line of preview.trim().split('\n')) expect(placed).toContain(line);
    await pressKey(page, 'Control+z');
    expect(await getCircuitText(page)).toBe(original);
    await pressKey(page, 'Control+Shift+z');
    expect(await getCircuitText(page)).toBe(placed);
});

test('placement edits and grid/fine nudges survive Enter and do not edit the selected source', async ({
    page,
}) => {
    const original = await getCircuitText(page);
    await page.evaluate((text) => {
        const panel = (window as any).__FidoCadJS__.circuitPanel;
        panel.getMapCoordinates().setXGridStep(5);
        panel.getMapCoordinates().setYGridStep(10);
        panel.beginPastePlacement(text);
    }, macro);
    await moveTo(page, 200, 200);
    await pressKey(page, 'r');
    await pressKey(page, 'm');
    await pressKey(page, 'ArrowRight');
    await pressKey(page, 'ArrowDown');
    await pressKey(page, 'Alt+ArrowUp');
    expect(await ghostText(page)).toContain('MC 205 209 1 1 080');
    await pressKey(page, 'Delete');
    await pressKey(page, 'l');
    expect(await getCircuitText(page)).toBe(original);
    await pressKey(page, 'Enter');
    expect(await getCircuitText(page)).toContain('MC 205 209 1 1 080');
    await pressKey(page, 'Control+z');
    expect(await getCircuitText(page)).toBe(original);
});

test('Escape discards transformed placement without modifying the drawing or undo history', async ({
    page,
}) => {
    const original = await getCircuitText(page);
    const canUndo = await page.evaluate(() => (window as any).__FidoCadJS__.circuitPanel.canUndo());
    await page.evaluate(
        (text) => (window as any).__FidoCadJS__.circuitPanel.beginPastePlacement(text),
        macro,
    );
    await moveTo(page, 200, 200);
    await pressKey(page, 'm');
    await pressKey(page, 'r');
    await pressKey(page, 'ArrowLeft');
    await pressKey(page, 'Escape');
    expect(await getCircuitText(page)).toBe(original);
    expect(
        await page.evaluate(() => {
            const panel = (window as any).__FidoCadJS__.circuitPanel;
            return { placing: panel.isPastePlacing(), canUndo: panel.canUndo() };
        }),
    ).toEqual({ placing: false, canUndo });
});
