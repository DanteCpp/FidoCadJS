/**
 * @file PastePlacement.ts
 * @author Dante Loi
 * @date 2026-06-04
 * @brief Interactive "place where you click" state for clipboard paste
 * @copyright Copyright 2026 Dante Loi - GPL v3
 * @details Holds a transient, off-screen drawing parsed from the clipboard so a
 *          green ghost of the pasted content can follow the cursor until the user
 *          confirms its position with a click (or Esc/Enter to drop in place).
 *          The original clipboard text is preserved verbatim; on commit the host
 *          re-parses it into the real model and offsets it by the chosen amount,
 *          exactly mirroring the non-interactive paste path so undo stays simple.
 */

import { DrawingModel } from './model/DrawingModel.js';
import { ParserActions } from './controllers/ParserActions.js';
import { Drawing } from './views/Drawing.js';
import { LayerDesc } from '../layers/LayerDesc.js';
import { ColorCanvas } from '../graphic/canvas/ColorCanvas.js';
import type { GraphicsInterface } from '../graphic/GraphicsInterface.js';
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
    private originalText = '';
    /** Anchor (top-left) of the parsed content as it came off the clipboard. */
    private anchorX = 0;
    private anchorY = 0;
    /** Offset currently applied to the ghost relative to the original anchor. */
    private offsetX = 0;
    private offsetY = 0;

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

        this.originalText = text;
        this.anchorX = minX;
        this.anchorY = minY;
        this.offsetX = 0;
        this.offsetY = 0;
        this.model.setChanged(true);
        this._active = true;
        return true;
    }

    /** Move the ghost so its anchor lands on the given (already snapped) point. */
    moveTo(lx: number, ly: number): void {
        if (!this._active) return;
        // The anchor is the blob's top-left, so keeping it non-negative keeps every
        // control point >= 0. Primitives refuse to move below the origin, so this
        // also guarantees the rigid blob never distorts and that the eventual
        // committed move applies in full.
        const tx = lx < 0 ? 0 : lx;
        const ty = ly < 0 ? 0 : ly;
        const targetOffsetX = tx - this.anchorX;
        const targetOffsetY = ty - this.anchorY;
        const dx = targetOffsetX - this.offsetX;
        const dy = targetOffsetY - this.offsetY;
        if (dx === 0 && dy === 0) return;
        for (const p of this.model.getPrimitiveVector()) {
            p.movePrimitive(dx, dy);
        }
        this.offsetX = targetOffsetX;
        this.offsetY = targetOffsetY;
        this.model.setChanged(true);
    }

    /** Render the green ghost. Caller is responsible for the surrounding alpha. */
    draw(gi: GraphicsInterface, cs: MapCoordinates): void {
        if (!this._active) return;
        this.drawing.draw(gi, cs);
    }

    /** The clipboard text as it was received (unchanged by the drag). */
    getOriginalText(): string {
        return this.originalText;
    }

    /** Total offset to apply to the committed copy of the original text. */
    getOffset(): { dx: number; dy: number } {
        return { dx: this.offsetX, dy: this.offsetY };
    }

    /** Leave placement mode and release the transient primitives. */
    end(): void {
        this._active = false;
        this.model.getPrimitiveVector().length = 0;
    }
}
