import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrimitiveLine } from '../../src/primitives/PrimitiveLine.js';
import { MapCoordinates } from '../../src/geom/MapCoordinates.js';
import { GraphicsNull } from '../../src/graphic/nil/GraphicsNull.js';
import { TeXMode } from '../../src/graphic/TeXMode.js';
import * as StandardLayers from '../../src/layers/StandardLayers.js';
import type { LaidOutSegment } from '../../src/graphic/MathLayout.js';

/**
 * Recording Graphics: extends the no-op GraphicsNull and captures the string
 * and math draw calls so we can assert which rendering path each label took.
 */
class RecordingGraphics extends GraphicsNull {
    readonly strings: string[] = [];
    readonly math: LaidOutSegment[][][] = [];

    override drawString(str: string, _x: number, _y: number): void {
        this.strings.push(str);
    }
    override getTextInterface() {
        return this;
    }
    override drawMathSegments(lines: LaidOutSegment[][]): void {
        this.math.push(lines);
    }
}

/** A line carrying a math name and a plain value, ready to draw. */
function lineWithNameValue(name: string, value: string): PrimitiveLine {
    const line = new PrimitiveLine(10, 10, 100, 10, 0, false, false, 0, 0, 0, 0, 'Courier New', 20);
    // Token layout: TY x y fs43 fontSize o sty layer font ...text
    line.setName(['TY', '15', '15', '34', '20', '0', '0', '0', '*', name], 10);
    line.setValue(['TY', '15', '25', '34', '20', '0', '0', '0', '*', value], 10);
    return line;
}

describe('LaTeX in name/value labels', () => {
    let cs: MapCoordinates;
    const layers = StandardLayers.createStandardLayers();

    beforeEach(() => {
        cs = new MapCoordinates();
        cs.setXMagnitudeNoCheck(1);
        cs.setYMagnitudeNoCheck(1);
    });

    afterEach(() => {
        TeXMode.active = false;
    });

    it('typesets a math name via drawMathSegments when TeX is active', () => {
        TeXMode.active = true;
        const g = new RecordingGraphics();
        lineWithNameValue('$\\frac{a}{b}$', 'plainval').draw(g, cs, layers);

        // The math name goes through the glyph-path renderer, not drawString.
        expect(g.math).toHaveLength(1);
        expect(g.strings).toContain('plainval');
        expect(g.strings).not.toContain('$\\frac{a}{b}$');
    });

    it('draws the literal string when TeX rendering is off', () => {
        TeXMode.active = false;
        const g = new RecordingGraphics();
        lineWithNameValue('$\\frac{a}{b}$', 'plainval').draw(g, cs, layers);

        expect(g.math).toHaveLength(0);
        expect(g.strings).toContain('$\\frac{a}{b}$');
        expect(g.strings).toContain('plainval');
    });

    it('leaves a delimiter-free name on the plain-text path even with TeX on', () => {
        TeXMode.active = true;
        const g = new RecordingGraphics();
        lineWithNameValue('R1', '10k').draw(g, cs, layers);

        expect(g.math).toHaveLength(0);
        expect(g.strings).toContain('R1');
        expect(g.strings).toContain('10k');
    });
});
