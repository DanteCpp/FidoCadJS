/**
 * @file UndoState.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief Undo state snapshot container
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

export class UndoState {
    text: string = '';
    isModified: boolean = false;
    fileName: string = '';
    libraryOperation: boolean = false;
    libraryDir: string = '';

    toString(): string {
        return `text=${this.text}\nfileName=${this.fileName}`
            + `\nOperation on a library: ${this.libraryOperation}`
            + `\nlibraryDir=${this.libraryDir}`;
    }
}
