import { describe, it, expect } from 'vitest';
import { DrawingModel } from '../../src/circuit/model/DrawingModel.js';
import { ParserActions } from '../../src/circuit/controllers/ParserActions.js';
import * as StandardLayers from '../../src/layers/StandardLayers.js';
import { registerDrawingHooks } from '../../src/circuit/views/Drawing.js';
import { MacroDesc } from '../../src/primitives/MacroDesc.js';
import { MapCoordinates } from '../../src/geom/MapCoordinates.js';
import { GraphicsNull } from '../../src/graphic/nil/GraphicsNull.js';
import { PrimitiveMacro } from '../../src/primitives/PrimitiveMacro.js';

/** Records the endpoints of every line drawn while rendering. */
class Recorder extends GraphicsNull {
    pts: number[][] = [];
    override drawLine(x1: number, y1: number, x2: number, y2: number): void {
        this.pts.push([x1, y1], [x2, y2]);
    }
}

/**
 * Signature = sorted multiset of all pairwise distances between drawn points.
 * Every element of the symmetry group (rotation/mirror) is an isometry, so a
 * correct transform leaves this signature unchanged. Distortion changes it.
 */
function distanceSignature(pts: number[][]): number[] {
    const d: number[] = [];
    for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
            d.push(Math.round(Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])));
        }
    }
    return d.sort((a, b) => a - b);
}

function renderSignature(
    macro: PrimitiveMacro,
    layers: ReturnType<typeof StandardLayers.createStandardLayers>,
    o: number,
    m: boolean,
): number[] {
    macro.setMirrored(m);
    macro.setOrientation(o);
    macro.setChanged(true);
    const cs = new MapCoordinates();
    cs.setMagnitudes(10, 10);
    cs.setXCenter(500);
    cs.setYCenter(500);
    const g = new Recorder();
    for (let layer = 0; layer < 16; layer++) {
        macro.setDrawOnlyLayer(layer);
        macro.draw(g, cs, layers);
    }
    return distanceSignature(g.pts);
}

describe('macro rotation preserves shape', () => {
    it('flat macro is rigid across all orientation/mirror combinations', () => {
        registerDrawingHooks();
        const model = new DrawingModel();
        const layers = StandardLayers.createStandardLayers();
        model.setLayers(layers);
        const pa = new ParserActions(model);
        // Scalene triangle — distinguishes all 8 symmetries of the square.
        model
            .getLibrary()
            .set(
                'test.t',
                new MacroDesc(
                    'test.t',
                    'T',
                    'LI 100 100 140 105 0\nLI 140 105 110 130 0\nLI 110 130 100 100 0',
                    'g',
                    't',
                    't',
                ),
            );
        pa.parseString('MC 100 100 0 0 test.t');
        const macro = model.getPrimitiveVector()[0] as PrimitiveMacro;

        const reference = renderSignature(macro, layers, 0, false);
        for (const m of [false, true]) {
            for (let o = 0; o < 4; o++) {
                expect(renderSignature(macro, layers, o, m)).toEqual(reference);
            }
        }
    });

    it('nested macro with mirrored sub-macro is rigid across all orientations', () => {
        registerDrawingHooks();
        const model = new DrawingModel();
        const layers = StandardLayers.createStandardLayers();
        model.setLayers(layers);
        const pa = new ParserActions(model);
        model
            .getLibrary()
            .set(
                'test.inner',
                new MacroDesc(
                    'test.inner',
                    'I',
                    'LI 100 100 140 105 0\nLI 140 105 110 130 0\nLI 110 130 100 100 0',
                    'g',
                    't',
                    't',
                ),
            );
        // Outer instantiates the inner mirrored + rotated, plus a reference line.
        model
            .getLibrary()
            .set(
                'test.outer',
                new MacroDesc(
                    'test.outer',
                    'O',
                    'MC 110 110 1 1 test.inner\nLI 100 100 130 100 0',
                    'g',
                    't',
                    't',
                ),
            );
        pa.parseString('MC 100 100 0 0 test.outer');
        const macro = model.getPrimitiveVector()[0] as PrimitiveMacro;

        const reference = renderSignature(macro, layers, 0, false);
        for (const m of [false, true]) {
            for (let o = 0; o < 4; o++) {
                expect(renderSignature(macro, layers, o, m)).toEqual(reference);
            }
        }
    });
});
