import { MapCoordinates } from '../geom/MapCoordinates.js';
import type { DrawingModel } from './model/DrawingModel.js';
import { Ruler } from './Ruler.js';
import { ElementsEdtActions } from './controllers/ElementsEdtActions.js';
import type { EditorActions } from './controllers/EditorActions.js';
import type { UndoActions } from './controllers/UndoActions.js';
import type { SelectionActions } from './controllers/SelectionActions.js';
import { GraphicPrimitive } from '../primitives/GraphicPrimitive.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/** Externally-readable subset of gesture state (used by CircuitPanel.render). */
export interface InputState {
    readonly ghostPrimitive: GraphicPrimitive | null;
    readonly selRectActive: boolean;
    readonly selRectSx2: number;
    readonly selRectSy2: number;
    readonly selStartScreenX: number;
    readonly selStartScreenY: number;
    readonly selRectLtoR: boolean;
    readonly isMovingSelected: boolean;
    readonly ruler: Ruler;
}

/** Callbacks from InputHandler into CircuitPanel. */
export interface InputCallbacks {
    render(): void;
    onZoomChange: (() => void) | null;
    onUndoStateChange: (() => void) | null;
    onCoordinatesChange: ((lx: number, ly: number) => void) | null;
    isTextEditActive(): boolean;
    commitTextEdit(): void;
    getTool(): number;
    setTool(toolId: number): void;
    updateGhostPreview(lx: number, ly: number): void;
    clampCenter(): void;
    showContextMenu(clientX: number, clientY: number): void;
    /** Fired when a selection-mode click on an empty region leaves nothing selected. */
    onSelectionCleared: (() => void) | null;
    /** True while an interactive paste ghost is following the cursor. */
    isPastePlacing(): boolean;
    /** Move the paste ghost to the given (snapped) logical point. */
    updatePastePlacement(lx: number, ly: number): void;
    /** Drop the pasted content at its current ghost position. */
    commitPastePlacement(): void;
    /** Abandon the interactive paste without inserting anything. */
    cancelPastePlacement(): void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DoubleClickDetector — small helper extracted to its own module
// ═══════════════════════════════════════════════════════════════════════════════

class DoubleClickDetector {
    private lastTime = 0;
    private lastSx = 0;
    private lastSy = 0;
    pending = false;

    static readonly TIME_MS = 400;
    static readonly DIST_PX = 5;

