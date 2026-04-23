import { ParserActions } from './ParserActions.js';

/**
 * UndoActions: manages undo/redo operations.
 * Stores snapshots of the drawing state as text strings.
 */
export class UndoActions {
    private readonly parserActions: ParserActions;
    private undoStack: string[];
    private redoStack: string[];
    private readonly maxUndoLevels: number = 100;
    private isModified: boolean = false;
    private openFileName: string | null = null;

    constructor(parserActions: ParserActions) {
        this.parserActions = parserActions;
        this.undoStack = [];
        this.redoStack = [];
    }

    /** Check if undo is available */
    canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    /** Check if redo is available */
    canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    /** Save current state for undo */
    saveUndoState(): void {
        const state = this.parserActions.getText(true);
        this.undoStack.push(state);
        if (this.undoStack.length > this.maxUndoLevels) {
            this.undoStack.shift();
        }
        this.redoStack = [];
        this.isModified = true;
    }

    /** Undo the last action */
    undo(): void {
        if (!this.canUndo()) return;

        // Save current state for redo
        const currentState = this.parserActions.getText(true);
        this.redoStack.push(currentState);

        // Restore previous state
        const previousState = this.undoStack.pop()!;
        this.parserActions.parseString(previousState);
        this.isModified = false;
    }

    /** Redo the last undone action */
    redo(): void {
        if (!this.canRedo()) return;

        // Save current state for undo
        const currentState = this.parserActions.getText(true);
        this.undoStack.push(currentState);

        // Restore redo state
        const redoState = this.redoStack.pop()!;
        this.parserActions.parseString(redoState);
        this.isModified = false;
    }

    /** Get modified state */
    getModified(): boolean {
        return this.isModified;
    }

    /** Set modified state */
    setModified(state: boolean): void {
        this.isModified = state;
    }

    /** Set open file name */
    setOpenFileName(name: string | null): void {
        this.openFileName = name;
    }

    /** Get open file name */
    getOpenFileName(): string | null {
        return this.openFileName;
    }
}
