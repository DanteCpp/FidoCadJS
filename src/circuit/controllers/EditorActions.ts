import { DrawingModel } from '../model/DrawingModel.js';
import { UndoActions } from './UndoActions.js';
import { SelectionActions } from './SelectionActions.js';
import { GraphicPrimitive } from '../../primitives/GraphicPrimitive.js';
import { PrimitiveMacro } from '../../primitives/PrimitiveMacro.js';
import { MapCoordinates } from '../../geom/MapCoordinates.js';

/**
 * EditorActions: handles basic editing operations like rotate, mirror, move, delete.
 */
export class EditorActions {
    private readonly model: DrawingModel;
    private readonly undoActions: UndoActions | null;
    private readonly selectionActions: SelectionActions;
    public selTolerance: number = 10;

    constructor(
        model: DrawingModel,
        selectionActions: SelectionActions,
        undoActions: UndoActions | null
    ) {
        this.model = model;
        this.undoActions = undoActions;
        this.selectionActions = selectionActions;
        this.selTolerance = 10;
    }

    /** Set selection tolerance in pixels */
    setSelectionTolerance(s: number): void {
        this.selTolerance = s;
    }

    /** Get selection tolerance in pixels */
    getSelectionTolerance(): number {
        return this.selTolerance;
    }

    /** Rotate all selected primitives 90 degrees clockwise */
    rotateAllSelected(): void {
        const first = this.selectionActions.getFirstSelectedPrimitive();
        if (!first) return;

        const ix = first.getFirstPoint().x;
        const iy = first.getFirstPoint().y;

        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                prim.rotatePrimitive(false, ix, iy);
            }
        }

        this.undoActions?.saveUndoState();
    }

    /** Mirror all selected primitives horizontally */
    mirrorAllSelected(): void {
        const first = this.selectionActions.getFirstSelectedPrimitive();
        if (!first) return;

        const ix = first.getFirstPoint().x;

        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                prim.mirrorPrimitive(ix);
            }
        }

        this.undoActions?.saveUndoState();
    }

    /** Move all selected primitives by dx, dy */
    moveAllSelected(dx: number, dy: number): void {
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                prim.movePrimitive(dx, dy);
            }
        }
        this.undoActions?.saveUndoState();
    }

    /** Delete all selected primitives */
    deleteAllSelected(saveState: boolean): void {
        const v = this.model.getPrimitiveVector();
        for (let i = v.length - 1; i >= 0; i--) {
            if (v[i].isSelected()) {
                v.splice(i, 1);
            }
        }
        if (saveState && this.undoActions) {
            this.undoActions.saveUndoState();
        }
    }

    /** Set layer for selected primitives */
    setLayerForSelectedPrimitives(layer: number): boolean {
        let toRedraw = false;
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected() && !(prim instanceof PrimitiveMacro)) {
                prim.setLayer(layer);
                toRedraw = true;
            }
        }
        if (toRedraw) {
            this.model.sortPrimitiveLayers();
            this.model.setChanged(true);
            this.undoActions?.saveUndoState();
        }
        return toRedraw;
    }

    /** Calculate minimum distance from point to any primitive */
    distancePrimitive(px: number, py: number): number {
        let minDistance = Number.MAX_VALUE;
        const layerV = this.model.getLayers();

        for (const prim of this.model.getPrimitiveVector()) {
            const distance = prim.getDistanceToPoint(px, py);
            if (distance <= minDistance) {
                const layer = prim.getLayer();
                if (layer < layerV.length && layerV[layer].isVisible()) {
                    minDistance = distance;
                }
            }
        }
        return minDistance;
    }

    /** Handle selection at the given screen coordinates */
    handleSelection(cs: MapCoordinates, x: number, y: number, toggle: boolean): void {
        if (!toggle) {
            this.selectionActions.setSelectionAll(false);
        }

        const toll = cs.unmapXnosnap(x + this.selTolerance) - cs.unmapXnosnap(x);
        const tolerance = toll < 2 ? 2 : toll;

        this.selectPrimitive(cs.unmapXnosnap(x), cs.unmapYnosnap(y), tolerance, toggle);
    }

    /** Select primitives close to the given logical point */
    private selectPrimitive(px: number, py: number, tolerance: number, toggle: boolean): boolean {
        let minDistance = Number.MAX_VALUE;
        let gpsel: GraphicPrimitive | null = null;
        const layerV = this.model.getLayers();

        for (const prim of this.model.getPrimitiveVector()) {
            const layer = prim.getLayer();
            if (layer >= layerV.length || layerV[layer].isVisible() || prim instanceof PrimitiveMacro) {
                const distance = prim.getDistanceToPoint(px, py);
                if (distance <= minDistance) {
                    gpsel = prim;
                    minDistance = distance;
                }
            }
        }

        if (minDistance < tolerance && gpsel) {
            if (toggle) {
                gpsel.setSelected(!gpsel.isSelected());
            } else {
                gpsel.setSelected(true);
            }
            return true;
        }
        return false;
    }

    /** Select primitives in a rectangular region */
    selectRect(px: number, py: number, w: number, h: number): boolean {
        if (w < 1 || h < 1) return false;

        let selected = false;
        for (const prim of this.model.getPrimitiveVector()) {
            const layer = prim.getLayer();
            const layerV = this.model.getLayers();
            if ((layer >= layerV.length || layerV[layer].isVisible() || prim instanceof PrimitiveMacro) &&
                prim.selectRect(px, py, w, h)) {
                selected = true;
            }
        }
        return selected;
    }

    /** Align selected primitives to leftmost position */
    alignLeftSelected(): void {
        let leftmost = Number.MAX_VALUE;
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                const x = prim.getPosition().x;
                if (x < leftmost) leftmost = x;
            }
        }
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                const dx = leftmost - prim.getPosition().x;
                prim.movePrimitive(dx, 0);
            }
        }
        this.undoActions?.saveUndoState();
    }

    /** Align selected primitives to rightmost position */
    alignRightSelected(): void {
        let rightmost = Number.MIN_VALUE;
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                const x = prim.getPosition().x + prim.getSize().width;
                if (x > rightmost) rightmost = x;
            }
        }
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                const dx = rightmost - (prim.getPosition().x + prim.getSize().width);
                prim.movePrimitive(dx, 0);
            }
        }
        this.undoActions?.saveUndoState();
    }

    /** Align selected primitives to topmost position */
    alignTopSelected(): void {
        let topmost = Number.MAX_VALUE;
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                const y = prim.getPosition().y;
                if (y < topmost) topmost = y;
            }
        }
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                const dy = topmost - prim.getPosition().y;
                prim.movePrimitive(0, dy);
            }
        }
        this.undoActions?.saveUndoState();
    }

    /** Align selected primitives to bottommost position */
    alignBottomSelected(): void {
        let bottommost = Number.MIN_VALUE;
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                const y = prim.getPosition().y + prim.getSize().height;
                if (y > bottommost) bottommost = y;
            }
        }
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                const dy = bottommost - (prim.getPosition().y + prim.getSize().height);
                prim.movePrimitive(0, dy);
            }
        }
        this.undoActions?.saveUndoState();
    }
}