    /** Call on every mousedown. Returns true if this mousedown is part of a dblclick pair. */
    detect(sx: number, sy: number): boolean {
        const now = performance.now();
        const timeClose = now - this.lastTime < DoubleClickDetector.TIME_MS;
        const posClose =
            Math.abs(sx - this.lastSx) <= DoubleClickDetector.DIST_PX &&
            Math.abs(sy - this.lastSy) <= DoubleClickDetector.DIST_PX;
        this.pending = timeClose && posClose;
        this.lastTime = now;
        this.lastSx = sx;
        this.lastSy = sy;
        return this.pending;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// InputHandler
// ═══════════════════════════════════════════════════════════════════════════════

export class InputHandler {
    private canvas: HTMLCanvasElement;
    private mapCoords: MapCoordinates;
    private model: DrawingModel;
    private elementsEdt: ElementsEdtActions;
    private editorActions: EditorActions;
    private undoActions: UndoActions;
    private selectionActions: SelectionActions;
    private cb: InputCallbacks;
    private dblClick = new DoubleClickDetector();

    // ── Gesture state ──────────────────────────────────────────────────────

    private _isPanning = false;
    private panStartX = 0;
    private panStartY = 0;
    private panStartCX = 0;
    private panStartCY = 0;

    private _selRectActive = false;
    private selRectLogX1 = 0;
    private selRectLogY1 = 0;
    private selRectLogX2 = 0;
    private selRectLogY2 = 0;
    private _selRectLtoR = false;
    private _selRectSx2 = 0;
    private _selRectSy2 = 0;
    private _selStartScreenX = 0;
    private _selStartScreenY = 0;

    private _dragHandleIndex = GraphicPrimitive.NO_DRAG;
    private _dragHandlePrim: GraphicPrimitive | null = null;
    private _ghostPrimitive: GraphicPrimitive | null = null;
    private lastScreenX = 0;
    private lastScreenY = 0;

    private mouseDownPrimHit: GraphicPrimitive | null = null;
    private isMoveAllDrag = false;
    private moveAllDragLogX = 0;
    private moveAllDragLogY = 0;

    private textEditorJustCommitted = false;

    private _isMovingSelected = false;
    private moveStartLogX = 0;
    private moveStartLogY = 0;

    // Measuring ruler (right-button drag), ported from FidoCadJ.
    private _ruler = new Ruler();
    private rulerArmed = false;
    private rulerDragged = false;

    private static readonly DRAG_THRESHOLD_PX = 5;

    // ── Public state (readonly for CircuitPanel) ───────────────────────────

    get state(): InputState {
        return this; // InputHandler implements InputState getters
    }

    get ghostPrimitive() {
        return this._ghostPrimitive;
    }
    get selRectActive() {
        return this._selRectActive;
    }
    get selRectSx2() {
        return this._selRectSx2;
    }
    get selRectSy2() {
        return this._selRectSy2;
    }
    get selStartScreenX() {
        return this._selStartScreenX;
    }
    get selStartScreenY() {
        return this._selStartScreenY;
    }
    get selRectLtoR() {
        return this._selRectLtoR;
    }
    get isMovingSelected() {
        return this._isMovingSelected;
    }
    get ruler() {
        return this._ruler;
    }

    // ── Constructor ────────────────────────────────────────────────────────

    constructor(
        canvas: HTMLCanvasElement,
        mapCoords: MapCoordinates,
        model: DrawingModel,
        elementsEdt: ElementsEdtActions,
        editorActions: EditorActions,
        undoActions: UndoActions,
        selectionActions: SelectionActions,
        callbacks: InputCallbacks,
    ) {
        this.canvas = canvas;
        this.mapCoords = mapCoords;
        this.model = model;
        this.elementsEdt = elementsEdt;
        this.editorActions = editorActions;
        this.undoActions = undoActions;
        this.selectionActions = selectionActions;
        this.cb = callbacks;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Public mutation methods (called by CircuitPanel)
    // ═══════════════════════════════════════════════════════════════════════════

    /** Reset all gesture/drag/selection state. */
    clearGhostAndSelection(): void {
        this._isMovingSelected = false;
        this.isMoveAllDrag = false;
        this.mouseDownPrimHit = null;
        this._dragHandleIndex = GraphicPrimitive.NO_DRAG;
        this._dragHandlePrim = null;
        this._ghostPrimitive = null;
        this._selRectActive = false;
    }

    /** Enter move-selected mode (called from startMoveSelected). */
    beginMoveSelected(): void {
        const selected = this.selectionActions.getSelectedPrimitives();
        if (selected.length === 0) return;

        this.undoActions.saveUndoState();
        this._isMovingSelected = true;
        this.canvas.style.cursor = 'move';
    }

    /** Update cursor based on current tool. */
    updateCursor(toolId: number): void {
        this.canvas.style.cursor = cursorForTool(toolId);
    }

    /** Set ghost primitive directly (for external reset). */
    setGhostPrimitive(p: GraphicPrimitive | null): void {
        this._ghostPrimitive = p;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Event handlers (attached by CircuitPanel)
    // ═══════════════════════════════════════════════════════════════════════════

    onMouseWheel(e: WheelEvent): void {
        e.preventDefault();
        if (this.cb.isTextEditActive()) {
            this.cb.commitTextEdit();
        }

        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * dpr;
        const my = (e.clientY - rect.top) * dpr;

        const oldZ = this.mapCoords.getXMagnitude();
        const newZ = Math.max(
            MapCoordinates.MIN_MAGNITUDE,
            Math.min(MapCoordinates.MAX_MAGNITUDE, oldZ * factor),
        );
        const scale = newZ / oldZ;

        this.mapCoords.setXCenter(mx - (mx - this.mapCoords.getXCenter()) * scale);
        this.mapCoords.setYCenter(my - (my - this.mapCoords.getYCenter()) * scale);
        this.cb.clampCenter();
        this.mapCoords.setXMagnitudeNoCheck(newZ);
        this.mapCoords.setYMagnitudeNoCheck(newZ);
        this.cb.render();
        this.cb.onZoomChange?.();
    }

    onMouseDown(e: MouseEvent): void {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        const sx = (e.clientX - rect.left) * dpr;
        const sy = (e.clientY - rect.top) * dpr;
        const lx = this.mapCoords.unmapXsnap(sx);
        const ly = this.mapCoords.unmapYsnap(sy);

        this.dblClick.detect(sx, sy);

        // Interactive paste mode owns the press entirely: a left click commits and
        // a right click cancels (both resolved on release). Swallow the press here
        // so it can't start a rubber-band, pan, or ruler gesture underneath.
        if (this.cb.isPastePlacing()) {
            return;
        }

        // A new press clears any measurement left on screen from a previous
        // right-button drag (matches FidoCadJ, which deactivates the ruler at
        // the start of every mouse press).
        if (this._ruler.isActive()) {
            this._ruler.setActive(false);
            this.cb.render();
        }

        if (this._isMovingSelected && e.button === 0) {
            this.moveStartLogX = lx;
            this.moveStartLogY = ly;
            return;
        }

        const tool = this.cb.getTool();

        if (tool === ElementsEdtActions.ZOOM) {
            this.zoomAtCursor(sx, sy, e.button === 2 ? 1 / 1.3 : 1.3);
            return;
        }

        if (e.button === 1 || (e.button === 0 && tool === ElementsEdtActions.HAND)) {
            if (this.cb.isTextEditActive()) this.cb.commitTextEdit();
            this._isPanning = true;
            this.panStartX = e.clientX;
            this.panStartY = e.clientY;
            this.panStartCX = this.mapCoords.getXCenter();
            this.panStartCY = this.mapCoords.getYCenter();
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        if (e.button === 2) {
            // Arm the measuring ruler. It only becomes visible once the user
            // actually drags; a plain right-click falls through to the context
            // menu (handled on the contextmenu event).
            this._ruler.setActive(false);
            this._ruler.setStart(sx, sy);
            this._ruler.setEnd(sx, sy);
            this.rulerArmed = true;
            this.rulerDragged = false;
            this.cb.render();
            return;
        }

        if (e.button === 0) {
            if (this.cb.isTextEditActive()) {
                this.cb.commitTextEdit();
                this.textEditorJustCommitted = true;
                return;
            }

            if (tool === ElementsEdtActions.SELECTION) {
                const handleIdx = this.findHandleAt(sx, sy);
                if (handleIdx !== GraphicPrimitive.NO_DRAG && this._dragHandlePrim !== null) {
                    this.undoActions.saveUndoState();
                    this._dragHandleIndex = handleIdx;
                    return;
                }
                const hitPrim = this.findPrimitiveAt(sx, sy);
                if (hitPrim !== null) {
                    this.mouseDownPrimHit = hitPrim;
                    this.moveAllDragLogX = lx;
                    this.moveAllDragLogY = ly;
                    this._selStartScreenX = sx;
                    this._selStartScreenY = sy;
                    return;
                }
                this._selStartScreenX = sx;
                this._selStartScreenY = sy;
                this._selRectActive = true;
                this.selRectLogX1 = lx;
                this.selRectLogY1 = ly;
                this.selRectLogX2 = lx;
                this.selRectLogY2 = ly;
                this._selRectLtoR = true;
                this._selRectSx2 = sx;
                this._selRectSy2 = sy;
                return;
            }
            this.lastScreenX = sx;
            this.lastScreenY = sy;
        }
    }

    onMouseMove(e: MouseEvent): void {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        const sx = (e.clientX - rect.left) * dpr;
        const sy = (e.clientY - rect.top) * dpr;
        const lx = this.mapCoords.unmapXsnap(sx);
        const ly = this.mapCoords.unmapYsnap(sy);

        this.cb.onCoordinatesChange?.(lx, ly);

        // Interactive paste: the ghost tracks the cursor until the user commits.
        if (this.cb.isPastePlacing()) {
            this.cb.updatePastePlacement(lx, ly);
            this.cb.render();
            return;
        }

        // Measuring ruler: drag with the right button held down.
        if (this.rulerArmed && (e.buttons & 2) !== 0) {
            this._ruler.setEnd(sx, sy);
            this._ruler.setActive(true);
            this.rulerDragged = true;
            this.cb.render();
            return;
        }

        if (this._isMovingSelected) {
            const dx = lx - this.moveStartLogX;
            const dy = ly - this.moveStartLogY;
            if (dx !== 0 || dy !== 0) {
                for (const prim of this.model.getPrimitiveVector()) {
                    if (prim.isSelected()) prim.movePrimitive(dx, dy);
                }
                this.moveStartLogX = lx;
                this.moveStartLogY = ly;
                this.model.setChanged(true);
                this.model.setModified(true);
                this.cb.render();
            }
            return;
        }

        if (this._isPanning) {
            const panDx = (e.clientX - this.panStartX) * dpr;
            const panDy = (e.clientY - this.panStartY) * dpr;
            this.mapCoords.setXCenter(this.panStartCX + panDx);
            this.mapCoords.setYCenter(this.panStartCY + panDy);
            this.cb.clampCenter();
            this.cb.render();
            return;
        }

        if (this.mouseDownPrimHit !== null) {
            if (
                Math.abs(sx - this._selStartScreenX) > InputHandler.DRAG_THRESHOLD_PX ||
                Math.abs(sy - this._selStartScreenY) > InputHandler.DRAG_THRESHOLD_PX
            ) {
                if (!this.mouseDownPrimHit.isSelected()) {
                    if (!e.ctrlKey && !e.metaKey) this.selectionActions.setSelectionAll(false);
                    this.mouseDownPrimHit.setSelected(true);
                    this.model.setChanged(true);
                }
                this.undoActions.saveUndoState();
                this.isMoveAllDrag = true;
                this.mouseDownPrimHit = null;
            }
        }

        if (this.isMoveAllDrag) {
            const dx = lx - this.moveAllDragLogX;
            const dy = ly - this.moveAllDragLogY;
            if (dx !== 0 || dy !== 0) {
                for (const prim of this.model.getPrimitiveVector()) {
                    if (prim.isSelected()) prim.movePrimitive(dx, dy);
                }
                this.moveAllDragLogX = lx;
                this.moveAllDragLogY = ly;
                this.model.setChanged(true);
                this.model.setModified(true);
                this.cb.render();
            }
            return;
        }

        if (this._selRectActive) {
            this.selRectLogX2 = lx;
            this.selRectLogY2 = ly;
            this._selRectSx2 = sx;
            this._selRectSy2 = sy;
            this._selRectLtoR = sx >= this._selStartScreenX;
            this.cb.render();
            return;
        }

        if (this._dragHandleIndex !== GraphicPrimitive.NO_DRAG && this._dragHandlePrim !== null) {
            const pt = this._dragHandlePrim.virtualPoint[this._dragHandleIndex];
            if (pt) {
                pt.x = lx;
                pt.y = ly;
                this._dragHandlePrim.setChanged(true);
                this.model.setChanged(true);
                this.model.setModified(true);
                this.cb.render();
            }
            return;
        }

        const hadGhost = this._ghostPrimitive !== null;
        this.cb.updateGhostPreview(lx, ly);
        // Repaint when the ghost appears, moves, OR was just cleared — otherwise a
        // stale ghost lingers on screen until some other event triggers a render.
        if (this._ghostPrimitive !== null || hadGhost) {
            this.cb.render();
        }
    }

    onMouseUp(e: MouseEvent, isLeave = false): void {
        if (this.textEditorJustCommitted) {
            this.textEditorJustCommitted = false;
            return;
        }

        // Interactive paste: a genuine left click drops the content where the
        // ghost sits; a right click abandons it. mouseleave must do neither.
        if (this.cb.isPastePlacing()) {
            if (isLeave) return;
            if (e.button === 0) {
                this.cb.commitPastePlacement();
            } else if (e.button === 2) {
                this.cb.cancelPastePlacement();
            }
            return;
        }

        // Right-button release ends a ruler gesture. If the user dragged, the
        // measurement stays on screen until the next press. Otherwise this was a
        // plain right-click: cancel the active drawing tool, or pop the context
        // menu when in selection mode (decided here, not on the contextmenu
        // event, which fires too early to tell a click from a drag).
        if (e.button === 2) {
            this.rulerArmed = false;
            if (!this.rulerDragged) {
                const t = this.cb.getTool();
                if (t !== ElementsEdtActions.SELECTION) {
                    this.cb.setTool(ElementsEdtActions.SELECTION);
                    this.cb.render();
                } else {
                    this.cb.showContextMenu(e.clientX, e.clientY);
                }
            }
            this.rulerDragged = false;
            return;
        }

        const tool = this.cb.getTool();

        if (this._isMovingSelected) {
            this._isMovingSelected = false;
            this.updateCursor(tool);
            this.cb.onUndoStateChange?.();
            return;
        }

        if (this._isPanning) {
            this._isPanning = false;
            this.updateCursor(tool);
            return;
        }

        if (this.mouseDownPrimHit !== null) {
            this.editorActions.handleSelection(
                this.mapCoords,
                this._selStartScreenX,
                this._selStartScreenY,
                e.ctrlKey || e.metaKey,
            );
            this.mouseDownPrimHit = null;
            this.cb.render();
            return;
        }

        if (this.isMoveAllDrag) {
            this.isMoveAllDrag = false;
            this.cb.render();
            return;
        }

        if (this._selRectActive) {
            const dpr = window.devicePixelRatio || 1;
            const canvasRect = this.canvas.getBoundingClientRect();
            const upSx = (e.clientX - canvasRect.left) * dpr;
            const upSy = (e.clientY - canvasRect.top) * dpr;
            const isClick =
                Math.abs(upSx - this._selStartScreenX) <= InputHandler.DRAG_THRESHOLD_PX &&
                Math.abs(upSy - this._selStartScreenY) <= InputHandler.DRAG_THRESHOLD_PX;
            if (isClick) {
                this.editorActions.handleSelection(
                    this.mapCoords,
                    this._selStartScreenX,
                    this._selStartScreenY,
                    e.ctrlKey || e.metaKey,
                );
                // Clicking an empty region leaves nothing selected: close the
                // properties sidebar so it doesn't linger on a stale primitive.
                if (this.selectionActions.getSelectedPrimitives().length === 0) {
                    this.cb.onSelectionCleared?.();
                }
            } else {
                const x1 = Math.min(this.selRectLogX1, this.selRectLogX2);
                const y1 = Math.min(this.selRectLogY1, this.selRectLogY2);
                const w = Math.abs(this.selRectLogX2 - this.selRectLogX1);
                const h = Math.abs(this.selRectLogY2 - this.selRectLogY1);
                this.editorActions.selectRect(x1, y1, w, h);
            }
            this._selRectActive = false;
            this.cb.render();
            return;
        }

        if (this._dragHandleIndex !== GraphicPrimitive.NO_DRAG) {
            this._dragHandleIndex = GraphicPrimitive.NO_DRAG;
            this._dragHandlePrim = null;
            this.cb.render();
            return;
        }

        if (this.dblClick.pending) {
            this.dblClick.pending = false;
            return;
        }

        // Click-to-place only on a genuine button release inside the canvas.
        // mouseleave reuses this handler to terminate gestures, but must NOT
        // re-fire placement at the stale mousedown coordinates. Likewise, never
        // place while the in-place text editor is open.
        if (!isLeave && tool !== ElementsEdtActions.SELECTION && !this.cb.isTextEditActive()) {
            const repaint = this.elementsEdt.handleClick(
                this.mapCoords,
                this.lastScreenX,
                this.lastScreenY,
                false,
                false,
                false,
            );
            if (repaint) this.cb.render();
        }
    }

    onDoubleClick(e: MouseEvent): void {
        if (this.cb.isTextEditActive()) {
            this.cb.commitTextEdit();
            return;
        }

        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        const sx = (e.clientX - rect.left) * dpr;
        const sy = (e.clientY - rect.top) * dpr;

        const repaint = this.elementsEdt.handleClick(
            this.mapCoords,
            sx,
            sy,
            false,
            e.ctrlKey || e.metaKey,
            true,
        );
        if (repaint) this.cb.render();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Private helpers
    // ═══════════════════════════════════════════════════════════════════════════

    private findHandleAt(sx: number, sy: number): number {
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                const handleIdx = prim.onHandle(this.mapCoords, sx, sy);
                if (handleIdx !== GraphicPrimitive.NO_DRAG) {
                    this._dragHandlePrim = prim;
                    return handleIdx;
                }
            }
        }
        this._dragHandlePrim = null;
        return GraphicPrimitive.NO_DRAG;
    }

    private findPrimitiveAt(sx: number, sy: number): GraphicPrimitive | null {
        const px = this.mapCoords.unmapXnosnap(sx);
        const py = this.mapCoords.unmapYnosnap(sy);
        const toll =
            this.mapCoords.unmapXnosnap(sx + this.editorActions.selTolerance) -
            this.mapCoords.unmapXnosnap(sx);
        const tolerance = toll < 2 ? 2 : toll;
        const layerV = this.model.getLayers();

        let minDist = Number.MAX_VALUE;
        let closest: GraphicPrimitive | null = null;
        for (const prim of this.model.getPrimitiveVector()) {
            if (!isVisibleForSelection(prim, layerV)) continue;
            const dist = prim.getDistanceToPoint(px, py);
            if (dist < tolerance && dist < minDist) {
                minDist = dist;
                closest = prim;
            }
        }
        return closest;
    }

    private zoomAtCursor(sx: number, sy: number, factor: number): void {
        const oldZ = this.mapCoords.getXMagnitude();
        const newZ = Math.max(
            MapCoordinates.MIN_MAGNITUDE,
            Math.min(MapCoordinates.MAX_MAGNITUDE, oldZ * factor),
        );
        const scale = newZ / oldZ;

        this.mapCoords.setXCenter(sx - (sx - this.mapCoords.getXCenter()) * scale);
        this.mapCoords.setYCenter(sy - (sy - this.mapCoords.getYCenter()) * scale);
        this.cb.clampCenter();
        this.mapCoords.setXMagnitudeNoCheck(newZ);
        this.mapCoords.setYMagnitudeNoCheck(newZ);
        this.cb.render();
        this.cb.onZoomChange?.();
    }
}

function isVisibleForSelection(
    prim: GraphicPrimitive,
    layerV: ReturnType<DrawingModel['getLayers']>,
): boolean {
    const layer = prim.getLayer();
    if (layer >= 0 && layer < layerV.length) return layerV[layer]!.isVisible();
    for (let i = 0; i < layerV.length; i++) {
        if (prim.containsLayer(i)) return layerV[i]!.isVisible();
    }
    return layer >= layerV.length;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Standalone helper (no longer a CircuitPanel method)
// ═══════════════════════════════════════════════════════════════════════════════

export function cursorForTool(toolId: number): string {
    switch (toolId) {
        case ElementsEdtActions.HAND:
            return 'grab';
        case ElementsEdtActions.ZOOM:
            return 'zoom-in';
        case ElementsEdtActions.SELECTION:
            return 'default';
        default:
            return 'crosshair';
    }
}
