import { expect, test } from '@playwright/test';
import {
    clickCanvasScreen,
    gotoApp,
    loadCircuit,
    logicalToScreen,
    pressKey,
    selectedCount,
} from './utils';

test('text selection follows glyph ink instead of the whole string box', async ({ page }) => {
    await gotoApp(page);
    await loadCircuit(page, '[FIDOCAD]\nTY 50 50 14 10 0 0 0 Courier++New String\n');
    await pressKey(page, 'a');

    const hitPoints = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d')!;
        ctx.font = '17px "Courier New", monospace';

        const inkBounds = (character: string) => {
            const originX = 30;
            const baseline = 60;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = '17px "Courier New", monospace';
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = '#000';
            ctx.fillText(character, originX, baseline);
            const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let minX = canvas.width;
            let minY = canvas.height;
            let maxX = -1;
            let maxY = -1;
            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    if (pixels[(y * canvas.width + x) * 4 + 3]! < 16) continue;
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }
            return {
                width: ctx.measureText(character).width,
                left: originX - minX,
                right: maxX + 1 - originX,
                ascent: baseline - minY,
                descent: maxY + 1 - baseline,
            };
        };

        const fontAscent = ctx.measureText('M').actualBoundingBoxAscent || 17 * 0.8;
        const s = inkBounds('S');
        const t = inkBounds('t');
        const g = inkBounds('g');
        const tOrigin = ctx.measureText('St').width - t.width;
        const gOrigin = ctx.measureText('String').width - g.width;
        const gapStart = s.right;
        const gapEnd = tOrigin - t.left;
        const verticalScale = (14 * 22) / (40 * 10);

        return {
            gap: {
                x: 50 + (gapStart + gapEnd) / 2,
                y: 50 + (fontAscent - s.ascent / 2) * verticalScale,
            },
            nearS: {
                x: 50 + gapStart + 0.2,
                y: 50 + (fontAscent - s.ascent / 2) * verticalScale,
            },
            descenderG: {
                x: 50 + gOrigin + (g.right - g.left) / 2,
                y: 50 + (fontAscent + g.descent * 0.7) * verticalScale,
            },
        };
    });

    const clickLogical = async (point: { x: number; y: number }) => {
        const screen = await logicalToScreen(page, point.x, point.y);
        await clickCanvasScreen(page, screen.x, screen.y);
    };

    await clickLogical(hitPoints.gap);
    expect(await selectedCount(page)).toBe(0);

    await clickLogical(hitPoints.nearS);
    expect(await selectedCount(page)).toBe(1);

    await pressKey(page, 'a');
    await clickLogical(hitPoints.descenderG);
    expect(await selectedCount(page)).toBe(1);
});
