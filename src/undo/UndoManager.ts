import { UndoState } from './UndoState.js';

export class UndoManager {
    private readonly undoBuffer: UndoState[] = [];
    private pointer: number = 0;
    private readonly sizeMax: number;
    private isRedoable: boolean = false;

    constructor(s: number) {
        this.sizeMax = s;
        this.undoReset();
    }

    undoReset(): void {
        this.undoBuffer.length = 0;
        this.pointer = 0;
        this.isRedoable = false;
    }

    canUndo(): boolean {
        return this.pointer > 1 && this.undoBuffer.length > 0;
    }

    canRedo(): boolean {
        return this.isRedoable && this.pointer >= 1
            && this.pointer < this.undoBuffer.length;
    }

    undoPush(state: UndoState): void {
        if (this.undoBuffer.length === this.sizeMax) {
            this.undoBuffer.splice(0, 1);
            this.pointer--;
        }
        this.undoBuffer.splice(this.pointer++, 0, state);
        this.isRedoable = false;
        while (this.undoBuffer.length > this.pointer) {
            this.undoBuffer.splice(this.pointer, 1);
        }
    }

    isNextOperationOnALibrary(): boolean {
        if (this.pointer >= this.undoBuffer.length || this.pointer < 1) return false;
        return this.undoBuffer[this.pointer]?.libraryOperation ?? false;
    }

    undoPop(): UndoState {
        this.pointer--;
        if (this.pointer < 1) this.pointer = 1;
        const o = this.undoBuffer[this.pointer - 1];
        if (!o) throw new Error('UndoManager: buffer empty');
        this.isRedoable = true;
        return o;
    }

    undoRedo(): UndoState {
        if (!this.isRedoable) throw new Error('UndoManager: nothing to redo');
        this.pointer++;
        if (this.pointer > this.undoBuffer.length) this.pointer = this.undoBuffer.length;
        const o = this.undoBuffer[this.pointer - 1];
        if (!o) throw new Error('UndoManager: buffer error');
        return o;
    }
}
