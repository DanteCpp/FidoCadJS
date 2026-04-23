export class FontG {
    fontFamily: string;

    constructor(name: string) {
        this.fontFamily = name;
    }

    getFamily(): string {
        return this.fontFamily;
    }
}
