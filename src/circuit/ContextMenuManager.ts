import { getString } from '../i18n/i18n.js';
import { ContextMenu } from '../ui/ContextMenu.js';
import { PrimitiveMacro } from '../primitives/PrimitiveMacro.js';
import { PrimitivePolygon } from '../primitives/PrimitivePolygon.js';
import { PrimitiveComplexCurve } from '../primitives/PrimitiveComplexCurve.js';
import type { SelectionActions } from './controllers/SelectionActions.js';
import type { UndoActions } from './controllers/UndoActions.js';
import type { MapCoordinates } from '../geom/MapCoordinates.js';
import type { ClipboardController } from './controllers/ClipboardController.js';
import type { GraphicPrimitive } from '../primitives/GraphicPrimitive.js';

export interface ContextMenuCallbacks {
    onPropertiesRequested: ((prim: GraphicPrimitive) => void) | null;
    onBatchPropertiesRequested: ((prims: GraphicPrimitive[]) => void) | null;
    onSymbolizeRequested: (() => void) | null;
    onRender: () => void;
    copySelected: () => void;
    cutSelected: () => void;
    paste: () => Promise<void>;
    duplicateSelected: () => void;
    selectAll: () => void;
    startMoveSelected: () => void;
    rotateSelected: () => void;
    mirrorSelected: () => void;
    vectorizeMacro: () => void;
}

export class ContextMenuManager {
    private contextMenu: ContextMenu;
    private selectionActions: SelectionActions;
    private undoActions: UndoActions;
    private mapCoordinates: MapCoordinates;
    private clipboardController: ClipboardController;
    private callbacks: ContextMenuCallbacks;
    private canvas: HTMLCanvasElement;

    constructor(
        contextMenu: ContextMenu,
        selectionActions: SelectionActions,
        undoActions: UndoActions,
        mapCoordinates: MapCoordinates,
        clipboardController: ClipboardController,
        canvas: HTMLCanvasElement,
        callbacks: ContextMenuCallbacks,
    ) {
        this.contextMenu = contextMenu;
        this.selectionActions = selectionActions;
        this.undoActions = undoActions;
        this.mapCoordinates = mapCoordinates;
        this.clipboardController = clipboardController;
        this.canvas = canvas;
        this.callbacks = callbacks;
    }

    /** Show the context menu at the given screen coordinates. */
    show(clientX: number, clientY: number): void {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        const sx = (clientX - rect.left) * dpr;
        const sy = (clientY - rect.top) * dpr;

        // Store logical (unsnapped) coords for add/remove node
        const contextMenuLogX = this.mapCoordinates.unmapXnosnap(sx);
        const contextMenuLogY = this.mapCoordinates.unmapYnosnap(sy);

        const first = this.selectionActions.getFirstSelectedPrimitive();
        const somethingSelected = first !== null;
        const hasCb = this.clipboardController.canPaste();
        const isNodePrim =
            this.selectionActions.isUniquePrimitiveSelected() &&
            (first instanceof PrimitivePolygon || first instanceof PrimitiveComplexCurve);
        const isMacroPrim =
            this.selectionActions.isUniquePrimitiveSelected() && first instanceof PrimitiveMacro;

        this.contextMenu.show(clientX, clientY, [
            {
                label: getString('Properties'),
                enabled: somethingSelected,
                action: () => {
                    const selected = this.selectionActions.getSelectedPrimitives();
                    if (selected.length > 1) {
                        this.callbacks.onBatchPropertiesRequested?.(selected);
                    } else if (first) {
                        this.callbacks.onPropertiesRequested?.(first);
                    }
                },
            },
            { separator: true },
            {
                label: getString('Cut'),
                enabled: somethingSelected,
                action: () => this.callbacks.cutSelected(),
            },
            {
                label: getString('Copy'),
                enabled: somethingSelected,
                action: () => this.callbacks.copySelected(),
            },
            {
                label: getString('Paste'),
                enabled: hasCb,
                action: () => this.callbacks.paste(),
            },
            {
                label: getString('Duplicate'),
                enabled: somethingSelected,
                action: () => this.callbacks.duplicateSelected(),
            },
            { separator: true },
            {
                label: getString('SelectAll'),
                enabled: true,
                action: () => {
                    this.callbacks.selectAll();
                },
            },
            { separator: true },
            {
                label: getString('Move'),
                enabled: somethingSelected,
                action: () => this.callbacks.startMoveSelected(),
            },
            {
                label: getString('Rotate'),
                enabled: somethingSelected,
                action: () => this.callbacks.rotateSelected(),
            },
            {
                label: getString('Mirror_E'),
                enabled: somethingSelected,
                action: () => this.callbacks.mirrorSelected(),
            },
            {
                label: getString('Symbolize'),
                enabled: somethingSelected,
                visible: somethingSelected && !isMacroPrim,
                action: () => this.callbacks.onSymbolizeRequested?.(),
            },
            {
                label: getString('Unsymbolize'),
                enabled: isMacroPrim,
                visible: isMacroPrim,
                action: () => this.callbacks.vectorizeMacro(),
            },
            { separator: true },
            {
                label: getString('Add_node'),
                enabled: isNodePrim,
                visible: isNodePrim,
                action: () => this.addNodeAt(contextMenuLogX, contextMenuLogY),
            },
            {
                label: getString('Remove_node'),
                enabled: isNodePrim,
                visible: isNodePrim,
                action: () => this.removeNodeAt(contextMenuLogX, contextMenuLogY),
            },
        ]);
    }

    addNodeAt(lx: number, ly: number): void {
        const first = this.selectionActions.getFirstSelectedPrimitive();
        if (!(first instanceof PrimitivePolygon) && !(first instanceof PrimitiveComplexCurve))
            return;
        this.undoActions.saveUndoState();
        first.addPointClosest(lx, ly);
        this.callbacks.onRender();
    }

    removeNodeAt(lx: number, ly: number): void {
        const first = this.selectionActions.getFirstSelectedPrimitive();
        if (!(first instanceof PrimitivePolygon) && !(first instanceof PrimitiveComplexCurve))
            return;
        this.undoActions.saveUndoState();
        first.removePoint(lx, ly, 1);
        this.callbacks.onRender();
    }
}
