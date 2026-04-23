import type { ColorInterface } from '../graphic/ColorInterface.js';

export class LayerDesc {
    static readonly MAX_LAYERS = 16;

    private layerColor: ColorInterface | null;
    private isVisibleFlag: boolean;
    private isModifiedFlag: boolean = false;
    private layerDescription: string;
    private alphaValue: number;

    constructor(c: ColorInterface | null = null, v = true, d = '', a = 1.0) {
        this.layerColor = c;
        this.isVisibleFlag = v;
        this.layerDescription = d;
        this.alphaValue = a;
    }

    getColor(): ColorInterface | null { return this.layerColor; }
    getAlpha(): number { return this.alphaValue; }
    isVisible(): boolean { return this.isVisibleFlag; }
    isModified(): boolean { return this.isModifiedFlag; }
    getDescription(): string { return this.layerDescription; }
    setDescription(s: string): void { this.layerDescription = s; }
    setVisible(v: boolean): void { this.isVisibleFlag = v; }
    setModified(v: boolean): void { this.isModifiedFlag = v; }
    setColor(c: ColorInterface): void { this.layerColor = c; }
    setAlpha(a: number): void { this.alphaValue = a; }
}
