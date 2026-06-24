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
    /**
     * Optional hook for interactive paste. When set and an interactive paste
     * resolves to non-empty content, the controller hands the text to the host
     * (which shows a ghost preview the user positions with the mouse) instead of
     * dropping it immediately. Return true if the host took over placement.
     */
    onInteractivePaste: ((text: string) => boolean) | null = null;

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
        this.copyText(text);
    }

    /**
     * Place arbitrary FidoCadJ text on both the internal and system clipboards.
     * Used by copy operations that build their own payload (e.g. "Copy all as
     * primitives") rather than serializing the current selection.
     */
    copyText(text: string): void {
        if (!text) return;
        this.internalClipboard = text;
        // Also push to the system clipboard so it can be pasted into other apps
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).catch(() => {
                /* ignore permission errors */
            });
        }
    }

    cutSelected(): void {
        this.copySelected();
        this.editorActions.deleteAllSelected(true);
        this.onRenderRequested?.();
        this.onUndoStateChange?.();
    }

    /**
     * Paste clipboard content into the drawing.
     * @param interactive when true (e.g. Ctrl+V / menu Paste) and an interactive
     *        placement hook is registered, the caller positions the content with
     *        the mouse. When false (e.g. duplicate) the content drops immediately
     *        at a one-grid-step offset.
     */
    async paste(interactive = false): Promise<void> {
        let text = '';
        // Prefer system clipboard, but race against a short timeout: Firefox
        // can leave readText() pending indefinitely when permissions have not
        // been granted, which would block the fallback to internal clipboard
        // and stall duplicate/paste flows.
        if (navigator.clipboard?.readText) {
            try {
                text = await Promise.race([
                    navigator.clipboard.readText(),
                    new Promise<string>((_, reject) =>
                        setTimeout(() => reject(new Error('clipboard read timeout')), 200),
                    ),
                ]);
            } catch {
                // permission denied / non-secure context / timeout – fall back
            }
        }
        // Fall back to internal clipboard if system read yielded nothing
        if (!text) {
            text = this.internalClipboard;
        }
        if (!text) return;

        // Interactive paste: hand the content to the host so the user can pick
        // where it lands. The host owns the undo bookkeeping on commit.
        if (interactive && this.onInteractivePaste?.(text)) {
            return;
        }

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
