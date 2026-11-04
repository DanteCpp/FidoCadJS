import { showShortcutsDialog } from '../../ui/DialogShortcuts.js';
import { Tool } from './Tool.js';
import type { ClipboardController } from './ClipboardController.js';
import type { KeyboardHost } from '../KeyboardHost.js';

export class KeyboardController {
    private host: KeyboardHost;
    private boundHandleKeyDown: (e: KeyboardEvent) => void;

    constructor(host: KeyboardHost, _clipboard: ClipboardController) {
        this.host = host;
        this.boundHandleKeyDown = this.handleDocumentKeyDown.bind(this);
    }

    /** Attach the global keydown listener to the document. */
    attach(): void {
        document.addEventListener('keydown', this.boundHandleKeyDown);
    }

    /** Detach the global keydown listener. */
    detach(): void {
        document.removeEventListener('keydown', this.boundHandleKeyDown);
    }

    /**
     * Central document-level key handler.
     * When focus is on a text input / textarea / contentEditable element,
     * only global app shortcuts (Ctrl+N/O/S/E/P/W) are forwarded;
     * tool shortcuts and clipboard operations are suppressed so the
     * user can type normally. Otherwise every keystroke goes through.
     */
    private handleDocumentKeyDown(e: KeyboardEvent): void {
        const target = e.target as HTMLElement;
        // Modal dialogs own Enter/Escape and their focused controls.
        if (target.closest?.('dialog')) return;
        const tagName = target.tagName?.toLowerCase();
        const isInput =
            tagName === 'input' ||
            tagName === 'textarea' ||
            tagName === 'select' ||
            target.isContentEditable;

        if (isInput) {
            const key = e.key.toLowerCase();
            const isCtrlOrMeta = e.ctrlKey || e.metaKey;

            // Global file-level shortcuts that should work app-wide
            if (
                isCtrlOrMeta &&
                (key === 'n' ||
                    key === 'o' ||
                    key === 's' ||
                    key === 'e' ||
                    key === 'p' ||
                    key === 'w' ||
                    key === 'enter')
            ) {
                this.onKeyDown(e);
                return;
            }

            // Escape cancels the TEXT tool even while focus is in a text
            // input (user just placed text and is editing it).
            if (
                e.key === 'Escape' &&
                !this.host.isTextEditActive() &&
                this.host.getTool() === Tool.TEXT
            ) {
                this.onKeyDown(e);
                return;
            }

            return;
        }

        this.onKeyDown(e);
    }

    /**
     * Process a single keyboard event.
     * Made public so tests can dispatch synthetic events directly.
     */
    onKeyDown(e: KeyboardEvent): void {
        if (this.host.isTextEditActive()) {
            return;
        }

        // While a paste ghost is being positioned, Enter drops it at the current
        // cursor and Escape aborts the paste entirely; every other key is swallowed
        // so the user can't switch tools or trigger shortcuts mid-placement.
        if (this.host.isPastePlacing()) {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.host.commitPastePlacement();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.host.cancelPastePlacement();
            }
            return;
        }

        const key = e.key.toLowerCase();
        const isCtrlOrMeta = e.ctrlKey || e.metaKey;
        const isAlt = e.altKey;
        if (isAlt && !key.startsWith('arrow')) return;

        if (isCtrlOrMeta && key === 'b') {
            e.preventDefault();
            this.host.toggleLibrary();
            return;
        }
        if (isCtrlOrMeta && key === 'enter') {
            e.preventDefault();
            this.host.getMenuBar()?.saveFile();
            return;
        }
        // Ctrl/Cmd+W belongs to the browser's tab lifecycle.
        if (isCtrlOrMeta && key === 'w') return;

