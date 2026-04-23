import { DrawingModel } from './model/DrawingModel.js';
import { ParserActions } from './controllers/ParserActions.js';
import { MapCoordinates } from '../geom/MapCoordinates.js';
import { GraphicsCanvas } from '../graphic/canvas/GraphicsCanvas.js';
import { ColorCanvas } from '../graphic/canvas/ColorCanvas.js';
import { StandardLayers } from '../layers/StandardLayers.js';
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
import { TextEditDialog } from '../ui/TextEditDialog.js';

export class CircuitPanel {
    private canvas: HTMLCanvasElement;
    private ctx: GraphicsCanvas;
    private model: DrawingModel;
    private parserActions: ParserActions;
    private mapCoordinates: MapCoordinates;
    private gridVisible: boolean = true;
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
    private dragHandleIndex: number = GraphicPrimitive.NO_DRAG;
    private dragHandlePrim: GraphicPrimitive | null = null;
    private ghostPrimitive: GraphicPrimitive | null = null;
    private lastScreenX: number = 0;
    private lastScreenY: number = 0;
    private textEditDialog: TextEditDialog;

    onZoomChange: (() => void) | null = null;
    onToolChange: ((toolId: number) => void) | null = null;
    onUndoStateChange: (() => void) | null = null;
    onCoordinatesChange: ((lx: number, ly: number) => void) | null = null;
    onPropertiesRequested: ((prim: GraphicPrimitive) => void) | null = null;
    onTextEditRequested: ((prim: PrimitiveAdvText, sx: number, sy: number) => void) | null = null;

    private pendingDblClick = false;

