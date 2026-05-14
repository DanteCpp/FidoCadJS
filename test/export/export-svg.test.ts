/**
 * @file export-svg.test.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief Tests for ExportSVG — SVG element generation
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExportSVG } from '../../src/export/ExportSVG.js';
import { DimensionG } from '../../src/graphic/DimensionG.js';
import { StandardLayers } from '../../src/layers/StandardLayers.js';
import { PointDouble } from '../../src/graphic/PointDouble.js';

describe('ExportSVG', () => {
    let svg: ExportSVG;
    const layers = StandardLayers.createStandardLayers();

    beforeEach(() => {
        svg = new ExportSVG();
        svg.exportStart(new DimensionG(200, 200), layers, 0);
    });

    it('exportStart / exportEnd produce valid SVG wrapper', () => {
        svg.exportEnd();
        const result = svg.getSvgString();
        expect(result).toContain('<?xml');
        expect(result).toContain('<svg');
        expect(result).toContain('</svg>');
    });

    it('exportLine produces line element', () => {
        // exportLine(x1, y1, x2, y2, layer, arrowStart, arrowEnd, arrowStyle, arrowLength, arrowHalfWidth, dashStyle, sW)
        svg.exportLine(10, 10, 100, 100, 0, false, false, 0, 0, 0, 0, 1);
        svg.exportEnd();
        const result = svg.getSvgString();
        expect(result).toContain('<line');
        expect(result).toContain('x1="10"');
        expect(result).toContain('y1="10"');
        expect(result).toContain('x2="100"');
        expect(result).toContain('y2="100"');
    });

    it('exportRectangle produces rect element', () => {
        svg.exportRectangle(20, 30, 80, 60, false, 0, 0, 1);
        svg.exportEnd();
        const result = svg.getSvgString();
        expect(result).toContain('<rect');
        expect(result).toContain('x="20"');
        expect(result).toContain('y="30"');
        expect(result).toContain('width=');
        expect(result).toContain('height=');
    });

    it('exportOval produces ellipse element', () => {
        svg.exportOval(20, 20, 80, 80, false, 0, 0, 1);
        svg.exportEnd();
        const result = svg.getSvgString();
        expect(result).toContain('<ellipse');
        expect(result).toContain('cx="50"');
        expect(result).toContain('cy="50"');
        expect(result).toContain('rx="30"');
        expect(result).toContain('ry="30"');
    });

    it('exportConnection produces circle element', () => {
        svg.exportConnection(70, 60, 0, 6);
        svg.exportEnd();
        const result = svg.getSvgString();
        expect(result).toContain('<circle');
        expect(result).toContain('cx="70"');
        expect(result).toContain('cy="60"');
        expect(result).toContain('r="3"');
    });

    it('exportPolygon produces polygon element', () => {
        const pts = [new PointDouble(0, 0), new PointDouble(50, 0), new PointDouble(25, 50)];
        svg.exportPolygon(pts, 3, false, 0, 0, 1);
        svg.exportEnd();
        const result = svg.getSvgString();
        expect(result).toContain('<polygon');
        expect(result).toContain('points=');
    });

    it('exportBezier produces path element', () => {
        svg.exportBezier(10, 10, 30, 50, 50, 20, 70, 40, 0, false, false, 0, 0, 0, 0, 1);
        svg.exportEnd();
        const result = svg.getSvgString();
        expect(result).toContain('<path');
        expect(result).toContain('d="');
        expect(result).toContain('C');
    });

    it('exportPCBLine produces line with stroke-width', () => {
        svg.exportPCBLine(10, 10, 100, 100, 5, 0);
        svg.exportEnd();
        const result = svg.getSvgString();
        expect(result).toContain('<line');
        expect(result).toContain('stroke-width');
    });

    it('exportPCBPad with oval style produces ellipse', () => {
        svg.exportPCBPad(50, 50, 0, 10, 10, 3, 0, false);
        svg.exportEnd();
        const result = svg.getSvgString();
        expect(result).toContain('<ellipse');
    });

    it('exportPCBPad with rect style produces rect', () => {
        svg.exportPCBPad(50, 50, 1, 10, 10, 3, 0, false);
        svg.exportEnd();
        const result = svg.getSvgString();
        expect(result).toContain('<rect');
    });

    it('exportAdvText produces text element', () => {
        svg.exportAdvText(100, 100, 6, 6, 'Arial', false, false, false, 0, 0, 'Hello');
        svg.exportEnd();
        const result = svg.getSvgString();
        expect(result).toContain('<text');
        expect(result).toContain('Hello');
        expect(result).toContain('font-family="Arial"');
    });

    it('dash style produces stroke-dasharray attribute', () => {
        svg.setDashUnit(4);
        svg.exportLine(10, 10, 100, 100, 0, false, false, 0, 0, 0, 1, 1);
        svg.exportEnd();
        const result = svg.getSvgString();
        expect(result).toContain('stroke-dasharray');
    });

    it('layer alpha < 1 produces opacity attribute', () => {
        // Layer 12 has alpha 0.95
        svg.exportLine(10, 10, 100, 100, 12, false, false, 0, 0, 0, 0, 1);
        svg.exportEnd();
        const result = svg.getSvgString();
        expect(result).toContain('opacity');
    });

    // ---------- Phase 1 — S2: mirror + rotation matrix ----------
    //
    // Java reference (~/FidoCadJ/src/fidocadj/export/ExportSVG.java:218):
    //   double alpha = isMirrored ? orientation : -orientation;
    //   out.write(" rotate("+alpha+") ");
    //
    // The TS port always emits `rotate(${-orientation})` regardless of
    // mirror, so mirrored+rotated text comes out at the wrong angle.

    describe('exportAdvText mirror + rotation', () => {
        it('not-mirrored, rotated 90° emits rotate(-90)', () => {
            svg.exportAdvText(50, 50, 5, 3, 'Arial', false, false, false, 90, 0, 'R');
            svg.exportEnd();
            expect(svg.getSvgString()).toContain('rotate(-90)');
        });

        it('mirrored, rotated 90° emits rotate(90) — Java convention', () => {
            svg.exportAdvText(50, 50, 5, 3, 'Arial', false, true, false, 90, 0, 'R');
            svg.exportEnd();
            const out = svg.getSvgString();
            expect(out).toContain('rotate(90)');
            expect(out).not.toContain('rotate(-90)');
        });

        it('mirrored, not rotated emits no rotate (and negative xscale)', () => {
            svg.exportAdvText(50, 50, 5, 3, 'Arial', false, true, false, 0, 0, 'M');
            svg.exportEnd();
            const out = svg.getSvgString();
            expect(out).not.toContain('rotate(');
            expect(out).toContain('scale(-1');
        });

        it('not-mirrored, rotated 180° emits rotate(-180)', () => {
            svg.exportAdvText(50, 50, 5, 3, 'Arial', false, false, false, 180, 0, 'U');
            svg.exportEnd();
            expect(svg.getSvgString()).toContain('rotate(-180)');
        });
    });

    // ---------- Phase 1 — S6: PCB elements honour layer alpha ----------
    //
    // exportConnection, exportPCBLine, exportPCBPad build their style=
    // strings inline (not through checkColorAndWidth) and previously
    // dropped the layer-alpha → opacity= attribute. A PCB pad on a
    // translucent layer rendered fully opaque, breaking parity with
    // exportLine / exportRectangle / exportOval which DO emit opacity.

    describe('PCB elements honour layer alpha', () => {
        it('exportConnection on layer 12 (alpha 0.95) emits opacity', () => {
            svg.exportConnection(50, 50, 12, 6);
            svg.exportEnd();
            expect(svg.getSvgString()).toContain('opacity="0.95"');
        });

        it('exportConnection on layer 0 (alpha 1.0) does not emit opacity', () => {
            svg.exportConnection(50, 50, 0, 6);
            svg.exportEnd();
            expect(svg.getSvgString()).not.toContain('opacity');
        });

        it('exportPCBLine on layer 12 emits opacity', () => {
            svg.exportPCBLine(10, 10, 100, 100, 5, 12);
            svg.exportEnd();
            expect(svg.getSvgString()).toContain('opacity="0.95"');
        });

        it('exportPCBLine on layer 0 does not emit opacity', () => {
            svg.exportPCBLine(10, 10, 100, 100, 5, 0);
            svg.exportEnd();
            expect(svg.getSvgString()).not.toContain('opacity');
        });

        it('exportPCBPad oval style on layer 12 emits opacity', () => {
            svg.exportPCBPad(50, 50, 0, 10, 10, 3, 12, false);
            svg.exportEnd();
            expect(svg.getSvgString()).toContain('opacity="0.95"');
        });

        it('exportPCBPad rect style on layer 12 emits opacity', () => {
            svg.exportPCBPad(50, 50, 1, 10, 10, 3, 12, false);
            svg.exportEnd();
            expect(svg.getSvgString()).toContain('opacity="0.95"');
        });

        it('exportPCBPad rounded style on layer 12 emits opacity', () => {
            svg.exportPCBPad(50, 50, 2, 10, 10, 3, 12, false);
            svg.exportEnd();
            expect(svg.getSvgString()).toContain('opacity="0.95"');
        });

        it('exportPCBPad onlyHole does NOT emit opacity (hole is always white)', () => {
            // The hole pass overpaints with white; the user wants it solid
            // regardless of the underlying layer's alpha. Matches Java
            // (which emits a plain `style="stroke:white;..."` with no
            // opacity in the onlyHole branch).
            svg.exportPCBPad(50, 50, 0, 10, 10, 3, 12, true);
            svg.exportEnd();
            expect(svg.getSvgString()).not.toContain('opacity');
        });

        it('exportPCBPad oval style on layer 0 does not emit opacity', () => {
            svg.exportPCBPad(50, 50, 0, 10, 10, 3, 0, false);
            svg.exportEnd();
            expect(svg.getSvgString()).not.toContain('opacity');
        });
    });

    // ---------- Phase 1 — arrow style bits ----------
    //
    // The TS port previously used `style === 0` to decide fill vs no-fill,
    // dropping the "limiter alone" case into the wrong branch. The fix
    // matches Java: fill iff flagEmpty (0x02) is NOT set.

    describe('exportArrow honours flag bits', () => {
        it('style=0 (neither flag) emits filled polygon', () => {
            svg.exportLine(10, 50, 90, 50, 0, true, false, 0, 10, 4, 0, 1);
            svg.exportEnd();
            const out = svg.getSvgString();
            expect(out).toContain('<polygon');
            expect(out).toMatch(/<polygon[^>]+fill="#000000"/);
        });

        it('style=1 (limiter only) emits filled polygon AND limiter line', () => {
            svg.exportLine(10, 50, 90, 50, 0, true, false, 1, 10, 4, 0, 1);
            svg.exportEnd();
            const out = svg.getSvgString();
            expect(out).toMatch(/<polygon[^>]+fill="#000000"/);
            // Plus exactly one additional <line> for the limiter cross-bar.
            const lineMatches = out.match(/<line\b/g);
            expect(lineMatches).not.toBeNull();
            expect(lineMatches!.length).toBe(2); // main line + limiter
        });

        it('style=2 (empty only) emits no-fill polygon and no extra line', () => {
            svg.exportLine(10, 50, 90, 50, 0, true, false, 2, 10, 4, 0, 1);
            svg.exportEnd();
            const out = svg.getSvgString();
            expect(out).toMatch(/<polygon[^>]+fill="none"/);
            const lineMatches = out.match(/<line\b/g);
            expect(lineMatches!.length).toBe(1); // only the main line
        });

        it('style=3 (empty + limiter) emits no-fill polygon AND limiter line', () => {
            svg.exportLine(10, 50, 90, 50, 0, true, false, 3, 10, 4, 0, 1);
            svg.exportEnd();
            const out = svg.getSvgString();
            expect(out).toMatch(/<polygon[^>]+fill="none"/);
            const lineMatches = out.match(/<line\b/g);
            expect(lineMatches!.length).toBe(2);
        });
    });
});
