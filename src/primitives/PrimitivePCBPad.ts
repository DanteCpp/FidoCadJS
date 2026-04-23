import type { GraphicsInterface } from '../graphic/GraphicsInterface.js';
import type { ExportInterface } from '../export/ExportInterface.js';
import { GraphicPrimitive } from './GraphicPrimitive.js';
import { MapCoordinates } from '../geom/MapCoordinates.js';
import { LayerDesc } from '../layers/LayerDesc.js';
import { GeometricDistances } from '../geom/GeometricDistances.js';
import { RectangleG } from '../graphic/RectangleG.js';

export class PrimitivePCBPad extends GraphicPrimitive {
    private static readonly N_POINTS = 3;
    private static readonly CORNER_DIAMETER = 5;

    private rx: number = 0;
    private ry: number = 0;
    private sty: number = 0;
    private ri: number = 0;
    private drawOnlyPads: boolean = false;

    private x1: number = 0; private y1: number = 0;
    private rrx: number = 0; private rry: number = 0;
    private xa: number = 0; private ya: number = 0;
    private rox: number = 0; private roy: number = 0;
    private rix: number = 0; private riy: number = 0;
    private rrx2: number = 0; private rry2: number = 0;
    private rix2: number = 0; private riy2: number = 0;

    constructor(f: string, size: number)
    constructor(x1: number, y1: number, wx: number, wy: number, radi: number,
        st: number, layer: number, f: string, size: number)
    constructor(...args: unknown[]) {
        super();
        if (args.length === 2) {
            this.rx = 0; this.ry = 0; this.sty = 0; this.ri = 0;
            this.initPrimitive(-1, args[0] as string, args[1] as number);
        } else {
            const [x1, y1, wx, wy, radi, st, layer, f, size] = args as
                [number, number, number, number, number, number, number, string, number];
            this.initPrimitive(-1, f, size);
            this.virtualPoint[0]!.x = x1; this.virtualPoint[0]!.y = y1;
            this.virtualPoint[this.getNameVirtualPointNumber()]!.x = x1 + 5;
            this.virtualPoint[this.getNameVirtualPointNumber()]!.y = y1 + 5;
            this.virtualPoint[this.getValueVirtualPointNumber()]!.x = x1 + 5;
            this.virtualPoint[this.getValueVirtualPointNumber()]!.y = y1 + 10;
            this.rx = wx; this.ry = wy; this.ri = radi; this.sty = st;
            this.setLayer(layer);
        }
    }

    getControlPointNumber(): number { return PrimitivePCBPad.N_POINTS; }

    override needsHoles(): boolean { return true; }

    setDrawOnlyPads(pd: boolean): void { this.drawOnlyPads = pd; }

    draw(g: GraphicsInterface, coordSys: MapCoordinates, layerV: LayerDesc[]): void {
        if (!this.selectLayer(g, layerV)) return;
        this.drawText(g, coordSys, layerV, -1);

        if (this.changed) {
            this.changed = false;
            this.x1 = this.virtualPoint[0]!.x;
            this.y1 = this.virtualPoint[0]!.y;

            this.xa = coordSys.mapXi(this.x1, this.y1, false);
            this.ya = coordSys.mapYi(this.x1, this.y1, false);

            this.rrx = Math.abs(this.xa - coordSys.mapXi(this.x1 + this.rx, this.y1 + this.ry, false));
            this.rry = Math.abs(this.ya - coordSys.mapYi(this.x1 + this.rx, this.y1 + this.ry, false));
            this.rrx2 = Math.trunc(this.rrx / 2);
            this.rry2 = Math.trunc(this.rry / 2);

            coordSys.trackPoint(this.xa - this.rrx2, this.ya - this.rry2);
            coordSys.trackPoint(this.xa + this.rrx2, this.ya + this.rry2);

            this.rox = Math.abs(this.xa - coordSys.mapXi(
                this.x1 + PrimitivePCBPad.CORNER_DIAMETER,
                this.y1 + PrimitivePCBPad.CORNER_DIAMETER, false));
            this.roy = Math.abs(this.ya - coordSys.mapYi(
                this.x1 + PrimitivePCBPad.CORNER_DIAMETER,
                this.y1 + PrimitivePCBPad.CORNER_DIAMETER, false));

            this.rix = Math.abs(this.xa - coordSys.mapXi(this.x1 + this.ri, this.y1 + this.ri, false));
            this.riy = Math.abs(this.ya - coordSys.mapYi(this.x1 + this.ri, this.y1 + this.ri, false));
            this.rix2 = Math.trunc(this.rix / 2);
            this.riy2 = Math.trunc(this.riy / 2);
        }

        if (!g.hitClip(this.xa - this.rrx2, this.ya - this.rry2, this.rrx, this.rry)) return;

        g.applyStroke(1, 0);

        if (this.drawOnlyPads) {
            g.setColor(g.getColor().white());
            g.fillOval(this.xa - this.rix2, this.ya - this.riy2, this.rix, this.riy);
        } else {
            switch (this.sty) {
                case 1:
                    g.fillRect(this.xa - this.rrx2, this.ya - this.rry2, this.rrx, this.rry);
                    break;
                case 2:
                    g.fillRoundRect(this.xa - this.rrx2, this.ya - this.rry2,
                        this.rrx, this.rry, this.rox, this.roy);
                    break;
                case 0:
                default:
                    g.fillOval(this.xa - this.rrx2, this.ya - this.rry2, this.rrx, this.rry);
                    break;
            }
        }
    }

