import { test, expect } from '@playwright/test';
import { gotoApp, grantClipboardPermissions, canvasBox, pressKey, primitiveCount } from './utils';

test.describe('Clipboard Operations', () => {
    test.beforeEach(async ({ page }) => {
        await gotoApp(page);
        await page.evaluate(() => {
            const panel = (window as any).__FidoCadJS__.circuitPanel;
            panel.clearCircuit();
            panel.loadCircuit('FJC A 1\nFJC B 1\nLI 50 50 150 50 0\nLI 100 100 200 100 1\n');
        });
    });

    // The one full UI-path flow: real Ctrl+C / Ctrl+V keystrokes through the
    // system clipboard, committed by clicking the placement position. The
    // API-driven tests below pin down the controller logic; this one proves
    // the keyboard wiring and browser clipboard integration end to end.
    test('Ctrl+C / Ctrl+V via keyboard inserts a copy on click', async ({
        page,
        context,
        browserName,
    }) => {
        test.skip(
            browserName !== 'chromium',
            'clipboard-read/write permission grants are Chromium-only',
        );
        await grantClipboardPermissions(context);

        await page.evaluate(() => (window as any).__FidoCadJS__.circuitPanel.selectAll());
        await pressKey(page, 'Control+c');
        await pressKey(page, 'Control+v');

        // The async clipboard read arms interactive placement mode.
        await expect
            .poll(() =>
                page.evaluate(() => (window as any).__FidoCadJS__.circuitPanel.isPastePlacing()),
            )
            .toBe(true);

        // Clicking confirms the placement position and inserts the copy.
        const box = await canvasBox(page);
        await page.mouse.click(box!.x + 400, box!.y + 300);
        await expect.poll(() => primitiveCount(page)).toBe(4);
    });

    test('copySelected preserves primitives', async ({ page }) => {
        const ok = await page.evaluate(() => {
            const panel = (window as any).__FidoCadJS__.circuitPanel;
            panel.selectAll();
            panel.copySelected();
            return panel.getModel().getPrimitiveVector().length === 2;
        });
        expect(ok).toBe(true);
    });

    test('cutSelected removes primitives', async ({ page }) => {
        const ok = await page.evaluate(() => {
            const panel = (window as any).__FidoCadJS__.circuitPanel;
            panel.selectAll();
            panel.cutSelected();
            return panel.getModel().getPrimitiveVector().length === 0;
        });
        expect(ok).toBe(true);
    });

    test('duplicateSelected doubles count', async ({ page, browserName }) => {
        test.skip(
            browserName === 'firefox',
            'Firefox clipboard API quirk with async readText fallback — tracked separately',
        );
        const ok = await page.evaluate(async () => {
            const panel = (window as any).__FidoCadJS__.circuitPanel;
            panel.selectAll();
            panel.duplicateSelected();
            for (let i = 0; i < 20; i++) {
                await new Promise((r) => setTimeout(r, 50));
                if (panel.getModel().getPrimitiveVector().length === 4) return true;
            }
            return false;
        });
        expect(ok).toBe(true);
    });

    test('cut then duplicate works via internal clipboard', async ({ page, browserName }) => {
        test.skip(
            browserName === 'firefox',
            'Firefox clipboard API quirk with async readText fallback — tracked separately',
        );
        const ok = await page.evaluate(async () => {
            const panel = (window as any).__FidoCadJS__.circuitPanel;
            panel.selectAll();
            panel.cutSelected();
            if (panel.getModel().getPrimitiveVector().length !== 0) return false;
            panel.duplicateSelected();
            for (let i = 0; i < 20; i++) {
                await new Promise((r) => setTimeout(r, 50));
                if (panel.getModel().getPrimitiveVector().length === 2) return true;
            }
            return false;
        });
        expect(ok).toBe(true);
    });

    test('duplicate is undoable', async ({ page, browserName }) => {
        test.skip(
            browserName === 'firefox',
            'Firefox clipboard API quirk with async readText fallback — tracked separately',
        );
        const ok = await page.evaluate(async () => {
            const panel = (window as any).__FidoCadJS__.circuitPanel;
            panel.selectAll();
            panel.duplicateSelected();
            // Wait for the async paste to complete and verify 4 primitives
            for (let i = 0; i < 20; i++) {
                await new Promise((r) => setTimeout(r, 50));
                if (panel.getModel().getPrimitiveVector().length === 4) break;
            }
            if (panel.getModel().getPrimitiveVector().length !== 4)
                return 'expected 4 after duplicate';
            panel.undo();
            return panel.getModel().getPrimitiveVector().length === 2;
        });
        expect(ok).toBe(true);
    });

    test('cut then undo restores', async ({ page }) => {
        const ok = await page.evaluate(() => {
            const panel = (window as any).__FidoCadJS__.circuitPanel;
            panel.selectAll();
            panel.cutSelected();
            if (panel.getModel().getPrimitiveVector().length !== 0) return false;
            panel.undo();
            return panel.getModel().getPrimitiveVector().length === 2;
        });
        expect(ok).toBe(true);
    });

    test('paste enters placement mode then commit inserts', async ({ page, browserName }) => {
        test.skip(
            browserName === 'firefox',
            'Firefox clipboard API quirk with async readText fallback — tracked separately',
        );
        const ok = await page.evaluate(async () => {
            const panel = (window as any).__FidoCadJS__.circuitPanel;
            panel.selectAll();
            panel.copySelected();
            void panel.paste();
            // Wait for the (async) clipboard read to arm placement mode.
            for (let i = 0; i < 20; i++) {
                await new Promise((r) => setTimeout(r, 50));
                if (panel.isPastePlacing()) break;
            }
            if (!panel.isPastePlacing()) return 'did not enter placement';
            // Nothing committed until the user confirms.
            if (panel.getModel().getPrimitiveVector().length !== 2) return 'inserted too early';
            panel.commitPastePlacement();
            if (panel.isPastePlacing()) return 'still placing after commit';
            return panel.getModel().getPrimitiveVector().length === 4;
        });
        expect(ok).toBe(true);
    });

    test('paste placement cancel inserts nothing', async ({ page, browserName }) => {
        test.skip(
            browserName === 'firefox',
            'Firefox clipboard API quirk with async readText fallback — tracked separately',
        );
        const ok = await page.evaluate(async () => {
            const panel = (window as any).__FidoCadJS__.circuitPanel;
            panel.selectAll();
            panel.copySelected();
            void panel.paste();
            for (let i = 0; i < 20; i++) {
                await new Promise((r) => setTimeout(r, 50));
                if (panel.isPastePlacing()) break;
            }
            if (!panel.isPastePlacing()) return false;
            panel.cancelPastePlacement();
            return !panel.isPastePlacing() && panel.getModel().getPrimitiveVector().length === 2;
        });
        expect(ok).toBe(true);
    });

    test('copy all as primitives fills a pasteable clipboard', async ({ page, browserName }) => {
        test.skip(
            browserName === 'firefox',
            'Firefox clipboard API quirk with async readText fallback — tracked separately',
        );
        const ok = await page.evaluate(async () => {
            const panel = (window as any).__FidoCadJS__.circuitPanel;
            // Copy the whole drawing (2 primitives) as flattened primitives, then
            // paste it back and confirm it inserts a second copy.
            panel.copyAllAsPrimitives();
            void panel.paste();
            for (let i = 0; i < 20; i++) {
                await new Promise((r) => setTimeout(r, 50));
                if (panel.isPastePlacing()) break;
            }
            if (!panel.isPastePlacing()) return 'did not enter placement';
            panel.commitPastePlacement();
            return panel.getModel().getPrimitiveVector().length === 4;
        });
        expect(ok).toBe(true);
    });

    test('paste placement commit is undoable', async ({ page, browserName }) => {
        test.skip(
            browserName === 'firefox',
            'Firefox clipboard API quirk with async readText fallback — tracked separately',
        );
        const ok = await page.evaluate(async () => {
            const panel = (window as any).__FidoCadJS__.circuitPanel;
            panel.selectAll();
            panel.copySelected();
            void panel.paste();
            for (let i = 0; i < 20; i++) {
                await new Promise((r) => setTimeout(r, 50));
                if (panel.isPastePlacing()) break;
            }
            if (!panel.isPastePlacing()) return false;
            panel.commitPastePlacement();
            if (panel.getModel().getPrimitiveVector().length !== 4) return false;
            panel.undo();
            return panel.getModel().getPrimitiveVector().length === 2;
        });
        expect(ok).toBe(true);
    });
});
