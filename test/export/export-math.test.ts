import { describe, it, expect } from 'vitest';
import { DrawingModel } from '../../src/circuit/model/DrawingModel.js';
import { ParserActions } from '../../src/circuit/controllers/ParserActions.js';
import { ExportFacade } from '../../src/export/ExportFacade.js';
import * as StandardLayers from '../../src/layers/StandardLayers.js';

function facadeFor(fcd: string): ExportFacade {
    const model = new DrawingModel();
    model.setLayers(StandardLayers.createStandardLayers());
    new ParserActions(model).parseString(fcd);
    return new ExportFacade(model);
}

// A text primitive carrying inline math: TY x y siy six o sty layer font text...
const MATH_FCD = '[FIDOCAD]\nTY 10 10 4 2 0 0 0 * $\\frac{1}{2}$';
const PLAIN_FCD = '[FIDOCAD]\nTY 10 10 4 2 0 0 0 * hello';

describe('Math export — SVG', () => {
    it('emits glyph paths for math, not literal $ source', () => {
        const svg = facadeFor(MATH_FCD).exportSVG();
        expect(svg).toContain('<path');
        expect(svg).toContain('matrix('); // per-glyph placement transform
        expect(svg).not.toContain('\\frac'); // raw LaTeX must not leak through
    });

    it('leaves plain text as a <text> element (no stray paths from text)', () => {
        const svg = facadeFor(PLAIN_FCD).exportSVG();
        expect(svg).toContain('>hello</text>');
    });

    it('falls back to literal text for malformed math', () => {
        const svg = facadeFor('[FIDOCAD]\nTY 10 10 4 2 0 0 0 * $\\frac{1}{$').exportSVG();
        // Unrenderable LaTeX is emitted verbatim inside a <text> element.
        expect(svg).toContain('</text>');
        expect(svg).toContain('frac');
    });
});

describe('Math export — PDF', () => {
    it('produces a valid PDF that draws math as path fills', () => {
        const pdf = facadeFor(MATH_FCD).exportPDF();
        expect(pdf.startsWith('%PDF')).toBe(true);
        // Math glyphs become filled paths (PDF fill operator), not text runs.
        expect(pdf).not.toContain('\\frac');
    });
});
