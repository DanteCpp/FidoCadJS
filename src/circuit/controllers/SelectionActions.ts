import { DrawingModel } from '../model/DrawingModel.js';
import { GraphicPrimitive } from '../../primitives/GraphicPrimitive.js';
import { PrimitiveMacro } from '../../primitives/PrimitiveMacro.js';

/**
 * SelectionActions: handles selection operations on primitives.
 * This controller manages selecting, deselecting, and querying selection state.
 */
export class SelectionActions {
    private readonly model: DrawingModel;

    constructor(model: DrawingModel) {
        this.model = model;
    }

    /** Get the first selected primitive */
    getFirstSelectedPrimitive(): GraphicPrimitive | null {
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                return prim;
            }
        }
        return null;
    }

    /** Select/deselect all primitives */
    setSelectionAll(state: boolean): void {
        for (const prim of this.model.getPrimitiveVector()) {
            prim.setSelected(state);
        }
    }

    /** Get a list of all selected primitives */
    getSelectedPrimitives(): GraphicPrimitive[] {
        return this.model.getPrimitiveVector().filter(p => p.isSelected());
    }

    /** Check if exactly one primitive is selected */
    isUniquePrimitiveSelected(): boolean {
        let found = false;
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                if (found) return false;
                found = true;
            }
        }
        return found;
    }

    /** Check if selection can be split (contains macros or elements with name/value) */
    selectionCanBeSplitted(): boolean {
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected() &&
                (prim instanceof PrimitiveMacro || prim.hasName() || prim.hasValue())) {
                return true;
            }
        }
        return false;
    }

    /** Get string representation of selected elements */
    getSelectedString(extensions: boolean, pa: import('./ParserActions.js').ParserActions): string {
        let s = '[FIDOCAD]\n';
        s += pa.registerConfiguration(extensions);
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                s += prim.toString(extensions);
            }
        }
        return s;
    }
}
