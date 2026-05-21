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
import { Drawing, registerDrawingHooks } from './views/Drawing.js';
import { registerExportHooks } from './views/Export.js';
import { TeXMode } from '../graphic/TeXMode.js';
import '../vendor/katex/katex.min.css';
import { DrawingSize } from '../geom/DrawingSize.js';
import { SelectionActions } from './controllers/SelectionActions.js';
import { UndoActions } from './controllers/UndoActions.js';
import { EditorActions } from './controllers/EditorActions.js';
import { ElementsEdtActions } from './controllers/ElementsEdtActions.js';
import { GraphicPrimitive } from '../primitives/GraphicPrimitive.js';
import { PrimitiveAdvText } from '../primitives/PrimitiveAdvText.js';
import { LayerDesc } from '../layers/LayerDesc.js';
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
import { InputHandler } from './InputHandler.js';
import type { InputCallbacks } from './InputHandler.js';

export class CircuitPanel implements KeyboardHost, EditorFacade {
    private container: HTMLElement;
    private canvasManager: CanvasManager;
    private ghostPreview: GhostPreview;
    private texOverlayManager: TeXOverlay;
    private exportFacade: ExportFacade;
    private macroVectorizer: MacroVectorizer;
    private contextMenuManager: ContextMenuManager;
    private inputHandler: InputHandler;
    private canvas: HTMLCanvasElement;
    private ctx: GraphicsCanvas;
    private model: DrawingModel;
    private parserActions: ParserActions;
    private currentFileName: string = 'circuit.fcd';
    private currentFileHandle: FileSystemFileHandle | null = null;
    private mapCoordinates: MapCoordinates;
    private gridVisible: boolean = true;
    private backgroundColor: string = '#ffffff';
    private gridColor: string = '#6464c8';
    private selectionLTRColor: string = '#008000';
    private selectionRTLColor: string = '#0000ff';
    private renderTeX: boolean = false;
    private drawing: Drawing;

    private selectionActions!: SelectionActions;
    private undoActions!: UndoActions;
    private editorActions!: EditorActions;
    private elementsEdt!: ElementsEdtActions;

    private currentTool: number = ElementsEdtActions.SELECTION;

    private textEditDialog: InPlaceTextEditor;

    onZoomChange: (() => void) | null = null;
    onToolChange: ((toolId: number) => void) | null = null;
    onUndoStateChange: (() => void) | null = null;
    onCoordinatesChange: ((lx: number, ly: number) => void) | null = null;
    onPropertiesRequested: ((prim: GraphicPrimitive) => void) | null = null;
    onBatchPropertiesRequested: ((prims: GraphicPrimitive[]) => void) | null = null;
    onTextEditRequested: ((prim: PrimitiveAdvText, sx: number, sy: number) => void) | null = null;
    onExistingTextEditRequested: ((prim: PrimitiveAdvText) => void) | null = null;
    onSymbolizeRequested: (() => void) | null = null;
    onCancelTextEdit: (() => void) | null = null;
    onSelectionCleared: (() => void) | null = null;

