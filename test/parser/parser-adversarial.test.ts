import { describe, it, expect } from 'vitest';
import { DrawingModel } from '../../src/circuit/model/DrawingModel.js';
import { ParserActions } from '../../src/circuit/controllers/ParserActions.js';
import * as StandardLayers from '../../src/layers/StandardLayers.js';
import { Globals } from '../../src/globals/Globals.js';

function parser(): ParserActions {
    const m = new DrawingModel();
    m.setLayers(StandardLayers.createStandardLayers());
    return new ParserActions(m);
}

/** Parser plus its model, for tests that assert on the parsed result. */
function parserWithModel(): { pa: ParserActions; model: DrawingModel } {
    const m = new DrawingModel();
    m.setLayers(StandardLayers.createStandardLayers());
    return { pa: new ParserActions(m), model: m };
}

describe('ParserActions adversarial input', () => {
    describe('malformed structure', () => {
        it('empty string yields an empty model', () => {
            const { pa, model } = parserWithModel();
            pa.parseString('');
            expect(model.getPrimitiveVector()).toHaveLength(0);
        });

        it('only the [FIDOCAD] header yields an empty model', () => {
            const { pa, model } = parserWithModel();
            pa.parseString('[FIDOCAD]\n');
            expect(model.getPrimitiveVector()).toHaveLength(0);
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

        it('garbage tokens are skipped; valid primitives still parse', () => {
            const { pa, model } = parserWithModel();
            pa.parseString('[FIDOCAD]\nXYZ this is not a primitive\nLI 10 20 30 40 0\n');
            expect(model.getPrimitiveVector()).toHaveLength(1);
            expect(pa.getText(false)).toContain('LI 10 20 30 40 0');
        });
    });

    describe('boundary values', () => {
        it('very large positive integer coordinates parse', () => {
            const big = Number.MAX_SAFE_INTEGER - 1;
            const { pa, model } = parserWithModel();
            pa.parseString(`[FIDOCAD]\nLI 0 0 ${big} ${big} 0\n`);
            expect(model.getPrimitiveVector()).toHaveLength(1);
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
        it('1000-line document parses every line into a primitive', () => {
            const lines = ['[FIDOCAD]'];
            for (let i = 0; i < 1000; i++) {
                lines.push(`LI ${i} ${i} ${i + 5} ${i + 5} 0`);
            }
            const start = Date.now();
            const { pa, model } = parserWithModel();
            pa.parseString(lines.join('\n'));
            expect(model.getPrimitiveVector()).toHaveLength(1000);
            // Sanity check: < 5s on any reasonable machine.
            expect(Date.now() - start).toBeLessThan(5_000);
        });

        it('long polygon (1000 vertices) parses to a single primitive', () => {
            // PV with 2000 numeric tokens (1000 x,y pairs) + trailing layer.
            const verts: string[] = [];
            for (let i = 0; i < 1000; i++) verts.push(`${i}`, `${i * 2}`);
            const line = 'PV ' + verts.join(' ') + ' 0';
            const { pa, model } = parserWithModel();
            pa.parseString('[FIDOCAD]\n' + line + '\n');
            expect(model.getPrimitiveVector()).toHaveLength(1);
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
        it('reference to non-existent macro is dropped without throwing', () => {
            // PrimitiveMacro.parseTokens throws "Unrecognized macro" and the
            // parser swallows it per line — matching Java FidoCadJ, which
            // also logs and drops the MC. Note the consequence: loading a
            // drawing whose library is missing loses those macros on save.
            const { pa, model } = parserWithModel();
            pa.parseString('[FIDOCAD]\nMC 100 100 0 0 nonexistent_macro\n');
            expect(model.getPrimitiveVector()).toHaveLength(0);
            expect(pa.getText(false)).not.toContain('nonexistent_macro');
        });

        it('cyclic macro expansion stops at the configured depth limit', () => {
            const pa = parser();
            pa.readLibraryString(
                ['[FIDOLIB Recursive]', '{Test}', '[self Self]', 'MC 0 0 0 0 lib.self'].join('\n'),
                'lib',
            );

            expect(() => pa.parseString('[FIDOCAD]\nMC 100 100 0 0 lib.self\n')).not.toThrow();
            expect(
                pa
                    .getText(false)
                    .split('\n')
                    .filter((line) => line.startsWith('MC ')).length,
            ).toBeLessThanOrEqual(Globals.MAX_MACRO_DEPTH + 1);
        });
    });
});
