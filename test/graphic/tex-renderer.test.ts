/**
 * @file tex-renderer.test.ts
 * @author Dante Loi
 * @date 2026-05-09
 * @brief Tests for TeXRenderer — mixed text/math parsing and KaTeX rendering
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { describe, it, expect } from 'vitest';
import { renderMixedText } from '../../src/graphic/TeXRenderer.js';

describe('TeXRenderer', () => {
    describe('renderMixedText', () => {
        it('returns empty array for empty string', () => {
            expect(renderMixedText('')).toEqual([]);
        });

        it('plain text without math delimiters returns single text segment', () => {
            const r = renderMixedText('Hello world');
            expect(r).toHaveLength(1);
            expect(r[0]!.type).toBe('text');
            expect(r[0]!.content).toBe('Hello world');
        });

        it('inline math $...$ is rendered as math-inline', () => {
            const r = renderMixedText('The value is $x = 5$ meters');
            expect(r).toHaveLength(3);
            expect(r[0]!.type).toBe('text');
            expect(r[0]!.content).toBe('The value is ');
            expect(r[1]!.type).toBe('math-inline');
            expect(r[1]!.source).toBe('x = 5');
            // KaTeX output should be HTML containing the rendered math
            expect(r[1]!.content).toContain('katex');
            expect(r[2]!.type).toBe('text');
            expect(r[2]!.content).toBe(' meters');
        });

        it('display math $$...$$ is rendered as math-display', () => {
            const r = renderMixedText('$$E = mc^2$$');
            expect(r).toHaveLength(1);
            expect(r[0]!.type).toBe('math-display');
            expect(r[0]!.source).toBe('E = mc^2');
            expect(r[0]!.content).toContain('katex');
        });

        it('mixed inline and display math', () => {
            const r = renderMixedText('We have $a$ and $$b + c$$ and $d$');
            const types = r.map(s => s.type);
            expect(types).toEqual([
                'text',        // 'We have '
                'math-inline', // a
                'text',        // ' and '
                'math-display',// b + c
                'text',        // ' and '
                'math-inline', // d
            ]);
        });

        it('unclosed inline $ is treated as literal text', () => {
            const r = renderMixedText('Price: $50 only');
            // $50 only — no closing $, so $ is isolated as text segment
            // Result: text("Price: "), text("$"), text("50 only")
            expect(r).toHaveLength(3);
            expect(r.every(s => s.type === 'text')).toBe(true);
            const joined = r.map(s => s.content).join('');
            expect(joined).toBe('Price: $50 only');
        });

        it('unclosed display $$ is treated as literal text', () => {
            const r = renderMixedText('Start $$ no end here');
            expect(r).toHaveLength(3);
            expect(r[0]!.type).toBe('text');
            expect(r[0]!.content).toBe('Start ');
            expect(r[1]!.type).toBe('text');
            expect(r[1]!.content).toBe('$$');
            expect(r[2]!.type).toBe('text');
            expect(r[2]!.content).toBe(' no end here');
        });

        it('handles complex LaTeX: fractions and Greek letters', () => {
            const r = renderMixedText('$\\frac{a}{b} = \\Omega$');
            expect(r).toHaveLength(1);
            expect(r[0]!.type).toBe('math-inline');
            expect(r[0]!.content).toContain('katex');
            // Should render something (not fallback to raw)
            expect(r[0]!.content.length).toBeGreaterThan(50);
        });

        it('handles multiple math segments in one string', () => {
            const r = renderMixedText('$R_1$ = $10\\,\\Omega$');
            expect(r).toHaveLength(3); // math, text, math
            expect(r[0]!.type).toBe('math-inline');
            expect(r[1]!.type).toBe('text');
            expect(r[1]!.content).toBe(' = ');
            expect(r[2]!.type).toBe('math-inline');
        });

        it('falls back to raw source on KaTeX error', () => {
            // Malformed LaTeX that KaTeX cannot render
            const r = renderMixedText('$\\invalid{command$');
            expect(r).toHaveLength(1);
            // Could be math-inline (with error HTML) or text (fallback)
            // KaTeX with throwOnError:false returns error HTML, not throws
            if (r[0]!.type === 'math-inline') {
                expect(r[0]!.content).toContain('katex-error');
            } else {
                expect(r[0]!.type).toBe('text');
                expect(r[0]!.content).toContain('\\invalid{command');
            }
        });

        it('text with only dollar signs (no math)', () => {
            // NOTE: consecutive bare $ signs will be treated as math delimiters.
            // "$5.00 or $10.00" → the two $ signs pair up, treating "5.00 or " as math.
            // This is an inherent ambiguity when using $ for both currency and math.
            const r = renderMixedText('Costs $5.00 or $10.00');
            // The two $ pair up, producing math that KaTeX renders as error
            const joined = r.map(s => s.content).join('');
            expect(joined).toContain('Costs ');
            expect(joined).toContain('10.00');
            // The middle part between $...$ is interpreted as (failing) math
        });

        // Edge case: consecutive math blocks
        it('consecutive inline math blocks', () => {
            const r = renderMixedText('$a$$b$');
            expect(r).toHaveLength(2); // math-inline, math-inline
            expect(r[0]!.type).toBe('math-inline');
            expect(r[1]!.type).toBe('math-inline');
        });

        it('dollar sign followed by space is not math', () => {
            // $ followed by space — still treated as math delimiter start,
            // but closing $ not found, so bare $ becomes a text segment
            const r = renderMixedText('That costs $ 100');
            expect(r).toHaveLength(3);
            expect(r[0]!.type).toBe('text');
            expect(r[0]!.content).toBe('That costs ');
            expect(r[1]!.type).toBe('text');
            expect(r[1]!.content).toBe('$');
            expect(r[2]!.type).toBe('text');
            expect(r[2]!.content).toBe(' 100');
        });
    });
});
