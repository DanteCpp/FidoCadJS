import { DrawingModel } from './model/DrawingModel.js';
import { ParserActions } from './controllers/ParserActions.js';
import { Drawing } from './views/Drawing.js';
import { LayerDesc } from '../layers/LayerDesc.js';
import { ColorCanvas } from '../graphic/canvas/ColorCanvas.js';
import type { Graphics } from '../graphic/Graphics.js';
import type { MapCoordinates } from '../geom/MapCoordinates.js';
import type { MacroDesc } from '../primitives/MacroDesc.js';

/** Build a full layer array where every layer renders in the editing green,
 *  so any pasted primitive shows up as a ghost regardless of its own layer. */
function greenLayers(): LayerDesc[] {
    const layers: LayerDesc[] = [];
    for (let i = 0; i < LayerDesc.MAX_LAYERS; i++) {
        layers.push(new LayerDesc(new ColorCanvas(0, 255, 0), true, '', 1.0));
    }
    return layers;
}

export class PastePlacement {
    private model: DrawingModel;
    private parser: ParserActions;
    private drawing: Drawing;

    private _active = false;
    private configurationText = '';
    /** Placement pivot, initially the top-left of the copied control points. */
    private anchorX = 0;
    private anchorY = 0;

    constructor() {
        this.model = new DrawingModel();
        this.model.setLayers(greenLayers());
        this.parser = new ParserActions(this.model);
        this.drawing = new Drawing(this.model);
    }

    isActive(): boolean {
        return this._active;
    }

    /**
     * Parse clipboard text into the transient model and arm placement mode.
     * @returns false if the text yielded no primitives (caller should bail out).
     */
    begin(text: string, library: Map<string, MacroDesc>): boolean {
        this.model.getPrimitiveVector().length = 0;
        this.model.setLibrary(library);
        this.parser.addString(text, false);

        const prims = this.model.getPrimitiveVector();
        if (prims.length === 0) {
            return false;
        }

        // Anchor on the bounding-box top-left of all control points so the blob
        // sits naturally under the cursor.
        let minX = Number.MAX_VALUE;
        let minY = Number.MAX_VALUE;
        for (const p of prims) {
            const n = p.getControlPointNumber();
            for (let i = 0; i < n; i++) {
                const pt = p.virtualPoint[i];
                if (!pt) continue;
                if (pt.x < minX) minX = pt.x;
                if (pt.y < minY) minY = pt.y;
            }
        }
        if (minX === Number.MAX_VALUE) {
            minX = 0;
            minY = 0;
        }

        // Keep clipboard configuration, never the preview's green layer palette.
        this.configurationText = text
            .split(/\r?\n/)
            .filter((line) => /^FJC\s/.test(line))
            .join('\n');
        this.anchorX = minX;
        this.anchorY = minY;
        this.model.setChanged(true);
        this._active = true;
        return true;
    }

    /** Move the ghost so its anchor lands on the given (already snapped) point. */
    moveTo(lx: number, ly: number): void {
        if (!this._active) return;
        this.moveBy(lx - this.anchorX, ly - this.anchorY);
    }

    moveBy(dx: number, dy: number): void {
        if (!this._active) return;
        // Rotations can put control points left/above the pivot. Clamp the whole
        // group together so no primitive refuses its move and breaks the layout.
        for (const p of this.model.getPrimitiveVector()) {
            for (let i = 0; i < p.getControlPointNumber(); i++) {
                const pt = p.virtualPoint[i]!;
                dx = Math.max(dx, -pt.x);
                dy = Math.max(dy, -pt.y);
            }
        }
        if (dx === 0 && dy === 0) return;
        for (const p of this.model.getPrimitiveVector()) {
            p.movePrimitive(dx, dy);
        }
        this.anchorX += dx;
        this.anchorY += dy;
        this.model.setChanged(true);
    }

    rotate(): void {
        if (!this._active) return;
        for (const p of this.model.getPrimitiveVector()) {
            p.rotatePrimitive(false, this.anchorX, this.anchorY);
        }
        this.moveBy(0, 0);
        this.model.setChanged(true);
    }

    mirror(): void {
        if (!this._active) return;
        for (const p of this.model.getPrimitiveVector()) {
            p.mirrorPrimitive(this.anchorX);
        }
        this.moveBy(0, 0);
        this.model.setChanged(true);
    }

    /** Render the green ghost. Caller is responsible for the surrounding alpha. */
    draw(gi: Graphics, cs: MapCoordinates): void {
        if (!this._active) return;
        this.drawing.draw(gi, cs);
    }

    /** Serialize the edited ghost at its final position for committing. */
    getText(): string {
        return (
            this.configurationText +
            '\n' +
            this.model
                .getPrimitiveVector()
                .map((p) => p.toString(true))
                .join('')
        );
    }

    /** Leave placement mode and release the transient primitives. */
    end(): void {
        this._active = false;
        this.model.getPrimitiveVector().length = 0;
    }
}