    parseTokens(tokens: string[], nn: number): void {
        this.changed = true;
        if (tokens[0] !== 'PA') throw new Error(`PA: Invalid primitive: ${tokens[0]}`);
        if (nn < 7) throw new Error('Bad arguments on PA');
        const x1 = parseInt(tokens[1]!, 10);
        const y1 = parseInt(tokens[2]!, 10);
        this.virtualPoint[0]!.x = x1; this.virtualPoint[0]!.y = y1;
        this.virtualPoint[this.getNameVirtualPointNumber()]!.x = x1 + 5;
        this.virtualPoint[this.getNameVirtualPointNumber()]!.y = y1 + 5;
        this.virtualPoint[this.getValueVirtualPointNumber()]!.x = x1 + 5;
        this.virtualPoint[this.getValueVirtualPointNumber()]!.y = y1 + 10;
        this.rx = parseInt(tokens[3]!, 10);
        this.ry = parseInt(tokens[4]!, 10);
        this.ri = parseInt(tokens[5]!, 10);
        this.sty = parseInt(tokens[6]!, 10);
        if (nn > 7) this.parseLayer(tokens[7]!);
    }

    getDistanceToPoint(px: number, py: number): number {
        if (this.checkText(px, py)) return 0;
        const distance = GeometricDistances.pointToPoint(
            this.virtualPoint[0]!.x, this.virtualPoint[0]!.y, px, py) -
            Math.min(this.rx, this.ry) / 2;
        return distance > 0 ? distance : 0;
    }

    toString(extensions: boolean): string {
        let s = `PA ${this.virtualPoint[0]!.x} ${this.virtualPoint[0]!.y} ` +
            `${this.rx} ${this.ry} ${this.ri} ${this.sty} ${this.getLayer()}\n`;
        s += this.saveText(extensions);
        return s;
    }

    export(exp: ExportInterface, cs: MapCoordinates): void {
        this.exportText(exp, cs, -1);
        exp.exportPCBPad(
            cs.mapX(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y),
            cs.mapY(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y),
            this.sty,
            Math.abs(cs.mapX(this.virtualPoint[0]!.x + this.rx, this.virtualPoint[0]!.y + this.ry) -
                cs.mapX(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y)),
            Math.abs(cs.mapY(this.virtualPoint[0]!.x + this.rx, this.virtualPoint[0]!.y + this.ry) -
                cs.mapY(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y)),
            Math.trunc(this.ri * cs.getXMagnitude()),
            this.getLayer(), this.drawOnlyPads);
    }

    getNameVirtualPointNumber(): number { return 1; }
    getValueVirtualPointNumber(): number { return 2; }

    override rotatePrimitive(bCounterClockWise: boolean, ix: number, iy: number): void {
        super.rotatePrimitive(bCounterClockWise, ix, iy);
        const swap = this.rx; this.rx = this.ry; this.ry = swap;
    }

    override intersects(rect: RectangleG, isLeftToRightSelection: boolean): boolean {
        if (!this.getCurrentLayer()?.isVisible()) return false;
        if (isLeftToRightSelection) return this.isFullyContained(rect);
        return rect.contains(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y);
    }
}
