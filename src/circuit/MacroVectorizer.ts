/**
 * @file MacroVectorizer.ts
 * @author Dante Loi
 * @date 2026-05-13
 * @brief Macro vectorization logic extracted from CircuitPanel
 * @copyright Copyright 2026 Dante Loi - GPL v3
 * @details Converts a selected macro instance back into individual primitives.
 *          Extracted mechanically during agent-friendly refactoring (P2.7).
 */

import { DrawingModel } from './model/DrawingModel.js';
import { ParserActions } from './controllers/ParserActions.js';
import { PrimitiveMacro } from '../primitives/PrimitiveMacro.js';
import { PrimitiveAdvText } from '../primitives/PrimitiveAdvText.js';
import type { SelectionActions } from './controllers/SelectionActions.js';
import type { UndoActions } from './controllers/UndoActions.js';

export class MacroVectorizer {
    private model: DrawingModel;
    private selectionActions: SelectionActions;
    private undoActions: UndoActions;
    private onRender: () => void;

    constructor(
        model: DrawingModel,
        selectionActions: SelectionActions,
        undoActions: UndoActions,
        onRender: () => void
    ) {
        this.model = model;
        this.selectionActions = selectionActions;
        this.undoActions = undoActions;
        this.onRender = onRender;
    }

    /** Convert a selected macro instance back into individual primitives. */
    vectorize(): void {
        const first = this.selectionActions.getFirstSelectedPrimitive();
        if (!(first instanceof PrimitiveMacro)) return;

        const macroDesc = first.getMacroDesc();
        if (!macroDesc) return;

        // Get the macro's position, orientation and mirror state
        const posX = first.virtualPoint[0]!.x;
        const posY = first.virtualPoint[0]!.y;
        const orientation = first.getOrientation();
        const mirrored = first.isMirrored();
        const layer = first.getLayer();

        // Parse the macro description into a temp DrawingModel
        const tempModel = new DrawingModel();
        tempModel.setLibrary(this.model.getLibrary());
        tempModel.setLayers(this.model.getLayers());
        const tempParser = new ParserActions(tempModel);
        tempParser.addString(macroDesc, false);

        // Save pre-vectorize state so the entire operation can be undone in one step.
        this.undoActions.saveUndoState();

        // Move and transform each primitive from the macro to the canvas position
        for (const prim of tempModel.getPrimitiveVector()) {
            if (!prim.virtualPoint[0]) continue;

            // Macro primitives are stored in a local coordinate system with origin at (100, 100).
            // Compute the primitive's position relative to the macro origin, apply
            // mirror/rotation, then place it at the macro's global position.
            let relX = prim.virtualPoint[0].x - 100;
            let relY = prim.virtualPoint[0].y - 100;

            // Apply mirror if needed
            if (mirrored) {
                relX = -relX;
            }

            // Apply orientation rotation (0=0°, 1=90°, 2=180°, 3=270°)
            switch (orientation) {
                case 1:
                    [relX, relY] = [-relY, relX];
                    break;
                case 2:
                    relX = -relX; relY = -relY;
                    break;
                case 3:
                    [relX, relY] = [relY, -relX];
                    break;
            }

            // Move the primitive so its first control point lands at the transformed position.
            // Also rotate the primitive itself if it's text (other types don't have orientation).
            const targetX = posX + relX;
            const targetY = posY + relY;
            const dx = targetX - prim.virtualPoint[0].x;
            const dy = targetY - prim.virtualPoint[0].y;
            prim.movePrimitive(dx, dy);

            // For text primitives, also apply the macro's orientation rotation to the text itself
            if (prim instanceof PrimitiveAdvText) {
                prim.setOrientation((prim.getOrientation() + orientation * 90) % 360);
            }

            prim.setLayer(layer);
            this.model.addPrimitive(prim, false, null);
        }

        // Remove the original macro primitive
        const idx = this.model.getPrimitiveVector().indexOf(first);
        if (idx >= 0) this.model.getPrimitiveVector().splice(idx, 1);
        this.onRender();
    }
}
