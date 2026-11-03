import { describe, it, expect } from 'vitest';
import { escapeLatex, latexLine, latexTextBody } from '../../src/export/LatexEscape.js';

describe('latexLine', () => {
    it('keeps valid inline math and escapes the surrounding text', () => {
        expect(latexLine('R_1 = $\\frac{a}{b}$ & 5%')).toBe('R\\_1 = $\\frac{a}{b}$ \\& 5\\%');
    });

    it('sets $$...$$ display math inline with \\displaystyle', () => {
        expect(latexLine('$$\\sum_i x_i$$')).toBe('$\\displaystyle \\sum_i x_i$');
    });

    it('escapes math the editor cannot typeset, like the editor shows it', () => {
        expect(latexLine('$\\frac{1}{$')).toBe('\\$\\textbackslash{}frac\\{1\\}\\{\\$');
    });

    it('escapes an unclosed delimiter as a literal dollar', () => {
        expect(latexLine('costs $5')).toBe('costs \\$5');
    });
});

describe('latexTextBody', () => {
    it('leaves default-size text unscaled', () => {
        expect(latexTextBody('$x$', 3)).toBe('$x$');
    });

    it('scales relative to the default width, rounded to 3 decimals', () => {
        expect(latexTextBody('$x$', 6)).toBe('\\scalebox{2}{$x$}');
        expect(latexTextBody('$x$', 4)).toBe('\\scalebox{1.333}{$x$}');
        expect(latexTextBody('a', 2)).toBe('\\scalebox{0.667}{a}');
    });

    it('scales stacked lines as one block', () => {
        expect(latexTextBody('a\n$b$', 6)).toBe('\\scalebox{2}{\\shortstack[l]{a\\\\$b$}}');
    });

    it('ignores a degenerate size', () => {
        expect(latexTextBody('a', 0)).toBe('a');
    });
});

describe('escapeLatex', () => {
    it('escapes backslash', () => {
        expect(escapeLatex('a\\b')).toBe('a\\textbackslash{}b');
    });

    it('escapes curly braces', () => {
        expect(escapeLatex('a{b}c')).toBe('a\\{b\\}c');
    });

    it('escapes hash, dollar, percent, ampersand', () => {
        expect(escapeLatex('#')).toBe('\\#');
        expect(escapeLatex('$')).toBe('\\$');
        expect(escapeLatex('%')).toBe('\\%');
        expect(escapeLatex('&')).toBe('\\&');
    });

    it('escapes underscore', () => {
        expect(escapeLatex('R_1')).toBe('R\\_1');
    });

    it('escapes caret', () => {
        expect(escapeLatex('x^2')).toBe('x\\textasciicircum{}2');
    });

    it('escapes tilde', () => {
        expect(escapeLatex('a~b')).toBe('a\\textasciitilde{}b');
    });

    it('does not escape non-special characters', () => {
        const input = 'Hello World 12345 < > = + - * / ? ! @';
        expect(escapeLatex(input)).toBe(input);
    });

    it('handles empty string', () => {
        expect(escapeLatex('')).toBe('');
    });

    it('handles complex LaTeX-like input', () => {
        // Note: \\Omega in JS source = literal \Omega (one backslash)
        const input = 'Label $R_1$ = 10k\\Omega & 5%';
        const escaped = escapeLatex(input);
        // Expected: $ → \$, _ → \_, \ → \textbackslash{}, & → \&, % → \%
        expect(escaped).toBe('Label \\$R\\_1\\$ = 10k\\textbackslash{}Omega \\& 5\\%');
    });

    it('handles multiple special chars in sequence', () => {
        expect(escapeLatex('_{}')).toBe('\\_\\{\\}');
    });
});
