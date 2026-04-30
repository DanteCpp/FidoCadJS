/**
 * @file DialogSymbolize.ts
 * @author Dante Loi
 * @date 2026-04-27
 * @brief "Symbol-o-matic" dialog for creating new library macros from selected primitives.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 *
 * Browser port of fidocadj.dialogs.DialogSymbolize (Phylum2, Davide Bucci, 2012-2023).
 * Shows selected primitives in a preview panel with a draggable origin crosshair.
 * On OK, builds a MacroDesc and adds it to the library model.
 */

import type { CircuitPanel } from '../circuit/CircuitPanel.js';
import { DrawingModel } from '../circuit/model/DrawingModel.js';
import type { LibraryModel } from '../librarymodel/LibraryModel.js';
import { ParserActions } from '../circuit/controllers/ParserActions.js';
import { Drawing, registerDrawingHooks } from '../circuit/views/Drawing.js';
import { GraphicsCanvas } from '../graphic/canvas/GraphicsCanvas.js';
import { DrawingSize } from '../geom/DrawingSize.js';
import { MapCoordinates } from '../geom/MapCoordinates.js';
import { MacroDesc } from '../primitives/MacroDesc.js';
import { LibUtils } from '../librarymodel/LibUtils.js';
import { StandardLayers } from '../layers/StandardLayers.js';
import { UserLibraryStorage } from '../librarymodel/UserLibraryStorage.js';

export class DialogSymbolize {
    private readonly drawingModel: DrawingModel;
    private readonly libraryModel: LibraryModel;
    private readonly onSaved: () => void;

    // UI elements
    private overlay!: HTMLElement;
    private libFilenameInput!: HTMLInputElement;
    private libNameInput!: HTMLInputElement;
    private groupInput!: HTMLInputElement;
    private macroNameInput!: HTMLInputElement;
    private keyInput!: HTMLInputElement;
    private snapCheckbox!: HTMLInputElement;
    private previewCanvas!: HTMLCanvasElement;
    private previewModel!: DrawingModel;
    private previewParser!: ParserActions;
    private previewGraphics!: GraphicsCanvas;
    private previewDrawing!: Drawing;
    private previewMapCoords!: MapCoordinates;

    // Draggable origin state (logical coords; initialized by buildPreviewModel())
    private originLx: number = 0;
    private originLy: number = 0;
    private gridVisible: boolean = false;
    private isDragging: boolean = false;
    private resizeObserver: ResizeObserver | null = null;

    constructor(_circuitPanel: CircuitPanel, drawingModel: DrawingModel, libraryModel: LibraryModel, onSaved: () => void) {
        this.drawingModel = drawingModel;
        this.libraryModel = libraryModel;
        this.onSaved = onSaved;
    }

    show(): void {
        registerDrawingHooks();
        this.buildUI();
        this.populateDefaults();
        document.body.appendChild(this.overlay);

        // Initialize preview after DOM attachment
        requestAnimationFrame(() => {
            this.initPreview();
            this.buildPreviewModel();
            this.refreshPreview();
        });
    }

    // ── UI Construction ───────────────────────────────────────────────────────

