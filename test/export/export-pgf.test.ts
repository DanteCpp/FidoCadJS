/**
 * @file export-pgf.test.ts
 * @author Dante Loi
 * @date 2026-05-09
 * @brief Tests for ExportPGF — PGF command generation for LaTeX
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExportPGF } from '../../src/export/ExportPGF.js';
import { DimensionG } from '../../src/graphic/DimensionG.js';
import { StandardLayers } from '../../src/layers/StandardLayers.js';
import { PointDouble } from '../../src/graphic/PointDouble.js';

describe('ExportPGF', () => {
    let pgf: ExportPGF;
    const layers = StandardLayers.createStandardLayers();

    beforeEach(() => {
        pgf = new ExportPGF();
        pgf.exportStart(new DimensionG(200, 200), layers, 0);
    });

    it('exportStart / exportEnd produce valid PGF wrapper', () => {
        pgf.exportEnd();
        const result = pgf.getPgfString();
        expect(result).toContain('\\begin{pgfpicture}');
        expect(result).toContain('\\end{pgfpicture}');
        expect(result).toContain('\\pgfsetxvec');
        expect(result).toContain('\\pgfsetyvec');
        expect(result).toContain('\\pgftranslateto');
        expect(result).toContain('\\begin{pgfmagnify}');
        expect(result).toContain('\\end{pgfmagnify}');
    });

    it('exportStart emits layer color definitions', () => {
        pgf.exportEnd();
        const result = pgf.getPgfString();
        // Should have color definitions for standard layers
        expect(result).toContain('\\definecolor{layer0}{rgb}');
        expect(result).toContain('\\definecolor{layer1}{rgb}');
        expect(result).toContain('% Layer color definitions');
        expect(result).toContain('% End of color definitions');
    });

    it('exportLine produces pgfline command', () => {
        pgf.exportLine(10, 10, 100, 100, 0, false, false, 0, 0, 0, 0, 1);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        expect(result).toContain('\\pgfline');
        expect(result).toContain('\\pgfxy(10,10)');
        expect(result).toContain('\\pgfxy(100,100)');
    });

    it('exportLine emits color switch for different layers', () => {
        pgf.exportLine(10, 10, 100, 100, 0, false, false, 0, 0, 0, 0, 1);
        pgf.exportLine(10, 10, 100, 100, 1, false, false, 0, 0, 0, 0, 1);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        expect(result).toContain('\\color{layer0}');
        expect(result).toContain('\\color{layer1}');
    });

    it('exportLine does not re-emit color for same layer', () => {
        pgf.exportLine(10, 10, 100, 100, 0, false, false, 0, 0, 0, 0, 1);
        pgf.exportLine(20, 20, 80, 80, 0, false, false, 0, 0, 0, 0, 1);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        // \color{layer0} should appear only once (from registerColorSize state tracking)
        const matches = result.match(/\\color\{layer0\}/g);
        expect(matches).not.toBeNull();
        expect(matches!.length).toBe(1);
    });

    it('exportLine with arrows emits arrow polygon', () => {
        pgf.exportLine(10, 10, 100, 10, 0, true, true, 0, 10, 4, 0, 1);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        // Arrows emit \pgfmoveto ... \pgfclosepath \pgffill
        expect(result).toContain('\\pgfmoveto');
        expect(result).toContain('\\pgfclosepath');
        expect(result).toContain('\\pgffill');
        // The line itself should also be present
        expect(result).toContain('\\pgfline');
    });

    it('exportLine with empty arrow style emits qstroke', () => {
        pgf.exportLine(10, 10, 100, 10, 0, true, false, 2, 10, 4, 0, 1);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        expect(result).toContain('\\pgfqstroke');
    });

    it('exportRectangle produces pgfmoveto/pgflineto chain', () => {
        pgf.exportRectangle(20, 30, 80, 60, false, 0, 0, 1);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        expect(result).toContain('\\pgfmoveto{\\pgfxy(20,30)}');
        expect(result).toContain('\\pgfclosepath');
    });

    it('exportRectangle filled emits pgffill', () => {
        pgf.exportRectangle(20, 30, 80, 60, true, 0, 0, 1);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        expect(result).toContain('\\pgffill');
    });

    it('exportRectangle unfilled emits pgfqstroke', () => {
        pgf.exportRectangle(20, 30, 80, 60, false, 0, 0, 1);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        expect(result).toContain('\\pgfqstroke');
    });

    it('exportOval produces pgfellipse command', () => {
        pgf.exportOval(20, 20, 80, 80, false, 0, 0, 1);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        expect(result).toContain('\\pgfellipse');
        expect(result).toContain('\\pgfxy(50,50)');
        expect(result).toContain('\\pgfxy(30,0)');
        expect(result).toContain('\\pgfxy(0,30)');
    });

    it('exportOval filled emits fillstroke', () => {
        pgf.exportOval(20, 20, 80, 80, true, 0, 0, 1);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        expect(result).toContain('[fillstroke]');
    });

    it('exportOval unfilled emits stroke', () => {
        pgf.exportOval(20, 20, 80, 80, false, 0, 0, 1);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        expect(result).toContain('[stroke]');
    });

    it('exportConnection produces pgfcircle command', () => {
        pgf.exportConnection(70, 60, 0, 6);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        expect(result).toContain('\\pgfcircle[fill]');
        expect(result).toContain('\\pgfxy(70,60)');
        expect(result).toContain('3pt'); // nodeSize / 2 = 3
    });

    it('exportPolygon produces pgfmoveto/pgflineto chain', () => {
        const pts = [new PointDouble(0, 0), new PointDouble(50, 0), new PointDouble(25, 50)];
        pgf.exportPolygon(pts, 3, false, 0, 0, 1);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        expect(result).toContain('\\pgfmoveto{\\pgfxy(0,0)}');
        expect(result).toContain('\\pgflineto{\\pgfxy(50,0)}');
        expect(result).toContain('\\pgflineto{\\pgfxy(25,50)}');
        expect(result).toContain('\\pgfclosepath');
    });

    it('exportPolygon filled emits pgffill', () => {
        const pts = [new PointDouble(0, 0), new PointDouble(50, 0), new PointDouble(25, 50)];
        pgf.exportPolygon(pts, 3, true, 0, 0, 1);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        expect(result).toContain('\\pgffill');
    });

    it('exportBezier produces pgfcurveto and pgfstroke', () => {
        pgf.exportBezier(10, 10, 30, 50, 50, 20, 70, 40, 0, false, false, 0, 0, 0, 0, 1);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        expect(result).toContain('\\pgfmoveto');
        expect(result).toContain('\\pgfcurveto');
        expect(result).toContain('\\pgfstroke');
    });

    it('exportPCBLine produces pgfline with correct width', () => {
        pgf.exportPCBLine(10, 10, 100, 100, 5, 0);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        expect(result).toContain('\\pgfline');
        expect(result).toContain('\\pgfsetlinewidth{5pt}');
    });

    it('exportPCBLine always uses solid dash (dash style 0)', () => {
        // Even though we don't call setDashUnit, registerDash(0) emits solid
        pgf.setDashUnit(4);
        pgf.exportPCBLine(10, 10, 100, 100, 3, 0);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        // Should contain the solid dash command
        expect(result).toContain('\\pgfsetdash{}{0pt}');
    });

    it('exportPCBPad with oval style produces pgfellipse', () => {
        pgf.exportPCBPad(50, 50, 0, 10, 10, 3, 0, false);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        expect(result).toContain('\\pgfellipse[fillstroke]');
    });

    it('exportPCBPad with rect style produces pgfrect', () => {
        pgf.exportPCBPad(50, 50, 1, 10, 10, 3, 0, false);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        expect(result).toContain('\\pgfrect[fillstroke]');
    });

    it('exportPCBPad with rounded style produces pgfrect', () => {
        pgf.exportPCBPad(50, 50, 2, 10, 10, 3, 0, false);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        expect(result).toContain('\\pgfrect[fillstroke]');
    });

    it('exportPCBPad onlyHole emits white ellipse', () => {
        pgf.exportPCBPad(50, 50, 0, 10, 10, 4, 0, true);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        expect(result).toContain('\\color{white}');
        expect(result).toContain('\\pgfellipse[fillstroke]');
    });

    it('exportAdvText produces pgfputat with escaped text', () => {
        pgf.exportAdvText(100, 100, 10, 10, 'Arial', false, false, false, 0, 0, 'Hello $R_1$');
        pgf.exportEnd();
        const result = pgf.getPgfString();
        expect(result).toContain('\\pgfputat');
        expect(result).toContain('\\pgfbox[left,top]');
        // LaTeX special chars are escaped now
        expect(result).toContain('Hello \\$R\\_1\\$');
        // Y is negated in PGF output
        expect(result).toContain('\\pgfxy(100,-100)');
    });

    it('exportAdvText escapes LaTeX special chars', () => {
        pgf.exportAdvText(50, 50, 10, 10, 'Arial', false, false, false, 0, 0, 'a & b < c');
        pgf.exportEnd();
        const result = pgf.getPgfString();
        // '&' escaped to '\&', '<' is not a LaTeX special char
        expect(result).toContain('a \\& b < c');
    });

    it('dash styles emit pgfsetdash commands', () => {
        pgf.setDashUnit(4);
        pgf.exportLine(10, 10, 100, 100, 0, false, false, 0, 0, 0, 1, 1);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        // Dash style 1 should produce pgfsetdash with pattern
        expect(result).toContain('\\pgfsetdash{');
    });

    it('dash style 0 emits solid pattern', () => {
        pgf.setDashUnit(4);
        pgf.exportLine(10, 10, 100, 100, 0, false, false, 0, 0, 0, 0, 1);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        expect(result).toContain('\\pgfsetdash{}{0pt}');
    });

    it('dash phase is emitted correctly', () => {
        pgf.setDashUnit(4);
        pgf.setDashPhase(2.5);
        pgf.exportLine(10, 10, 100, 100, 0, false, false, 0, 0, 0, 1, 1);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        expect(result).toContain('}{2.5pt}');
    });

    it('exportMacro returns false (expansion signal)', () => {
        const r = pgf.exportMacro(
            0,
            0,
            false,
            0,
            'test',
            '',
            '',
            0,
            0,
            '',
            0,
            0,
            '',
            10,
            new Map(),
        );
        expect(r).toBe(false);
    });

    it('exportCurve returns false (expansion signal)', () => {
        const r = pgf.exportCurve([], 0, false, false, 0, false, false, 0, 0, 0, 0, 1);
        expect(r).toBe(false);
    });

    it('line width change emits pgfsetlinewidth', () => {
        pgf.exportLine(10, 10, 100, 100, 0, false, false, 0, 0, 0, 0, 2.5);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        expect(result).toContain('\\pgfsetlinewidth{2.5pt}');
    });

    it('same line width on same layer does not re-emit', () => {
        pgf.exportLine(10, 10, 100, 100, 0, false, false, 0, 0, 0, 0, 2);
        pgf.exportLine(20, 20, 80, 80, 0, false, false, 0, 0, 0, 0, 2);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        // \pgfsetlinewidth should appear only once for width 2
        const matches = result.match(/\\pgfsetlinewidth\{2pt\}/g);
        expect(matches).not.toBeNull();
        expect(matches!.length).toBe(1);
    });

    it('integer coordinates are emitted without decimal point', () => {
        pgf.exportLine(42, 73, 100, 50, 0, false, false, 0, 0, 0, 0, 1);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        expect(result).toContain('\\pgfxy(42,73)');
        expect(result).not.toContain('\\pgfxy(42.0,73.0)');
    });

    it('setDashUnit formats PGF-style dash with pt separators', () => {
        pgf = new ExportPGF();
        pgf.exportStart(new DimensionG(200, 200), layers, 0);
        pgf.setDashUnit(4);
        pgf.exportLine(10, 10, 100, 100, 0, false, false, 0, 0, 0, 1, 1);
        pgf.exportEnd();
        const result = pgf.getPgfString();
        // PGF dash pattern should use {Xpt}{Ypt} format, not commas
        expect(result).toContain('pt}{');
    });
});
