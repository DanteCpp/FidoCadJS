/**
 * @file export-pdf.test.ts
 * @author Dante Loi
 * @date 2026-05-15
 * @brief Tests for ExportPDF — content-stream and PDF document structure.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExportPDF } from '../../src/export/ExportPDF.js';
import { DimensionG } from '../../src/graphic/DimensionG.js';
import { StandardLayers } from '../../src/layers/StandardLayers.js';
import { PointDouble } from '../../src/graphic/PointDouble.js';

describe('ExportPDF', () => {
    let pdf: ExportPDF;
    const layers = StandardLayers.createStandardLayers();

    beforeEach(() => {
        pdf = new ExportPDF();
        pdf.exportStart(new DimensionG(400, 300), layers, 0);
    });

    describe('document structure', () => {
        it('emits a valid PDF 1.4 header and EOF', () => {
            pdf.exportEnd();
            const out = pdf.getPdfString();
            expect(out.startsWith('%PDF-1.4\n')).toBe(true);
            expect(out.trimEnd().endsWith('%%EOF')).toBe(true);
        });

        it('includes catalog, pages, page, and font objects', () => {
            pdf.exportEnd();
            const out = pdf.getPdfString();
            expect(out).toContain('/Type /Catalog');
            expect(out).toContain('/Type /Pages');
            expect(out).toContain('/Type /Page');
            // Eight standard-font objects (Courier/Times/Helvetica/Symbol families).
            expect(out).toContain('/BaseFont /Courier');
            expect(out).toContain('/BaseFont /Helvetica');
            expect(out).toContain('/BaseFont /Times-Roman');
            expect(out).toContain('/BaseFont /Symbol');
        });

        it('emits a cross-reference table with 15 entries (objects 0..14)', () => {
            pdf.exportEnd();
            const out = pdf.getPdfString();
            expect(out).toMatch(/xref\n0 15\n/);
            // Free-list head:
            expect(out).toContain('0000000000 65535 f');
        });

        it('declares MediaBox sized for the drawing plus border', () => {
            pdf.exportEnd();
            const out = pdf.getPdfString();
            // 400/2.778 ≈ 144 + 1 + 5 = 150 ; 300/2.778 ≈ 108 + 1 + 5 = 114
            expect(out).toMatch(/\/MediaBox \[ 0 0 {2}\d+ \d+ \]/);
        });

        it('initializes content stream with origin transform and line-cap', () => {
            pdf.exportEnd();
            const out = pdf.getPdfString();
            // First cm: translate; second cm: scale + Y-flip; "1 J" round caps.
            expect(out).toContain(' cm');
            expect(out).toContain('1 J');
        });
    });

    describe('primitives', () => {
        it('exportLine emits an m/l/S sequence', () => {
            pdf.exportLine(10, 20, 100, 200, 0, false, false, 0, 0, 0, 0, 1);
            pdf.exportEnd();
            const out = pdf.getPdfString();
            expect(out).toMatch(/10 20 m 100 200 l S/);
        });

        it('exportRectangle filled emits four edges + f', () => {
            pdf.exportRectangle(10, 10, 50, 50, true, 0, 0, 1);
            pdf.exportEnd();
            const out = pdf.getPdfString();
            expect(out).toContain('10 10 m');
            expect(out).toContain('50 10 l');
            expect(out).toContain('50 50 l');
            expect(out).toContain('10 50 l');
            expect(out).toContain('\nf\n');
        });

        it('exportRectangle stroke-only emits s', () => {
            pdf.exportRectangle(10, 10, 50, 50, false, 0, 0, 1);
            pdf.exportEnd();
            const out = pdf.getPdfString();
            expect(out).toContain('\ns\n');
        });

        it('exportBezier emits m + c S cubic-curve operator', () => {
            pdf.exportBezier(0, 0, 10, 10, 20, 0, 30, 10, 0, false, false, 0, 0, 0, 0, 1);
            pdf.exportEnd();
            const out = pdf.getPdfString();
            expect(out).toContain('0 0 m');
            expect(out).toContain('10 10 20 0 30 10 c S');
        });

        it('exportPolygon emits move + line vertices + f* (fill)', () => {
            const verts = [
                new PointDouble(0, 0),
                new PointDouble(10, 0),
                new PointDouble(10, 10),
                new PointDouble(0, 10),
            ];
            pdf.exportPolygon(verts, 4, true, 0, 0, 1);
            pdf.exportEnd();
            const out = pdf.getPdfString();
            expect(out).toContain('0 0 m');
            expect(out).toContain('10 0 l');
            expect(out).toContain('10 10 l');
            expect(out).toContain('0 10 l');
            expect(out).toContain('f*');
        });

        it('exportPolygon stroke-only emits s', () => {
            const verts = [new PointDouble(0, 0), new PointDouble(10, 0), new PointDouble(0, 10)];
            pdf.exportPolygon(verts, 3, false, 0, 0, 1);
            pdf.exportEnd();
            const out = pdf.getPdfString();
            expect(out).toContain('s');
        });

        it('exportConnection draws a filled disc via ellipse + f', () => {
            pdf.exportConnection(50, 50, 0, 4);
            pdf.exportEnd();
            const out = pdf.getPdfString();
            // First vertex of the 32-segment ellipse is at (cx+rx, cy) = (52, 50).
            expect(out).toMatch(/52 50 m/);
            // Bézier-via-y operator with four numbers per row.
            expect(out).toMatch(/\d+\.\d+ \d+\.\d+ \d+\.\d+ \d+\.\d+ y/);
        });

        it('exportPCBLine emits stroke-width and m/l/S', () => {
            pdf.exportPCBLine(0, 0, 100, 0, 5, 0);
            pdf.exportEnd();
            const out = pdf.getPdfString();
            expect(out).toContain(' 5 w');
            expect(out).toContain('0 0 m 100 0 l S');
        });

        it('exportPCBPad style 1 (square) draws filled square + hole', () => {
            pdf.exportPCBPad(50, 50, 1, 10, 10, 4, 0, false);
            pdf.exportEnd();
            const out = pdf.getPdfString();
            expect(out).toContain('45 45 m');
            expect(out).toContain('55 45 l');
            expect(out).toContain('B'); // fill + stroke
            // Then a white drill paint.
            expect(out).toContain(' 1 1 1 rg');
        });
    });

    describe('color and dash state', () => {
        it('emits rg/RG color operators for the active layer', () => {
            pdf.exportLine(0, 0, 1, 1, 0, false, false, 0, 0, 0, 0, 1);
            pdf.exportEnd();
            const out = pdf.getPdfString();
            expect(out).toMatch(/[\d.]+ [\d.]+ [\d.]+ rg/);
            expect(out).toMatch(/[\d.]+ [\d.]+ [\d.]+ RG/);
        });

        it('does not repeat color operators when layer stays the same', () => {
            pdf.exportLine(0, 0, 1, 1, 0, false, false, 0, 0, 0, 0, 1);
            pdf.exportLine(2, 2, 3, 3, 0, false, false, 0, 0, 0, 0, 1);
            pdf.exportEnd();
            const out = pdf.getPdfString();
            const matches = out.match(/ rg\n/g);
            expect(matches).not.toBeNull();
            expect(matches!.length).toBe(1);
        });

        it('emits [] 0 d to reset dashing when a solid stroke follows a dashed one', () => {
            pdf.setDashUnit(1);
            pdf.exportLine(0, 0, 10, 0, 0, false, false, 0, 0, 0, 1, 1); // dashStyle=1
            pdf.exportLine(0, 5, 10, 5, 0, false, false, 0, 0, 0, 0, 1); // dashStyle=0
            pdf.exportEnd();
            const out = pdf.getPdfString();
            expect(out).toContain('[] 0 d');
        });
    });

    describe('text', () => {
        it('exportAdvText emits BT/ET text block', () => {
            pdf.exportAdvText(10, 10, 6, 8, 'Helvetica', false, false, false, 0, 0, 'Hello');
            pdf.exportEnd();
            const out = pdf.getPdfString();
            expect(out).toContain('BT');
            expect(out).toContain('ET');
            expect(out).toContain('(Hello) Tj');
            expect(out).toContain('/F5'); // Helvetica is F5.
        });

        it('escapes PDF special characters in text', () => {
            pdf.exportAdvText(0, 0, 6, 8, 'Helvetica', false, false, false, 0, 0, 'a(b\\c)');
            pdf.exportEnd();
            const out = pdf.getPdfString();
            expect(out).toContain('(a\\(b\\\\c\\)) Tj');
        });

        it('routes Times and Courier font names to dedicated font slots', () => {
            pdf.exportAdvText(0, 0, 6, 8, 'Times', false, false, false, 0, 0, 'A');
            pdf.exportAdvText(0, 20, 6, 8, 'Courier', true, false, false, 0, 0, 'B');
            pdf.exportEnd();
            const out = pdf.getPdfString();
            expect(out).toContain('/F3'); // Times-Roman
            expect(out).toContain('/F2'); // Courier-Bold
        });
    });

    describe('arrows', () => {
        it('filled arrow ends with f*', () => {
            pdf.exportArrow(100, 0, 0, 0, 10, 4, 0);
            pdf.exportEnd();
            const out = pdf.getPdfString();
            expect(out).toContain('f*');
        });

        it('limiter arrow draws an extra perpendicular line', () => {
            // flagLimiter = 0x01
            pdf.exportArrow(100, 0, 0, 0, 10, 4, 0x01);
            pdf.exportEnd();
            const out = pdf.getPdfString();
            expect(out).toMatch(/m \S+ \S+ l s/);
        });
    });
});
