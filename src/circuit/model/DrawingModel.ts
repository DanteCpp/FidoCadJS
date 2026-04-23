import type { GraphicPrimitive } from '../../primitives/GraphicPrimitive.js';
import type { LayerDesc } from '../../layers/LayerDesc.js';
import type { MacroDesc } from '../../primitives/MacroDesc.js';
import type { ProcessElementsInterface } from './ProcessElementsInterface.js';
import { ImageAsCanvas } from '../ImageAsCanvas.js';

export class DrawingModel {
    private layersUsed: boolean[] = new Array(16).fill(false);
    private maxLayerVal: number = 0;
    private drawOnlyPadsFlag: boolean = false;
    private drawOnlyLayerVal: number = -1;
    private imgCanvas: ImageAsCanvas = new ImageAsCanvas();
    private macroFont: string = 'Courier New';
    private macroFontSize: number = 0;
    private changedFlag: boolean = true;

    private primitiveVector: GraphicPrimitive[] = [];
    private layerV: LayerDesc[] = [];
    private library: Map<string, MacroDesc> = new Map();

    applyToAllElements(tt: ProcessElementsInterface): void {
        for (const g of this.primitiveVector) tt.doAction(g);
    }

    getLayers(): LayerDesc[] { return this.layerV; }

    setLayers(v: LayerDesc[]): void {
        this.layerV = v;
        this.applyToAllElements({
            doAction(g: GraphicPrimitive) {
                if ('setLayers' in g && typeof (g as { setLayers?: unknown }).setLayers === 'function') {
                    (g as { setLayers: (v: LayerDesc[]) => void }).setLayers(v);
                }
            }
        });
        this.changedFlag = true;
    }

    getLibrary(): Map<string, MacroDesc> { return this.library; }

    setLibrary(l: Map<string, MacroDesc>): void {
        this.library = l;
        this.changedFlag = true;
    }

    resetLibrary(): void {
        this.library = new Map();
        this.changedFlag = true;
    }

    addPrimitive(p: GraphicPrimitive, sort: boolean,
        ua: { saveUndoState(): void; setModified(b: boolean): void } | null): void {
        this.primitiveVector.push(p);
        if (sort) this.sortPrimitiveLayers();
        if (ua !== null) {
            ua.saveUndoState();
            ua.setModified(true);
            this.changedFlag = true;
        }
    }

    setTextFont(f: string, tsize: number,
        ua: { setModified(b: boolean): void } | null): void {
        this.macroFont = f;
        this.macroFontSize = tsize;
        for (const g of this.primitiveVector) g.setMacroFont(f, tsize);
        this.changedFlag = true;
        if (ua !== null) ua.setModified(true);
    }

    getTextFont(): string { return this.macroFont; }

    getTextFontSize(): number {
        if (this.primitiveVector.length === 0) return this.macroFontSize;
        const size = this.primitiveVector[0]!.getMacroFontSize();
        this.macroFontSize = size > 0 ? size : 1;
        return this.macroFontSize;
    }

    sortPrimitiveLayers(): void {
        const v = this.primitiveVector;
        // Shell sort by layer number (ascending)
        for (let l = Math.floor(v.length / 2); l > 0; l = Math.floor(l / 2)) {
            for (let j = l; j < v.length; j++) {
                for (let i = j - l; i >= 0; i -= l) {
                    if (v[i + l]!.getLayer() >= v[i]!.getLayer()) break;
                    const s = v[i]!; v[i] = v[i + l]!; v[i + l] = s;
                }
            }
        }

        this.layersUsed.fill(false);
        this.maxLayerVal = -1;
        let k = 0;
        const MAX = 16;
        for (let l = 0; l < MAX; l++) {
            for (let i = k; i < v.length; i++) {
                const g = v[i]!;
                if (g.getLayer() > this.maxLayerVal) this.maxLayerVal = g.getLayer();
                if (g.containsLayer(l)) {
                    this.layersUsed[l] = true;
                    k = i;
                    for (let z = 0; z < l; z++) this.layersUsed[z] = true;
                    break;
                }
            }
        }
    }

    getMaxLayer(): number { return this.maxLayerVal; }
    containsLayer(l: number): boolean { return this.layersUsed[l] ?? false; }
    isEmpty(): boolean { return this.primitiveVector.length === 0; }
    getChanged(): boolean { return this.changedFlag; }
    setChanged(c: boolean): void { this.changedFlag = c; }
    getPrimitiveVector(): GraphicPrimitive[] { return this.primitiveVector; }
    setPrimitiveVector(v: GraphicPrimitive[]): void { this.primitiveVector = v; }
    setDrawOnlyPads(pd: boolean): void { this.drawOnlyPadsFlag = pd; }
    getDrawOnlyPads(): boolean { return this.drawOnlyPadsFlag; }
    setDrawOnlyLayer(la: number): void { this.drawOnlyLayerVal = la; }
    getDrawOnlyLayer(): number { return this.drawOnlyLayerVal; }
    setImgCanvas(ic: ImageAsCanvas): void { this.imgCanvas = ic; }
    getImgCanvas(): ImageAsCanvas { return this.imgCanvas; }
}