    constructor(container: HTMLElement) {
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

        // Initialize drawing view
        this.drawing = new Drawing(this.model);

        // Initialize text edit dialog
        this.textEditDialog = new TextEditDialog();

        // Set initial cursor
        this.canvas.style.cursor = this.cursorForTool(this.currentTool);

        // Make canvas focusable for keyboard events
        this.canvas.setAttribute('tabIndex', '0');
        this.canvas.addEventListener('click', () => this.canvas.focus());

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

        // Handle ZOOM tool
        if (this.currentTool === ElementsEdtActions.ZOOM) {
            const factor = e.button === 2 ? (1 / 1.3) : 1.3;
            this.zoomAtCursor(sx, sy, factor);
            return;
        }

        // Pan: middle button or left button + HAND tool
        if (e.button === 1 || (e.button === 0 && this.currentTool === ElementsEdtActions.HAND)) {
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
            if (this.currentTool === ElementsEdtActions.SELECTION) {
                const handleIdx = this.findHandleAt(sx, sy);
                if (handleIdx !== GraphicPrimitive.NO_DRAG && this.dragHandlePrim !== null) {
                    this.dragHandleIndex = handleIdx;
                    return;
                }
                // Start rubber-band selection
                this.selRectActive = true;
                this.selRectLogX1 = lx;
                this.selRectLogY1 = ly;
                this.selRectLogX2 = lx;
                this.selRectLogY2 = ly;
                this.selRectLtoR = true;
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

        if (this.isPanning) {
            const panDx = (e.clientX - this.panStartX) * dpr;
            const panDy = (e.clientY - this.panStartY) * dpr;
            this.mapCoordinates.setXCenter(this.panStartCX + panDx);
            this.mapCoordinates.setYCenter(this.panStartCY + panDy);
            this.render();
            return;
        }

        if (this.selRectActive) {
            this.selRectLogX2 = lx;
            this.selRectLogY2 = ly;
            this.selRectLtoR = lx >= this.selRectLogX1;
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

    private onMouseUp(_e: MouseEvent): void {
        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = this.cursorForTool(this.currentTool);
            return;
        }

        if (this.selRectActive) {
            const x1 = Math.min(this.selRectLogX1, this.selRectLogX2);
            const y1 = Math.min(this.selRectLogY1, this.selRectLogY2);
            const w = Math.abs(this.selRectLogX2 - this.selRectLogX1);
            const h = Math.abs(this.selRectLogY2 - this.selRectLogY1);
            this.editorActions.selectRect(x1, y1, w, h);
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
        }
    }

    getModel(): DrawingModel { return this.model; }
    getParserActions(): ParserActions { return this.parserActions; }
    getMapCoordinates(): MapCoordinates { return this.mapCoordinates; }

    setGridVisible(visible: boolean): void {
        this.gridVisible = visible;
        this.render();
    }

    isGridVisible(): boolean { return this.gridVisible; }

    setAntiAlias(antiAlias: boolean): void {
        this.ctx.getCtx().imageSmoothingEnabled = antiAlias;
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

    getZoomPercent(): number {
        return Math.round((this.mapCoordinates.getXMagnitude() / 20) * 100);
    }

    zoomToFit(): void {
        const newCs = DrawingSize.calculateZoomToFit(
            this.model,
            this.canvas.width,
            this.canvas.height,
            true
        );
        this.mapCoordinates.setXMagnitudeNoCheck(newCs.getXMagnitude());
        this.mapCoordinates.setYMagnitudeNoCheck(newCs.getYMagnitude());
        this.mapCoordinates.setXCenter(newCs.getXCenter());
        this.mapCoordinates.setYCenter(newCs.getYCenter());
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
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Reset transform and clipping
        ctx.save();
        ctx.resetTransform();
        ctx.clearRect(0, 0, width, height);
        ctx.restore();

        // Draw grid
        if (this.gridVisible) {
            const gridDotsColor = new ColorCanvas(100, 100, 200);  // More visible blue
            const gridLinesColor = new ColorCanvas(150, 150, 220); // More visible light blue
            this.ctx.drawGrid(
                this.mapCoordinates,
                0, 0, width, height,
                gridDotsColor,
                gridLinesColor
            );
        }

        // Draw primitives via the Drawing view (correct layer ordering, macro support)
        this.mapCoordinates.resetMinMax();
        this.drawing.draw(this.ctx, this.mapCoordinates);

        // Draw handles for selected elements
        this.drawing.drawSelectedHandles(this.ctx, this.mapCoordinates);

        // Draw rubber-band selection rect
        if (this.selRectActive) {
            ctx.save();
            const sx1 = this.mapCoordinates.mapX(this.selRectLogX1, 0);
            const sy1 = this.mapCoordinates.mapY(0, this.selRectLogY1);
            const sx2 = this.mapCoordinates.mapX(this.selRectLogX2, 0);
            const sy2 = this.mapCoordinates.mapY(0, this.selRectLogY2);
            ctx.strokeStyle = this.selRectLtoR ? '#008000' : '#0000ff';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(
                Math.min(sx1, sx2), Math.min(sy1, sy2),
                Math.abs(sx2 - sx1), Math.abs(sy2 - sy1)
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

    showTextEdit(screenX: number, screenY: number, prim: PrimitiveAdvText): void {
        this.textEditDialog.show(
            screenX, screenY,
            prim.getString(),
            (value) => {
                prim.setString(value);
                prim.setChanged(true);
                this.model.setChanged(true);
                this.render();
            },
            () => {
                // Cancel: remove the newly placed primitive
                const prims = this.model.getPrimitiveVector();
                const filtered = prims.filter(p => p !== prim);
                this.model.setPrimitiveVector(filtered);
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

    addKeyboardListeners(): void {
        this.canvas.addEventListener('keydown', (e) => this.onKeyDown(e));
    }

    private onKeyDown(e: KeyboardEvent): void {
        const key = e.key.toLowerCase();
        const isCtrlOrMeta = e.ctrlKey || e.metaKey;

        if (key === 'delete' || key === 'backspace') {
            e.preventDefault();
            this.deleteSelected();
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

        if (key === 'r' && !isCtrlOrMeta) {
            e.preventDefault();
            this.rotateSelected();
            return;
        }

        if (key === 's' && !isCtrlOrMeta) {
            e.preventDefault();
            this.mirrorSelected();
            return;
        }

        if (key === 'a' && isCtrlOrMeta) {
            e.preventDefault();
            this.selectAll();
            return;
        }

        if (key === 'z' && isCtrlOrMeta) {
            e.preventDefault();
            this.undo();
            return;
        }

        if (key === 'y' && isCtrlOrMeta) {
            e.preventDefault();
            this.redo();
            return;
        }

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