        if (!isCtrlOrMeta && !isAlt) {
            const actions: Record<string, () => void> = {
                k: () => showShortcutsDialog(),
                i: () =>
                    e.shiftKey
                        ? this.host.getMenuBar()?.attachImageFile()
                        : this.host.toggleInfoBar(),
                j: () => this.host.setTool(Tool.CONNECTION),
                p: () =>
                    e.shiftKey
                        ? this.host.setTool(Tool.POLYGON)
                        : this.host.editSelectedProperties(),
                f2: () => this.host.editSelectedProperties(),
                '[': () => this.host.cycleLayer(-1),
                ']': () => this.host.cycleLayer(1),
                f: () => this.host.toggleFilled(),
                g: () => (e.shiftKey ? this.host.toggleSnap() : this.host.toggleGrid()),
                '0': () => this.host.zoomToFit(),
                enter: () => this.host.finishLine(),
            };
            // Shift+I is image import; Shift+T keeps the PCB track tool reachable.
            if (e.shiftKey && key === 't') {
                e.preventDefault();
                this.host.setTool(Tool.PCB_LINE);
                return;
            }
            if (actions[key]) {
                e.preventDefault();
                actions[key]();
                return;
            }
        }

        // ===== CLIPBOARD OPERATIONS =====
        if (key === 'x' && isCtrlOrMeta) {
            e.preventDefault();
            this.host.cutSelected();
            return;
        }

        if (key === 'c' && isCtrlOrMeta) {
            e.preventDefault();
            this.host.copySelected();
            return;
        }

        if (key === 'v' && isCtrlOrMeta) {
            e.preventDefault();
            this.host.paste();
            return;
        }

        if (key === 'd' && isCtrlOrMeta) {
            e.preventDefault();
            this.host.duplicateSelected();
            return;
        }

        if (key === 'i' && isCtrlOrMeta && !e.shiftKey) {
            e.preventDefault();
            void this.host.copyAsImage();
            return;
        }

        // ===== FILE OPERATIONS =====
        if (key === 'n' && isCtrlOrMeta) {
            e.preventDefault();
            this.host.getMenuBar()?.newFile();
            return;
        }

        if (key === 'o' && isCtrlOrMeta) {
            e.preventDefault();
            this.host.getMenuBar()?.openFile();
            return;
        }

        if (key === 's' && isCtrlOrMeta && !e.shiftKey) {
            e.preventDefault();
            this.host.getMenuBar()?.saveFile();
            return;
        }

        if (key === 's' && isCtrlOrMeta && e.shiftKey) {
            e.preventDefault();
            this.host.getMenuBar()?.saveFileAs();
            return;
        }

        if (key === 'g' && isCtrlOrMeta) {
            e.preventDefault();
            this.host.getMenuBar()?.showCircuitCodeDialog();
            return;
        }

        if (key === 'e' && isCtrlOrMeta) {
            e.preventDefault();
            this.host.getMenuBar()?.exportFile();
            return;
        }

        if (key === 'p' && isCtrlOrMeta) {
            e.preventDefault();
            this.host.getMenuBar()?.printFile();
            return;
        }

        // ===== UNDO/REDO =====
        if (key === 'z' && isCtrlOrMeta && !e.shiftKey) {
            e.preventDefault();
            this.host.undo();
            return;
        }

        if ((key === 'z' && isCtrlOrMeta && e.shiftKey) || (key === 'y' && isCtrlOrMeta)) {
            e.preventDefault();
            this.host.redo();
            return;
        }

        // ===== SELECT ALL =====
        // Ctrl/Cmd+A: select the whole drawing (when focus is on the canvas).
        // The document-level guard already lets native Ctrl+A run inside text
        // inputs, so this only fires when editing the circuit itself.
        if (key === 'a' && isCtrlOrMeta) {
            e.preventDefault();
            this.host.selectAll();
            return;
        }

        // ===== ARROWHEADS ON SELECTED PRIMITIVES =====
        // Shift+S / Shift+E toggle a start / end arrowhead on any selected
        // arrow-capable primitive (line, Bézier, complex curve). Handled before
        // the single-key tool/transform shortcuts below, which ignore shiftKey
        // and would otherwise treat these as Mirror (S) / Ellipse (E).
        if (e.shiftKey && !isCtrlOrMeta && !isAlt) {
            if (key === 's') {
                e.preventDefault();
                this.host.toggleArrowStartSelected();
                return;
            }
            if (key === 'e') {
                e.preventDefault();
                this.host.toggleArrowEndSelected();
                return;
            }
        }

