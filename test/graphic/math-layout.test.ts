/**
 * @file math-layout.test.ts
 * @author Dante Loi
 * @date 2026-06-03
 * @brief Tests for MathLayout — $/$$ splitting, MathJax geometry rendering,
 *        left-to-right segment positioning, and literal-text fallback.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { describe, it, expect } from 'vitest';
import { splitMathSegments, layoutMath } from '../../src/graphic/MathLayout.js';

// Deterministic stand-in for backend font metrics: 1 unit per character.
const measure = (s: string) => s.length;

describe('splitMathSegments', () => {
    it('returns empty array for empty string', () => {
        expect(splitMathSegments('')).toEqual([]);
    });

    it('plain text is a single text segment', () => {
        const r = splitMathSegments('Hello world');
        expect(r).toHaveLength(1);
        expect(r[0]).toMatchObject({ type: 'text', content: 'Hello world' });
    });

    it('splits inline math', () => {
        const r = splitMathSegments('The value is $x = 5$ meters');
        expect(r.map((s) => s.type)).toEqual(['text', 'math', 'text']);
        expect(r[1]).toMatchObject({ type: 'math', content: 'x = 5', display: false });
    });

    it('splits display math', () => {
        const r = splitMathSegments('$$E = mc^2$$');
        expect(r).toHaveLength(1);
        expect(r[0]).toMatchObject({ type: 'math', content: 'E = mc^2', display: true });
    });

    it('mixes inline and display', () => {
        const r = splitMathSegments('We have $a$ and $$b + c$$ and $d$');
        expect(r.map((s) => s.type)).toEqual(['text', 'math', 'text', 'math', 'text', 'math']);
    });

    it('treats an unclosed $ as literal text', () => {
        const r = splitMathSegments('Price: $50 only');
        expect(r.every((s) => s.type === 'text')).toBe(true);
        expect(r.map((s) => s.content).join('')).toBe('Price: $50 only');
    });

    it('handles consecutive inline blocks', () => {
        const r = splitMathSegments('$a$$b$');
        expect(r.map((s) => s.type)).toEqual(['math', 'math']);
    });
});

describe('layoutMath', () => {
    it('renders pure inline math to a single positioned math segment', () => {
        const r = layoutMath('$\\frac{1}{2}$', 10, measure);
        expect(r.hasMath).toBe(true);
        expect(r.segments).toHaveLength(1);
        const seg = r.segments[0]!;
        expect(seg.kind).toBe('math');
        expect(seg.x).toBe(0);
        expect(seg.geom!.glyphs.length).toBeGreaterThan(0);
        // Advance = widthEm * emPx, and the total matches.
        expect(seg.width).toBeCloseTo(seg.geom!.widthEm * 10, 6);
        expect(r.totalWidth).toBeCloseTo(seg.width, 6);
    });

    it('lays out mixed text and math left to right with monotonic x', () => {
        const r = layoutMath('a $x^2$ b', 10, measure);
        expect(r.segments.map((s) => s.kind)).toEqual(['text', 'math', 'text']);
        expect(r.hasMath).toBe(true);
        // x-offsets strictly increase across segments.
        for (let i = 1; i < r.segments.length; i++) {
            expect(r.segments[i]!.x).toBeGreaterThan(r.segments[i - 1]!.x);
        }
        // First text segment is 'a ' → width 2 with our 1-per-char measure.
        expect(r.segments[0]).toMatchObject({ kind: 'text', x: 0, width: 2, text: 'a ' });
    });

    it('falls back to literal text on malformed LaTeX', () => {
        const r = layoutMath('$\\frac{1}{$', 10, measure);
        expect(r.hasMath).toBe(false);
        expect(r.segments).toHaveLength(1);
        expect(r.segments[0]).toMatchObject({ kind: 'text', text: '$\\frac{1}{$' });
    });

    it('all-plain-text has no math', () => {
        const r = layoutMath('just a label', 10, measure);
        expect(r.hasMath).toBe(false);
        expect(r.segments).toHaveLength(1);
        expect(r.totalWidth).toBe('just a label'.length);
    });

    it('display math produces taller geometry than inline for the same source', () => {
        const inline = layoutMath('$\\sum_{i=0}^{n} i$', 10, measure).segments[0]!.geom!;
        const display = layoutMath('$$\\sum_{i=0}^{n} i$$', 10, measure).segments[0]!.geom!;
        // Display-mode sums set limits above/below, increasing total height.
        expect(display.heightEm + display.depthEm).toBeGreaterThan(
            inline.heightEm + inline.depthEm,
        );
    });
});
