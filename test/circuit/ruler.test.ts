/**
 * @file ruler.test.ts
 * @author Dante Loi
 * @date 2026-06-03
 * @brief Tests for the on-canvas measuring Ruler (FidoCadJ port)
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Ruler } from '../../src/circuit/Ruler.js';
import { MapCoordinates } from '../../src/geom/MapCoordinates.js';

/** Minimal 2D-context stub recording the text the ruler draws. */
function makeFakeCtx() {
    const texts: string[] = [];
    const ctx = {
        texts,
        save() {},
        restore() {},
        setLineDash() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        stroke() {},
        fillRect() {},
        strokeRect() {},
        fillText(t: string) {
            texts.push(t);
        },
        measureText(t: string) {
            return { width: t.length * 6 };
        },
        strokeStyle: '',
        fillStyle: '',
        lineWidth: 0,
        font: '',
        textBaseline: '',
    };
    return ctx as unknown as CanvasRenderingContext2D & { texts: string[] };
}

describe('Ruler', () => {
    let mc: MapCoordinates;

    beforeEach(() => {
        // Magnitude 1, centred at origin: device pixels map 1:1 to logical units.
        mc = new MapCoordinates();
        mc.setXMagnitudeNoCheck(1);
        mc.setYMagnitudeNoCheck(1);
    });

    it('is inactive and draws nothing by default', () => {
        const ruler = new Ruler();
        const ctx = makeFakeCtx();
        expect(ruler.isActive()).toBe(false);
        ruler.draw(ctx, mc, 1);
        expect(ctx.texts).toHaveLength(0);
    });

    it('reports the length in logical units and millimetres', () => {
        const ruler = new Ruler();
        ruler.setStart(0, 0);
        ruler.setEnd(100, 0);
        ruler.setActive(true);

        const ctx = makeFakeCtx();
        ruler.draw(ctx, mc, 1);

        // 100 logical units, and 100 * 0.127 mm = 12.70 mm.
        expect(ctx.texts).toContain('100.00');
        expect(ctx.texts).toContain('12.70 mm');
    });

    it('measures a diagonal with Pythagoras', () => {
        const ruler = new Ruler();
        ruler.setStart(0, 0);
        ruler.setEnd(30, 40); // 3-4-5 → length 50
        ruler.setActive(true);

        const ctx = makeFakeCtx();
        ruler.draw(ctx, mc, 1);

        expect(ctx.texts).toContain('50.00');
        expect(ctx.texts).toContain((50 * 0.127).toFixed(2) + ' mm');
    });

    it('exposes its start point', () => {
        const ruler = new Ruler();
        ruler.setStart(12, 34);
        expect(ruler.getStartX()).toBe(12);
        expect(ruler.getStartY()).toBe(34);
    });
});
