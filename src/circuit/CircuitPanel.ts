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
import { LayerDesc } from '../layers/LayerDesc.js';
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
import type { KeyboardHost } from './controllers/KeyboardController.js';
import { ClipboardController } from './controllers/ClipboardController.js';

export class CircuitPanel {
    private container: HTMLElement;
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
    private contextMenuLogX: number = 0;
    private contextMenuLogY: number = 0;
    private menuBar: MenuBar | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private boundOnResize: () => void = () => this.onResize();
    private isMovingSelected: boolean = false;
    private moveStartLogX: number = 0;
    private moveStartLogY: number = 0;

    constructor(container: HTMLElement) {
        this.container = container;
        // Wire up static hooks for PrimitiveMacro rendering and exporting
        registerDrawingHooks();
        registerExportHooks();

        // Initialize coordinate system FIRST (before ResizeObserver)
        this.mapCoordinates = new MapCoordinates();
        this.mapCoordinates.setXCenter(0);  // Logical coordinate, not pixels!
        this.mapCoordinates.setYCenter(0);
        this.mapCoordinates.setXMagnitude(20);
        this.mapCoordinates.setYMagnitude(20);

        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.setAttribute('data-testid', 'editor-canvas');
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.display = 'block';
        container.appendChild(this.canvas);

        // Expose panel reference for E2E test access (intentional escape hatch)
        (this.canvas as any).__circuitPanel = this;

        // Setup high-DPI canvas with ResizeObserver for robust sizing
        const dpr = window.devicePixelRatio || 1;
        let hasInitialized = false;
        this.resizeObserver = new ResizeObserver(() => {
            const w = container.clientWidth * dpr;
            const h = container.clientHeight * dpr;
            if (w <= 0 || h <= 0) return;
            if (w === this.canvas.width && h === this.canvas.height && hasInitialized) return;
            this.canvas.width = w;
            this.canvas.height = h;
            hasInitialized = true;
            this.render();
        });
        this.resizeObserver.observe(container);

        // Force initial layout computation
        container.offsetWidth;

        this.ctx = new GraphicsCanvas(this.canvas);
        this.ctx.setZoom(1);

        // Initialize model
        this.model = new DrawingModel();
        this.model.setLayers(StandardLayers.createStandardLayers());
        this.parserActions = new ParserActions(this.model);

        // Initialize controllers
        this.selectionActions = new SelectionActions(this.model);
        this.undoActions = new UndoActions(this.parserActions);
        this.editorActions = new EditorActions(this.model, this.selectionActions, this.undoActions);
        this.elementsEdt = new ElementsEdtActions(
            this.model, this.selectionActions, this.undoActions, this.editorActions
        );

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

        // Initialize clipboard controller (before keyboard, which depends on it)
        this.clipboardController = new ClipboardController(
            this.selectionActions, this.parserActions, this.editorActions,
            this.undoActions, this.mapCoordinates
        );
        this.clipboardController.onRenderRequested = () => this.render();
        this.clipboardController.onUndoStateChange = () => this.onUndoStateChange?.();

        // Initialize keyboard controller
        this.keyboardController = new KeyboardController(
            this as unknown as KeyboardHost, this.clipboardController
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
                this.showContextMenu(e.clientX, e.clientY);
            }
        });

        // Handle resize
        window.addEventListener('resize', this.boundOnResize);

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
    }

    /** Remove all global listeners and observers. Call when the panel is unmounted. */
    destroy(): void {
        this.keyboardController.detach();
        window.removeEventListener('resize', this.boundOnResize);
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
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

    private onMouseUp(e: MouseEvent): void {
        // If the preceding mousedown committed the text editor, consume this mouseup
        if (this.textEditorJustCommitted) {
            this.textEditorJustCommitted = false;
            return;
        }

        if (this.isMovingSelected) {
            this.isMovingSelected = false;
            this.undoActions.saveUndoState();
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
            this.undoActions.saveUndoState();
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
            this.undoActions.saveUndoState();
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

    private onResize(): void {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.parentElement?.getBoundingClientRect();
        if (!rect || rect.width === 0) return;

        const oldW = this.canvas.width;
        const oldH = this.canvas.height;
        const newW = rect.width * dpr;
        const newH = rect.height * dpr;

        // Preserve relative pan: keep center as same fraction of canvas
        if (oldW > 0) {
            this.mapCoordinates.setXCenter(
                this.mapCoordinates.getXCenter() * (newW / oldW)
            );
        }
        if (oldH > 0) {
            this.mapCoordinates.setYCenter(
                this.mapCoordinates.getYCenter() * (newH / oldH)
            );
        }
        this.clampCenter();
        this.canvas.width = newW;
        this.canvas.height = newH;
        this.render();
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

    private updateGhostPreview(lx: number, ly: number): void {
        this.ghostPrimitive = null;

        const tool = this.currentTool;
        const clickNum = this.elementsEdt.clickNumber;
        const xpoly = this.elementsEdt.xpoly;
        const ypoly = this.elementsEdt.ypoly;
        const layer = this.elementsEdt.currentLayer;
        const font = this.model.getTextFont();
        const fontSize = this.model.getTextFontSize();

        switch (tool) {
            case ElementsEdtActions.LINE:
                if (clickNum === 1) {
                    this.ghostPrimitive = new PrimitiveLine(
                        xpoly[1], ypoly[1], lx, ly, layer,
                        false, false, 0, 3, 2, 0, font, fontSize
                    );
                }
                break;

            case ElementsEdtActions.BEZIER:
                if (clickNum === 3) {
                    this.ghostPrimitive = new PrimitiveBezier(
                        xpoly[1], ypoly[1],
                        xpoly[2], ypoly[2],
                        xpoly[3], ypoly[3],
                        lx, ly,
                        layer, false, false, 0, 3, 2, 0, font, fontSize
                    );
                } else if (clickNum >= 1 && clickNum < 3) {
                    const ctrlPoly = new PrimitivePolygon(false, layer, 0, font, fontSize);
                    for (let i = 1; i <= clickNum; i++) {
                        ctrlPoly.addPoint(xpoly[i], ypoly[i]);
                    }
                    ctrlPoly.addPoint(lx, ly);
                    this.ghostPrimitive = ctrlPoly;
                }
                break;

            case ElementsEdtActions.RECTANGLE:
                if (clickNum === 1) {
                    this.ghostPrimitive = new PrimitiveRectangle(
                        xpoly[1], ypoly[1], lx, ly, false, layer, 0, font, fontSize
                    );
                }
                break;

            case ElementsEdtActions.ELLIPSE:
                if (clickNum === 1) {
                    this.ghostPrimitive = new PrimitiveOval(
                        xpoly[1], ypoly[1], lx, ly, false, layer, 0, font, fontSize
                    );
                }
                break;

            case ElementsEdtActions.POLYGON:
                if (clickNum >= 1) {
                    const poly = new PrimitivePolygon(false, layer, 0, font, fontSize);
                    for (let i = 1; i <= clickNum; i++) {
                        poly.addPoint(xpoly[i], ypoly[i]);
                    }
                    poly.addPoint(lx, ly);
                    this.ghostPrimitive = poly;
                }
                break;

            case ElementsEdtActions.COMPLEXCURVE:
                if (clickNum >= 1) {
                    const cc = new PrimitiveComplexCurve(
                        false, false, layer,
                        false, false, 0, 3, 2, 0,
                        font, fontSize
                    );
                    for (let i = 1; i <= clickNum; i++) {
                        cc.addPoint(xpoly[i], ypoly[i]);
                    }
                    cc.addPoint(lx, ly);
                    this.ghostPrimitive = cc;
                }
                break;

            case ElementsEdtActions.PCB_LINE:
                if (clickNum === 1) {
                    this.ghostPrimitive = new PrimitivePCBLine(
                        xpoly[1], ypoly[1], lx, ly,
                        this.elementsEdt.getAddElements().getPcbThickness(),
                        layer, font, fontSize
                    );
                }
                break;

            case ElementsEdtActions.MACRO:
                // Show preview of macro following cursor (like Java version)
                if (this.elementsEdt.macroKey !== '') {
                    try {
                        let orientation = 0;
                        let mirror = false;
                        if (this.elementsEdt.primEdit instanceof PrimitiveMacro) {
                            orientation = this.elementsEdt.primEdit.getOrientation();
                            mirror = this.elementsEdt.primEdit.isMirrored();
                        }

                        const macroPreview = new PrimitiveMacro(
                            this.model.getLibrary(),
                            StandardLayers.createEditingLayerArray(), // Green preview color
                            font,
                            fontSize
                        );
                        macroPreview.virtualPoint[0]!.x = lx;
                        macroPreview.virtualPoint[0]!.y = ly;
                        macroPreview.virtualPoint[1]!.x = lx + 10;
                        macroPreview.virtualPoint[1]!.y = ly + 10;
                        macroPreview.virtualPoint[2]!.x = lx + 10;
                        macroPreview.virtualPoint[2]!.y = ly + 5;
                        macroPreview.setOrientation(orientation);
                        macroPreview.setMirrored(mirror);
                        macroPreview.initializeFromKey(this.elementsEdt.macroKey);
                        macroPreview.setDrawOnlyLayer(-1);
                        this.ghostPrimitive = macroPreview;
                    } catch (e) {
                        // Ignore errors during preview (macro might not be loaded yet)
                    }
                }
                break;
        }
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
        this.texOverlay.style.display = enabled ? 'block' : 'none';
        if (!enabled) {
            this.texOverlay.innerHTML = '';
        }
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

    /** Populate the TeX overlay div with KaTeX-rendered math from text primitives. */
    private syncTeXOverlay(dpr: number): void {
        if (!this.renderTeX) return;

        const htmlParts: string[] = [];
        const latexIndices: number[] = []; // primitive indices for each overlay div
        const layers = this.model.getLayers();
        const primitives = this.model.getPrimitiveVector();

        for (let pi = 0; pi < primitives.length; pi++) {
            const prim = primitives[pi]!;
            if (!(prim instanceof PrimitiveAdvText)) continue;

            const text = prim.getString();
            // Quick skip: if no $ delimiter, no math to render
            if (!text.includes('$')) continue;

            const lx = prim.virtualPoint[0]!.x;
            const ly = prim.virtualPoint[0]!.y;
            const sx = this.mapCoordinates.mapX(lx, ly);
            const sy = this.mapCoordinates.mapY(lx, ly);

            // Convert canvas pixels to CSS pixels for overlay positioning
            const cssX = sx / dpr;
            const cssY = sy / dpr;

            // Compute font CSS matching the canvas font settings (mirrors draw()).
            // Use the larger of six and the width-equivalent of siy to ensure
            // both font size fields affect the visual rendering.
            const yMag = this.mapCoordinates.getYMagnitude();
            const effectiveSix = Math.max(
                prim.getFontWidth(),
                prim.getFontDimension() * 7 / 10
            );
            const canvasFontSize = effectiveSix * 12 * yMag / 7 + 0.5;
            const cssFontSize = canvasFontSize / dpr;
            const isBold = prim.isBold();
            const isItalic = prim.isItalic();
            const fontName = prim.getFontName() || 'Courier New';
            const fontStyle = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}`;

            // Layer color — blend with selection green when selected (matches canvas).
            const layerIdx = prim.getLayer();
            let textColor = '#000000';
            if (layerIdx >= 0 && layerIdx < layers.length) {
                const color = layers[layerIdx].getColor();
                if (color) {
                    if (prim.isSelected()) {
                        // Same blend as GraphicsCanvas.activateSelectColor:
                        // selectedColor(0,255,0) * 0.6 + layerColor * 0.4
                        const r = Math.floor(0 * 0.6 + color.getRed() * 0.4);
                        const g = Math.floor(255 * 0.6 + color.getGreen() * 0.4);
                        const b = Math.floor(0 * 0.6 + color.getBlue() * 0.4);
                        textColor = `rgb(${r},${g},${b})`;
                    } else {
                        textColor = (color as ColorCanvas).toCSSColor();
                    }
                }
            }

            // Orientation and mirror (mirrors draw() coordinate adjustments).
            let orientation = prim.getOrientation();
            let mirror = prim.isMirrored() !== 0;
            if (mirror) orientation = -orientation;
            orientation -= this.mapCoordinates.getOrientation() * 90;
            if (this.mapCoordinates.getMirror()) {
                mirror = !mirror;
                orientation = -orientation;
            }
            let transformStyle = '';
            if (orientation !== 0 || mirror) {
                transformStyle = `transform: rotate(${orientation}deg)` +
                    (mirror ? ' scaleX(-1)' : '') + '; ' +
                    'transform-origin: 0 0; ';
            }

            const segments = renderMixedText(text);
            const segmentHtml = segments.map(seg => {
                if (seg.type === 'text') {
                    // Escape HTML in plain text segments
                    const escaped = seg.content
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;');
                    return `<span style="white-space: pre;">${escaped}</span>`;
                }
                // Math segments already contain safe KaTeX HTML
                return seg.content;
            }).join('');

            htmlParts.push(
                `<div data-prim-index="${pi}" style="position:absolute; left:${cssX}px; top:${cssY}px; ` +
                `white-space: nowrap; font: ${fontStyle}${cssFontSize}px ${fontName}; ` +
                `color: ${textColor}; ${transformStyle}">${segmentHtml}</div>`
            );
            latexIndices.push(pi);
        }

        this.texOverlay.innerHTML = htmlParts.join('');

        // Measure actual KaTeX overlay dimensions after layout and feed them
        // back to the primitives for accurate click hit-testing.
        requestAnimationFrame(() => {
            const overlayDivs = this.texOverlay.querySelectorAll('[data-prim-index]');
            for (const div of overlayDivs) {
                const idx = parseInt((div as HTMLElement).dataset['primIndex'] ?? '', 10);
                const prim = primitives[idx];
                if (!(prim instanceof PrimitiveAdvText)) continue;
                const rect = div.getBoundingClientRect();
                if (rect.width <= 0 && rect.height <= 0) continue;
                // Convert CSS pixel dimensions to logical units.
                // The div is positioned at (cssX, cssY) which maps to
                // (virtualPoint.x, virtualPoint.y) in logical coords.
                const wLogical = Math.round(rect.width * dpr / this.mapCoordinates.getXMagnitude());
                const hLogical = Math.round(rect.height * dpr / this.mapCoordinates.getYMagnitude());
                prim.setTeXOverlaySize(wLogical, hLogical);
            }
        });
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
        this.syncTeXOverlay(window.devicePixelRatio || 1);

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

    exportSVG(): string {
        const mp = new MapCoordinates();
        mp.setMagnitudes(1, 1);
        const svg = new ExportSVG();
        const exportView = new Export(this.model);
        exportView.exportHeader(svg, mp);
        exportView.exportDrawing(svg, false, mp);
        svg.exportEnd();
        return svg.getSvgString();
    }

    exportPGF(): string {
        const mp = new MapCoordinates();
        mp.setMagnitudes(1, 1);
        const pgf = new ExportPGF();
        const exportView = new Export(this.model);
        exportView.exportHeader(pgf, mp);
        exportView.exportDrawing(pgf, false, mp);
        pgf.exportEnd();
        return pgf.getPgfString();
    }

    exportTikZ(): string {
        const mp = new MapCoordinates();
        mp.setMagnitudes(1, 1);
        const tikz = new ExportTikZ();
        const exportView = new Export(this.model);
        exportView.exportHeader(tikz, mp);
        exportView.exportDrawing(tikz, false, mp);
        tikz.exportEnd();
        return tikz.getTikZString();
    }

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
        // Check if there are selected primitives
        const selected = this.selectionActions.getSelectedPrimitives();
        if (selected.length === 0) return;

        // Enter move mode - the next mouse drag will move the selection
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
                prim.setString(value);
                prim.setChanged(true);
                this.model.setChanged(true);
                this.undoActions.saveUndoState();
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

    // ─── Context Menu ─────────────────────────────────────────────────────────

    private showContextMenu(clientX: number, clientY: number): void {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        const sx = (clientX - rect.left) * dpr;
        const sy = (clientY - rect.top) * dpr;

        // Store logical (unsnapped) coords for add/remove node
        this.contextMenuLogX = this.mapCoordinates.unmapXnosnap(sx);
        this.contextMenuLogY = this.mapCoordinates.unmapYnosnap(sy);

        const first = this.selectionActions.getFirstSelectedPrimitive();
        const somethingSelected = first !== null;
        const hasCb = this.clipboardController.canPaste();
        const isNodePrim = this.selectionActions.isUniquePrimitiveSelected() &&
            (first instanceof PrimitivePolygon || first instanceof PrimitiveComplexCurve);
        const isMacroPrim = this.selectionActions.isUniquePrimitiveSelected() &&
            first instanceof PrimitiveMacro;

        this.contextMenu.show(clientX, clientY, [
            {
                label: 'Properties',
                enabled: somethingSelected,
                action: () => {
                    if (first) this.onPropertiesRequested?.(first);
                },
            },
            { separator: true },
            {
                label: 'Cut',
                enabled: somethingSelected,
                action: () => this.cutSelected(),
            },
            {
                label: 'Copy',
                enabled: somethingSelected,
                action: () => this.copySelected(),
            },
            {
                label: 'Paste',
                enabled: hasCb,
                action: () => this.paste(),
            },
            {
                label: 'Duplicate',
                enabled: somethingSelected,
                action: () => this.duplicateSelected(),
            },
            { separator: true },
            {
                label: 'Select All',
                enabled: true,
                action: () => { this.selectAll(); },
            },
            { separator: true },
            {
                label: 'Move',
                enabled: somethingSelected,
                action: () => this.startMoveSelected(),
            },
            {
                label: 'Rotate',
                enabled: somethingSelected,
                action: () => this.rotateSelected(),
            },
            {
                label: 'Mirror',
                enabled: somethingSelected,
                action: () => this.mirrorSelected(),
            },
            {
                label: 'Symbolize',
                enabled: somethingSelected,
                visible: somethingSelected && !isMacroPrim,
                action: () => this.onSymbolizeRequested?.(),
            },
            {
                label: 'Vectorize',
                enabled: isMacroPrim,
                visible: isMacroPrim,
                action: () => this.vectorizeSelectedMacro(),
            },
            { separator: true },
            {
                label: 'Add Node',
                enabled: isNodePrim,
                visible: isNodePrim,
                action: () => this.addNodeAt(this.contextMenuLogX, this.contextMenuLogY),
            },
            {
                label: 'Remove Node',
                enabled: isNodePrim,
                visible: isNodePrim,
                action: () => this.removeNodeAt(this.contextMenuLogX, this.contextMenuLogY),
            },
        ]);
    }

    private addNodeAt(lx: number, ly: number): void {
        const first = this.selectionActions.getFirstSelectedPrimitive();
        if (first instanceof PrimitivePolygon) {
            first.addPointClosest(lx, ly);
        } else if (first instanceof PrimitiveComplexCurve) {
            first.addPointClosest(lx, ly);
        } else {
            return;
        }
        this.undoActions.saveUndoState();
        this.render();
    }

    private removeNodeAt(lx: number, ly: number): void {
        const first = this.selectionActions.getFirstSelectedPrimitive();
        if (first instanceof PrimitivePolygon) {
            first.removePoint(lx, ly, 1);
        } else if (first instanceof PrimitiveComplexCurve) {
            first.removePoint(lx, ly, 1);
        } else {
            return;
        }
        this.undoActions.saveUndoState();
        this.render();
    }

    /** Convert a selected macro instance back into individual primitives. */
    vectorizeSelectedMacro(): void {
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

        // Move and transform each primitive from the macro to the canvas position
        const saved = this.undoActions.saveUndoState.bind(this.undoActions);
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
        saved();
        this.render();
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