    private buildUI(): void {
        this.overlay = document.createElement('div');
        this.overlay.style.cssText =
            'position:fixed; top:0; left:0; right:0; bottom:0; z-index:10000; ' +
            'background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; ' +
            'font-family:sans-serif; font-size:12px;';

        const dialog = document.createElement('div');
        dialog.style.cssText =
            'background:white; border-radius:6px; box-shadow:0 4px 24px rgba(0,0,0,0.3); ' +
            'width:560px; max-height:90vh; display:flex; flex-direction:column;';

        // ── Title bar ──────────────────────────────────────────────────────
        const titleBar = document.createElement('div');
        titleBar.style.cssText =
            'padding:10px 16px; background:#f0f0f0; border-bottom:1px solid #ddd; ' +
            'display:flex; align-items:center; justify-content:space-between; flex-shrink:0;';
        const title = document.createElement('span');
        title.textContent = 'Symbol-o-matic';
        title.style.cssText = 'font-weight:bold; font-size:13px;';
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = 'border:none; background:none; cursor:pointer; font-size:14px; color:#888;';
        closeBtn.addEventListener('click', () => this.close());
        titleBar.appendChild(title);
        titleBar.appendChild(closeBtn);
        dialog.appendChild(titleBar);

        // ── Body (scrollable) ──────────────────────────────────────────────
        const body = document.createElement('div');
        body.style.cssText = 'padding:16px; overflow-y:auto; flex:1;';

        // Lib filename row
        body.appendChild(this.buildFieldRow('Library filename:', () => {
            this.libFilenameInput = document.createElement('input');
            this.libFilenameInput.type = 'text';
            this.libFilenameInput.style.cssText = 'flex:1; padding:4px 6px; font-size:12px; border:1px solid #ccc; border-radius:2px;';
            return this.libFilenameInput;
        }));

        // Lib name row
        body.appendChild(this.buildFieldRow('Library name:', () => {
            this.libNameInput = document.createElement('input');
            this.libNameInput.type = 'text';
            this.libNameInput.style.cssText = 'flex:1; padding:4px 6px; font-size:12px; border:1px solid #ccc; border-radius:2px;';
            return this.libNameInput;
        }));

        // Preview container
        const previewLabel = document.createElement('div');
        previewLabel.textContent = 'Origin (drag crosshair, right-click=toggle grid):';
        previewLabel.style.cssText = 'font-size:11px; color:#666; margin-bottom:2px;';
        body.appendChild(previewLabel);

        const previewContainer = document.createElement('div');
        previewContainer.style.cssText =
            'width:100%; height:200px; border:1px solid #ccc; border-radius:2px; ' +
            'margin-bottom:10px; position:relative; overflow:hidden; background:#fff;';
        this.previewCanvas = document.createElement('canvas');
        this.previewCanvas.style.cssText = 'display:block; width:100%; height:100%;';
        previewContainer.appendChild(this.previewCanvas);
        body.appendChild(previewContainer);

        // Group row
        body.appendChild(this.buildFieldRow('Group:', () => {
            this.groupInput = document.createElement('input');
            this.groupInput.type = 'text';
            this.groupInput.style.cssText = 'flex:1; padding:4px 6px; font-size:12px; border:1px solid #ccc; border-radius:2px;';
            return this.groupInput;
        }));

        // Macro name row
        body.appendChild(this.buildFieldRow('Name:', () => {
            this.macroNameInput = document.createElement('input');
            this.macroNameInput.type = 'text';
            this.macroNameInput.style.cssText = 'flex:1; padding:4px 6px; font-size:12px; border:1px solid #ccc; border-radius:2px;';
            return this.macroNameInput;
        }));

        // Key row
        const keyRow = document.createElement('div');
        keyRow.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:8px;';
        const keyLabel = document.createElement('span');
        keyLabel.textContent = 'Key:';
        keyLabel.style.cssText = 'min-width:100px; font-size:12px; color:#333;';
        this.keyInput = document.createElement('input');
        this.keyInput.type = 'text';
        this.keyInput.style.cssText = 'flex:1; padding:4px 6px; font-size:12px; border:1px solid #ccc; border-radius:2px;';
        this.keyInput.addEventListener('input', () => this.validateKeyVisual());
        keyRow.appendChild(keyLabel);
        keyRow.appendChild(this.keyInput);
        body.appendChild(keyRow);

        // Snap checkbox
        const snapRow = document.createElement('div');
        snapRow.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:8px;';
        this.snapCheckbox = document.createElement('input');
        this.snapCheckbox.type = 'checkbox';
        this.snapCheckbox.id = 'snapToGrid';
        const snapLabel = document.createElement('label');
        snapLabel.htmlFor = 'snapToGrid';
        snapLabel.textContent = 'Snap origin to grid';
        snapLabel.style.cssText = 'font-size:12px; color:#333;';
        snapRow.appendChild(this.snapCheckbox);
        snapRow.appendChild(snapLabel);
        body.appendChild(snapRow);

        dialog.appendChild(body);

        // ── Buttons ────────────────────────────────────────────────────────
        const btnRow = document.createElement('div');
        btnRow.style.cssText =
            'padding:12px 16px; border-top:1px solid #ddd; display:flex; justify-content:flex-end; gap:8px; flex-shrink:0;';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText =
            'padding:6px 16px; border:1px solid #ccc; border-radius:3px; background:#f5f5f5; cursor:pointer; font-size:12px;';
        cancelBtn.addEventListener('click', () => this.close());

        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        okBtn.style.cssText =
            'padding:6px 16px; border:1px solid #5a8fc0; border-radius:3px; ' +
            'background:#5a8fc0; color:white; cursor:pointer; font-size:12px;';
        okBtn.addEventListener('click', () => this.onOk());

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(okBtn);
        dialog.appendChild(btnRow);

        this.overlay.appendChild(dialog);

        // Close on Escape
        this.overlay.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Escape') this.close();
        });

        // Close on backdrop click
        this.overlay.addEventListener('click', (e: MouseEvent) => {
            if (e.target === this.overlay) this.close();
        });
    }

    private buildFieldRow(label: string, createInput: () => HTMLElement): HTMLElement {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:8px;';
        const lbl = document.createElement('span');
        lbl.textContent = label;
        lbl.style.cssText = 'min-width:100px; font-size:12px; color:#333;';
        row.appendChild(lbl);
        row.appendChild(createInput());
        return row;
    }

    // ── Preview Initialization ────────────────────────────────────────────────

    private initPreview(): void {
        this.previewModel = new DrawingModel();
        this.previewModel.setLayers(StandardLayers.createStandardLayers());
        this.previewModel.setLibrary(this.drawingModel.getLibrary());

        this.previewParser = new ParserActions(this.previewModel);
        this.previewGraphics = new GraphicsCanvas(this.previewCanvas);
        this.previewDrawing = new Drawing(this.previewModel);

        // Setup coordinate mapping for the preview canvas
        this.previewMapCoords = new MapCoordinates();

        // Mouse handlers for dragging origin
        this.previewCanvas.addEventListener('mousedown', (e) => {
            if (e.button === 2) {
                // Right-click: toggle grid
                this.gridVisible = !this.gridVisible;
                this.refreshPreview();
                return;
            }
            if (e.button === 0) {
                this.isDragging = true;
                this.updateOriginFromMouse(e);
                this.refreshPreview();
            }
        });
        this.previewCanvas.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                this.updateOriginFromMouse(e);
                this.refreshPreview();
            }
        });
        this.previewCanvas.addEventListener('mouseup', () => {
            this.isDragging = false;
        });
        this.previewCanvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
        });
        this.previewCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Re-fit when the container is resized.
        const container = this.previewCanvas.parentElement;
        if (container && typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => {
                this.buildPreviewModel();
                this.refreshPreview();
            });
            this.resizeObserver.observe(container);
        }
    }

    /**
     * Builds the preview model and computes zoom-to-fit ONCE.
     *
     * Mirrors fidocadj.dialogs.DialogSymbolize init flow: the preview macro
     * is built with origin (100, 100) and the origin marker is reset to the
     * logical coords corresponding to canvas pixel (10, 10). The marker is
     * then dragged independently — without rebuilding the model or re-fitting.
     * Name/key/group/lib are metadata-only (MacroDesc), so editing those
     * fields never invalidates the preview.
     */
    private buildPreviewModel(): void {
        const container = this.previewCanvas.parentElement;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const w = Math.floor(rect.width);
        const h = Math.floor(rect.height);
        if (w <= 0 || h <= 0) return;

        this.previewModel.getPrimitiveVector().length = 0;
        const tmp = this.buildMacro('temp', 'temp', 'temp', 'temp', 'temp', { x: 100, y: 100 });
        if (!tmp) return;
        this.previewParser.addString(tmp.description, false);

        const mc = DrawingSize.calculateZoomToFit(
            this.previewModel,
            Math.floor(w * 0.8),
            Math.floor(h * 0.8),
            true
        );
        mc.setXCenter(mc.getXCenter() + 10);
        mc.setYCenter(mc.getYCenter() + 10);
        this.previewMapCoords = mc;

        // Mirrors OriginCircuitPanel.resetOrigin(): place marker near pixel (10, 10).
        this.originLx = mc.unmapXsnap(10);
        this.originLy = mc.unmapYsnap(10);
    }

    private updateOriginFromMouse(e: MouseEvent): void {
        const rect = this.previewCanvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        if (this.snapCheckbox.checked) {
            this.originLx = this.previewMapCoords.unmapXsnap(sx);
            this.originLy = this.previewMapCoords.unmapYsnap(sy);
        } else {
            this.originLx = this.previewMapCoords.unmapXnosnap(sx);
            this.originLy = this.previewMapCoords.unmapYnosnap(sy);
        }
    }

    private refreshPreview(): void {
        const container = this.previewCanvas.parentElement;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const w = Math.floor(rect.width);
        const h = Math.floor(rect.height);
        if (w <= 0 || h <= 0) return;

        const dpr = window.devicePixelRatio || 1;
        this.previewCanvas.width = Math.floor(w * dpr);
        this.previewCanvas.height = Math.floor(h * dpr);

        const mc = this.previewMapCoords;
        const ctx = this.previewCanvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);

        this.previewGraphics.setZoom(dpr);
        this.previewGraphics.clearDirtyRect();
        this.previewGraphics.markDirtyFull(this.previewCanvas.width, this.previewCanvas.height);

        ctx.save();
        if (dpr !== 1) ctx.scale(dpr, dpr);

        if (this.gridVisible) {
            this.drawGrid(ctx, w, h, dpr);
        }

        this.previewDrawing.draw(this.previewGraphics, mc);

        const ox = mc.mapXi(this.originLx, this.originLy, false);
        const oy = mc.mapYi(this.originLx, this.originLy, false);
        ctx.save();
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, oy);
        ctx.lineTo(w, oy);
        ctx.moveTo(ox, 0);
        ctx.lineTo(ox, h);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(ox, oy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '11px sans-serif';
        ctx.fillText('Origin', ox + 5, oy - 5);
        ctx.restore();

        ctx.restore();
    }

    private drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, _dpr: number): void {
        const gridStep = 10;
        ctx.strokeStyle = '#c8c8ff';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let x = 0; x < w; x += gridStep) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
        }
        for (let y = 0; y < h; y += gridStep) {
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
        }
        ctx.stroke();
    }

    // ── Populate form fields ──────────────────────────────────────────────────

    populateDefaults(): void {
        // Enumerate non-standard library prefixes
        const prefixes: string[] = [];
        const masterMap = this.libraryModel.getAllMacros();
        for (const md of masterMap.values()) {
            if (!LibUtils.isStdLib(md) && md.filename && !prefixes.includes(md.filename)) {
                prefixes.push(md.filename);
            }
        }

        if (prefixes.length > 0) {
            const defaultPrefix = prefixes[0]!;
            this.libFilenameInput.value = defaultPrefix;
            this.libNameInput.value = LibUtils.getLibName(masterMap, defaultPrefix) ?? '';
            const groups = LibUtils.enumGroups(masterMap, defaultPrefix);
            this.groupInput.value = groups.length > 0 ? groups[0]! : 'group';
        } else {
            this.libFilenameInput.value = 'user_lib';
            this.libNameInput.value = 'User Library';
            this.groupInput.value = 'group';
        }

        this.macroNameInput.value = 'name';
        this.generateUniqueKey();
    }

    private generateUniqueKey(): void {
        const prefix = this.libFilenameInput.value.trim() || 'user_lib';
        const masterMap = this.libraryModel.getAllMacros();

        for (let attempt = 0; attempt < 50; attempt++) {
            const baseKey = Math.random().toString(36).slice(2, 8);
            const fullKey = `${prefix}.${baseKey}`.toLowerCase();
            if (!LibUtils.checkKey(masterMap, prefix, fullKey)) {
                this.keyInput.value = baseKey;
                this.validateKeyVisual();
                return;
            }
        }
        this.keyInput.value = Math.random().toString(36).slice(2, 8);
        this.validateKeyVisual();
    }

    private validateKeyVisual(): void {
        const key = this.keyInput.value.trim();
        if (key.length === 0) {
            this.keyInput.style.background = '#ff6666';
            this.keyInput.style.color = '#fff';
            return;
        }
        if (LibUtils.checkKeyInvalidChars(key)) {
            this.keyInput.style.background = '#ff6666';
            this.keyInput.style.color = '#fff';
            return;
        }
        const prefix = this.libFilenameInput.value.trim();
        const fullKey = `${prefix}.${key}`.toLowerCase();
        if (LibUtils.checkKey(this.libraryModel.getAllMacros(), prefix, fullKey)) {
            this.keyInput.style.background = '#ff6666';
            this.keyInput.style.color = '#fff';
            return;
        }
        this.keyInput.style.background = '';
        this.keyInput.style.color = '';
    }

    // ── Macro building ────────────────────────────────────────────────────────

    private buildMacro(
        myname: string, mykey: string, mylib: string,
        mygrp: string, myprefix: string, origin: { x: number; y: number }
    ): MacroDesc | null {
        // Check if anything is selected
        let hasSelection = false;
        for (const prim of this.drawingModel.getPrimitiveVector()) {
            if (prim.isSelected()) { hasSelection = true; break; }
        }
        if (!hasSelection) return null;

        // Clone selected primitives into a temp DrawingModel
        const tempModel = new DrawingModel();
        tempModel.setLibrary(this.drawingModel.getLibrary());
        const tempParser = new ParserActions(tempModel);

        for (const prim of this.drawingModel.getPrimitiveVector()) {
            if (prim.isSelected()) {
                const str = prim.toString(true);
                tempParser.addString(str, true);
            }
        }

        // Move each cloned primitive relative to the origin
        const descParts: string[] = [];
        for (const p of tempModel.getPrimitiveVector()) {
            if (p.isSelected()) {
                p.movePrimitive(origin.x, origin.y);
                descParts.push(p.toString(true));
            }
        }

        const desc = descParts.join('');
        const fullKey = `${myprefix}.${mykey}`.toLowerCase();
        return new MacroDesc(fullKey, myname, desc, mygrp, mylib, myprefix);
    }

    // ── OK / Cancel ───────────────────────────────────────────────────────────

    private onOk(): void {
        const key = this.keyInput.value.trim();
        const prefix = this.libFilenameInput.value.trim();
        const fullKey = `${prefix}.${key}`.toLowerCase();

        if (key.length === 0) {
            alert('Invalid key.');
            this.keyInput.focus();
            return;
        }
        if (LibUtils.checkKeyInvalidChars(key)) {
            alert('The key must not contain spaces or "."');
            this.keyInput.focus();
            return;
        }
        if (LibUtils.checkKey(this.libraryModel.getAllMacros(), prefix, fullKey)) {
            alert('The specified key is already in use or contains forbidden characters.');
            this.keyInput.focus();
            return;
        }

        const macro = this.buildMacro(
            this.macroNameInput.value.trim() || 'name',
            key,
            this.libNameInput.value.trim() || 'User Library',
            this.groupInput.value.trim() || 'group',
            prefix,
            { x: 200 - this.originLx, y: 200 - this.originLy }
        );

        if (!macro) {
            alert('No primitives selected for symbol creation.');
            return;
        }

        // Add to master library map
        this.drawingModel.getLibrary().set(macro.key, macro);

        // Persist user library
        try {
            UserLibraryStorage.saveUserLibrary(prefix, this.libraryModel.getAllMacros(),
                this.libNameInput.value.trim() || 'User Library');
        } catch {
            alert('Cannot save library. Check storage availability.');
        }

        // Rebuild the library model tree and refresh the picker
        this.libraryModel.forceUpdate();
        this.onSaved();

        this.close();
    }

    private close(): void {
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        this.overlay.remove();
    }
}
