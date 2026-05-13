/**
 * @file CircuitPanel.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief Main editor panel controller coordinating input, model, and views
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { DrawingModel } from './model/DrawingModel.js';
import { ParserActions } from './controllers/ParserActions.js';
import { MapCoordinates } from '../geom/MapCoordinates.js';
import { GraphicsCanvas } from '../graphic/canvas/GraphicsCanvas.js';
import { ColorCanvas } from '../graphic/canvas/ColorCanvas.js';
import type { ColorInterface } from '../graphic/ColorInterface.js';
import { StandardLayers } from '../layers/StandardLayers.js';
import { Drawing, registerDrawingHooks } from './views/Drawing.js';
import { Export, registerExportHooks } from './views/Export.js';
import { ExportSVG } from '../export/ExportSVG.js';
import { ExportPGF } from '../export/ExportPGF.js';
import { ExportTikZ } from '../export/ExportTikZ.js';
import { TeXMode } from '../graphic/TeXMode.js';
import { renderMixedText } from '../graphic/TeXRenderer.js';
import '../vendor/katex/katex.min.css';
import { DrawingSize } from '../geom/DrawingSize.js';
import { SelectionActions } from './controllers/SelectionActions.js';
import { UndoActions } from './controllers/UndoActions.js';
import { EditorActions } from './controllers/EditorActions.js';
import { ElementsEdtActions } from './controllers/ElementsEdtActions.js';
import { GraphicPrimitive } from '../primitives/GraphicPrimitive.js';
import { PrimitiveAdvText } from '../primitives/PrimitiveAdvText.js';
import { PrimitiveLine } from '../primitives/PrimitiveLine.js';
import { PrimitiveRectangle } from '../primitives/PrimitiveRectangle.js';
import { PrimitiveOval } from '../primitives/PrimitiveOval.js';
import { PrimitivePCBLine } from '../primitives/PrimitivePCBLine.js';
import { PrimitiveMacro } from '../primitives/PrimitiveMacro.js';
import { PrimitivePolygon } from '../primitives/PrimitivePolygon.js';
import { PrimitiveComplexCurve } from '../primitives/PrimitiveComplexCurve.js';
import { PrimitiveBezier } from '../primitives/PrimitiveBezier.js';
import { InPlaceTextEditor } from '../ui/InPlaceTextEditor.js';
import { ContextMenu } from '../ui/ContextMenu.js';
import { AddElements } from './controllers/AddElements.js';
import { MenuBar } from '../ui/MenuBar.js';
import { KeyboardController } from './controllers/KeyboardController.js';
import type { KeyboardHost } from './KeyboardHost.js';
import type { EditorFacade } from './EditorFacade.js';
import { ClipboardController } from './controllers/ClipboardController.js';
import { CanvasManager } from './CanvasManager.js';
import { GhostPreview } from './GhostPreview.js';
import { TeXOverlay } from './views/TeXOverlay.js';
import { MacroVectorizer } from './MacroVectorizer.js';
import { ContextMenuManager } from './ContextMenuManager.js';
import { ExportFacade } from '../export/ExportFacade.js';
import { createEditorServices } from './services.js';

export class CircuitPanel implements KeyboardHost, EditorFacade {
    private container: HTMLElement;
    private canvasManager: CanvasManager;
    private ghostPreview: GhostPreview;
    private texOverlayManager: TeXOverlay;
    private exportFacade: ExportFacade;
    private macroVectorizer: MacroVectorizer;
    private contextMenuManager: ContextMenuManager;
    private canvas: HTMLCanvasElement;
    private ctx: GraphicsCanvas;
    private model: DrawingModel;
    private parserActions: ParserActions;
    private mapCoordinates: MapCoordinates;
    private gridVisible: boolean = true;
    private backgroundColor: string = '#ffffff';
    private gridColor: string = '#6464c8';
    private selectionLTRColor: string = '#008000';
    private selectionRTLColor: string = '#0000ff';
    private renderTeX: boolean = false;
    private texOverlay: HTMLDivElement;
    private drawing: Drawing;
    private isPanning: boolean = false;
    private panStartX: number = 0;
    private panStartY: number = 0;
    private panStartCX: number = 0;
    private panStartCY: number = 0;

    private selectionActions!: SelectionActions;
    private undoActions!: UndoActions;
    private editorActions!: EditorActions;
    private elementsEdt!: ElementsEdtActions;

    private currentTool: number = ElementsEdtActions.SELECTION;
    private selRectActive: boolean = false;
    private selRectLogX1: number = 0;
    private selRectLogY1: number = 0;
    private selRectLogX2: number = 0;
    private selRectLogY2: number = 0;
    private selRectLtoR: boolean = false;
    private selRectSx2: number = 0;
    private selRectSy2: number = 0;
    private dragHandleIndex: number = GraphicPrimitive.NO_DRAG;
    private dragHandlePrim: GraphicPrimitive | null = null;
    private ghostPrimitive: GraphicPrimitive | null = null;
    private lastScreenX: number = 0;
    private lastScreenY: number = 0;
    private textEditDialog: InPlaceTextEditor;
    private mouseDownPrimHit: GraphicPrimitive | null = null;
    private isMoveAllDrag: boolean = false;
    private moveAllDragLogX: number = 0;
    private moveAllDragLogY: number = 0;
    private selStartScreenX: number = 0;
    private selStartScreenY: number = 0;
    private static readonly DRAG_THRESHOLD_PX = 5;
    private textEditorJustCommitted: boolean = false;

    onZoomChange: (() => void) | null = null;
    onToolChange: ((toolId: number) => void) | null = null;
    onUndoStateChange: (() => void) | null = null;
    onCoordinatesChange: ((lx: number, ly: number) => void) | null = null;
    onPropertiesRequested: ((prim: GraphicPrimitive) => void) | null = null;
    onTextEditRequested: ((prim: PrimitiveAdvText, sx: number, sy: number) => void) | null = null;
    onExistingTextEditRequested: ((prim: PrimitiveAdvText) => void) | null = null;
    onSymbolizeRequested: (() => void) | null = null;
    onCancelTextEdit: (() => void) | null = null;

    private lastMouseDownTime: number = 0;
    private lastMouseDownSx: number = 0;
    private lastMouseDownSy: number = 0;
    private pendingDblClick = false;
    private static readonly DBLCLICK_TIME_MS = 400;
    private static readonly DBLCLICK_DIST_PX = 5;

    private clipboardController: ClipboardController;
    private keyboardController: KeyboardController;
    private contextMenu!: ContextMenu;
    private menuBar: MenuBar | null = null;
    private isMovingSelected: boolean = false;
    private moveStartLogX: number = 0;
    private moveStartLogY: number = 0;

    constructor(container: HTMLElement) {
        this.container = container;
        // Wire up static hooks for PrimitiveMacro rendering and exporting
        registerDrawingHooks();
        registerExportHooks();

        // Create all editor services via factory (explicit dependency graph)
        const services = createEditorServices();
        this.model = services.model;
        this.mapCoordinates = services.mapCoordinates;
        this.parserActions = services.parserActions;
        this.selectionActions = services.selectionActions;
        this.undoActions = services.undoActions;
        this.editorActions = services.editorActions;
        this.elementsEdt = services.elementsEdt;
        this.clipboardController = services.clipboardController;

        // Create canvas via CanvasManager (must happen early)
        this.canvasManager = new CanvasManager(container);
        this.canvas = this.canvasManager.canvas;
        this.canvasManager.setOnResize(() => {
            this.clampCenter();
            this.render();
        });

        // Initialize ghost preview generator
        this.ghostPreview = new GhostPreview();

        // Initialize graphics context
        this.ctx = new GraphicsCanvas(this.canvas);
        this.ctx.setZoom(1);

        // Wire up callbacks from ElementsEdtActions
        this.elementsEdt.onTextEditRequested = (prim, sx, sy) => {
            this.onTextEditRequested?.(prim, sx, sy);
        };
        this.elementsEdt.onPropertiesRequested = (prim) => {
            this.onPropertiesRequested?.(prim);
        };
        this.elementsEdt.onExistingTextEditRequested = (prim) => {
            this.onExistingTextEditRequested?.(prim);
        };
        // Initialize drawing view
        this.drawing = new Drawing(this.model);

        // Initialize text edit dialog
        this.textEditDialog = new InPlaceTextEditor();

        // Initialize context menu — mount on body to avoid overflow:hidden clipping
        this.contextMenu = new ContextMenu();

        // Wire clipboard callbacks (controller already created by services factory)
        this.clipboardController.onRenderRequested = () => this.render();
        this.clipboardController.onUndoStateChange = () => this.onUndoStateChange?.();

        // Initialize extracted managers
        this.exportFacade = new ExportFacade(this.model);
        this.macroVectorizer = new MacroVectorizer(
            this.model, this.selectionActions, this.undoActions, () => this.render()
        );
        this.contextMenuManager = new ContextMenuManager(
            this.contextMenu, this.selectionActions, this.undoActions,
            this.mapCoordinates, this.clipboardController,
            {
                onPropertiesRequested: (prim) => this.onPropertiesRequested?.(prim),
                onSymbolizeRequested: () => this.onSymbolizeRequested?.(),
                onRender: () => this.render(),
                copySelected: () => this.copySelected(),
                cutSelected: () => this.cutSelected(),
                paste: () => this.paste(),
                duplicateSelected: () => this.duplicateSelected(),
                selectAll: () => this.selectAll(),
                startMoveSelected: () => this.startMoveSelected(),
                rotateSelected: () => this.rotateSelected(),
                mirrorSelected: () => this.mirrorSelected(),
                vectorizeMacro: () => this.vectorizeSelectedMacro(),
            }
        );

        // Initialize keyboard controller
        this.keyboardController = new KeyboardController(
            this, this.clipboardController
        );

        // Set initial cursor
        this.canvas.style.cursor = this.cursorForTool(this.currentTool);

        // Make canvas focusable for keyboard events
        this.canvas.setAttribute('tabIndex', '0');
        this.canvas.addEventListener('mousedown', () => this.canvas.focus());

        // Prevent browser default context menu; show custom one in SELECTION mode
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            // If a drawing tool is active, right-click cancels it (already dispatched
            // via onMouseDown to handleClick). Sync the UI toolbar state and do NOT
            // show the context menu.
            if (this.currentTool !== ElementsEdtActions.SELECTION) {
                this.setTool(ElementsEdtActions.SELECTION);
                this.render();
            } else {
                this.contextMenuManager.show(e.clientX, e.clientY);
            }
        });

        // Mouse wheel zoom (toward cursor)
        this.canvas.addEventListener('wheel', (e) => this.onMouseWheel(e), { passive: false });

        // Drag-to-pan
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));

        // TeX overlay — positioned on top of canvas for crisp math rendering
        this.texOverlay = document.createElement('div');
        this.texOverlay.style.cssText =
            'position: absolute; top: 0; left: 0; width: 100%; height: 100%; ' +
            'pointer-events: none; overflow: hidden; z-index: 1; display: none;';
        this.texOverlay.setAttribute('aria-hidden', 'true');
        container.style.position = 'relative';
        container.appendChild(this.texOverlay);

        this.texOverlayManager = new TeXOverlay(this.texOverlay);
    }

    /** Remove all global listeners and observers. Call when the panel is unmounted. */
    destroy(): void {
        this.keyboardController.detach();
        this.canvasManager.destroy();
    }

    private onMouseWheel(e: WheelEvent): void {
        e.preventDefault();

        // Commit in-place text edit if active before zooming
        if (this.textEditDialog.isActive()) {
            this.textEditDialog.commit();
        }

        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const mx = (e.clientX - rect.left) * dpr;
        const my = (e.clientY - rect.top) * dpr;

        const oldZ = this.mapCoordinates.getXMagnitude();
        const newZ = Math.max(
            MapCoordinates.MIN_MAGNITUDE,
            Math.min(MapCoordinates.MAX_MAGNITUDE, oldZ * factor)
        );
        const scale = newZ / oldZ;

        this.mapCoordinates.setXCenter(mx - (mx - this.mapCoordinates.getXCenter()) * scale);
        this.mapCoordinates.setYCenter(my - (my - this.mapCoordinates.getYCenter()) * scale);
        this.clampCenter();
        this.mapCoordinates.setXMagnitudeNoCheck(newZ);
        this.mapCoordinates.setYMagnitudeNoCheck(newZ);
        this.render();
        this.onZoomChange?.();
    }

    private onMouseDown(e: MouseEvent): void {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        const sx = (e.clientX - rect.left) * dpr;
        const sy = (e.clientY - rect.top) * dpr;
        const lx = this.mapCoordinates.unmapXsnap(sx);
        const ly = this.mapCoordinates.unmapYsnap(sy);

        // Detect potential double-click: if two mousedowns happen within
        // the double-click window at close screen positions, flag the
        // upcoming mouseup so we skip element creation (dblclick handler
        // will deal with it instead).
        const now = performance.now();
        const timeClose = now - this.lastMouseDownTime < CircuitPanel.DBLCLICK_TIME_MS;
        const posClose = Math.abs(sx - this.lastMouseDownSx) <= CircuitPanel.DBLCLICK_DIST_PX &&
                         Math.abs(sy - this.lastMouseDownSy) <= CircuitPanel.DBLCLICK_DIST_PX;
        this.pendingDblClick = timeClose && posClose;
        this.lastMouseDownTime = now;
        this.lastMouseDownSx = sx;
        this.lastMouseDownSy = sy;

        // Handle move mode - start dragging selected elements
        if (this.isMovingSelected && e.button === 0) {
            this.moveStartLogX = lx;
            this.moveStartLogY = ly;
            return;
        }

        // Handle ZOOM tool
        if (this.currentTool === ElementsEdtActions.ZOOM) {
            const factor = e.button === 2 ? (1 / 1.3) : 1.3;
            this.zoomAtCursor(sx, sy, factor);
            return;
        }

        // Pan: middle button or left button + HAND tool
        if (e.button === 1 || (e.button === 0 && this.currentTool === ElementsEdtActions.HAND)) {
            // Commit in-place text edit if active before panning
            if (this.textEditDialog.isActive()) {
                this.textEditDialog.commit();
            }
            this.isPanning = true;
            this.panStartX = e.clientX;
            this.panStartY = e.clientY;
            this.panStartCX = this.mapCoordinates.getXCenter();
            this.panStartCY = this.mapCoordinates.getYCenter();
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        // Right button: dispatch as button3 click
        if (e.button === 2) {
            const repaint = this.elementsEdt.handleClick(
                this.mapCoordinates, sx, sy, true, e.ctrlKey || e.metaKey, false
            );
            if (repaint) {
                this.render();
            }
            return;
        }

        // Left button
        if (e.button === 0) {
            // Commit in-place text edit if active before processing the click
            if (this.textEditDialog.isActive()) {
                this.textEditDialog.commit();
                this.textEditorJustCommitted = true;
                return;
            }

            if (this.currentTool === ElementsEdtActions.SELECTION) {
                const handleIdx = this.findHandleAt(sx, sy);
                if (handleIdx !== GraphicPrimitive.NO_DRAG && this.dragHandlePrim !== null) {
                    this.undoActions.saveUndoState();
                    this.dragHandleIndex = handleIdx;
                    return;
                }
                // Check if cursor hits any primitive — resolve to click-select or move-drag later
                const hitPrim = this.findPrimitiveAt(sx, sy);
                if (hitPrim !== null) {
                    this.mouseDownPrimHit = hitPrim;
                    this.moveAllDragLogX = lx;
                    this.moveAllDragLogY = ly;
                    this.selStartScreenX = sx;
                    this.selStartScreenY = sy;
                    return;
                }
                // No primitive hit → start rubber-band selection
                this.selStartScreenX = sx;
                this.selStartScreenY = sy;
                this.selRectActive = true;
                this.selRectLogX1 = lx;
                this.selRectLogY1 = ly;
                this.selRectLogX2 = lx;
                this.selRectLogY2 = ly;
                this.selRectLtoR = true;
                this.selRectSx2 = sx;
                this.selRectSy2 = sy;
                return;
            }
            // Drawing tool: record state, dispatch on mouseup
            this.lastScreenX = sx;
            this.lastScreenY = sy;
        }
    }

    private onMouseMove(e: MouseEvent): void {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        const sx = (e.clientX - rect.left) * dpr;
        const sy = (e.clientY - rect.top) * dpr;
        const lx = this.mapCoordinates.unmapXsnap(sx);
        const ly = this.mapCoordinates.unmapYsnap(sy);

        // Always update coordinates for status bar
        this.onCoordinatesChange?.(lx, ly);

        if (this.isMovingSelected) {
            // Move selected elements with cursor
            const dx = lx - this.moveStartLogX;
            const dy = ly - this.moveStartLogY;
            if (dx !== 0 || dy !== 0) {
                for (const prim of this.model.getPrimitiveVector()) {
                    if (prim.isSelected()) {
                        prim.movePrimitive(dx, dy);
                    }
                }
                this.moveStartLogX = lx;
                this.moveStartLogY = ly;
                this.model.setChanged(true);
                this.render();
            }
            return;
        }

        if (this.isPanning) {
            const panDx = (e.clientX - this.panStartX) * dpr;
            const panDy = (e.clientY - this.panStartY) * dpr;
            this.mapCoordinates.setXCenter(this.panStartCX + panDx);
            this.mapCoordinates.setYCenter(this.panStartCY + panDy);
            this.clampCenter();
            this.render();
            return;
        }

        // Resolve pending prim-hit into move-drag once mouse moves past threshold
        if (this.mouseDownPrimHit !== null) {
            if (Math.abs(sx - this.selStartScreenX) > CircuitPanel.DRAG_THRESHOLD_PX ||
                Math.abs(sy - this.selStartScreenY) > CircuitPanel.DRAG_THRESHOLD_PX) {
                if (!this.mouseDownPrimHit.isSelected()) {
                    if (!e.ctrlKey && !e.metaKey) this.selectionActions.setSelectionAll(false);
                    this.mouseDownPrimHit.setSelected(true);
                    this.model.setChanged(true);
                }
                // Save pre-drag state so undo can restore the original positions.
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
                this.render();
            }
            return;
        }

        if (this.selRectActive) {
            this.selRectLogX2 = lx;
            this.selRectLogY2 = ly;
            this.selRectSx2 = sx;
            this.selRectSy2 = sy;
            this.selRectLtoR = sx >= this.selStartScreenX;
            this.render();
            return;
        }

        if (this.dragHandleIndex !== GraphicPrimitive.NO_DRAG && this.dragHandlePrim !== null) {
            const pt = this.dragHandlePrim.virtualPoint[this.dragHandleIndex];
            if (pt) {
                pt.x = lx;
                pt.y = ly;
                this.dragHandlePrim.setChanged(true);
                this.model.setChanged(true);
                this.render();
            }
            return;
        }

        this.updateGhostPreview(lx, ly);
        if (this.ghostPrimitive !== null) {
            this.render();
        }
    }

    private updateGhostPreview(lx: number, ly: number): void {
        this.ghostPrimitive = this.ghostPreview.updateGhost(
            lx, ly, this.currentTool, this.elementsEdt, this.model
        );
    }

    private onMouseUp(e: MouseEvent): void {
        // If the preceding mousedown committed the text editor, consume this mouseup
        if (this.textEditorJustCommitted) {
            this.textEditorJustCommitted = false;
            return;
        }

        if (this.isMovingSelected) {
            this.isMovingSelected = false;
            this.canvas.style.cursor = this.cursorForTool(this.currentTool);
            this.onUndoStateChange?.();
            return;
        }

        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = this.cursorForTool(this.currentTool);
            return;
        }

        // Pending prim-hit resolved as a click (mouse didn't move past threshold)
        if (this.mouseDownPrimHit !== null) {
            this.editorActions.handleSelection(
                this.mapCoordinates,
                this.selStartScreenX,
                this.selStartScreenY,
                e.ctrlKey || e.metaKey
            );
            this.mouseDownPrimHit = null;
            this.render();
            return;
        }

        if (this.isMoveAllDrag) {
            this.isMoveAllDrag = false;
            this.render();
            return;
        }

        if (this.selRectActive) {
            const dpr = window.devicePixelRatio || 1;
            const canvasRect = this.canvas.getBoundingClientRect();
            const upSx = (e.clientX - canvasRect.left) * dpr;
            const upSy = (e.clientY - canvasRect.top) * dpr;
            const isClick = Math.abs(upSx - this.selStartScreenX) <= CircuitPanel.DRAG_THRESHOLD_PX &&
                            Math.abs(upSy - this.selStartScreenY) <= CircuitPanel.DRAG_THRESHOLD_PX;
            if (isClick) {
                this.editorActions.handleSelection(
                    this.mapCoordinates,
                    this.selStartScreenX,
                    this.selStartScreenY,
                    e.ctrlKey || e.metaKey
                );
            } else {
                const x1 = Math.min(this.selRectLogX1, this.selRectLogX2);
                const y1 = Math.min(this.selRectLogY1, this.selRectLogY2);
                const w = Math.abs(this.selRectLogX2 - this.selRectLogX1);
                const h = Math.abs(this.selRectLogY2 - this.selRectLogY1);
                this.editorActions.selectRect(x1, y1, w, h);
            }
            this.selRectActive = false;
            this.render();
            return;
        }

        if (this.dragHandleIndex !== GraphicPrimitive.NO_DRAG) {
            this.dragHandleIndex = GraphicPrimitive.NO_DRAG;
            this.dragHandlePrim = null;
            this.render();
            return;
        }

        // Drawing tool click dispatch (for non-SELECTION tools)
        // Skip if this is the second mouseup of a double-click
        if (this.pendingDblClick) {
            this.pendingDblClick = false;
            return;
        }

        if (this.currentTool !== ElementsEdtActions.SELECTION) {
            const repaint = this.elementsEdt.handleClick(
                this.mapCoordinates, this.lastScreenX, this.lastScreenY, false, false, false
            );
            if (repaint) {
                this.render();
            }
        }
    }

    private onDoubleClick(e: MouseEvent): void {
        // If the text editor is active, commit it and consume the double-click
        if (this.textEditDialog.isActive()) {
            this.textEditDialog.commit();
            return;
        }

        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        const sx = (e.clientX - rect.left) * dpr;
        const sy = (e.clientY - rect.top) * dpr;

        const repaint = this.elementsEdt.handleClick(
            this.mapCoordinates, sx, sy, false, e.ctrlKey || e.metaKey, true
        );
        if (repaint) {
            this.render();
        }
    }


    private findHandleAt(sx: number, sy: number): number {
        for (const prim of this.model.getPrimitiveVector()) {
            if (prim.isSelected()) {
                const handleIdx = prim.onHandle(this.mapCoordinates, sx, sy);
                if (handleIdx !== GraphicPrimitive.NO_DRAG) {
                    this.dragHandlePrim = prim;
                    return handleIdx;
                }
            }
        }
        this.dragHandlePrim = null;
        return GraphicPrimitive.NO_DRAG;
    }

    private findPrimitiveAt(sx: number, sy: number): GraphicPrimitive | null {
        const px = this.mapCoordinates.unmapXnosnap(sx);
        const py = this.mapCoordinates.unmapYnosnap(sy);
        const toll = this.mapCoordinates.unmapXnosnap(sx + this.editorActions.selTolerance)
                   - this.mapCoordinates.unmapXnosnap(sx);
        const tolerance = toll < 2 ? 2 : toll;
        const layerV = this.model.getLayers();

        let minDist = Number.MAX_VALUE;
        let closest: GraphicPrimitive | null = null;
        for (const prim of this.model.getPrimitiveVector()) {
            const layer = prim.getLayer();
            if (layer < layerV.length && !layerV[layer].isVisible()) continue;
            const dist = prim.getDistanceToPoint(px, py);
            if (dist < tolerance && dist < minDist) {
                minDist = dist;
                closest = prim;
            }
        }
        return closest;
    }

    private cursorForTool(toolId: number): string {
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

    private zoomAtCursor(sx: number, sy: number, factor: number): void {
        const oldZ = this.mapCoordinates.getXMagnitude();
        const newZ = Math.max(
            MapCoordinates.MIN_MAGNITUDE,
            Math.min(MapCoordinates.MAX_MAGNITUDE, oldZ * factor)
        );
        const scale = newZ / oldZ;

        this.mapCoordinates.setXCenter(sx - (sx - this.mapCoordinates.getXCenter()) * scale);
        this.mapCoordinates.setYCenter(sy - (sy - this.mapCoordinates.getYCenter()) * scale);
        this.clampCenter();
        this.mapCoordinates.setXMagnitudeNoCheck(newZ);
        this.mapCoordinates.setYMagnitudeNoCheck(newZ);
        this.render();
        this.onZoomChange?.();
    }

    getModel(): DrawingModel { return this.model; }
    getParserActions(): ParserActions { return this.parserActions; }
    getMapCoordinates(): MapCoordinates { return this.mapCoordinates; }
    getAddElements(): AddElements { return this.elementsEdt.getAddElements(); }
    getCanvasElement(): HTMLCanvasElement { return this.canvas; }

    setGridVisible(visible: boolean): void {
        this.gridVisible = visible;
        this.render();
    }

    isGridVisible(): boolean { return this.gridVisible; }

    setAntiAlias(antiAlias: boolean): void {
        this.ctx.getCtx().imageSmoothingEnabled = antiAlias;
    }

    setBackgroundColor(c: string): void { this.backgroundColor = c; }
    setGridColor(c: string): void { this.gridColor = c; }
    setSelectionLTRColor(c: string): void { this.selectionLTRColor = c; }
    setSelectionRTLColor(c: string): void { this.selectionRTLColor = c; }

    setRenderTeX(enabled: boolean): void {
        this.renderTeX = enabled;
        this.texOverlayManager.setEnabled(enabled);
        this.render();
    }

    setSelectedColor(c: ColorInterface): void {
        this.ctx.setSelectedColor(c);
    }

    zoomIn(): void {
        const factor = 1.2;
        this.mapCoordinates.setXMagnitudeNoCheck(this.mapCoordinates.getXMagnitude() * factor);
        this.mapCoordinates.setYMagnitudeNoCheck(this.mapCoordinates.getYMagnitude() * factor);
        this.render();
    }

    zoomOut(): void {
        const factor = 1 / 1.2;
        this.mapCoordinates.setXMagnitudeNoCheck(this.mapCoordinates.getXMagnitude() * factor);
        this.mapCoordinates.setYMagnitudeNoCheck(this.mapCoordinates.getYMagnitude() * factor);
        this.render();
    }

    setZoom(magnitude: number): void {
        this.mapCoordinates.setXMagnitudeNoCheck(magnitude);
        this.mapCoordinates.setYMagnitudeNoCheck(magnitude);
        this.render();
    }

    getZoom(): number { return this.mapCoordinates.getXMagnitude(); }

    isSnapActive(): boolean { return this.mapCoordinates.getSnap(); }
    setSnap(s: boolean): void { this.mapCoordinates.setSnap(s); }

    getZoomPercent(): number {
        return Math.round((this.mapCoordinates.getXMagnitude() / 20) * 100);
    }

    zoomToFit(): void {
        const dpr = window.devicePixelRatio || 1;
        const margin = Math.round(10 * dpr);
        const w = Math.max(1, this.container.clientWidth  * dpr - 2 * margin);
        const h = Math.max(1, this.container.clientHeight * dpr - 2 * margin);
        const newCs = DrawingSize.calculateZoomToFit(this.model, w, h, true);
        this.mapCoordinates.setXMagnitudeNoCheck(newCs.getXMagnitude());
        this.mapCoordinates.setYMagnitudeNoCheck(newCs.getYMagnitude());
        this.mapCoordinates.setXCenter(newCs.getXCenter() + margin);
        this.mapCoordinates.setYCenter(newCs.getYCenter() + margin);
        this.clampCenter();
        this.render();
        this.onZoomChange?.();
    }

    /** Clamp the viewport center so the top-left corner (pixel 0,0) never
     *  maps to a negative logical coordinate (north-west of the origin).
     */
    private clampCenter(): void {
        this.mapCoordinates.setXCenter(Math.min(this.mapCoordinates.getXCenter(), 0));
        this.mapCoordinates.setYCenter(Math.min(this.mapCoordinates.getYCenter(), 0));
    }

    render(): void {
        const ctx = this.ctx.getCtx();
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Mark entire canvas as dirty so hitClip() passes for the first draw.
        // Each subsequent draw expands the dirty rect via markDirty(), so all
        // primitives render. Without this, the first primitive's bounds become
        // the dirty rect and clip everything outside it.
        this.ctx.clearDirtyRect();
        this.ctx.markDirtyFull(width, height);

        // Clear canvas with background color
        ctx.fillStyle = this.backgroundColor;
        ctx.fillRect(0, 0, width, height);

        // Draw grid
        if (this.gridVisible) {
            const gc = hexToRgb(this.gridColor);
            const gridColor = new ColorCanvas(gc.r, gc.g, gc.b);
            this.ctx.drawGrid(this.mapCoordinates, 0, 0, width, height, gridColor, gridColor);
        }

        // Draw primitives via the Drawing view (correct layer ordering, macro support)
        this.mapCoordinates.resetMinMax();
        TeXMode.active = this.renderTeX;
        this.drawing.draw(this.ctx, this.mapCoordinates);

        // Draw handles for selected elements
        this.drawing.drawSelectedHandles(this.ctx, this.mapCoordinates);

        // Draw rubber-band selection rect
        if (this.selRectActive) {
            ctx.save();
            const rx1 = this.selStartScreenX;
            const ry1 = this.selStartScreenY;
            const rx2 = this.selRectSx2;
            const ry2 = this.selRectSy2;
            ctx.strokeStyle = this.selRectLtoR ? this.selectionLTRColor : this.selectionRTLColor;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(
                Math.min(rx1, rx2), Math.min(ry1, ry2),
                Math.abs(rx2 - rx1), Math.abs(ry2 - ry1)
            );
            ctx.restore();
        }

        // Draw ghost (live preview for drawing tools)
        if (this.ghostPrimitive !== null) {
            ctx.save();
            ctx.globalAlpha = 0.4;
            this.ghostPrimitive.draw(this.ctx, this.mapCoordinates, this.model.getLayers());
            ctx.restore();
        }

        // Sync TeX overlay when LaTeX rendering is enabled
        this.texOverlayManager.sync(this.model, this.mapCoordinates, window.devicePixelRatio || 1);

        this.model.setChanged(false);
        this.ctx.clearDirtyRect();
    }

    loadCircuit(circuitText: string): void {
        this.parserActions.parseString(circuitText);
        if (this.model.getPrimitiveVector().length > 0) {
            this.zoomToFit();
        } else {
            this.render();
        }
    }

    getCircuitText(): string {
        return this.parserActions.getText(true);
    }

    exportSVG(): string { return this.exportFacade.exportSVG(); }

    exportPGF(): string { return this.exportFacade.exportPGF(); }

    exportTikZ(): string { return this.exportFacade.exportTikZ(); }

    setTool(toolId: number): void {
        this.currentTool = toolId;
        this.elementsEdt.setState(toolId);
        this.canvas.style.cursor = this.cursorForTool(toolId);
        this.onToolChange?.(toolId);
    }

    setMacroTool(macroKey: string): void {
        this.currentTool = ElementsEdtActions.MACRO;
        this.elementsEdt.setState(ElementsEdtActions.MACRO, macroKey);
        this.canvas.style.cursor = 'crosshair';
        this.onToolChange?.(ElementsEdtActions.MACRO);
    }

    loadLibraryString(content: string, prefix: string): void {
        this.parserActions.readLibraryString(content, prefix);
    }

    getTool(): number {
        return this.currentTool;
    }

    undo(): void {
        this.undoActions.undo();
        this.render();
        this.onUndoStateChange?.();
    }

    redo(): void {
        this.undoActions.redo();
        this.render();
        this.onUndoStateChange?.();
    }

    canUndo(): boolean {
        return this.undoActions.canUndo();
    }

    canRedo(): boolean {
        return this.undoActions.canRedo();
    }

    selectAll(): void {
        this.selectionActions.setSelectionAll(true);
        this.render();
    }

    deleteSelected(): void {
        this.editorActions.deleteAllSelected(true);
        this.render();
        this.onUndoStateChange?.();
    }

    rotateSelected(): void {
        this.editorActions.rotateAllSelected();
        this.render();
        this.onUndoStateChange?.();
    }

    mirrorSelected(): void {
        this.editorActions.mirrorAllSelected();
        this.render();
        this.onUndoStateChange?.();
    }

    setMenuBar(menuBar: MenuBar): void {
        this.menuBar = menuBar;
    }

    startMoveSelected(): void {
        const selected = this.selectionActions.getSelectedPrimitives();
        if (selected.length === 0) return;

        this.undoActions.saveUndoState();
        this.isMovingSelected = true;
        this.canvas.style.cursor = 'move';
    }

    getCurrentLayer(): number {
        return this.elementsEdt.currentLayer;
    }

    setCurrentLayer(layer: number): void {
        this.elementsEdt.currentLayer = layer;
    }

    getLayerDescriptions(): string[] {
        const layers = this.model.getLayers();
        const result: string[] = [];
        for (let i = 0; i < 16; i++) {
            if (i < layers.length) {
                result.push(layers[i].getDescription());
            } else {
                result.push(`Layer ${i}`);
            }
        }
        return result;
    }

    getLayers(): LayerDesc[] {
        const layers = this.model.getLayers();
        const result: LayerDesc[] = [];
        for (let i = 0; i < 16; i++) {
            result.push(i < layers.length ? layers[i] : new LayerDesc());
        }
        return result;
    }

    showInPlaceEdit(prim: PrimitiveAdvText, isNewText: boolean): void {
        const originalValue = prim.getString();

        this.textEditDialog.show(
            prim,
            this.canvas,
            this.mapCoordinates,
            this.model.getLayers(),
            (value) => {
                // Commit
                this.undoActions.saveUndoState();
                prim.setString(value);
                prim.setChanged(true);
                this.model.setChanged(true);
                this.render();
            },
            () => {
                // Cancel
                if (isNewText) {
                    // Remove the newly placed primitive
                    const prims = this.model.getPrimitiveVector();
                    const filtered = prims.filter(p => p !== prim);
                    this.model.setPrimitiveVector(filtered);
                } else {
                    // Restore original text
                    prim.setString(originalValue);
                    prim.setChanged(true);
                }
                this.model.setChanged(true);
                this.render();
            },
            () => {
                // Live update
                this.model.setChanged(true);
                this.render();
            }
        );
    }

    clearCircuit(): void {
        this.model.getPrimitiveVector().splice(0);
        // Reset existing undo stack rather than replacing the instance,
        // so dependent controllers (EditorActions, AddElements, etc.) keep
        // valid references.
        this.undoActions.reset();
        this.selectionActions.setSelectionAll(false);
        this.ghostPrimitive = null;
        this.selRectActive = false;
        this.dragHandleIndex = GraphicPrimitive.NO_DRAG;
        this.dragHandlePrim = null;
        this.render();
        this.onUndoStateChange?.();
    }

    // ─── KeyboardHost interface implementation ───────────────────────────────

    isTextEditActive(): boolean { return this.textEditDialog.isActive(); }
    getMenuBar(): MenuBar | null { return this.menuBar; }
    cancelTextEdit(): void { this.onCancelTextEdit?.(); }
    deselectAll(): void { this.selectionActions.setSelectionAll(false); }
    clearGhostAndSelection(): void {
        this.isMovingSelected = false;
        this.isMoveAllDrag = false;
        this.mouseDownPrimHit = null;
        this.dragHandleIndex = GraphicPrimitive.NO_DRAG;
        this.dragHandlePrim = null;
        this.ghostPrimitive = null;
        this.selRectActive = false;
    }
    nudgeSelected(dx: number, dy: number): void {
        this.editorActions.moveAllSelected(dx, dy);
        // moveAllSelected already saves undo state — do not double-save
        this.render();
        this.onUndoStateChange?.();
    }

    // ─── Clipboard (delegated) ───────────────────────────────────────────────

    copySelected(): void { this.clipboardController.copySelected(); }
    cutSelected(): void { this.clipboardController.cutSelected(); }
    async paste(): Promise<void> { await this.clipboardController.paste(); }
    duplicateSelected(): void { this.clipboardController.duplicateSelected(); }
    canPaste(): boolean { return this.clipboardController.canPaste(); }

    /** Convert a selected macro instance back into individual primitives. */
    vectorizeSelectedMacro(): void {
        this.macroVectorizer.vectorize();
    }

    // ─── Keyboard (delegated) ────────────────────────────────────────────────

    addKeyboardListeners(): void {
        this.keyboardController.attach();
    }

    removeKeyboardListeners(): void {
        this.keyboardController.detach();
    }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    return {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16),
    };
}
