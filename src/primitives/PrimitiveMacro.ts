import type { GraphicsInterface } from '../graphic/GraphicsInterface.js';
import type { ExportInterface } from '../export/ExportInterface.js';
import { GraphicPrimitive } from './GraphicPrimitive.js';
import { MapCoordinates } from '../geom/MapCoordinates.js';
import { LayerDesc } from '../layers/LayerDesc.js';
import { DrawingModel } from '../circuit/model/DrawingModel.js';
import { MacroDesc } from './MacroDesc.js';
import { RectangleG } from '../graphic/RectangleG.js';

/** Injected by ParserActions to break the circular dependency. */
export type MacroParserFn = (model: DrawingModel, description: string) => void;

/** Injected by Drawing (Phase 2) to render the inner macro model. */
export type MacroDrawFn = (
    model: DrawingModel, g: GraphicsInterface, coordSys: MapCoordinates
) => void;

/** Injected by Export (Phase 2) to export the inner macro model. */
export type MacroExportFn = (
    model: DrawingModel, exp: ExportInterface,
    exportInvisible: boolean, cs: MapCoordinates
) => void;

export class PrimitiveMacro extends GraphicPrimitive {
    private static readonly N_POINTS = 3;

    /** Set by ParserActions before any macro is parsed. */
    static parserFn: MacroParserFn | null = null;
    /** Set by Drawing (Phase 2). */
    static drawFn: MacroDrawFn | null = null;
    /** Set by Export (Phase 2). */
    static exportFn: MacroExportFn | null = null;

    private readonly library: Map<string, MacroDesc>;
    private readonly layers: LayerDesc[];
    private o: number = 0;
    private m: boolean = false;
    private drawOnlyPads: boolean = false;
    private drawOnlyLayer: number = -1;
    private alreadyExported: boolean = false;
    private readonly macroModel: DrawingModel;
    private readonly macroCoord: MapCoordinates;
    private macroName: string = '';
    macroDesc: string | null = null;
    private exportInvisible: boolean = false;
    private x1: number = 0; private y1: number = 0;

    constructor(lib: Map<string, MacroDesc>, l: LayerDesc[], f: string, size: number) {
        super();
        this.library = lib;
        this.layers = l;
        this.drawOnlyPads = false;
        this.drawOnlyLayer = -1;
        this.macroModel = new DrawingModel();
        this.macroCoord = new MapCoordinates();
        this.changed = true;
        this.initPrimitive(-1, f, size);
        this.macroStore(l);
    }

    getControlPointNumber(): number { return PrimitiveMacro.N_POINTS; }

    setExportInvisible(s: boolean): void { this.exportInvisible = s; }
    setDrawOnlyPads(pd: boolean): void { this.drawOnlyPads = pd; }
    setDrawOnlyLayer(la: number): void { this.drawOnlyLayer = la; }
    getMaxLayer(): number { return this.macroModel.getMaxLayer(); }
    getOrientation(): number { return this.o; }
    setOrientation(o: number): void { this.o = o; this.setChanged(true); }
    isMirrored(): boolean { return this.m; }
    setMirrored(v: boolean): void { this.m = v; this.setChanged(true); }
    getMacroName(): string { return this.macroName; }
    getMacroDesc(): string | null { return this.macroDesc; }
    setMacroDesc(d: string): void { this.macroDesc = d; }

    /** Look up a macro by key, set name and description, and parse the sub-circuit. */
    initializeFromKey(key: string): void {
        this.macroName = key.toLowerCase();
        const macro = this.library.get(this.macroName);
        if (macro) {
            this.macroDesc = macro.description;
        } else {
            this.macroDesc = null;
        }
        this.macroStore(this.layers);
    }

    containsLayer(l: number): boolean { return this.macroModel.containsLayer(l); }

    override setChanged(c: boolean): void {
        super.setChanged(c);
        this.macroModel.setChanged(c);
    }

    private macroStore(layerV: LayerDesc[]): void {
        this.macroModel.setLibrary(this.library);
        this.macroModel.setLayers(layerV);
        this.changed = true;
        if (this.macroDesc !== null && PrimitiveMacro.parserFn !== null) {
            PrimitiveMacro.parserFn(this.macroModel, this.macroDesc);
        }
    }

