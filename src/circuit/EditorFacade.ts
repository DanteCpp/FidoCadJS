/**
 * @file EditorFacade.ts
 * @author Dante Loi
 * @date 2026-05-13
 * @brief Narrow interface that UI components consume instead of concrete CircuitPanel
 * @copyright Copyright 2026 Dante Loi - GPL v3
 * @details Extracted during agent-friendly refactoring. This interface exposes only
 *          the methods and properties that UI classes (ToolbarController, MenuBar,
 *          PropertiesPanelController, ExportDialog, SettingsManager) actually call.
 *          CircuitPanel implements this interface so UI code can be mocked in tests.
 */

import type { MapCoordinates } from '../geom/MapCoordinates.js';
import type { DrawingModel } from './model/DrawingModel.js';
import type { LayerDesc } from '../layers/LayerDesc.js';
import type { AddElements } from './controllers/AddElements.js';
import type { GraphicPrimitive } from '../primitives/GraphicPrimitive.js';

export interface EditorFacade {
    // ─── Callback properties ──────────────────────────────────────────────
    onToolChange: ((toolId: number) => void) | null;
    onZoomChange: (() => void) | null;
    onUndoStateChange: (() => void) | null;
    onCoordinatesChange: ((lx: number, ly: number) => void) | null;

    // ─── Tool ─────────────────────────────────────────────────────────────
    setTool(toolId: number): void;
    getTool(): number;

    // ─── Zoom ─────────────────────────────────────────────────────────────
    zoomIn(): void;
    zoomOut(): void;
    zoomToFit(): void;
    setZoom(magnitude: number): void;
    getZoomPercent(): number;

    // ─── Grid / Snap ──────────────────────────────────────────────────────
    isGridVisible(): boolean;
    setGridVisible(v: boolean): void;
    isSnapActive(): boolean;
    setSnap(s: boolean): void;

    // ─── Edit ─────────────────────────────────────────────────────────────
    undo(): void;
    redo(): void;
    canUndo(): boolean;
    canRedo(): boolean;

    // ─── Selection ────────────────────────────────────────────────────────
    selectAll(): void;
    getSelectedPrimitives(): GraphicPrimitive[];
    deleteSelected(): void;
    rotateSelected(): void;
    mirrorSelected(): void;
    alignLeftSelected(): void;
    alignRightSelected(): void;
    alignTopSelected(): void;
    alignBottomSelected(): void;
    alignHorizontalCenterSelected(): void;
    alignVerticalCenterSelected(): void;
    distributeHorizontallySelected(): void;
    distributeVerticallySelected(): void;

    // ─── Clipboard ────────────────────────────────────────────────────────
    copySelected(): void;
    cutSelected(): void;
    paste(): Promise<void>;
    duplicateSelected(): void;
    canPaste(): boolean;
    copyAsImage(): Promise<void>;
    copyAllAsPrimitives(): void;

    // ─── File ─────────────────────────────────────────────────────────────
    getCircuitText(): string;
    loadCircuit(text: string): void;
    markAsSaved(): void;
    getFileName(): string;
    setFileName(name: string): void;
    getFileHandle(): FileSystemFileHandle | null;
    setFileHandle(handle: FileSystemFileHandle | null): void;

    // ─── Export ───────────────────────────────────────────────────────────
    exportSVG(): string;
    exportPGF(): string;
    exportTikZ(): string;
    exportPDF(): string;
    getCanvasElement(): HTMLCanvasElement;

    // ─── Model access ─────────────────────────────────────────────────────
    getModel(): DrawingModel;
    getMapCoordinates(): MapCoordinates;
    getLayers(): LayerDesc[];
    getLayerDescriptions(): string[];

    // ─── Settings (consumed by SettingsManager) ───────────────────────────
    setAntiAlias(a: boolean): void;
    setBackgroundColor(c: string): void;
    setGridColor(c: string): void;
    setSelectionLTRColor(c: string): void;
    setSelectionRTLColor(c: string): void;
    setRenderTeX(e: boolean): void;
    getAddElements(): AddElements;

    // ─── Layer ────────────────────────────────────────────────────────────
    getCurrentLayer(): number;
    setCurrentLayer(layer: number): void;

    // ─── Render ───────────────────────────────────────────────────────────
    render(): void;

    // ─── Background image ─────────────────────────────────────────────────
    attachImage(file: File): Promise<void>;
    detachImage(): void;
    isImageAttached(): boolean;
    getImageAlpha(): number;
    setImageAlpha(a: number): void;
    getImageScale(): number;
    setImageScale(s: number): void;
    getImageX(): number;
    setImageX(x: number): void;
    getImageY(): number;
    setImageY(y: number): void;
}