    private clipboardController: ClipboardController;
    private keyboardController: KeyboardController;
    private contextMenu!: ContextMenu;
    private menuBar: MenuBar | null = null;
    private readonly lifecycle = new AbortController();

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
            this.model,
            this.selectionActions,
            this.undoActions,
            () => this.render(),
        );
        this.contextMenuManager = new ContextMenuManager(
            this.contextMenu,
            this.selectionActions,
            this.undoActions,
            this.mapCoordinates,
            this.clipboardController,
            this.canvas,
            {
                onPropertiesRequested: (prim) => this.onPropertiesRequested?.(prim),
                onBatchPropertiesRequested: (prims) => this.onBatchPropertiesRequested?.(prims),
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
            },
        );

        // Initialize keyboard controller
        this.keyboardController = new KeyboardController(this, this.clipboardController);

        // Initialize input handler (gesture state machine + mouse events)
        const inputCb: InputCallbacks = {
            render: () => this.render(),
            onZoomChange: this.onZoomChange,
            onUndoStateChange: this.onUndoStateChange,
            onCoordinatesChange: this.onCoordinatesChange,
            isTextEditActive: () => this.textEditDialog.isActive(),
            commitTextEdit: () => this.textEditDialog.commit(),
            getTool: () => this.currentTool,
            setTool: (id) => this.setTool(id),
            updateGhostPreview: (lx, ly) => this.updateGhostPreview(lx, ly),
            clampCenter: () => this.clampCenter(),
            showContextMenu: (cx, cy) => this.contextMenuManager.show(cx, cy),
            onSelectionCleared: () => this.onSelectionCleared?.(),
        };
        this.inputHandler = new InputHandler(
            this.canvas,
            this.mapCoordinates,
            this.model,
            this.elementsEdt,
            this.editorActions,
            this.undoActions,
            this.selectionActions,
            inputCb,
        );

        // Set initial cursor
        this.inputHandler.updateCursor(this.currentTool);

        // Make canvas focusable for keyboard events
        this.canvas.setAttribute('tabIndex', '0');
        this.canvas.addEventListener('mousedown', () => this.canvas.focus(), {
            signal: this.lifecycle.signal,
        });

        // Prevent browser default context menu; show custom one in SELECTION mode
        this.canvas.addEventListener(
            'contextmenu',
            (e) => {
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
            },
            { signal: this.lifecycle.signal },
        );

        // Mouse wheel zoom (toward cursor)
        this.canvas.addEventListener('wheel', (e) => this.inputHandler.onMouseWheel(e), {
            passive: false,
            signal: this.lifecycle.signal,
        });

        // Drag-to-pan
        this.canvas.addEventListener('mousedown', (e) => this.inputHandler.onMouseDown(e), {
            signal: this.lifecycle.signal,
        });
        this.canvas.addEventListener('mousemove', (e) => this.inputHandler.onMouseMove(e), {
            signal: this.lifecycle.signal,
        });
        this.canvas.addEventListener('mouseup', (e) => this.inputHandler.onMouseUp(e), {
            signal: this.lifecycle.signal,
        });
        this.canvas.addEventListener('mouseleave', (e) => this.inputHandler.onMouseUp(e, true), {
            signal: this.lifecycle.signal,
        });
        this.canvas.addEventListener('dblclick', (e) => this.inputHandler.onDoubleClick(e), {
            signal: this.lifecycle.signal,
        });

        // TeX overlay — positioned on top of canvas for crisp math rendering
        this.texOverlayManager = TeXOverlay.attach(container);

        // Wire up document title updates when the model is modified
        this.model.onTitleUpdate = () => this.updateDocumentTitle();
        this.updateDocumentTitle();
    }

    /** Update the browser tab title to reflect modified state. */
    private updateDocumentTitle(): void {
        const modified = this.model.isModified();
        document.title = (modified ? '* ' : '') + 'FidoCadJS';
    }

    /** Remove all global listeners and observers. Call when the panel is unmounted. */
    destroy(): void {
        this.lifecycle.abort();
        this.keyboardController.detach();
        this.canvasManager.destroy();
    }

    private updateGhostPreview(lx: number, ly: number): void {
        this.inputHandler.setGhostPrimitive(
            this.ghostPreview.updateGhost(lx, ly, this.currentTool, this.elementsEdt, this.model),
        );
    }

    getModel(): DrawingModel {
        return this.model;
    }
    getParserActions(): ParserActions {
        return this.parserActions;
    }
    getMapCoordinates(): MapCoordinates {
        return this.mapCoordinates;
    }
    getAddElements(): AddElements {
        return this.elementsEdt.getAddElements();
    }
    getCanvasElement(): HTMLCanvasElement {
        return this.canvas;
    }

    setGridVisible(visible: boolean): void {
        this.gridVisible = visible;
        this.render();
    }

    isGridVisible(): boolean {
        return this.gridVisible;
    }

    setAntiAlias(antiAlias: boolean): void {
        this.ctx.getCtx().imageSmoothingEnabled = antiAlias;
    }

    setBackgroundColor(c: string): void {
        this.backgroundColor = c;
    }
    setGridColor(c: string): void {
        this.gridColor = c;
    }
    setSelectionLTRColor(c: string): void {
        this.selectionLTRColor = c;
    }
    setSelectionRTLColor(c: string): void {
        this.selectionRTLColor = c;
    }

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

    getZoom(): number {
        return this.mapCoordinates.getXMagnitude();
    }

    isSnapActive(): boolean {
        return this.mapCoordinates.getSnap();
    }
    setSnap(s: boolean): void {
        this.mapCoordinates.setSnap(s);
    }

    getZoomPercent(): number {
        return Math.round((this.mapCoordinates.getXMagnitude() / 20) * 100);
    }

    zoomToFit(): void {
        // When there are no elements, reset to 100 % at the origin.
        if (this.model.isEmpty()) {
            this.mapCoordinates.setXMagnitudeNoCheck(20);
            this.mapCoordinates.setYMagnitudeNoCheck(20);
            this.mapCoordinates.setXCenter(0);
            this.mapCoordinates.setYCenter(0);
            this.render();
            this.onZoomChange?.();
            return;
        }

        const dpr = window.devicePixelRatio || 1;
        const margin = Math.round(10 * dpr);
        const w = Math.max(1, this.container.clientWidth * dpr - 2 * margin);
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

        this.ctx.clearDirtyRect();
        this.ctx.markDirtyFull(width, height);

        // Clear canvas with background color through the graphics wrapper so the
        // tracked colour stays in sync with the real fillStyle. Clearing via the
        // raw ctx would desync GraphicsCanvas.currentColor and could hide filled
        // layer-0 primitives (e.g. connection dots) when the grid is disabled.
        const bg = hexToRgb(this.backgroundColor);
        this.ctx.setColor(new ColorCanvas(bg.r, bg.g, bg.b));
        this.ctx.fillRect(0, 0, width, height);

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
        const st = this.inputHandler.state;
        if (st.selRectActive) {
            ctx.save();
            const rx1 = st.selStartScreenX;
            const ry1 = st.selStartScreenY;
            const rx2 = st.selRectSx2;
            const ry2 = st.selRectSy2;
            ctx.strokeStyle = st.selRectLtoR ? this.selectionLTRColor : this.selectionRTLColor;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(
                Math.min(rx1, rx2),
                Math.min(ry1, ry2),
                Math.abs(rx2 - rx1),
                Math.abs(ry2 - ry1),
            );
            ctx.restore();
        }

        // Draw ghost (live preview for drawing tools)
        if (st.ghostPrimitive !== null) {
            ctx.save();
            ctx.globalAlpha = 0.4;
            st.ghostPrimitive.draw(this.ctx, this.mapCoordinates, this.model.getLayers());
            ctx.restore();
        }

        // Sync TeX overlay when LaTeX rendering is enabled
        this.texOverlayManager.sync(this.model, this.mapCoordinates, window.devicePixelRatio || 1);

        this.model.setChanged(false);
    }

    loadCircuit(circuitText: string): void {
        this.parserActions.parseString(circuitText);
        this.model.setModified(true);
        if (this.model.getPrimitiveVector().length > 0) {
            this.zoomToFit();
        } else {
            this.render();
        }
    }

    getCircuitText(): string {
        return this.parserActions.getText(true);
    }

    /** Mark the model as saved (clean). Called after a successful save. */
    markAsSaved(): void {
        this.model.setModified(false);
    }

    /** Name of the file currently associated with this circuit. */
    getFileName(): string {
        return this.currentFileName;
    }

    setFileName(name: string): void {
        this.currentFileName = name;
    }

    /**
     * Handle to the file last chosen via the File System Access API, if any.
     * Lets a plain "Save" write back to the same file without re-prompting.
     */
    getFileHandle(): FileSystemFileHandle | null {
        return this.currentFileHandle;
    }

    setFileHandle(handle: FileSystemFileHandle | null): void {
        this.currentFileHandle = handle;
    }

    /**
     * Try to activate the macro whose single-letter shortcut matches the given key.
     * Returns true if a macro was found and activated, false otherwise.
     */
    tryMacroKeyShortcut(key: string): boolean {
        const library = this.model.getLibrary();
        for (const [macroName, macroDesc] of library) {
            const macroKey = (macroDesc as any).key;
            if (macroKey && String(macroKey).toLowerCase() === key.toLowerCase()) {
                // Switch to macro tool with this macro pre-selected
                this.setMacroTool(macroName);
                this.render();
                return true;
            }
        }
        return false;
    }

    exportSVG(): string {
        return this.exportFacade.exportSVG();
    }

    exportPGF(): string {
        return this.exportFacade.exportPGF();
    }

    exportTikZ(): string {
        return this.exportFacade.exportTikZ();
    }

    exportPDF(): string {
        return this.exportFacade.exportPDF();
    }

    setTool(toolId: number): void {
        this.currentTool = toolId;
        this.elementsEdt.setState(toolId);
        // Drop any in-progress ghost preview so it can't linger after the tool
        // changes (e.g. right-click cancelling a partially-drawn line).
        this.inputHandler.setGhostPrimitive(null);
        this.inputHandler.updateCursor(toolId);
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
        this.model.setModified(true);
        this.render();
        this.onUndoStateChange?.();
    }

    redo(): void {
        this.undoActions.redo();
        this.model.setModified(true);
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

    getSelectedPrimitives(): GraphicPrimitive[] {
        return this.selectionActions.getSelectedPrimitives();
    }

    deleteSelected(): void {
        this.editorActions.deleteAllSelected(true);
        this.model.setModified(true);
        this.render();
        this.onUndoStateChange?.();
    }

    rotateSelected(): void {
        this.editorActions.rotateAllSelected();
        this.model.setModified(true);
        this.render();
        this.onUndoStateChange?.();
    }

    mirrorSelected(): void {
        this.editorActions.mirrorAllSelected();
        this.model.setModified(true);
        this.render();
        this.onUndoStateChange?.();
    }

    alignLeftSelected(): void {
        this.editorActions.alignLeftSelected();
        this.render();
        this.onUndoStateChange?.();
    }
    alignRightSelected(): void {
        this.editorActions.alignRightSelected();
        this.render();
        this.onUndoStateChange?.();
    }
    alignTopSelected(): void {
        this.editorActions.alignTopSelected();
        this.render();
        this.onUndoStateChange?.();
    }
    alignBottomSelected(): void {
        this.editorActions.alignBottomSelected();
        this.render();
        this.onUndoStateChange?.();
    }
    alignHorizontalCenterSelected(): void {
        this.editorActions.alignHorizontalCenterSelected();
        this.render();
        this.onUndoStateChange?.();
    }
    alignVerticalCenterSelected(): void {
        this.editorActions.alignVerticalCenterSelected();
        this.render();
        this.onUndoStateChange?.();
    }
    distributeHorizontallySelected(): void {
        this.editorActions.distributeHorizontallySelected();
        this.render();
        this.onUndoStateChange?.();
    }
    distributeVerticallySelected(): void {
        this.editorActions.distributeVerticallySelected();
        this.render();
        this.onUndoStateChange?.();
    }

    setMenuBar(menuBar: MenuBar): void {
        this.menuBar = menuBar;
    }

    startMoveSelected(): void {
        this.inputHandler.beginMoveSelected();
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
                    const filtered = prims.filter((p) => p !== prim);
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
            },
        );
    }

    clearCircuit(): void {
        this.model.getPrimitiveVector().splice(0);
        this.undoActions.reset();
        this.selectionActions.setSelectionAll(false);
        this.inputHandler.clearGhostAndSelection();
        this.render();
        this.onUndoStateChange?.();
    }

    // ─── KeyboardHost interface implementation ───────────────────────────────

    isTextEditActive(): boolean {
        return this.textEditDialog.isActive();
    }
    getMenuBar(): MenuBar | null {
        return this.menuBar;
    }
    cancelTextEdit(): void {
        this.onCancelTextEdit?.();
    }
    deselectAll(): void {
        this.selectionActions.setSelectionAll(false);
    }
    clearGhostAndSelection(): void {
        this.inputHandler.clearGhostAndSelection();
    }
    nudgeSelected(dx: number, dy: number): void {
        this.editorActions.moveAllSelected(dx, dy);
        // moveAllSelected already saves undo state — do not double-save
        this.render();
        this.onUndoStateChange?.();
    }

    // ─── Clipboard (delegated) ───────────────────────────────────────────────

    copySelected(): void {
        this.clipboardController.copySelected();
    }
    cutSelected(): void {
        this.clipboardController.cutSelected();
    }
    async paste(): Promise<void> {
        await this.clipboardController.paste();
    }
    duplicateSelected(): void {
        this.clipboardController.duplicateSelected();
    }
    canPaste(): boolean {
        return this.clipboardController.canPaste();
    }

    async copyAsImage(): Promise<void> {
        try {
            const { renderToOffscreen } = await import('../export/ExportBitmap.js');
            const { defaultBitmapOptions } = await import('../export/ExportBitmapOptions.js');
            const opts = defaultBitmapOptions();
            opts.dpi = 150;
            const canvas = renderToOffscreen(this.model, opts);
            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((b) => {
                    if (b) resolve(b);
                    else reject(new Error('toBlob returned null'));
                }, 'image/png');
            });
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        } catch (e) {
            console.error('Copy as Image failed:', e);
        }
    }

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

    // ─── Background image ────────────────────────────────────────────────────

    async attachImage(file: File): Promise<void> {
        await this.model.getImgCanvas().attachFile(file);
        this.render();
    }

    detachImage(): void {
        this.model.getImgCanvas().detach();
        this.render();
    }

    isImageAttached(): boolean {
        return this.model.getImgCanvas().isAttached();
    }

    getImageAlpha(): number {
        return this.model.getImgCanvas().getAlpha();
    }

    setImageAlpha(a: number): void {
        this.model.getImgCanvas().setAlpha(a);
        this.render();
    }

    getImageScale(): number {
        return this.model.getImgCanvas().getScale();
    }

    setImageScale(s: number): void {
        this.model.getImgCanvas().setScale(s);
        this.render();
    }

    getImageX(): number {
        return this.model.getImgCanvas().getX();
    }

    setImageX(x: number): void {
        this.model.getImgCanvas().setX(x);
        this.render();
    }

    getImageY(): number {
        return this.model.getImgCanvas().getY();
    }

    setImageY(y: number): void {
        this.model.getImgCanvas().setY(y);
        this.render();
    }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    return {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16),
    };
}