    setLayers(layerV: LayerDesc[]): void { this.macroModel.setLayers(layerV); }

    private drawMacroContents(g: GraphicsInterface, coordSys: MapCoordinates): void {
        if (this.changed) {
            this.changed = false;
            this.x1 = this.virtualPoint[0]!.x;
            this.y1 = this.virtualPoint[0]!.y;

            this.macroCoord.setXMagnitude(coordSys.getXMagnitude());
            this.macroCoord.setYMagnitude(coordSys.getYMagnitude());
            this.macroCoord.setXCenter(coordSys.mapXr(this.x1, this.y1));
            this.macroCoord.setYCenter(coordSys.mapYr(this.x1, this.y1));
            this.macroCoord.setOrientation((this.o + coordSys.getOrientation()) % 4);
            this.macroCoord.mirror = this.m !== coordSys.mirror;
            this.macroCoord.isMacro = true;
            this.macroCoord.resetMinMax();
            this.macroModel.setChanged(true);
        }

        this.macroModel.setDrawOnlyLayer(this.drawOnlyLayer);
        this.macroModel.setDrawOnlyPads(this.drawOnlyPads);

        if (PrimitiveMacro.drawFn !== null) {
            PrimitiveMacro.drawFn(this.macroModel, g, this.macroCoord);
        }

        if (this.macroCoord.getXMax() > this.macroCoord.getXMin() &&
            this.macroCoord.getYMax() > this.macroCoord.getYMin()) {
            coordSys.trackPoint(this.macroCoord.getXMax(), this.macroCoord.getYMax());
            coordSys.trackPoint(this.macroCoord.getXMin(), this.macroCoord.getYMin());
        }
    }

    draw(g: GraphicsInterface, coordSys: MapCoordinates, layerV: LayerDesc[]): void {
        this.setLayer(0);
        if (this.selectLayer(g, layerV)) {
            this.drawText(g, coordSys, layerV, this.drawOnlyLayer);
        }
        this.drawMacroContents(g, coordSys);
    }

    parseTokens(tokens: string[], nn: number): void {
        this.changed = true;
        if (tokens[0] !== 'MC') throw new Error(`MC: Invalid primitive: ${tokens[0]}`);
        if (nn < 6) throw new Error('Bad arguments on MC');

        this.virtualPoint[0]!.x = parseInt(tokens[1]!, 10);
        this.virtualPoint[0]!.y = parseInt(tokens[2]!, 10);
        this.virtualPoint[1]!.x = this.virtualPoint[0]!.x + 10;
        this.virtualPoint[1]!.y = this.virtualPoint[0]!.y + 10;
        this.virtualPoint[2]!.x = this.virtualPoint[0]!.x + 10;
        this.virtualPoint[2]!.y = this.virtualPoint[0]!.y + 5;

        this.o = parseInt(tokens[3]!, 10);
        this.m = parseInt(tokens[4]!, 10) === 1;
        this.macroName = tokens[5]!;
        for (let i = 6; i < nn; i++) this.macroName += ' ' + tokens[i];
        this.macroName = this.macroName.toLowerCase();

        const macro = this.library.get(this.macroName);
        if (!macro) throw new Error(`Unrecognized macro '${this.macroName}'`);

        this.macroDesc = macro.description;
        this.macroStore(this.layers);
    }

