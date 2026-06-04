/**
 * @file math-render.test.ts
 * @author Dante Loi
 * @date 2026-06-03
 * @brief E2E — LaTeX math renders through the real browser stack: typeset
 *        glyphs painted on the canvas (renderTeX) and embedded as paths in SVG
 *        export. Replaces the removed KaTeX-overlay behaviour.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { test, expect } from '@playwright/test';
import { gotoApp, loadCircuit, exportSVG } from './utils';

// A text primitive with inline math: TY x y siy six o sty layer font text...
const MATH_FCD = '[FIDOCAD]\nTY 30 30 4 2 0 0 0 * $\\frac{a}{b}$';

/** Capture the editor canvas as a base64 PNG via toBlob. */
async function exportPngBase64(page: import('@playwright/test').Page): Promise<string> {
    return page.evaluate(
        () =>
            new Promise<string>((resolve, reject) => {
                const panel = (window as any).__FidoCadJS__.circuitPanel;
                const canvas = panel.getCanvasElement();
                canvas.toBlob((blob: Blob | null) => {
                    if (!blob) return reject(new Error('toBlob returned null'));
                    const reader = new FileReader();
                    reader.onload = () => {
                        const r = reader.result as string;
                        resolve(r.slice(r.indexOf(',') + 1));
                    };
                    reader.onerror = () => reject(reader.error);
                    reader.readAsDataURL(blob);
                }, 'image/png');
            }),
    );
}

async function setRenderTeX(page: import('@playwright/test').Page, on: boolean): Promise<void> {
    await page.evaluate((enabled) => {
        (window as any).__FidoCadJS__.circuitPanel.setRenderTeX(enabled);
    }, on);
    await page.waitForTimeout(200);
}

test.describe('LaTeX math rendering', () => {
    test.beforeEach(async ({ page }) => {
        await gotoApp(page);
    });

    test('canvas paints typeset math differently from literal source', async ({ page }) => {
        await loadCircuit(page, MATH_FCD);

        await setRenderTeX(page, false);
        const literal = await exportPngBase64(page);

        await setRenderTeX(page, true);
        const typeset = await exportPngBase64(page);

        // Typesetting $\frac{a}{b}$ produces a fraction bar + stacked glyphs,
        // which must differ from drawing the raw "$\frac{a}{b}$" string.
        expect(typeset).not.toBe(literal);
        expect(Buffer.from(typeset, 'base64').length).toBeGreaterThan(100);
    });

    test('SVG export embeds math as glyph paths, not literal $', async ({ page }) => {
        await loadCircuit(page, MATH_FCD);
        const svg = await exportSVG(page);
        expect(svg).toContain('<path');
        expect(svg).toContain('matrix(');
        expect(svg).not.toContain('\\frac');
    });

    test('no leftover KaTeX overlay DOM is present', async ({ page }) => {
        // The old overlay injected KaTeX HTML; nothing should remain.
        const katexNodes = await page.locator('.katex').count();
        expect(katexNodes).toBe(0);
    });
});
