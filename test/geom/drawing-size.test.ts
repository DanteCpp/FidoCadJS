/**
 * @file drawing-size.test.ts
 * @author Dante Loi
 * @date 2026-05-15
 * @brief Unit tests for DrawingSize — bounding-box computation used by
 *        the export pipeline.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 *
 * DrawingSize had zero direct coverage. Its `getImageSize` is what the
 * ExportFacade's coordinate-offset fix (Phase 1) relies on.
 */

import { describe, it, expect } from 'vitest';
import { DrawingSize } from '../../src/geom/DrawingSize.js';
import { DrawingModel } from '../../src/circuit/model/DrawingModel.js';
import { ParserActions } from '../../src/circuit/controllers/ParserActions.js';
import { StandardLayers } from '../../src/layers/StandardLayers.js';
import { PointG } from '../../src/graphic/PointG.js';

function makeModel(fcd: string): DrawingModel {
    const m = new DrawingModel();
    m.setLayers(StandardLayers.createStandardLayers());
    new ParserActions(m).parseString(fcd);
    return m;
}

describe('DrawingSize.getImageSize', () => {
    it('empty model returns a unit dimension and zero origin', () => {
        const m = new DrawingModel();
        m.setLayers(StandardLayers.createStandardLayers());
        const o = new PointG(0, 0);
        const d = DrawingSize.getImageSize(m, 1, true, o);
        expect(d.width).toBeGreaterThanOrEqual(1);
        expect(d.height).toBeGreaterThanOrEqual(1);
        expect(o.x).toBe(0);
        expect(o.y).toBe(0);
    });

    it('single horizontal line: width is the line length, origin at top-left', () => {
        const m = makeModel('[FIDOCAD]\nLI 10 20 50 20 0\n');
        const o = new PointG(0, 0);
        const d = DrawingSize.getImageSize(m, 1, true, o);
        // 40-unit-wide line; tracking has tolerance, so allow a few units slack.
        expect(d.width).toBeGreaterThanOrEqual(40);
        expect(d.width).toBeLessThanOrEqual(60);
        expect(o.x).toBeGreaterThanOrEqual(0);
        expect(o.x).toBeLessThanOrEqual(15);
        expect(o.y).toBeGreaterThanOrEqual(15);
        expect(o.y).toBeLessThanOrEqual(25);
    });

    it('negative coordinates are tracked correctly', () => {
        const m = makeModel('[FIDOCAD]\nLI -50 -50 50 50 0\n');
        const o = new PointG(0, 0);
        const d = DrawingSize.getImageSize(m, 1, true, o);
        expect(d.width).toBeGreaterThanOrEqual(100);
        expect(o.x).toBeLessThanOrEqual(-45); // origin near (-50,-50)
        expect(o.y).toBeLessThanOrEqual(-45);
    });

    it('mutates the model.changed flag', () => {
        const m = makeModel('[FIDOCAD]\nLI 10 10 20 20 0\n');
        m.setChanged(false);
        DrawingSize.getImageSize(m, 1, true, new PointG(0, 0));
        expect(m.getChanged()).toBe(true);
    });

    it('countMin=false uses absolute max instead of width=max-min', () => {
        const m = makeModel('[FIDOCAD]\nLI 100 100 150 150 0\n');
        const oMin = new PointG(0, 0);
        const dMin = DrawingSize.getImageSize(m, 1, true, oMin);
        const oMax = new PointG(0, 0);
        const dMax = DrawingSize.getImageSize(m, 1, false, oMax);
        // countMin=false uses XMax/YMax directly; should be larger than the
        // countMin=true width.
        expect(dMax.width).toBeGreaterThan(dMin.width);
    });

    it('clamps min dimensions to 1 (never returns zero)', () => {
        const m = new DrawingModel();
        m.setLayers(StandardLayers.createStandardLayers());
        const o = new PointG(0, 0);
        const d = DrawingSize.getImageSize(m, 1, true, o);
        expect(d.width).toBeGreaterThanOrEqual(1);
        expect(d.height).toBeGreaterThanOrEqual(1);
    });
});

describe('DrawingSize.getImageOrigin', () => {
    it('empty model returns (0, 0)', () => {
        const m = new DrawingModel();
        m.setLayers(StandardLayers.createStandardLayers());
        const o = DrawingSize.getImageOrigin(m, 1);
        expect(o.x).toBe(0);
        expect(o.y).toBe(0);
    });

    it('returns the bounding-box top-left for a non-empty model', () => {
        const m = makeModel('[FIDOCAD]\nLI 30 40 100 100 0\n');
        const o = DrawingSize.getImageOrigin(m, 1);
        expect(o.x).toBeGreaterThanOrEqual(25);
        expect(o.x).toBeLessThanOrEqual(35);
        expect(o.y).toBeGreaterThanOrEqual(35);
        expect(o.y).toBeLessThanOrEqual(45);
    });
});

describe('DrawingSize.calculateZoomToFit', () => {
    it('returns a MapCoordinates instance fitting the drawing into the target box', () => {
        const m = makeModel('[FIDOCAD]\nLI 0 0 100 100 0\n');
        const mc = DrawingSize.calculateZoomToFit(m, 500, 500, true);
        // The drawing is 100×100; fitting into 500×500 should give zoom <= 5x.
        const z = mc.getXMagnitude();
        expect(z).toBeGreaterThan(0);
        expect(z).toBeLessThanOrEqual(5);
    });
});
