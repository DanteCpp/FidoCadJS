/**
 * @file ClipboardController.ts
 * @author Dante Loi
 * @date 2026-05-09
 * @brief Clipboard operations (copy, cut, paste, duplicate) extracted from CircuitPanel
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import type { SelectionActions } from './SelectionActions.js';
import type { ParserActions } from './ParserActions.js';
import type { EditorActions } from './EditorActions.js';
import type { UndoActions } from './UndoActions.js';
import type { MapCoordinates } from '../../geom/MapCoordinates.js';

export class ClipboardController {
    private selectionActions: SelectionActions;
    private parserActions: ParserActions;
    private editorActions: EditorActions;
    private undoActions: UndoActions;
    private mapCoordinates: MapCoordinates;
    private internalClipboard: string = '';

    /** Callback to trigger a re-render after clipboard operations. */
    onRenderRequested: (() => void) | null = null;
    /** Callback to notify that undo state has changed (enables/disables undo/redo buttons). */
    onUndoStateChange: (() => void) | null = null;

    constructor(
        selectionActions: SelectionActions,
        parserActions: ParserActions,
        editorActions: EditorActions,
        undoActions: UndoActions,
        mapCoordinates: MapCoordinates,
    ) {
        this.selectionActions = selectionActions;
        this.parserActions = parserActions;
        this.editorActions = editorActions;
        this.undoActions = undoActions;
        this.mapCoordinates = mapCoordinates;
    }

    copySelected(): void {
        const selected = this.selectionActions.getSelectedPrimitives();
        if (selected.length === 0) return;
        const text = this.selectionActions.getSelectedString(true, this.parserActions);
        this.internalClipboard = text;
        // Also push to the system clipboard so it can be pasted into other apps
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).catch(() => { /* ignore permission errors */ });
        }
    }

    cutSelected(): void {
        this.copySelected();
        this.editorActions.deleteAllSelected(true);
        this.onRenderRequested?.();
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
            text = this.internalClipboard;
        }
        if (!text) return;

        // Save pre-paste state so a single undo reverts the entire paste.
        this.undoActions.saveUndoState();

        // Deselect everything so only pasted items end up selected
        this.selectionActions.setSelectionAll(false);
        this.parserActions.addString(text, true);
        // Offset pasted selection by one grid step so it doesn't overlap the original.
        // Pass saveState=false: the undo state was already captured above.
        const step = this.mapCoordinates.getXGridStep();
        this.editorActions.moveAllSelected(step, step, false);
        this.onRenderRequested?.();
        this.onUndoStateChange?.();
    }

    duplicateSelected(): void {
        this.copySelected();
        // duplicate should not overwrite the OS clipboard when possible, so keep
        // internal buffer hot and let paste fall back to it.
        void this.paste();
    }

    /** Return true if the user might be able to paste (either via system clipboard
     *  or the internal fallback). */
    canPaste(): boolean {
        if (this.internalClipboard.length > 0) return true;
        try {
            if (typeof (navigator as any).clipboard?.readText === 'function') return true;
        } catch {
            /* non-secure context or permission denied */
        }
        return false;
    }
}
