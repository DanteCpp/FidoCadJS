import { DrawingModel } from './model/DrawingModel.js';
import { ParserActions } from './controllers/ParserActions.js';
import { PrimitiveMacro } from '../primitives/PrimitiveMacro.js';
import { PrimitiveAdvText } from '../primitives/PrimitiveAdvText.js';
import { GraphicPrimitive } from '../primitives/GraphicPrimitive.js';
import { LayerDesc } from '../layers/LayerDesc.js';
import type { MacroDesc } from '../primitives/MacroDesc.js';
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
        onRender: () => void,
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

        const constituents = MacroVectorizer.expandMacro(
            first,
            this.model.getLibrary(),
            this.model.getLayers(),
        );
        if (constituents === null) return;

        // Save pre-vectorize state so the entire operation can be undone in one step.
        this.undoActions.saveUndoState();

        for (const prim of constituents) {
            this.model.addPrimitive(prim, false, null);
        }

        // Remove the original macro primitive
        const idx = this.model.getPrimitiveVector().indexOf(first);
        if (idx >= 0) this.model.getPrimitiveVector().splice(idx, 1);
        this.onRender();
    }

    /**
     * Produce a FidoCadJ document representing the whole drawing with every macro
     * recursively flattened into its constituent primitives. The live model is
     * left untouched — the work happens on a throwaway copy.
     */
    vectorizeAllToString(): string {
        // Copy the current drawing into a scratch model so we never mutate the
        // real one.
        const work = new DrawingModel();
        work.setLibrary(this.model.getLibrary());
        work.setLayers(this.model.getLayers());
        const parser = new ParserActions(work);
        parser.addString(new ParserActions(this.model).getText(true), false);

        // Repeatedly expand macros until none remain. Each pass replaces every
        // top-level macro with its constituents; nested macros surface on the
        // next pass. A generous cap guards against pathological recursion.
        const library = this.model.getLibrary();
        const layers = this.model.getLayers();
        for (let pass = 0; pass < 64; pass++) {
            const vec = work.getPrimitiveVector();
            const macroIdx = vec.findIndex((p) => p instanceof PrimitiveMacro);
            if (macroIdx === -1) break;

            const macro = vec[macroIdx] as PrimitiveMacro;
            const constituents = MacroVectorizer.expandMacro(macro, library, layers);
            vec.splice(macroIdx, 1);
            if (constituents) {
                vec.push(...constituents);
            }
        }

        return '[FIDOCAD]\n' + parser.getText(true);
    }

    /**
     * Expand a single macro instance into its constituent primitives, transformed
     * into the macro's global position/orientation/mirror. Returns null if the
     * macro has no resolvable description; otherwise the (detached) primitives,
     * which the caller is responsible for inserting into a model.
     */
    private static expandMacro(
        macro: PrimitiveMacro,
        library: Map<string, MacroDesc>,
        layers: LayerDesc[],
    ): GraphicPrimitive[] | null {
        const macroDesc = macro.getMacroDesc();
        if (!macroDesc) return null;

        const posX = macro.virtualPoint[0]!.x;
        const posY = macro.virtualPoint[0]!.y;
        const orientation = macro.getOrientation();
        const mirrored = macro.isMirrored();
        const layer = macro.getLayer();

        // Parse the macro description into a temp DrawingModel
        const tempModel = new DrawingModel();
        tempModel.setLibrary(library);
        tempModel.setLayers(layers);
        const tempParser = new ParserActions(tempModel);
        tempParser.addString(macroDesc, false);

        const result: GraphicPrimitive[] = [];
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
                    relX = -relX;
                    relY = -relY;
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

            // Constituents adopt the macro instance's layer (matches the
            // single-macro vectorize behavior). Nested macros surfaced here are
            // flattened on a subsequent pass.
            prim.setLayer(layer);
            result.push(prim);
        }
        return result;
    }
}
