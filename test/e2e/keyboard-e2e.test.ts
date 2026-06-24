import { test, expect } from '@playwright/test';
import {
    gotoApp,
    pressKey,
    getCurrentTool,
    getCircuitText,
    primitiveCount,
    loadCircuit,
    clearCircuit,
    canUndo,
    canRedo,
    settle,
    Tools,
} from './utils';

/** Select all via the panel API. */
async function selectAll(page: any) {
    await page.evaluate(() => {
        const panel = (window as any).__FidoCadJS__.circuitPanel;
        panel.selectAll();
    });
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
        // Tool should still be LINE (Ctrl+E triggers export, not ellipse tool)
        expect(await getCurrentTool(page)).toBe(Tools.LINE);
    });

    test('Ctrl+P does NOT switch to Polygon tool', async ({ page }) => {
        await pressKey(page, 'l');
        await pressKey(page, 'Control+p');
        expect(await getCurrentTool(page)).toBe(Tools.LINE);
    });

    test('Ctrl+O does NOT switch to Complex curve tool', async ({ page, browserName }) => {
        // Firefox: Ctrl+O triggers the native "Open File" dialog which crashes
        // headless Firefox on CI ("Target page, context or browser has been closed").
        // The assertion (that the app does not bind Ctrl+O to a tool) is engine-
        // agnostic, so verifying on Chromium + WebKit is sufficient.
        test.skip(
            browserName === 'firefox',
            'Ctrl+O opens the native Firefox file dialog and crashes headless',
        );
        await pressKey(page, 'l');
        await pressKey(page, 'Control+o');
        expect(await getCurrentTool(page)).toBe(Tools.LINE);
    });

    test('Ctrl+Z does NOT switch to PCB pad tool', async ({ page }) => {
        await pressKey(page, 'l');
        await pressKey(page, 'Control+z');
        expect(await getCurrentTool(page)).toBe(Tools.LINE);
    });

    test('Ctrl+S does NOT trigger mirror (S)', async ({ page }) => {
        await loadCircuit(page, TEST_FCD);
        const before = await primitiveCount(page);

        await selectAll(page);
        await pressKey(page, 'Control+s');

        // Primitive count unchanged (Ctrl+S saves, does not mirror)
        expect(await primitiveCount(page)).toBe(before);
    });

    test('Ctrl+Shift+S does NOT trigger mirror', async ({ page }) => {
        await loadCircuit(page, TEST_FCD);
        await selectAll(page);

        await pressKey(page, 'Control+Shift+s');

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
        // Load a circuit placed away from the origin: rotation must keep all
        // coordinates positive, because the undo stack round-trips through
        // the parser, which clamps negative coordinates to zero (so a
        // rotation that went negative would not redo to identical text).
        await loadCircuit(page, 'FJC A 1\nFJC B 1\nLI 200 200 280 200 0\nRV 210 220 270 260 2\n');
        const original = await getCircuitText(page);
        await page.evaluate(() => {
            const panel = (window as any).__FidoCadJS__.circuitPanel;
            panel.selectAll();
            panel.rotateSelected();
        });
        const rotated = await getCircuitText(page);
        expect(rotated).not.toBe(original);
        expect(await canUndo(page)).toBe(true);

        // Undo restores the pre-rotation circuit…
        await pressKey(page, 'Control+z');
        expect(await getCircuitText(page)).toBe(original);
        expect(await canRedo(page)).toBe(true);

        // …and redo re-applies the rotation.
        await pressKey(page, 'Control+y');
        expect(await getCircuitText(page)).toBe(rotated);
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
        await settle(page);

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
        await settle(page);

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
