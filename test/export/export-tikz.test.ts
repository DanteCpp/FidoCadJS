import { describe, it, expect, beforeEach } from 'vitest';
import { ExportTikZ } from '../../src/export/ExportTikZ.js';
import { DimensionG } from '../../src/graphic/DimensionG.js';
import { StandardLayers } from '../../src/layers/StandardLayers.js';
import { PointDouble } from '../../src/graphic/PointDouble.js';

describe('ExportTikZ', () => {
    let tikz: ExportTikZ;
    const layers = StandardLayers.createStandardLayers();

    beforeEach(() => {
        tikz = new ExportTikZ();
        tikz.exportStart(new DimensionG(200, 200), layers, 0);
    });

    it('exportStart / exportEnd produce valid TikZ wrapper', () => {
        tikz.exportEnd();
        const result = tikz.getTikZString();
        expect(result).toContain('\\begin{tikzpicture}');
        expect(result).toContain('\\end{tikzpicture}');
        expect(result).toContain('yscale=-1');
        expect(result).toContain('x=1pt');
        expect(result).toContain('y=1pt');
        expect(result).toContain('line join=round');
        expect(result).toContain('line cap=round');
    });

    it('exportStart emits layer color definitions', () => {
        tikz.exportEnd();
        const result = tikz.getTikZString();
        expect(result).toContain('\\definecolor{layer0}{rgb}');
        expect(result).toContain('\\definecolor{layer1}{rgb}');
    });

    it('exportLine produces draw command with correct coords', () => {
        tikz.exportLine(10, 10, 100, 100, 0, false, false, 0, 0, 0, 0, 1);
        tikz.exportEnd();
        const result = tikz.getTikZString();
        expect(result).toContain('\\draw[color=layer0, line width=1pt]');
        expect(result).toContain('(10,10) -- (100,100)');
        expect(result).toContain(';');
    });

    it('exportLine emits correct layer color', () => {
        tikz.exportLine(10, 10, 100, 100, 3, false, false, 0, 0, 0, 0, 1);
        tikz.exportEnd();
        const result = tikz.getTikZString();
        expect(result).toContain('color=layer3');
    });

    it('exportLine with arrows emits arrow polygons', () => {
        tikz.exportLine(10, 10, 100, 10, 0, true, true, 0, 10, 4, 0, 1);
        tikz.exportEnd();
        const result = tikz.getTikZString();
        // Arrow polygons use \filldraw
        expect(result).toContain('\\filldraw[color=layer0]');
        // The line still present
        expect(result).toContain('\\draw[color=layer0, line width=1pt]');
    });

    it('exportLine with empty arrow emits draw (not filldraw)', () => {
        tikz.exportLine(10, 10, 100, 10, 0, true, false, 2, 10, 4, 0, 1);
        tikz.exportEnd();
        const result = tikz.getTikZString();
        // style=2 means flagEmpty is set → arrow uses \draw, not \filldraw
        expect(result).toMatch(/\\draw\[color=layer0\].*-- cycle;/);
    });

    it('exportRectangle uses rectangle syntax', () => {
        tikz.exportRectangle(20, 30, 80, 60, false, 0, 0, 1);
        tikz.exportEnd();
        const result = tikz.getTikZString();
        expect(result).toContain('\\draw[color=layer0, line width=1pt]');
        expect(result).toContain('(20,30) rectangle (80,60)');
    });

    it('exportRectangle filled uses filldraw', () => {
        tikz.exportRectangle(20, 30, 80, 60, true, 0, 0, 1);
        tikz.exportEnd();
        const result = tikz.getTikZString();
        expect(result).toContain('\\filldraw');
    });

    it('exportRectangle unfilled uses draw', () => {
        tikz.exportRectangle(20, 30, 80, 60, false, 0, 0, 1);
        tikz.exportEnd();
        const result = tikz.getTikZString();
        expect(result).toContain('\\draw');
        expect(result).not.toContain('\\filldraw');
    });

    it('exportOval produces ellipse syntax', () => {
        tikz.exportOval(20, 20, 80, 80, false, 0, 0, 1);
        tikz.exportEnd();
        const result = tikz.getTikZString();
        expect(result).toContain('ellipse [x radius=30, y radius=30]');
        expect(result).toContain('(50,50)');
    });

    it('exportOval filled uses filldraw', () => {
        tikz.exportOval(20, 20, 80, 80, true, 0, 0, 1);
        tikz.exportEnd();
        const result = tikz.getTikZString();
        expect(result).toContain('\\filldraw');
    });

    it('exportConnection produces circle syntax', () => {
        tikz.exportConnection(70, 60, 0, 6);
        tikz.exportEnd();
        const result = tikz.getTikZString();
        expect(result).toContain('\\filldraw[color=layer0]');
        expect(result).toContain('(70,60) circle [radius=3]');
    });

    it('exportPolygon produces point chain with cycle', () => {
        const pts = [new PointDouble(0, 0), new PointDouble(50, 0), new PointDouble(25, 50)];
        tikz.exportPolygon(pts, 3, false, 0, 0, 1);
        tikz.exportEnd();
        const result = tikz.getTikZString();
        expect(result).toContain('\\draw[color=layer0, line width=1pt]');
        expect(result).toContain('(0,0) -- (50,0) -- (25,50) -- cycle;');
    });

    it('exportPolygon filled uses filldraw', () => {
        const pts = [new PointDouble(0, 0), new PointDouble(50, 0)];
        tikz.exportPolygon(pts, 2, true, 0, 0, 1);
        tikz.exportEnd();
        const result = tikz.getTikZString();
        expect(result).toContain('\\filldraw');
    });

    it('exportBezier produces controls syntax', () => {
        tikz.exportBezier(10, 10, 30, 50, 50, 20, 70, 40, 0, false, false, 0, 0, 0, 0, 1);
        tikz.exportEnd();
        const result = tikz.getTikZString();
        expect(result).toContain('.. controls');
        expect(result).toContain('and');
    });

    it('exportPCBLine emits correct line width', () => {
        tikz.exportPCBLine(10, 10, 100, 100, 5, 0);
        tikz.exportEnd();
        const result = tikz.getTikZString();
        expect(result).toContain('line width=5pt');
    });

    it('exportPCBLine has no dash pattern (always solid)', () => {
        tikz.setDashUnit(4);
        tikz.exportPCBLine(10, 10, 100, 100, 3, 0);
        tikz.exportEnd();
        const result = tikz.getTikZString();
        expect(result).not.toContain('dash pattern');
    });

    it('exportPCBPad oval produces ellipse', () => {
        tikz.exportPCBPad(50, 50, 0, 10, 10, 3, 0, false);
        tikz.exportEnd();
        const result = tikz.getTikZString();
        expect(result).toContain('ellipse');
        expect(result).toContain('\\filldraw');
    });

    it('exportPCBPad square produces rectangle ++', () => {
        tikz.exportPCBPad(50, 50, 1, 10, 10, 3, 0, false);
        tikz.exportEnd();
        const result = tikz.getTikZString();
        expect(result).toContain('rectangle ++(10,10)');
    });

    it('exportPCBPad rounded produces rectangle ++', () => {
        tikz.exportPCBPad(50, 50, 2, 10, 10, 3, 0, false);
        tikz.exportEnd();
        const result = tikz.getTikZString();
        expect(result).toContain('rectangle ++(10,10)');
    });

    it('exportPCBPad onlyHole emits white filldraw', () => {
        tikz.exportPCBPad(50, 50, 0, 10, 10, 4, 0, true);
        tikz.exportEnd();
        const result = tikz.getTikZString();
        expect(result).toContain('\\filldraw[color=white]');
        expect(result).toContain('ellipse');
    });

    it('exportAdvText produces node with anchor', () => {
        tikz.exportAdvText(100, 100, 10, 10, 'Arial', false, false, false, 0, 0, 'Hello $R_1$');
        tikz.exportEnd();
        const result = tikz.getTikZString();
        expect(result).toContain('\\node[anchor=north west');
        expect(result).toContain('color=layer0');
        expect(result).toContain('at (100,100)');
        // LaTeX special chars are escaped now
        expect(result).toContain('{Hello \\$R\\_1\\$}');
    });

    it('exportAdvText escapes LaTeX special chars', () => {
        tikz.exportAdvText(50, 50, 10, 10, 'Arial', false, false, false, 0, 0, 'a & b < c');
        tikz.exportEnd();
        const result = tikz.getTikZString();
        // '&' escaped to '\&', '<' is not a LaTeX special char
        expect(result).toContain('a \\& b < c');
    });

    it('dash style emits dash pattern option', () => {
        tikz.setDashUnit(4);
        tikz.exportLine(10, 10, 100, 100, 0, false, false, 0, 0, 0, 1, 1);
        tikz.exportEnd();
        const result = tikz.getTikZString();
        expect(result).toContain('dash pattern=on');
    });

    it('solid dash (style 0) has no dash pattern', () => {
        tikz.setDashUnit(4);
        tikz.exportLine(10, 10, 100, 100, 0, false, false, 0, 0, 0, 0, 1);
        tikz.exportEnd();
        const result = tikz.getTikZString();
        expect(result).not.toContain('dash pattern');
        expect(result).toContain('\\draw[color=layer0, line width=1pt]');
    });

    it('dash phase emits dash phase option', () => {
        tikz.setDashUnit(4);
        tikz.setDashPhase(2.5);
        tikz.exportLine(10, 10, 100, 100, 0, false, false, 0, 0, 0, 1, 1);
        tikz.exportEnd();
        const result = tikz.getTikZString();
        expect(result).toContain('dash phase=2.5pt');
    });

    it('arrow with limiter emits limiter line', () => {
        // style=1 means flagLimiter is set
        tikz.exportLine(10, 10, 100, 10, 0, true, false, 1, 10, 4, 0, 1);
        tikz.exportEnd();
        const result = tikz.getTikZString();
        // Should have the arrow polygon AND a limiter line
        const drawLines = result.match(/\\draw\[/g);
        // At least 2: one for arrow, one for limiter, plus the main line
        expect(drawLines).not.toBeNull();
        expect(drawLines!.length).toBeGreaterThanOrEqual(2);
    });

    it('exportMacro returns false', () => {
        const r = tikz.exportMacro(
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

    it('exportCurve returns false', () => {
        const r = tikz.exportCurve([], 0, false, false, 0, false, false, 0, 0, 0, 0, 1);
        expect(r).toBe(false);
    });

    it('integer coords emitted without decimals', () => {
        tikz.exportLine(42, 73, 100, 50, 0, false, false, 0, 0, 0, 0, 1);
        tikz.exportEnd();
        const result = tikz.getTikZString();
        expect(result).toContain('(42,73)');
        expect(result).not.toContain('(42.0,73.0)');
    });
});
