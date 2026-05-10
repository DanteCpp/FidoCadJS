/**
 * @file primitive-edge-cases.test.ts
 * @author Dante Loi
 * @date 2026-05-09
 * @brief Edge-case and unit tests for individual primitives (toString, parseTokens)
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { describe, it, expect } from 'vitest';
import { PrimitiveLine } from '../../src/primitives/PrimitiveLine.js';
import { PrimitiveBezier } from '../../src/primitives/PrimitiveBezier.js';
import { PrimitiveRectangle } from '../../src/primitives/PrimitiveRectangle.js';
import { PrimitiveOval } from '../../src/primitives/PrimitiveOval.js';
import { PrimitivePolygon } from '../../src/primitives/PrimitivePolygon.js';
import { PrimitiveComplexCurve } from '../../src/primitives/PrimitiveComplexCurve.js';
import { PrimitiveConnection } from '../../src/primitives/PrimitiveConnection.js';
import { PrimitivePCBLine } from '../../src/primitives/PrimitivePCBLine.js';
import { PrimitivePCBPad } from '../../src/primitives/PrimitivePCBPad.js';
import { PrimitiveAdvText } from '../../src/primitives/PrimitiveAdvText.js';

const FONT = 'Arial';
const FSIZE = 16;

describe('PrimitiveLine', () => {
    it('toString produces LI token format', () => {
        const line = new PrimitiveLine(10, 20, 30, 40, 0, false, false, 0, 3, 2, 0, FONT, FSIZE);
        const s = line.toString(false);
        expect(s).toContain('LI');
        expect(s).toContain('10');
        expect(s).toContain('20');
        expect(s).toContain('30');
        expect(s).toContain('40');
    });

    it('parseTokens round-trips basic line', () => {
        const line = new PrimitiveLine(FONT, FSIZE);
        line.parseTokens(['LI', '10', '20', '30', '40', '0'], 6);
        const s = line.toString(false);
        expect(s).toBe('LI 10 20 30 40 0\n');
    });

    it('handles zero-length line gracefully', () => {
        const line = new PrimitiveLine(10, 20, 10, 20, 0, false, false, 0, 3, 2, 0, FONT, FSIZE);
        // A zero-length line: toString should produce empty output
        const s = line.toString(false);
        expect(s).toBe('');
    });

    it('handles negative coordinates', () => {
        const line = new PrimitiveLine(-10, -20, 30, 40, 0, false, false, 0, 3, 2, 0, FONT, FSIZE);
        const s = line.toString(false);
        expect(s).toContain('-10');
        expect(s).toContain('-20');
    });
});

describe('PrimitiveBezier', () => {
    it('toString produces BE token format', () => {
        const bz = new PrimitiveBezier(50, 5, 20, 60, 70, 35, 50, 70, 0, false, false, 0, 3, 2, 0, FONT, FSIZE);
        const s = bz.toString(false);
        expect(s).toContain('BE');
        expect(s).toContain('50');
        expect(s).toContain('70');
    });

    it('parseTokens round-trips', () => {
        const bz = new PrimitiveBezier(FONT, FSIZE);
        bz.parseTokens(['BE', '50', '5', '20', '60', '70', '35', '50', '70', '0'], 10);
        const s = bz.toString(false);
        expect(s).toBe('BE 50 5 20 60 70 35 50 70 0\n');
    });
});

describe('PrimitiveRectangle', () => {
    it('empty rectangle uses RV token', () => {
        const r = new PrimitiveRectangle(10, 20, 50, 60, false, 0, 0, FONT, FSIZE);
        const s = r.toString(false);
        expect(s).toContain('RV');
    });

    it('filled rectangle uses RP token', () => {
        const r = new PrimitiveRectangle(10, 20, 50, 60, true, 0, 0, FONT, FSIZE);
        const s = r.toString(false);
        expect(s).toContain('RP');
    });

    it('parseTokens handles RV token', () => {
        const r = new PrimitiveRectangle(FONT, FSIZE);
        r.parseTokens(['RV', '25', '20', '95', '75', '0'], 6);
        expect(r.getFilled()).toBe(false);
    });

    it('parseTokens handles RP token', () => {
        const r = new PrimitiveRectangle(FONT, FSIZE);
        r.parseTokens(['RP', '10', '10', '50', '40', '0'], 6);
        expect(r.getFilled()).toBe(true);
    });
});

describe('PrimitiveOval', () => {
    it('empty oval uses EV token', () => {
        const o = new PrimitiveOval(10, 20, 50, 60, false, 0, 0, FONT, FSIZE);
        expect(o.toString(false)).toContain('EV');
    });

    it('filled oval uses EP token', () => {
        const o = new PrimitiveOval(10, 20, 50, 60, true, 0, 0, FONT, FSIZE);
        expect(o.toString(false)).toContain('EP');
    });
});

describe('PrimitivePolygon', () => {
    it('open polygon uses PV token', () => {
        const p = new PrimitivePolygon(false, 0, 0, FONT, FSIZE);
        p.addPoint(10, 20);
        p.addPoint(30, 40);
        p.addPoint(50, 60);
        expect(p.toString(false)).toContain('PV');
    });

    it('filled polygon uses PP token', () => {
        const p = new PrimitivePolygon(true, 0, 0, FONT, FSIZE);
        p.addPoint(10, 20);
        p.addPoint(30, 40);
        expect(p.toString(false)).toContain('PP');
    });

    it('addPointClosest inserts at correct segment', () => {
        const p = new PrimitivePolygon(false, 0, 0, FONT, FSIZE);
        p.addPoint(0, 0);
        p.addPoint(100, 0);
        p.addPointClosest(50, 0);
        // Should have interpolated a new point between the two existing ones
        const text = p.toString(false);
        expect(text).toContain('PV');
        // Should have 3 coordinate pairs
        const parts = text.trim().split(/\s+/);
        expect(parts.length).toBe(8); // PV + 3*2 coords + layer
    });
});

describe('PrimitiveComplexCurve', () => {
    it('open curve uses CV token', () => {
        const c = new PrimitiveComplexCurve(false, false, 0, false, false, 0, 3, 2, 0, FONT, FSIZE);
        c.addPoint(10, 20);
        c.addPoint(30, 40);
        expect(c.toString(false)).toContain('CV');
    });

    it('closed filled curve uses CP token', () => {
        const c = new PrimitiveComplexCurve(true, true, 0, false, false, 0, 3, 2, 0, FONT, FSIZE);
        c.addPoint(10, 20);
        c.addPoint(30, 40);
        c.addPoint(50, 60);
        expect(c.toString(false)).toContain('CP');
    });
});

describe('PrimitiveConnection', () => {
    it('toString produces SA token format', () => {
        const conn = new PrimitiveConnection(70, 60, 0, FONT, FSIZE);
        const s = conn.toString(false);
        expect(s).toContain('SA');
        expect(s).toContain('70');
        expect(s).toContain('60');
    });

    it('parseTokens round-trips', () => {
        const conn = new PrimitiveConnection(FONT, FSIZE);
        conn.parseTokens(['SA', '70', '60', '0'], 4);
        expect(conn.toString(false)).toBe('SA 70 60 0\n');
    });
});

describe('PrimitivePCBLine', () => {
    it('toString produces PL token with width', () => {
        const pl = new PrimitivePCBLine(10, 110, 90, 110, 5, 0, FONT, FSIZE);
        const s = pl.toString(false);
        expect(s).toContain('PL');
        expect(s).toContain('5'); // width
    });

    it('round-trips width correctly', () => {
        const pl = new PrimitivePCBLine(FONT, FSIZE);
        pl.parseTokens(['PL', '10', '110', '90', '110', '5', '0'], 7);
        expect(pl.getWidth()).toBe(5);
        expect(pl.toString(false)).toBe('PL 10 110 90 110 5 0\n');
    });
});

describe('PrimitivePCBPad', () => {
    it('oval style (0) round-trips', () => {
        const pad = new PrimitivePCBPad(FONT, FSIZE);
        pad.parseTokens(['PA', '50', '75', '5', '5', '0', '0', '0'], 8);
        expect(pad.getSty()).toBe(0);
        expect(pad.toString(false)).toBe('PA 50 75 5 5 0 0 0\n');
    });

    it('rect style (1) round-trips', () => {
        const pad = new PrimitivePCBPad(FONT, FSIZE);
        pad.parseTokens(['PA', '50', '75', '5', '5', '0', '1', '0'], 8);
        expect(pad.getSty()).toBe(1);
        expect(pad.toString(false)).toBe('PA 50 75 5 5 0 1 0\n');
    });

    it('rounded rect style (2) round-trips', () => {
        const pad = new PrimitivePCBPad(FONT, FSIZE);
        pad.parseTokens(['PA', '50', '75', '5', '5', '0', '2', '0'], 8);
        expect(pad.getSty()).toBe(2);
        expect(pad.toString(false)).toBe('PA 50 75 5 5 0 2 0\n');
    });
});

describe('PrimitiveAdvText', () => {
    it('toString produces TY token', () => {
        const t = new PrimitiveAdvText();
        t.parseTokens(['TY', '85', '25', '5', '3', '0', '0', '0', '*', 'A'], 10);
        const s = t.toString(false);
        expect(s).toContain('TY');
        expect(s).toContain('A');
    });

    it('handles multi-word text', () => {
        const t = new PrimitiveAdvText();
        t.parseTokens(['TY', '85', '25', '5', '3', '0', '0', '0', '*', 'Hello World'], 10);
        const s = t.toString(false);
        expect(s).toContain('Hello World');
    });

    it('handles empty text gracefully', () => {
        const t = new PrimitiveAdvText();
        t.parseTokens(['TY', '85', '25', '5', '3', '0', '0', '0', '*', ''], 10);
        const s = t.toString(false);
        expect(s).toBeDefined();
        expect(typeof s).toBe('string');
    });
});
