import { describe, it, expect, beforeEach } from 'vitest';
import { DrawingModel } from '../../src/circuit/model/DrawingModel.js';
import { ParserActions } from '../../src/circuit/controllers/ParserActions.js';
import { Drawing, registerDrawingHooks } from '../../src/circuit/views/Drawing.js';
import * as StandardLayers from '../../src/layers/StandardLayers.js';
import { DrawingSize } from '../../src/geom/DrawingSize.js';
import { GraphicsCanvas } from '../../src/graphic/canvas/GraphicsCanvas.js';
import { ColorCanvas } from '../../src/graphic/canvas/ColorCanvas.js';

/** Build a spy 2D context that records `ctx.fillStyle` at every fill() call. */
function makeSpyCanvas(): { canvas: HTMLCanvasElement; fillColors: string[] } {
    const fillColors: string[] = [];
    const ctx: any = {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        globalAlpha: 1,
        font: '12px sans-serif',
        lineCap: 'butt',
        lineJoin: 'miter',
        measureText: () => ({ width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 }),
        fill() {
            fillColors.push(ctx.fillStyle);
        },
        fillRect() {},
        stroke() {},
        strokeRect() {},
        clearRect() {},
        beginPath() {},
        closePath() {},
        moveTo() {},
        lineTo() {},
        ellipse() {},
        arc() {},
        rect() {},
        save() {},
        restore() {},
        scale() {},
        translate() {},
        setLineDash() {},
        fillText() {},
    };
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    (canvas as any).getContext = () => ctx;
    return { canvas, fillColors };
}

function buildModel(): {
    model: DrawingModel;
    mc: ReturnType<typeof DrawingSize.calculateZoomToFit>;
} {
    registerDrawingHooks();
    const model = new DrawingModel();
    model.setLayers(StandardLayers.createStandardLayers());
    const parser = new ParserActions(model);
    // A line plus a connection dot, both on layer 0 (black). No explicit layer
    // token on the SA, so it keeps the default layer 0.
    parser.parseString('[FIDOCAD]\nLI 50 50 100 100 0\nSA 75 75\n');
    const mc = DrawingSize.calculateZoomToFit(model, 170, 170, true);
    return { model, mc };
}

describe('macro preview connection visibility', () => {
    beforeEach(() => {
        registerDrawingHooks();
    });

    it('fills the connection dot with the layer colour (not the background) when cleared via the graphics API', () => {
        const { model, mc } = buildModel();
        const { canvas, fillColors } = makeSpyCanvas();
        const g = new GraphicsCanvas(canvas);

        // The fix: clear the background through the graphics wrapper so the
        // tracked colour stays in sync.
        g.setColor(new ColorCanvas(255, 255, 255));
        g.fillRect(0, 0, canvas.width, canvas.height);

        new Drawing(model).draw(g, mc);

        // The connection dot is the only fill() (ellipse). It must be black,
        // not the white background.
        expect(fillColors).toContain('rgb(0,0,0)');
        expect(fillColors).not.toContain('rgb(255,255,255)');
    });

    it('demonstrates the original bug: a raw-context clear leaves the dot painted white', () => {
        const { model, mc } = buildModel();
        const { canvas, fillColors } = makeSpyCanvas();
        const g = new GraphicsCanvas(canvas);

        // The old, buggy clear: write fillStyle straight to the raw context,
        // leaving GraphicsCanvas.currentColor at its default black.
        g.getCtx().fillStyle = 'rgb(255,255,255)';

        new Drawing(model).draw(g, mc);

        // selectLayer() believes the colour is already black (== layer 0) and
        // skips setColor(), so the dot fills with the stale white fillStyle.
        expect(fillColors).toContain('rgb(255,255,255)');
        expect(fillColors).not.toContain('rgb(0,0,0)');
    });
});
