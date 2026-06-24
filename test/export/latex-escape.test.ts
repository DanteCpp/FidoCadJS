import { describe, it, expect } from 'vitest';
import { escapeLatex } from '../../src/export/LatexEscape.js';

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