        // ===== TOOL SELECTION (single key, case-insensitive) =====
        // S or A: Selection tool
        if ((key === 'a' || key === 's') && !isCtrlOrMeta) {
            e.preventDefault();
            this.host.setTool(Tool.SELECTION);
            this.host.clearGhostAndSelection();
            this.host.render();
            return;
        }

        // Space or Home: Fit to view. (The Selection tool is still reachable
        // via A and Escape, which previously shared the Space binding.)
        if ((key === ' ' || key === 'home') && !isCtrlOrMeta) {
            e.preventDefault();
            this.host.zoomToFit();
            return;
        }

        if (key === 'escape') {
            e.preventDefault();

            if (this.host.cancelRuler() || this.host.finishLine()) return;

            // Close any open text-editing UI (properties sidebar, etc.)
            this.host.cancelTextEdit();

            // Deselect all objects
            this.host.deselectAll();

            // Switch to Selection tool (resets clickNumber, successiveMove, macro orientation)
            this.host.setTool(Tool.SELECTION);
            this.host.clearGhostAndSelection();
            this.host.render();
            return;
        }

        // L: Line tool
        if (key === 'l' && !isCtrlOrMeta) {
            e.preventDefault();
            this.host.setTool(Tool.LINE);
            return;
        }

        // T: Text tool
        if (key === 't' && !isCtrlOrMeta) {
            e.preventDefault();
            this.host.setTool(Tool.TEXT);
            return;
        }

        // B: rectangle; Shift+B: Bézier curve
        if (key === 'b' && !isCtrlOrMeta) {
            e.preventDefault();
            this.host.setTool(e.shiftKey ? Tool.BEZIER : Tool.RECTANGLE);
            return;
        }

        // O: Complex curve tool
        if (key === 'o' && !isCtrlOrMeta) {
            e.preventDefault();
            this.host.setTool(Tool.COMPLEXCURVE);
            return;
        }

        // E: Ellipse tool
        if (key === 'e' && !isCtrlOrMeta) {
            e.preventDefault();
            this.host.setTool(Tool.ELLIPSE);
            return;
        }

        // C: Connection tool
        if (key === 'c' && !isCtrlOrMeta) {
            e.preventDefault();
            this.host.setTool(Tool.CONNECTION);
            return;
        }

        // Z: PCB pad tool
        if (key === 'z' && !isCtrlOrMeta) {
            e.preventDefault();
            this.host.setTool(Tool.PCB_PAD);
            return;
        }

        // ===== TRANSFORM OPERATIONS (when something is selected) =====
        // M: mirror; Shift+M: move selected elements
        if (key === 'm' && !isCtrlOrMeta) {
            e.preventDefault();
            if (e.shiftKey) this.host.startMoveSelected();
            else this.host.mirrorSelected();
            return;
        }

        // R: Rotate selected elements
        if (key === 'r' && !isCtrlOrMeta) {
            e.preventDefault();
            this.host.rotateSelected();
            return;
        }

        // Delete or Backspace: Delete selected objects
        if (key === 'delete' || key === 'backspace') {
            e.preventDefault();
            this.host.deleteSelected();
            return;
        }

        // Plain arrows follow the drawing grid; Alt+arrows retain fine nudging.
        if (!isCtrlOrMeta && key.startsWith('arrow')) {
            const dx = key === 'arrowleft' ? -1 : key === 'arrowright' ? 1 : 0;
            const dy = key === 'arrowup' ? -1 : key === 'arrowdown' ? 1 : 0;
            if (dx || dy) {
                e.preventDefault();
                this.host.nudgeByKeyboard(dx, dy, isAlt);
                return;
            }
        }

        // ===== MACRO SINGLE-LETTER SHORTCUTS =====
        // Try library macro keys (single letter, no modifier)
        if (key.length === 1 && !isCtrlOrMeta && !isAlt) {
            if (this.host.tryMacroKeyShortcut(key)) {
                e.preventDefault();
                return;
            }
        }

        // ===== ZOOM CONTROLS =====
        if (key === '+' || key === '=') {
            e.preventDefault();
            this.host.zoomIn();
            return;
        }

        if (key === '-') {
            e.preventDefault();
            this.host.zoomOut();
            return;
        }
    }
}
