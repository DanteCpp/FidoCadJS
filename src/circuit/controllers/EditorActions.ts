/**
 * @file EditorActions.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief High-level editor operations (open, save, clipboard, zoom)
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

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
    private readonly undoActions: UndoActions;
    private readonly selectionActions: SelectionActions;
    public selTolerance: number = 10;

    constructor(model: DrawingModel, selectionActions: SelectionActions, undoActions: UndoActions) {
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

        this.undoActions.saveUndoState();

        const ix = first.getFirstPoint().x;
        const iy = first.getFirstPoint().y;

        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                prim.rotatePrimitive(false, ix, iy);
            }
        }
    }

    /** Mirror all selected primitives horizontally */
    mirrorAllSelected(): void {
        const first = this.selectionActions.getFirstSelectedPrimitive();
        if (!first) return;

        this.undoActions.saveUndoState();

        const ix = first.getFirstPoint().x;

        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                prim.mirrorPrimitive(ix);
            }
        }
    }

    /** Move all selected primitives by dx, dy.
     *  @param saveState  Pass false when the caller already saved undo state. */
    moveAllSelected(dx: number, dy: number, saveState: boolean = true): void {
        if (saveState) {
            this.undoActions.saveUndoState();
        }
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                prim.movePrimitive(dx, dy);
            }
        }
    }

    /** Delete all selected primitives */
    deleteAllSelected(saveState: boolean): void {
        if (saveState) {
            this.undoActions.saveUndoState();
        }
        const v = this.model.getPrimitiveVector();
        for (let i = v.length - 1; i >= 0; i--) {
            if (v[i].isSelected()) {
                v.splice(i, 1);
            }
        }
    }

    /** Set layer for selected primitives */
    setLayerForSelectedPrimitives(layer: number): boolean {
        const hasSelected = this.model
            .getPrimitiveVector()
            .some((p) => p.isSelected() && !(p instanceof PrimitiveMacro));
        if (!hasSelected) return false;

        this.undoActions.saveUndoState();

        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected() && !(prim instanceof PrimitiveMacro)) {
                prim.setLayer(layer);
            }
        }
        this.model.sortPrimitiveLayers();
        this.model.setChanged(true);
        return true;
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
            if (
                layer >= layerV.length ||
                layerV[layer].isVisible() ||
                prim instanceof PrimitiveMacro
            ) {
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
            if (
                (layer >= layerV.length ||
                    layerV[layer].isVisible() ||
                    prim instanceof PrimitiveMacro) &&
                prim.selectRect(px, py, w, h)
            ) {
                selected = true;
            }
        }
        return selected;
    }

    /** Align selected primitives to leftmost position */
    alignLeftSelected(): void {
        let leftmost = Number.MAX_VALUE;
        let hasSelected = false;
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                hasSelected = true;
                const x = prim.getPosition().x;
                if (x < leftmost) leftmost = x;
            }
        }
        if (!hasSelected) return;
        this.undoActions.saveUndoState();
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                const dx = leftmost - prim.getPosition().x;
                prim.movePrimitive(dx, 0);
            }
        }
    }

    /** Align selected primitives to rightmost position */
    alignRightSelected(): void {
        let rightmost = Number.MIN_VALUE;
        let hasSelected = false;
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                hasSelected = true;
                const x = prim.getPosition().x + prim.getSize().width;
                if (x > rightmost) rightmost = x;
            }
        }
        if (!hasSelected) return;
        this.undoActions.saveUndoState();
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                const dx = rightmost - (prim.getPosition().x + prim.getSize().width);
                prim.movePrimitive(dx, 0);
            }
        }
    }

    /** Align selected primitives to topmost position */
    alignTopSelected(): void {
        let topmost = Number.MAX_VALUE;
        let hasSelected = false;
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                hasSelected = true;
                const y = prim.getPosition().y;
                if (y < topmost) topmost = y;
            }
        }
        if (!hasSelected) return;
        this.undoActions.saveUndoState();
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                const dy = topmost - prim.getPosition().y;
                prim.movePrimitive(0, dy);
            }
        }
    }

    /** Align selected primitives to bottommost position */
    alignBottomSelected(): void {
        let bottommost = Number.MIN_VALUE;
        let hasSelected = false;
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                hasSelected = true;
                const y = prim.getPosition().y + prim.getSize().height;
                if (y > bottommost) bottommost = y;
            }
        }
        if (!hasSelected) return;
        this.undoActions.saveUndoState();
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                const dy = bottommost - (prim.getPosition().y + prim.getSize().height);
                prim.movePrimitive(0, dy);
            }
        }
    }

    /** Align selected primitives to horizontal center of the selection bounding box. */
    alignHorizontalCenterSelected(): void {
        let minX = Number.MAX_VALUE;
        let maxX = Number.MIN_VALUE;
        let hasSelected = false;
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                hasSelected = true;
                const x = prim.getPosition().x;
                const x2 = x + prim.getSize().width;
                if (x < minX) minX = x;
                if (x2 > maxX) maxX = x2;
            }
        }
        if (!hasSelected) return;
        const centerX = (minX + maxX) / 2;
        this.undoActions.saveUndoState();
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                const primCenter = prim.getPosition().x + prim.getSize().width / 2;
                const dx = centerX - primCenter;
                prim.movePrimitive(dx, 0);
            }
        }
    }

    /** Align selected primitives to vertical center of the selection bounding box. */
    alignVerticalCenterSelected(): void {
        let minY = Number.MAX_VALUE;
        let maxY = Number.MIN_VALUE;
        let hasSelected = false;
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                hasSelected = true;
                const y = prim.getPosition().y;
                const y2 = y + prim.getSize().height;
                if (y < minY) minY = y;
                if (y2 > maxY) maxY = y2;
            }
        }
        if (!hasSelected) return;
        const centerY = (minY + maxY) / 2;
        this.undoActions.saveUndoState();
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                const primCenter = prim.getPosition().y + prim.getSize().height / 2;
                const dy = centerY - primCenter;
                prim.movePrimitive(0, dy);
            }
        }
    }

    /** Distribute selected primitives evenly between the leftmost and rightmost X positions. */
    distributeHorizontallySelected(): void {
        const selected: GraphicPrimitive[] = [];
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) selected.push(prim);
        }
        if (selected.length < 3) return; // Need at least 3 to distribute

        // Sort by X position (primary) then Y (secondary)
        selected.sort((a, b) => {
            const dx = a.getPosition().x - b.getPosition().x;
            if (dx !== 0) return dx;
            return a.getPosition().y - b.getPosition().y;
        });

        const firstX = selected[0]!.getPosition().x + selected[0]!.getSize().width / 2;
        const lastX =
            selected[selected.length - 1]!.getPosition().x +
            selected[selected.length - 1]!.getSize().width / 2;
        const step = (lastX - firstX) / (selected.length - 1);

        this.undoActions.saveUndoState();
        for (let i = 1; i < selected.length - 1; i++) {
            const targetX = firstX + step * i;
            const currentX = selected[i]!.getPosition().x + selected[i]!.getSize().width / 2;
            selected[i]!.movePrimitive(targetX - currentX, 0);
        }
    }

    /** Distribute selected primitives evenly between the topmost and bottommost Y positions. */
    distributeVerticallySelected(): void {
        const selected: GraphicPrimitive[] = [];
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) selected.push(prim);
        }
        if (selected.length < 3) return;

        // Sort by Y position (primary) then X (secondary)
        selected.sort((a, b) => {
            const dy = a.getPosition().y - b.getPosition().y;
            if (dy !== 0) return dy;
            return a.getPosition().x - b.getPosition().x;
        });

        const firstY = selected[0]!.getPosition().y + selected[0]!.getSize().height / 2;
        const lastY =
            selected[selected.length - 1]!.getPosition().y +
            selected[selected.length - 1]!.getSize().height / 2;
        const step = (lastY - firstY) / (selected.length - 1);

        this.undoActions.saveUndoState();
        for (let i = 1; i < selected.length - 1; i++) {
            const targetY = firstY + step * i;
            const currentY = selected[i]!.getPosition().y + selected[i]!.getSize().height / 2;
            selected[i]!.movePrimitive(0, targetY - currentY);
        }
    }
}