    getDistanceToPoint(px: number, py: number): number {
        if (this.checkText(px, py)) return 0;

        const x1 = this.virtualPoint[0]!.x;
        const y1 = this.virtualPoint[0]!.y;

        let vx: number, vy: number;
        if (this.m) {
            switch (this.o) {
                case 1: vx = py - y1 + 100; vy = px - x1 + 100; break;
                case 2: vx = px - x1 + 100; vy = -(py - y1) + 100; break;
                case 3: vx = -(py - y1) + 100; vy = -(px - x1) + 100; break;
                case 0: vx = -(px - x1) + 100; vy = py - y1 + 100; break;
                default: vx = 0; vy = 0; break;
            }
        } else {
            switch (this.o) {
                case 1: vx = py - y1 + 100; vy = -(px - x1) + 100; break;
                case 2: vx = -(px - x1) + 100; vy = -(py - y1) + 100; break;
                case 3: vx = -(py - y1) + 100; vy = px - x1 + 100; break;
                case 0: vx = px - x1 + 100; vy = py - y1 + 100; break;
                default: vx = 0; vy = 0; break;
            }
        }

        if (this.macroDesc === null) return Number.MAX_SAFE_INTEGER;

        // Phase 2: call into macro model's EditorActions for precise distance.
        // Phase 1 stub: return distance to the macro anchor point.
        const dx = vx - 100, dy = vy - 100;
        return Math.trunc(Math.sqrt(dx * dx + dy * dy));
    }

    resetExport(): void { this.alreadyExported = false; }

    toString(extensions: boolean): string {
        const mirror = this.m ? '1' : '0';
        let s = `MC ${this.virtualPoint[0]!.x} ${this.virtualPoint[0]!.y} ` +
            `${this.o} ${mirror} ${this.macroName}\n`;
        s += this.saveText(extensions);
        return s;
    }

    export(exp: ExportInterface, cs: MapCoordinates): void {
        if (this.alreadyExported) return;

        if (exp.exportMacro(
            cs.mapX(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y),
            cs.mapY(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y),
            this.m, this.o * 90, this.macroName, this.macroDesc ?? '',
            this.name,
            cs.mapX(this.virtualPoint[1]!.x, this.virtualPoint[1]!.y),
            cs.mapY(this.virtualPoint[1]!.x, this.virtualPoint[1]!.y),
            this.value,
            cs.mapX(this.virtualPoint[2]!.x, this.virtualPoint[2]!.y),
            cs.mapY(this.virtualPoint[2]!.x, this.virtualPoint[2]!.y),
            this.macroFont,
            Math.trunc(cs.mapYr(this.getMacroFontSize(), this.getMacroFontSize()) - cs.mapYr(0, 0)),
            this.library)) {
            this.alreadyExported = true;
            return;
        }

        const x1 = this.virtualPoint[0]!.x;
        const y1 = this.virtualPoint[0]!.y;
        const mc = new MapCoordinates();
        mc.setXMagnitude(cs.getXMagnitude());
        mc.setYMagnitude(cs.getYMagnitude());
        mc.setXCenter(cs.mapXr(x1, y1));
        mc.setYCenter(cs.mapYr(x1, y1));
        mc.setOrientation((this.o + cs.getOrientation()) % 4);
        mc.mirror = this.m !== cs.mirror;
        mc.isMacro = true;
        this.macroModel.setDrawOnlyLayer(this.drawOnlyLayer);
        this.macroModel.setDrawOnlyPads(this.drawOnlyPads);

        // Phase 2: call PrimitiveMacro.exportFn(this.macroModel, exp, this.exportInvisible, mc)
        if (PrimitiveMacro.exportFn !== null) {
            PrimitiveMacro.exportFn(this.macroModel, exp, this.exportInvisible, mc);
        }
        this.exportText(exp, cs, this.drawOnlyLayer);
    }

    getNameVirtualPointNumber(): number { return 1; }
    getValueVirtualPointNumber(): number { return 2; }

    override rotatePrimitive(bCounterClockWise: boolean, ix: number, iy: number): void {
        super.rotatePrimitive(bCounterClockWise, ix, iy);
        this.o = bCounterClockWise ? (this.o + 3) % 4 : (this.o + 1) % 4;
        this.changed = true;
    }

    override mirrorPrimitive(xPos: number): void {
        super.mirrorPrimitive(xPos);
        this.m = !this.m;
        this.changed = true;
    }

    override intersects(rect: RectangleG, isLeftToRightSelection: boolean): boolean {
        if (!this.getCurrentLayer()?.isVisible()) return false;
        if (isLeftToRightSelection) return this.isFullyContained(rect);
        return rect.contains(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y);
    }
}
