import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphicsCanvas } from '../../src/graphic/canvas/GraphicsCanvas.js';
import { ColorCanvas } from '../../src/graphic/canvas/ColorCanvas.js';
import { MapCoordinates } from '../../src/geom/MapCoordinates.js';

describe('GraphicsCanvas.drawGrid — auto-scaling', () => {
    let gc: GraphicsCanvas;
    let mc: MapCoordinates;
    let fillRectSpy: ReturnType<typeof vi.fn>;
    let moveToSpy: ReturnType<typeof vi.fn>;
    let lineToSpy: ReturnType<typeof vi.fn>;

    const WIDTH = 800;
    const HEIGHT = 600;
    const color = new ColorCanvas(100, 100, 200);

    beforeEach(() => {
        const canvas = document.createElement('canvas');
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
        gc = new GraphicsCanvas(canvas);

        const ctx = gc.getCtx() as any;
        fillRectSpy = vi.fn();
        moveToSpy = vi.fn();
        lineToSpy = vi.fn();
        ctx.fillRect = fillRectSpy;
        ctx.moveTo = moveToSpy;
        ctx.lineTo = lineToSpy;

        mc = new MapCoordinates();
    });

    function drawGrid(): void {
        gc.drawGrid(mc, 0, 0, WIDTH, HEIGHT, color, color);
    }

    /** Total grid-cell draw operations (dots use fillRect; lines use moveTo). */
    function drawCalls(): number {
        return fillRectSpy.mock.calls.length + moveToSpy.mock.calls.length;
    }

    it('keeps draw calls bounded at the minimum zoom (zoomed out)', () => {
        // At magnitude 0.25 the raw step is 5 * 0.25 = 1.25px. Without
        // auto-scaling the nested dot loop would run (800/1.25)*(600/1.25)
        // ≈ 300k times. Auto-scaling must coarsen the grid instead.
        mc.setMagnitudes(0.25, 0.25);
        drawGrid();
        // A grid that fits 800x600 with cells ≥ 8px can hold at most
        // ~100 x ~75 ≈ a few thousand cells — orders of magnitude below 300k.
        expect(drawCalls()).toBeLessThan(10000);
    });

    it('never renders cells smaller than the minimum pixel spacing', () => {
        // Whatever the zoom, consecutive grid dots must be ≥ 8px apart.
        mc.setMagnitudes(0.25, 0.25);
        drawGrid();

        // Collect distinct x positions from the dot grid (fillRect x arg).
        const xs = Array.from(new Set(fillRectSpy.mock.calls.map((c) => c[0] as number))).sort(
            (a, b) => a - b,
        );
        expect(xs.length).toBeGreaterThan(1);
        for (let i = 1; i < xs.length; i++) {
            expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(8 - 1e-9);
        }
    });

    it('always draws dots, never lines, at every zoom level', () => {
        for (const mag of [0.25, 1, 5, 10, 100]) {
            fillRectSpy.mockClear();
            moveToSpy.mockClear();
            mc.setMagnitudes(mag, mag);
            drawGrid();
            expect(fillRectSpy).toHaveBeenCalled();
            expect(moveToSpy).not.toHaveBeenCalled();
        }
    });

    it('draws 2px dots centred on each grid point', () => {
        mc.setMagnitudes(10, 10); // 5 * 10 = 50px cells, no auto-scaling
        drawGrid();
        // Every dot is a 2x2 rect; the first sits centred on the origin (0,0),
        // i.e. its top-left corner is at (-1, -1).
        const [x, y, w, h] = fillRectSpy.mock.calls[0]!;
        expect(w).toBe(2);
        expect(h).toBe(2);
        expect(x).toBeCloseTo(-1, 6);
        expect(y).toBeCloseTo(-1, 6);
    });

    it('aligns grid dots to the document origin', () => {
        // With xCenter at 0 and a 50px cell, dots step by a clean 50px multiple.
        mc.setMagnitudes(10, 10);
        drawGrid();
        const xs = Array.from(new Set(fillRectSpy.mock.calls.map((c) => c[0] as number))).sort(
            (a, b) => a - b,
        );
        expect(xs[1]! - xs[0]!).toBeCloseTo(50, 6);
    });

    it('does nothing (no infinite loop) when magnitude is degenerate', () => {
        // A zero magnitude yields a zero step; the method must bail, not hang.
        mc.setMagnitudesNoCheck(0, 0);
        expect(() => drawGrid()).not.toThrow();
        expect(drawCalls()).toBe(0);
    });
});
