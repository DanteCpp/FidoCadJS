import type { MenuBar } from '../ui/MenuBar.js';

/**
 * Interface that the host (CircuitPanel) must satisfy for the keyboard
 * controller to dispatch shortcuts.
 */
export interface KeyboardHost {
    /** Whether an in-place text editor is currently active. */
    isTextEditActive(): boolean;
    /** The currently active drawing tool. */
    getTool(): number;
    /** The menu bar (may be null during early init). */
    getMenuBar(): MenuBar | null;

    // Tool / state changes
    setTool(toolId: number): void;
    cancelTextEdit(): void;

    // Zoom
    zoomIn(): void;
    zoomOut(): void;
    zoomToFit(): void;

    // Transform
    rotateSelected(): void;
    mirrorSelected(): void;
    deleteSelected(): void;
    startMoveSelected(): void;
    nudgeSelected(dx: number, dy: number): void;

    // Undo/redo
    undo(): void;
    redo(): void;

    // Clipboard (delegated to ClipboardController for actual logic)
    cutSelected(): void;
    copySelected(): void;
    paste(): void;
    duplicateSelected(): void;
    copyAsImage(): Promise<void>;

    // Interactive paste placement
    isPastePlacing(): boolean;
    commitPastePlacement(): void;
    cancelPastePlacement(): void;

    // Selection
    selectAll(): void;

    // State cleanup (for Escape)
    deselectAll(): void;
    clearGhostAndSelection(): void;

    // Re-render
    render(): void;

    // Macro single-letter shortcut
    tryMacroKeyShortcut(key: string): boolean;
}
