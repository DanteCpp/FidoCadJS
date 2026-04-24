import type { GraphicsInterface } from '../graphic/GraphicsInterface.js';
import type { ExportInterface } from '../export/ExportInterface.js';
import { GraphicPrimitive } from './GraphicPrimitive.js';
import { MapCoordinates } from '../geom/MapCoordinates.js';
import { LayerDesc } from '../layers/LayerDesc.js';
import { GeometricDistances } from '../geom/GeometricDistances.js';
import { RectangleG } from '../graphic/RectangleG.js';

export class PrimitivePCBLine extends GraphicPrimitive {
    private static readonly N_POINTS = 4;

    private width: number = 0;
    private xa: number = 0; private ya: number = 0;
    private xb: number = 0; private yb: number = 0;
    private x1: number = 0; private y1: number = 0;
    private x2: number = 0; private y2: number = 0;
    private wiPix: number = 0;
    private xbpap1: number = 0; private ybpap1: number = 0;

    constructor(f: string, size: number)
    constructor(x1: number, y1: number, x2: number, y2: number,
        w: number, layer: number, f: string, size: number)
    constructor(...args: unknown[]) {
        super();
        if (args.length === 2) {
            this.width = 0;
            this.initPrimitive(-1, args[0] as string, args[1] as number);
        } else {
            const [x1, y1, x2, y2, w, layer, f, size] = args as
                [number, number, number, number, number, number, string, number];
            this.initPrimitive(-1, f, size);
            this.virtualPoint[0]!.x = x1; this.virtualPoint[0]!.y = y1;
            this.virtualPoint[1]!.x = x2; this.virtualPoint[1]!.y = y2;
            this.virtualPoint[this.getNameVirtualPointNumber()]!.x = x1 + 5;
            this.virtualPoint[this.getNameVirtualPointNumber()]!.y = y1 + 5;
            this.virtualPoint[this.getValueVirtualPointNumber()]!.x = x1 + 5;
            this.virtualPoint[this.getValueVirtualPointNumber()]!.y = y1 + 10;
            this.width = w;
            this.setLayer(layer);
        }
    }

    getControlPointNumber(): number { return PrimitivePCBLine.N_POINTS; }

    getWidth(): number { return this.width; }
    setWidth(v: number): void { this.width = v; this.setChanged(true); }

    draw(g: GraphicsInterface, coordSys: MapCoordinates, layerV: LayerDesc[]): void {
        if (!this.selectLayer(g, layerV)) return;
        this.drawText(g, coordSys, layerV, -1);

        if (this.changed) {
            this.changed = false;
            this.x1 = coordSys.mapX(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y);
            this.y1 = coordSys.mapY(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y);
            this.x2 = coordSys.mapX(this.virtualPoint[1]!.x, this.virtualPoint[1]!.y);
            this.y2 = coordSys.mapY(this.virtualPoint[1]!.x, this.virtualPoint[1]!.y);

            this.wiPix = Math.abs(
                coordSys.mapXr(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y) -
                coordSys.mapXr(this.virtualPoint[0]!.x + this.width,
                    this.virtualPoint[0]!.y + this.width));

            this.xa = Math.trunc(Math.min(this.x1, this.x2) - this.wiPix / 2);
            this.ya = Math.trunc(Math.min(this.y1, this.y2) - this.wiPix / 2);
            this.xb = Math.trunc(Math.max(this.x1, this.x2) + this.wiPix / 2);
            this.yb = Math.trunc(Math.max(this.y1, this.y2) + this.wiPix / 2);

            coordSys.trackPoint(this.xa, this.ya);
            coordSys.trackPoint(this.xb, this.yb);

            this.xbpap1 = this.xb - this.xa + 1;
            this.ybpap1 = this.yb - this.ya + 1;
        }

        if (!g.hitClip(this.xa, this.ya, this.xbpap1, this.ybpap1)) return;

        g.applyStroke(this.wiPix, 0);
        g.drawLine(this.x1, this.y1, this.x2, this.y2);
    }

    parseTokens(tokens: string[], nn: number): void {
        this.changed = true;
        if (tokens[0] !== 'PL') throw new Error(`PL: Invalid primitive: ${tokens[0]}`);
        if (nn < 6) throw new Error('Bad arguments on PL');
        const x1 = parseInt(tokens[1]!, 10);
        const y1 = parseInt(tokens[2]!, 10);
        this.virtualPoint[0]!.x = x1; this.virtualPoint[0]!.y = y1;
        this.virtualPoint[1]!.x = parseInt(tokens[3]!, 10);
        this.virtualPoint[1]!.y = parseInt(tokens[4]!, 10);
        this.virtualPoint[this.getNameVirtualPointNumber()]!.x = x1 + 5;
        this.virtualPoint[this.getNameVirtualPointNumber()]!.y = y1 + 5;
        this.virtualPoint[this.getValueVirtualPointNumber()]!.x = x1 + 5;
        this.virtualPoint[this.getValueVirtualPointNumber()]!.y = y1 + 10;
        this.width = parseFloat(tokens[5]!);
        if (nn > 6) this.parseLayer(tokens[6]!);
    }

    getDistanceToPoint(px: number, py: number): number {
        if (this.checkText(px, py)) return 0;
        const distance = Math.trunc(GeometricDistances.pointToSegment(
            this.virtualPoint[0]!.x, this.virtualPoint[0]!.y,
            this.virtualPoint[1]!.x, this.virtualPoint[1]!.y,
            px, py) - this.width / 2);
        return distance < 0 ? 0 : distance;
    }

    toString(extensions: boolean): string {
        let s = `PL ${this.virtualPoint[0]!.x} ${this.virtualPoint[0]!.y} ` +
            `${this.virtualPoint[1]!.x} ${this.virtualPoint[1]!.y} ` +
            `${this.roundIntelligently(this.width)} ${this.getLayer()}\n`;
        s += this.saveText(extensions);
        return s;
    }

    export(exp: ExportInterface, cs: MapCoordinates): void {
        this.exportText(exp, cs, -1);
        exp.exportPCBLine(
            cs.mapX(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y),
            cs.mapY(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y),
            cs.mapX(this.virtualPoint[1]!.x, this.virtualPoint[1]!.y),
            cs.mapY(this.virtualPoint[1]!.x, this.virtualPoint[1]!.y),
            Math.trunc(this.width * cs.getXMagnitude()),
            this.getLayer());
    }

    getNameVirtualPointNumber(): number { return 2; }
    getValueVirtualPointNumber(): number { return 3; }

    override intersects(rect: RectangleG, isLeftToRightSelection: boolean): boolean {
        if (!this.getCurrentLayer()?.isVisible()) return false;
        if (isLeftToRightSelection) return this.isFullyContained(rect);
        const x1 = this.virtualPoint[0]!.x, y1 = this.virtualPoint[0]!.y;
        const x2 = this.virtualPoint[1]!.x, y2 = this.virtualPoint[1]!.y;
        if (rect.contains(x1, y1) || rect.contains(x2, y2)) return true;
        return rect.intersectsLine(x1, y1, x2, y2);
    }
}
