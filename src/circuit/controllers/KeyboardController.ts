/**
 * @file KeyboardController.ts
 * @author Dante Loi
 * @date 2026-05-09
 * @brief Keyboard shortcut handler extracted from CircuitPanel
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { ElementsEdtActions } from './ElementsEdtActions.js';
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
        const tagName = target.tagName.toLowerCase();
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
                    key === 'w')
            ) {
                this.onKeyDown(e);
                return;
            }

            // Escape cancels the TEXT tool even while focus is in a text
            // input (user just placed text and is editing it).
            if (
                e.key === 'Escape' &&
                !this.host.isTextEditActive() &&
                this.host.getTool() === ElementsEdtActions.TEXT
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

        const key = e.key.toLowerCase();
        const isCtrlOrMeta = e.ctrlKey || e.metaKey;
        const isAlt = e.altKey;

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

        // ===== TOOL SELECTION (single key, case-insensitive) =====
        // A or Escape: Selection tool
        if (key === 'a' && !isCtrlOrMeta) {
            e.preventDefault();
            this.host.setTool(ElementsEdtActions.SELECTION);
            this.host.clearGhostAndSelection();
            this.host.render();
            return;
        }

        // Space: Selection tool (FidoCadJ binds Space, like A and Escape, to
        // the selection state). Home is the fit-to-view shortcut.
        if (key === ' ' && !isCtrlOrMeta) {
            e.preventDefault();
            this.host.setTool(ElementsEdtActions.SELECTION);
            this.host.clearGhostAndSelection();
            this.host.render();
            return;
        }

        // Home: Fit to view
        if (key === 'home' && !isCtrlOrMeta) {
            e.preventDefault();
            this.host.zoomToFit();
            return;
        }

        if (key === 'escape') {
            e.preventDefault();

            // Close any open text-editing UI (properties sidebar, etc.)
            this.host.cancelTextEdit();

            // Deselect all objects
            this.host.deselectAll();

            // Switch to Selection tool (resets clickNumber, successiveMove, primEdit)
            this.host.setTool(ElementsEdtActions.SELECTION);
            this.host.clearGhostAndSelection();
            this.host.render();
            return;
        }

        // L: Line tool
        if (key === 'l' && !isCtrlOrMeta) {
            e.preventDefault();
            this.host.setTool(ElementsEdtActions.LINE);
            return;
        }

        // T: Text tool
        if (key === 't' && !isCtrlOrMeta) {
            e.preventDefault();
            this.host.setTool(ElementsEdtActions.TEXT);
            return;
        }

        // B: Bezier curve tool
        if (key === 'b' && !isCtrlOrMeta) {
            e.preventDefault();
            this.host.setTool(ElementsEdtActions.BEZIER);
            return;
        }

        // P: Polygon tool
        if (key === 'p' && !isCtrlOrMeta) {
            e.preventDefault();
            this.host.setTool(ElementsEdtActions.POLYGON);
            return;
        }

        // O: Complex curve tool
        if (key === 'o' && !isCtrlOrMeta) {
            e.preventDefault();
            this.host.setTool(ElementsEdtActions.COMPLEXCURVE);
            return;
        }

        // E: Ellipse tool
        if (key === 'e' && !isCtrlOrMeta) {
            e.preventDefault();
            this.host.setTool(ElementsEdtActions.ELLIPSE);
            return;
        }

        // G: Rectangle tool
        if (key === 'g' && !isCtrlOrMeta) {
            e.preventDefault();
            this.host.setTool(ElementsEdtActions.RECTANGLE);
            return;
        }

        // C: Connection tool
        if (key === 'c' && !isCtrlOrMeta) {
            e.preventDefault();
            this.host.setTool(ElementsEdtActions.CONNECTION);
            return;
        }

        // I: PCB track tool
        if (key === 'i' && !isCtrlOrMeta) {
            e.preventDefault();
            this.host.setTool(ElementsEdtActions.PCB_LINE);
            return;
        }

        // Z: PCB pad tool
        if (key === 'z' && !isCtrlOrMeta) {
            e.preventDefault();
            this.host.setTool(ElementsEdtActions.PCB_PAD);
            return;
        }

        // ===== TRANSFORM OPERATIONS (when something is selected) =====
        // M: Move selected elements
        if (key === 'm' && !isCtrlOrMeta) {
            e.preventDefault();
            this.host.startMoveSelected();
            return;
        }

        // R: Rotate selected elements
        if (key === 'r' && !isCtrlOrMeta) {
            e.preventDefault();
            this.host.rotateSelected();
            return;
        }

        // S: Mirror selected elements
        if (key === 's' && !isCtrlOrMeta) {
            e.preventDefault();
            this.host.mirrorSelected();
            return;
        }

        // Delete or Backspace: Delete selected objects
        if (key === 'delete' || key === 'backspace') {
            e.preventDefault();
            this.host.deleteSelected();
            return;
        }

        // ===== NUDGE WITH ALT + ARROW KEYS =====
        if (isAlt) {
            const nudgeStep = 1;
            let dx = 0,
                dy = 0;

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
                this.host.nudgeSelected(dx, dy);
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
