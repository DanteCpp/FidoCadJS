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
