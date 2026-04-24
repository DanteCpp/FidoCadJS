import { DrawingModel } from './model/DrawingModel.js';
import { ParserActions } from './controllers/ParserActions.js';
import { MapCoordinates } from '../geom/MapCoordinates.js';
import { GraphicsCanvas } from '../graphic/canvas/GraphicsCanvas.js';
import { ColorCanvas } from '../graphic/canvas/ColorCanvas.js';
import { StandardLayers } from '../layers/StandardLayers.js';
import { LayerDesc } from '../layers/LayerDesc.js';
import { Drawing, registerDrawingHooks } from './views/Drawing.js';
import { Export, registerExportHooks } from './views/Export.js';
import { ExportSVG } from '../export/ExportSVG.js';
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
import { InPlaceTextEditor } from '../ui/InPlaceTextEditor.js';
import { ContextMenu } from '../ui/ContextMenu.js';
import { AddElements } from './controllers/AddElements.js';
import { MenuBar } from '../ui/MenuBar.js';

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

    private pendingDblClick = false;

    private clipboard: string = '';
    private contextMenu!: ContextMenu;
    private contextMenuLogX: number = 0;
    private contextMenuLogY: number = 0;
    private menuBar: MenuBar | null = null;
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
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.display = 'block';
        container.appendChild(this.canvas);

        // Setup high-DPI canvas with ResizeObserver for robust sizing
        const dpr = window.devicePixelRatio || 1;
        let hasInitialized = false;
        const ro = new ResizeObserver(() => {
            const w = container.clientWidth * dpr;
            const h = container.clientHeight * dpr;
            if (w <= 0 || h <= 0) return;
            if (w === this.canvas.width && h === this.canvas.height && hasInitialized) return;
            this.canvas.width = w;
            this.canvas.height = h;
            hasInitialized = true;
            this.render();
        });
        ro.observe(container);

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

        // Set initial cursor
        this.canvas.style.cursor = this.cursorForTool(this.currentTool);

        // Make canvas focusable for keyboard events
        this.canvas.setAttribute('tabIndex', '0');
        this.canvas.addEventListener('mousedown', () => this.canvas.focus());

        // Prevent browser default context menu; show custom one in SELECTION mode
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            // Right-click may have cancelled macro insertion in onMouseDown — sync tool state
            if (this.currentTool === ElementsEdtActions.MACRO &&
                this.elementsEdt.getSelectionState() === ElementsEdtActions.SELECTION) {
                this.setTool(ElementsEdtActions.SELECTION);
            }
            if (this.currentTool === ElementsEdtActions.SELECTION) {
                this.showContextMenu(e.clientX, e.clientY);
            }
        });

        // Handle resize
        window.addEventListener('resize', () => this.onResize());

        // Mouse wheel zoom (toward cursor)
        this.canvas.addEventListener('wheel', (e) => this.onMouseWheel(e), { passive: false });

        // Drag-to-pan
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
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

        // Reset pendingDblClick on mousedown
        this.pendingDblClick = false;

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

        // Set flag to skip the next mouseup
        this.pendingDblClick = true;

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
                if (clickNum >= 1 && clickNum < 4) {
                    this.ghostPrimitive = new PrimitiveLine(
                        xpoly[clickNum], ypoly[clickNum], lx, ly, layer,
                        false, false, 0, 3, 2, 0, font, fontSize
                    );
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
                    this.ghostPrimitive = new PrimitiveLine(
                        xpoly[clickNum], ypoly[clickNum], lx, ly, layer,
                        false, false, 0, 3, 2, 0, font, fontSize
                    );
                }
                break;

            case ElementsEdtActions.COMPLEXCURVE:
                if (clickNum >= 1) {
                    this.ghostPrimitive = new PrimitiveLine(
                        xpoly[clickNum], ypoly[clickNum], lx, ly, layer,
                        false, false, 0, 3, 2, 0, font, fontSize
                    );
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
        this.render();
        this.onZoomChange?.();
    }

    render(): void {
        const ctx = this.ctx.getCtx();
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Pre-fill dirty rect to full canvas so every hitClip() passes this render pass
        this.ctx.clearDirtyRect();
        this.ctx.markDirtyFull(width, height);

        // Clear canvas
        ctx.fillStyle = this.backgroundColor;
        ctx.fillRect(0, 0, width, height);

        // Reset transform, clipping and alpha
        ctx.save();
        ctx.resetTransform();
        ctx.globalAlpha = 1.0;
        ctx.clearRect(0, 0, width, height);
        ctx.restore();

        // Draw grid
        if (this.gridVisible) {
            const gc = hexToRgb(this.gridColor);
            const gridColor = new ColorCanvas(gc.r, gc.g, gc.b);
            this.ctx.drawGrid(this.mapCoordinates, 0, 0, width, height, gridColor, gridColor);
        }

        // Draw primitives via the Drawing view (correct layer ordering, macro support)
        this.mapCoordinates.resetMinMax();
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
        this.undoActions = new UndoActions(this.parserActions);
        this.selectionActions.setSelectionAll(false);
        this.ghostPrimitive = null;
        this.selRectActive = false;
        this.dragHandleIndex = GraphicPrimitive.NO_DRAG;
        this.dragHandlePrim = null;
        this.render();
        this.onUndoStateChange?.();
    }

    // ─── Clipboard ───────────────────────────────────────────────────────────

    copySelected(): void {
        const selected = this.selectionActions.getSelectedPrimitives();
        if (selected.length === 0) return;
        const text = this.selectionActions.getSelectedString(true, this.parserActions);
        this.clipboard = text;
        // Also push to the system clipboard so it can be pasted into other apps
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).catch(() => { /* ignore permission errors */ });
        }
    }

    cutSelected(): void {
        this.copySelected();
        this.editorActions.deleteAllSelected(true);
        this.render();
        this.onUndoStateChange?.();
    }

    async paste(): Promise<void> {
        let text = '';
        // Prefer system clipboard
        if (navigator.clipboard?.readText) {
            try {
                text = await navigator.clipboard.readText();
            } catch {
                // permission denied or non-secure context – fall back
            }
        }
        // Fall back to internal clipboard if system read yielded nothing
        if (!text) {
            text = this.clipboard;
        }
        if (!text) return;

        // Deselect everything so only pasted items end up selected
        this.selectionActions.setSelectionAll(false);
        this.parserActions.addString(text, true);
        // Offset pasted selection by one grid step so it doesn't overlap the original
        const step = this.mapCoordinates.getXGridStep();
        this.editorActions.moveAllSelected(step, step);
        this.undoActions.saveUndoState();
        this.render();
        this.onUndoStateChange?.();
    }

    duplicateSelected(): void {
        this.copySelected();
        // duplicate should not overwrite the OS clipboard when possible, so keep
        // internal buffer hot and let paste fall back to it.
        void this.paste();
    }

    // Return true if the user might be able to paste (either via system clipboard
    // or the internal fallback).
    canPaste(): boolean {
        if (this.clipboard.length > 0) return true;
        try {
            if (typeof (navigator as any).clipboard?.readText === 'function') return true;
        } catch {
            /* non-secure context or permission denied */
        }
        return false;
    }

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
        const hasCb = this.clipboard.length > 0;
        const isNodePrim = this.selectionActions.isUniquePrimitiveSelected() &&
            (first instanceof PrimitivePolygon || first instanceof PrimitiveComplexCurve);

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

    // ─── Keyboard ─────────────────────────────────────────────────────────────

    addKeyboardListeners(): void {
        this.canvas.addEventListener('keydown', (e) => this.onKeyDown(e));
    }

    private onKeyDown(e: KeyboardEvent): void {
        // Don't process canvas shortcuts while in-place text editor is active
        if (this.textEditDialog.isActive()) {
            return;
        }

        const key = e.key.toLowerCase();
        const isCtrlOrMeta = e.ctrlKey || e.metaKey;
        const isAlt = e.altKey;

        // ===== CLIPBOARD OPERATIONS =====
        if (key === 'x' && isCtrlOrMeta) {
            e.preventDefault();
            this.cutSelected();
            return;
        }

        if (key === 'c' && isCtrlOrMeta) {
            e.preventDefault();
            this.copySelected();
            return;
        }

        if (key === 'v' && isCtrlOrMeta) {
            e.preventDefault();
            this.paste();
            return;
        }

        if (key === 'd' && isCtrlOrMeta) {
            e.preventDefault();
            this.duplicateSelected();
            return;
        }

        // ===== FILE OPERATIONS =====
        if (key === 'n' && isCtrlOrMeta) {
            e.preventDefault();
            // Trigger new file via menu bar
            this.menuBar?.newFile();
            return;
        }

        if (key === 'o' && isCtrlOrMeta) {
            e.preventDefault();
            this.menuBar?.openFile();
            return;
        }

        if (key === 's' && isCtrlOrMeta && !e.shiftKey) {
            e.preventDefault();
            this.menuBar?.saveFile();
            return;
        }

        if (key === 's' && isCtrlOrMeta && e.shiftKey) {
            e.preventDefault();
            this.menuBar?.saveFileAs();
            return;
        }

        if (key === 'e' && isCtrlOrMeta) {
            e.preventDefault();
            this.menuBar?.exportFile();
            return;
        }

        if (key === 'p' && isCtrlOrMeta) {
            e.preventDefault();
            this.menuBar?.printFile();
            return;
        }

        if (key === 'w' && isCtrlOrMeta) {
            e.preventDefault();
            this.menuBar?.closeFile();
            return;
        }

        // ===== UNDO/REDO =====
        if (key === 'z' && isCtrlOrMeta && !e.shiftKey) {
            e.preventDefault();
            this.undo();
            return;
        }

        if ((key === 'z' && isCtrlOrMeta && e.shiftKey) || (key === 'y' && isCtrlOrMeta)) {
            e.preventDefault();
            this.redo();
            return;
        }

        // ===== TOOL SELECTION (single key, case-insensitive) =====
        // A or Space or Escape: Selection tool
        if ((key === 'a' || key === ' ') && !isCtrlOrMeta) {
            e.preventDefault();
            this.setTool(ElementsEdtActions.SELECTION);
            this.ghostPrimitive = null;
            this.selRectActive = false;
            this.render();
            return;
        }

        if (key === 'escape') {
            e.preventDefault();
            this.setTool(ElementsEdtActions.SELECTION);
            this.ghostPrimitive = null;
            this.selRectActive = false;
            this.render();
            return;
        }

        // L: Line tool
        if (key === 'l' && !isCtrlOrMeta) {
            e.preventDefault();
            this.setTool(ElementsEdtActions.LINE);
            return;
        }

        // T: Text tool
        if (key === 't' && !isCtrlOrMeta) {
            e.preventDefault();
            this.setTool(ElementsEdtActions.TEXT);
            return;
        }

        // B: Bezier curve tool
        if (key === 'b' && !isCtrlOrMeta) {
            e.preventDefault();
            this.setTool(ElementsEdtActions.BEZIER);
            return;
        }

        // P: Polygon tool
        if (key === 'p' && !isCtrlOrMeta) {
            e.preventDefault();
            this.setTool(ElementsEdtActions.POLYGON);
            return;
        }

        // O: Complex curve tool
        if (key === 'o' && !isCtrlOrMeta) {
            e.preventDefault();
            this.setTool(ElementsEdtActions.COMPLEXCURVE);
            return;
        }

        // E: Ellipse tool
        if (key === 'e' && !isCtrlOrMeta) {
            e.preventDefault();
            this.setTool(ElementsEdtActions.ELLIPSE);
            return;
        }

        // G: Rectangle tool
        if (key === 'g' && !isCtrlOrMeta) {
            e.preventDefault();
            this.setTool(ElementsEdtActions.RECTANGLE);
            return;
        }

        // C: Connection tool
        if (key === 'c' && !isCtrlOrMeta) {
            e.preventDefault();
            this.setTool(ElementsEdtActions.CONNECTION);
            return;
        }

        // I: PCB track tool
        if (key === 'i' && !isCtrlOrMeta) {
            e.preventDefault();
            this.setTool(ElementsEdtActions.PCB_LINE);
            return;
        }

        // Z: PCB pad tool
        if (key === 'z' && !isCtrlOrMeta) {
            e.preventDefault();
            this.setTool(ElementsEdtActions.PCB_PAD);
            return;
        }

        // ===== TRANSFORM OPERATIONS (when something is selected) =====
        // M: Move selected elements
        if (key === 'm' && !isCtrlOrMeta) {
            e.preventDefault();
            this.startMoveSelected();
            return;
        }

        // R: Rotate selected elements
        if (key === 'r' && !isCtrlOrMeta) {
            e.preventDefault();
            this.rotateSelected();
            return;
        }

        // S: Mirror selected elements
        if (key === 's' && !isCtrlOrMeta) {
            e.preventDefault();
            this.mirrorSelected();
            return;
        }

        // Delete or Backspace: Delete selected objects
        if (key === 'delete' || key === 'backspace') {
            e.preventDefault();
            this.deleteSelected();
            return;
        }

        // ===== NUDGE WITH ALT + ARROW KEYS =====
        if (isAlt) {
            const nudgeStep = 1; // 1 logical unit
            let dx = 0, dy = 0;

            if (key === 'arrowleft') {
                e.preventDefault();
                dx = -nudgeStep;
            } else if (key === 'arrowright') {
                e.preventDefault();
                dx = nudgeStep;
            } else if (key === 'arrowup') {
                e.preventDefault();
                dy = nudgeStep;
            } else if (key === 'arrowdown') {
                e.preventDefault();
                dy = -nudgeStep;
            }

            if (dx !== 0 || dy !== 0) {
                this.editorActions.moveAllSelected(dx, dy);
                this.undoActions.saveUndoState();
                this.render();
                this.onUndoStateChange?.();
                return;
            }
        }

        // ===== ZOOM CONTROLS =====
        if (key === '+' || key === '=') {
            e.preventDefault();
            this.zoomIn();
            return;
        }

        if (key === '-') {
            e.preventDefault();
            this.zoomOut();
            return;
        }
    }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    return {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16),
    };
}
