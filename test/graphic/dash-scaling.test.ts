/**
 * @file dash-scaling.test.ts
 * @author Dante Loi
 * @date 2026-05-15
 * @brief Verify that applyStroke scales dash patterns with line width
 *        so dashed strokes look consistent at every zoom level.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphicsCanvas } from '../../src/graphic/canvas/GraphicsCanvas.js';
import { Globals } from '../../src/globals/Globals.js';

describe('GraphicsCanvas.applyStroke — dash scaling', () => {
    let gc: GraphicsCanvas;
    let setLineDashSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        gc = new GraphicsCanvas(canvas);

        // Replace the stub setLineDash with a spy so we can inspect calls.
        const ctx = gc.getCtx() as any;
        setLineDashSpy = vi.fn();
        ctx.setLineDash = setLineDashSpy;
    });

    // ── helpers ──────────────────────────────────────────────────────

    /** Return the dash pattern that would be set for the given stroke. */
    function captureDash(w: number, dashStyle: number): number[] {
        setLineDashSpy.mockClear();
        gc.applyStroke(w, dashStyle);
        // Solid strokes pass []; dashed strokes pass the scaled pattern.
        return setLineDashSpy.mock.calls[0]?.[0] ?? [];
    }

    // ── basic behaviour ──────────────────────────────────────────────

    it('solid stroke (dashStyle 0) passes an empty array', () => {
        const dash = captureDash(10, 0);
        expect(dash).toEqual([]);
    });

    it('dashed stroke (dashStyle 1) passes a non-empty array', () => {
        const dash = captureDash(10, 1);
        expect(dash.length).toBeGreaterThan(0);
    });

    // ── scaling by line width ────────────────────────────────────────

    it('scales dash pattern proportionally to line width', () => {
        // Base pattern for dashStyle 1 is [5, 5] from Globals.
        // With w = 10 and lineWidth = 0.5, scale = 10 / 0.5 = 20.
        // Expected: [5*20, 5*20] = [100, 100].
        const dash10 = captureDash(10, 1);
        const expectedScale = 10 / Globals.lineWidth;
        expect(dash10).toEqual([5 * expectedScale, 5 * expectedScale]);
    });

    it('doubling line width doubles the dash pattern', () => {
        const dash5 = captureDash(5, 1);
        const dash10 = captureDash(10, 1);

        // dash10 should be exactly 2× dash5 in every element.
        expect(dash10.length).toBe(dash5.length);
        for (let i = 0; i < dash10.length; i++) {
            expect(dash10[i]).toBeCloseTo(dash5[i]! * 2, 0);
        }
    });

    it('dashStyle 4 (multi-segment) scales all segments', () => {
        // Pattern: [2, 5, 5, 5], scale = 10 / 0.5 = 20
        const dash = captureDash(10, 4);
        const expectedScale = 10 / Globals.lineWidth;
        expect(dash).toEqual([2, 5, 5, 5].map((d) => d * expectedScale));
    });

    // ── edge cases ───────────────────────────────────────────────────

    it('handles minimum line width (D_MIN clamping)', () => {
        // When w is very small (e.g. 0.5 from D_MIN clamping),
        // the scale is still computed correctly.
        const dash = captureDash(0.5, 1);
        const expectedScale = 0.5 / Globals.lineWidth;
        expect(dash).toEqual([5 * expectedScale, 5 * expectedScale]);
        // At min width the dashes are small but still positive.
        expect(dash[0]).toBeGreaterThan(0);
    });

    it('handles high zoom (large line width)', () => {
        // w = 200 (e.g. 1000 % zoom at lineWidth = 0.5 → 0.5*400 = 200)
        const dash = captureDash(200, 2);
        const expectedScale = 200 / Globals.lineWidth;
        expect(dash).toEqual([2 * expectedScale, 2 * expectedScale]);
        // Values should be large but finite.
        expect(Number.isFinite(dash[0]!)).toBe(true);
    });

    it('all 5 dash styles produce valid output', () => {
        for (let style = 0; style < Globals.dashNumber; style++) {
            const dash = captureDash(8, style);
            if (style === 0) {
                expect(dash).toEqual([]);
            } else {
                expect(dash.length).toBeGreaterThan(0);
                // Pattern should match scaled Globals.dash[style].
                const raw = Globals.dash[style]!;
                const scale = 8 / Globals.lineWidth;
                expect(dash).toEqual(raw.map((d) => d * scale));
            }
        }
    });
});
