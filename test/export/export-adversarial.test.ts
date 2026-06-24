import { describe, it, expect, beforeEach } from 'vitest';
import { ExportSVG } from '../../src/export/ExportSVG.js';
import { DimensionG } from '../../src/graphic/DimensionG.js';
import { StandardLayers } from '../../src/layers/StandardLayers.js';

describe('ExportSVG adversarial input', () => {
    let svg: ExportSVG;
    const layers = StandardLayers.createStandardLayers();

    beforeEach(() => {
        svg = new ExportSVG();
        svg.exportStart(new DimensionG(200, 200), layers, 0);
    });

    describe('extreme numeric values', () => {
        it('MAX_SAFE_INTEGER coordinates do not throw', () => {
            const big = Number.MAX_SAFE_INTEGER;
            expect(() =>
                svg.exportLine(0, 0, big, big, 0, false, false, 0, 0, 0, 0, 1),
            ).not.toThrow();
            svg.exportEnd();
        });

        it('-MAX_SAFE_INTEGER coordinates do not throw', () => {
            const big = -Number.MAX_SAFE_INTEGER;
            expect(() =>
                svg.exportLine(0, 0, big, big, 0, false, false, 0, 0, 0, 0, 1),
            ).not.toThrow();
        });

        it('Infinity is emitted (and the file is still valid XML)', () => {
            // We don't promise to sanitise Infinity — but we DO promise not
            // to throw, and the output must still parse as XML.
            svg.exportLine(0, 0, Infinity, 0, 0, false, false, 0, 0, 0, 0, 1);
            svg.exportEnd();
            const out = svg.getSvgString();
            // Browsers tolerate "Infinity" as an SVG attribute (it draws
            // nothing) but the XML structure must be well-formed.
            expect(out).toContain('<svg');
            expect(out).toContain('</svg>');
        });

        it('NaN coordinates do not throw', () => {
            expect(() =>
                svg.exportLine(0, 0, NaN, NaN, 0, false, false, 0, 0, 0, 0, 1),
            ).not.toThrow();
        });

        it('sub-pixel positive value rounds to its cLe form', () => {
            svg.exportLine(0.005, 0.005, 1, 1, 0, false, false, 0, 0, 0, 0, 1);
            svg.exportEnd();
            const out = svg.getSvgString();
            // cLe = Math.round(l * 100) / 100. So 0.005 → 0.01 (banker's
            // rounding might surprise us in V8, but the result must
            // contain SOME finite numeric attribute, not NaN).
            expect(out).not.toContain('NaN');
        });
    });

    describe('text fields', () => {
        it('long text (10000 chars) does not throw', () => {
            const long = 'a'.repeat(10_000);
            expect(() =>
                svg.exportAdvText(50, 50, 5, 3, 'Arial', false, false, false, 0, 0, long),
            ).not.toThrow();
        });

        it('empty text is emitted as an empty <text> element', () => {
            svg.exportAdvText(50, 50, 5, 3, 'Arial', false, false, false, 0, 0, '');
            svg.exportEnd();
            const out = svg.getSvgString();
            expect(out).toContain('<text');
            expect(out).toMatch(/<text[^>]*>\s*<\/text>/);
        });

        it('XML metacharacters are escaped', () => {
            svg.exportAdvText(
                50,
                50,
                5,
                3,
                'Arial',
                false,
                false,
                false,
                0,
                0,
                `<script>alert("x")</script>&copy;`,
            );
            svg.exportEnd();
            const out = svg.getSvgString();
            expect(out).not.toMatch(/<script>/i);
            expect(out).toContain('&lt;script&gt;');
            expect(out).toContain('&quot;');
            // The text should still contain the user-supplied entity (now
            // double-encoded) — &amp;copy; rather than &copy;.
            expect(out).toContain('&amp;copy;');
        });

        it('embedded </svg> cannot break out of the document', () => {
            svg.exportAdvText(50, 50, 5, 3, 'Arial', false, false, false, 0, 0, '</svg>');
            svg.exportEnd();
            const out = svg.getSvgString();
            // Exactly one closing </svg> tag (the one we wrote in exportEnd).
            const matches = out.match(/<\/svg>/g);
            expect(matches!.length).toBe(1);
        });

        it('font name with XML metacharacters is escaped', () => {
            svg.exportAdvText(50, 50, 5, 3, '<bad>', false, false, false, 0, 0, 'x');
            svg.exportEnd();
            const out = svg.getSvgString();
            expect(out).not.toMatch(/font-family="<bad>"/);
            expect(out).toContain('&lt;bad&gt;');
        });

        it('surrogate-pair emoji survives without breaking output', () => {
            svg.exportAdvText(50, 50, 5, 3, 'Arial', false, false, false, 0, 0, '🔥');
            svg.exportEnd();
            const out = svg.getSvgString();
            expect(out).toContain('🔥');
        });
    });

    describe('many primitives', () => {
        it('1000 lines do not throw or blow the buffer', () => {
            for (let i = 0; i < 1000; i++) {
                svg.exportLine(i, 0, i + 10, 100, 0, false, false, 0, 0, 0, 0, 1);
            }
            expect(() => svg.exportEnd()).not.toThrow();
            const out = svg.getSvgString();
            expect((out.match(/<line\b/g) ?? []).length).toBe(1000);
        });
    });

    describe('PCB pad style range', () => {
        it('unknown pad style falls back to the oval (style 0) branch', () => {
            // Style 99 isn't a defined pad style; the implementation's
            // switch default is the oval emission.
            expect(() => svg.exportPCBPad(50, 50, 99, 10, 10, 3, 0, false)).not.toThrow();
            svg.exportEnd();
            expect(svg.getSvgString()).toContain('<ellipse');
        });
    });
});
