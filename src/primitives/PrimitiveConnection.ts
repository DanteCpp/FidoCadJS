import type { GraphicsInterface } from '../graphic/GraphicsInterface.js';
import type { ExportInterface } from '../export/ExportInterface.js';
import { GraphicPrimitive } from './GraphicPrimitive.js';
import { MapCoordinates } from '../geom/MapCoordinates.js';
import { LayerDesc } from '../layers/LayerDesc.js';
import { Globals } from '../globals/Globals.js';
import { GeometricDistances } from '../geom/GeometricDistances.js';
import { RectangleG } from '../graphic/RectangleG.js';

export class PrimitiveConnection extends GraphicPrimitive {
    private static readonly N_POINTS = 3;

    private x1: number = 0; private y1: number = 0;
    private xa1: number = 0; private ya1: number = 0;
    private ni: number = 0;
    private nn: number = 0;
    private w: number = 0;

    constructor(f: string, size: number)
    constructor(x: number, y: number, layer: number, f: string, size: number)
    constructor(...args: unknown[]) {
        super();
        if (args.length === 2) {
            this.initPrimitive(-1, args[0] as string, args[1] as number);
        } else {
            const [x, y, layer, f, size] = args as [number, number, number, string, number];
            this.initPrimitive(-1, f, size);
            this.virtualPoint[0]!.x = x; this.virtualPoint[0]!.y = y;
            this.virtualPoint[this.getNameVirtualPointNumber()]!.x = x + 5;
            this.virtualPoint[this.getNameVirtualPointNumber()]!.y = y + 5;
            this.virtualPoint[this.getValueVirtualPointNumber()]!.x = x + 5;
            this.virtualPoint[this.getValueVirtualPointNumber()]!.y = y + 10;
            this.setLayer(layer);
        }
    }

    getControlPointNumber(): number { return PrimitiveConnection.N_POINTS; }

    draw(g: GraphicsInterface, coordSys: MapCoordinates, layerV: LayerDesc[]): void {
        if (!this.selectLayer(g, layerV)) return;
        this.drawText(g, coordSys, layerV, -1);

        if (this.changed) {
            this.changed = false;
            this.x1 = this.virtualPoint[0]!.x;
            this.y1 = this.virtualPoint[0]!.y;

            this.nn = Math.abs(coordSys.mapXr(0, 0) - coordSys.mapXr(10, 10)) *
                Globals.diameterConnection / 10.0;

            if (this.nn < 2.0) {
                this.nn = Math.trunc(Math.abs(coordSys.mapXr(0, 0) - coordSys.mapXr(20, 20)) *
                    Globals.diameterConnection / 12);
            }

            this.xa1 = Math.round(coordSys.mapX(this.x1, this.y1) - this.nn / 2.0);
            this.ya1 = Math.round(coordSys.mapY(this.x1, this.y1) - this.nn / 2.0);

            this.ni = Math.round(this.nn);
            if (this.ni === 0) this.ni = 1;

            this.w = Globals.lineWidth * coordSys.getXMagnitude();
            if (this.w < GraphicPrimitive.D_MIN) this.w = GraphicPrimitive.D_MIN;
        }

        if (!g.hitClip(this.xa1, this.ya1, this.ni, this.ni)) return;

        g.applyStroke(this.w, 0);

        if (this.ni > 1) {
            g.fillOval(this.xa1, this.ya1, this.ni, this.ni);
        } else {
            g.fillRect(this.xa1, this.ya1, this.ni, this.ni);
        }
    }

    parseTokens(tokens: string[], nn: number): void {
        this.changed = true;
        if (tokens[0] !== 'SA') throw new Error('Invalid primitive: programming error?');
        if (nn < 3) throw new Error('Bad arguments on SA');
        const x1 = parseInt(tokens[1]!, 10);
        const y1 = parseInt(tokens[2]!, 10);
        this.virtualPoint[0]!.x = x1; this.virtualPoint[0]!.y = y1;
        this.virtualPoint[this.getNameVirtualPointNumber()]!.x = x1 + 5;
        this.virtualPoint[this.getNameVirtualPointNumber()]!.y = y1 + 5;
        this.virtualPoint[this.getValueVirtualPointNumber()]!.x = x1 + 5;
        this.virtualPoint[this.getValueVirtualPointNumber()]!.y = y1 + 10;
        if (nn > 3) this.parseLayer(tokens[3]!);
    }

    getDistanceToPoint(px: number, py: number): number {
        if (this.checkText(px, py)) return 0;
        return GeometricDistances.pointToPoint(
            this.virtualPoint[0]!.x, this.virtualPoint[0]!.y, px, py) - 1;
    }

    toString(extensions: boolean): string {
        let s = `SA ${this.virtualPoint[0]!.x} ${this.virtualPoint[0]!.y} ${this.getLayer()}\n`;
        s += this.saveText(extensions);
        return s;
    }

    export(exp: ExportInterface, cs: MapCoordinates): void {
        this.exportText(exp, cs, -1);
        exp.exportConnection(
            cs.mapX(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y),
            cs.mapY(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y),
            this.getLayer(),
            Globals.diameterConnection * cs.getXMagnitude());
    }

    getNameVirtualPointNumber(): number { return 1; }
    getValueVirtualPointNumber(): number { return 2; }

    override intersects(rect: RectangleG, isLeftToRightSelection: boolean): boolean {
        if (!this.getCurrentLayer()?.isVisible()) return false;
        if (isLeftToRightSelection) return this.isFullyContained(rect);
        return rect.contains(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y);
    }
}
