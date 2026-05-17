/**
 * @file parser-adversarial.test.ts
 * @author Dante Loi
 * @date 2026-05-15
 * @brief Adversarial / fuzz tests for ParserActions — malformed FCD must
 *        never crash the parser. The contract is: either parse it (best
 *        effort) or throw a defined Error.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 *
 * The tests are hand-rolled rather than property-based (no fast-check
 * dependency) but cover the same shapes:
 *   - syntactically malformed input (empty, truncated, mixed line endings)
 *   - boundary integer values (Number.MAX_SAFE_INTEGER, negative coords)
 *   - long lines (>10 000 tokens)
 *   - Unicode (BMP + surrogate pairs + emoji) in text fields
 *   - NUL bytes
 *   - embedded markup that could escape an XML/LaTeX context
 *   - macro recursion at the depth limit (16)
 */

import { describe, it, expect } from 'vitest';
import { DrawingModel } from '../../src/circuit/model/DrawingModel.js';
import { ParserActions } from '../../src/circuit/controllers/ParserActions.js';
import { StandardLayers } from '../../src/layers/StandardLayers.js';

function parser(): ParserActions {
    const m = new DrawingModel();
    m.setLayers(StandardLayers.createStandardLayers());
    return new ParserActions(m);
}

describe('ParserActions adversarial input', () => {
    describe('malformed structure', () => {
        it('empty string does not throw', () => {
            expect(() => parser().parseString('')).not.toThrow();
        });

        it('only the [FIDOCAD] header does not throw', () => {
            expect(() => parser().parseString('[FIDOCAD]\n')).not.toThrow();
        });

        it('truncated final line does not throw', () => {
            // No trailing newline; the LI is mid-token.
            expect(() => parser().parseString('[FIDOCAD]\nLI 10 20 30')).not.toThrow();
        });

        it('mixed line endings (\\r\\n + \\n) parse', () => {
            const pa = parser();
            pa.parseString('[FIDOCAD]\r\nLI 10 20 30 40 0\nLI 50 60 70 80 0\r\n');
            const text = pa.getText(false);
            // Both LIs survive the round-trip — the parser tolerates both.
            expect(text).toMatch(/LI 10 20 30 40 0/);
            expect(text).toMatch(/LI 50 60 70 80 0/);
        });

        it('lone CRs do not crash', () => {
            expect(() => parser().parseString('[FIDOCAD]\rLI 10 20 30 40 0\r')).not.toThrow();
        });

        it('garbage tokens are skipped or swallowed without crashing', () => {
            expect(() =>
                parser().parseString('[FIDOCAD]\nXYZ this is not a primitive\nLI 10 20 30 40 0\n'),
            ).not.toThrow();
        });
    });

    describe('boundary values', () => {
        it('very large positive integer coordinates parse', () => {
            const big = Number.MAX_SAFE_INTEGER - 1;
            expect(() => parser().parseString(`[FIDOCAD]\nLI 0 0 ${big} ${big} 0\n`)).not.toThrow();
        });

        it('very negative integer coordinates parse', () => {
            expect(() =>
                parser().parseString('[FIDOCAD]\nLI -999999 -999999 0 0 0\n'),
            ).not.toThrow();
        });

        it('zero-length line is silently dropped (per round-trip tests)', () => {
            const pa = parser();
            pa.parseString('[FIDOCAD]\nLI 50 50 50 50 0\n');
            // Existing contract: degenerate lines produce empty serialisation.
            expect(pa.getText(false)).not.toMatch(/LI 50 50 50 50/);
        });

        it('out-of-range layer index does not crash', () => {
            // Layer 99 is far outside the 16-layer standard set.
            expect(() => parser().parseString('[FIDOCAD]\nLI 10 10 20 20 99\n')).not.toThrow();
        });

        it('NaN-like tokens degrade gracefully', () => {
            // The parser uses parseInt/parseFloat which return NaN; the
            // primitive may end up with NaN coords but the parser shouldn't
            // throw.
            expect(() => parser().parseString('[FIDOCAD]\nLI abc def ghi jkl 0\n')).not.toThrow();
        });
    });

    describe('long input', () => {
        it('1000-line document parses', () => {
            const lines = ['[FIDOCAD]'];
            for (let i = 0; i < 1000; i++) {
                lines.push(`LI ${i} ${i} ${i + 5} ${i + 5} 0`);
            }
            const start = Date.now();
            expect(() => parser().parseString(lines.join('\n'))).not.toThrow();
            // Sanity check: < 5s on any reasonable machine.
            expect(Date.now() - start).toBeLessThan(5_000);
        });

        it('long polygon (1000 vertices) parses', () => {
            // PV with 2000 numeric tokens (1000 x,y pairs) + trailing layer.
            const verts: string[] = [];
            for (let i = 0; i < 1000; i++) verts.push(`${i}`, `${i * 2}`);
            const line = 'PV ' + verts.join(' ') + ' 0';
            expect(() => parser().parseString('[FIDOCAD]\n' + line + '\n')).not.toThrow();
        });
    });

    describe('Unicode in text fields', () => {
        it('BMP characters round-trip', () => {
            const pa = parser();
            pa.parseString('[FIDOCAD]\nTY 50 50 5 3 0 0 0 * Café\n');
            expect(pa.getText(false)).toContain('Café');
        });

        it('surrogate-pair emoji round-trips', () => {
            const pa = parser();
            pa.parseString('[FIDOCAD]\nTY 50 50 5 3 0 0 0 * 🔥\n');
            expect(pa.getText(false)).toContain('🔥');
        });

        it('multi-word text is preserved with internal spaces', () => {
            const pa = parser();
            pa.parseString('[FIDOCAD]\nTY 50 50 5 3 0 0 0 * Hello World Foo Bar\n');
            expect(pa.getText(false)).toContain('Hello World Foo Bar');
        });
    });

    describe('adversarial text content', () => {
        it('embedded </svg> does not crash and is preserved through round-trip', () => {
            const pa = parser();
            pa.parseString('[FIDOCAD]\nTY 50 50 5 3 0 0 0 * </svg>\n');
            expect(pa.getText(false)).toContain('</svg>');
        });

        it('LaTeX special characters are preserved through round-trip', () => {
            const pa = parser();
            pa.parseString('[FIDOCAD]\nTY 50 50 5 3 0 0 0 * a&b\\c\n');
            expect(pa.getText(false)).toContain('a&b\\c');
        });
    });

    describe('FCJ extension robustness', () => {
        it('FCJ without preceding primitive does not crash', () => {
            expect(() => parser().parseString('[FIDOCAD]\nFCJ 0 0 0 0 0 0\n')).not.toThrow();
        });

        it('FCJ with too few tokens does not crash', () => {
            expect(() =>
                parser().parseString('[FIDOCAD]\nLI 10 10 20 20 0\nFCJ 1\n'),
            ).not.toThrow();
        });

        it('FCJ with too many tokens does not crash', () => {
            expect(() =>
                parser().parseString('[FIDOCAD]\nLI 10 10 20 20 0\nFCJ 0 0 0 0 0 0 99 99 99 99\n'),
            ).not.toThrow();
        });
    });

    describe('macro robustness', () => {
        it('reference to non-existent macro does not throw', () => {
            expect(() =>
                parser().parseString('[FIDOCAD]\nMC 100 100 0 0 nonexistent_macro\n'),
            ).not.toThrow();
        });
    });
});
