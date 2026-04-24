import type { GraphicsInterface } from '../graphic/GraphicsInterface.js';
import type { ExportInterface } from '../export/ExportInterface.js';
import { GraphicPrimitive } from './GraphicPrimitive.js';
import { MapCoordinates } from '../geom/MapCoordinates.js';
import { LayerDesc } from '../layers/LayerDesc.js';
import { Globals } from '../globals/Globals.js';
import { GeometricDistances } from '../geom/GeometricDistances.js';
import { RectangleG } from '../graphic/RectangleG.js';

export class PrimitiveRectangle extends GraphicPrimitive {
    private static readonly N_POINTS = 4;
    private static readonly DISTANCE_IN = 1;
    private static readonly DISTANCE_OUT = 1000;

    private isFilled: boolean = false;
    private dashStyle: number = 0;
    private xa = 0; private ya = 0; private xb = 0; private yb = 0;
    private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
    private width = 0; private height = 0; private w = 0;

    constructor(f: string, size: number)
    constructor(x1: number, y1: number, x2: number, y2: number,
        f: boolean, layer: number, dashSt: number, font: string, size: number)
    constructor(...args: unknown[]) {
        super();
        if (args.length === 2) {
            this.isFilled = false;
            this.initPrimitive(-1, args[0] as string, args[1] as number);
        } else {
            const [x1, y1, x2, y2, f, layer, dashSt, font, size] = args as
                [number, number, number, number, boolean, number, number, string, number];
            this.initPrimitive(-1, font, size);
            this.virtualPoint[0]!.x = x1; this.virtualPoint[0]!.y = y1;
            this.virtualPoint[1]!.x = x2; this.virtualPoint[1]!.y = y2;
            this.virtualPoint[this.getNameVirtualPointNumber()]!.x = x1 + 5;
            this.virtualPoint[this.getNameVirtualPointNumber()]!.y = y1 + 5;
            this.virtualPoint[this.getValueVirtualPointNumber()]!.x = x1 + 5;
            this.virtualPoint[this.getValueVirtualPointNumber()]!.y = y1 + 10;
            this.isFilled = f;
            this.dashStyle = dashSt;
            this.setLayer(layer);
        }
    }

    getControlPointNumber(): number { return PrimitiveRectangle.N_POINTS; }

    getFilled(): boolean { return this.isFilled; }
    setFilled(v: boolean): void { this.isFilled = v; this.setChanged(true); }
    getDashStyle(): number { return this.dashStyle; }
    setDashStyle(v: number): void { this.dashStyle = this.checkDashStyle(v); this.setChanged(true); }

    draw(g: GraphicsInterface, coordSys: MapCoordinates, layerV: LayerDesc[]): void {
        if (!this.selectLayer(g, layerV)) return;
        this.drawText(g, coordSys, layerV, -1);

        if (this.changed) {
            this.changed = false;
            this.x1 = coordSys.mapX(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y);
            this.y1 = coordSys.mapY(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y);
            this.x2 = coordSys.mapX(this.virtualPoint[1]!.x, this.virtualPoint[1]!.y);
            this.y2 = coordSys.mapY(this.virtualPoint[1]!.x, this.virtualPoint[1]!.y);
            this.xa = Math.min(this.x1, this.x2); this.xb = Math.max(this.x1, this.x2);
            this.ya = Math.min(this.y1, this.y2); this.yb = Math.max(this.y1, this.y2);
            this.w = Globals.lineWidth * coordSys.getXMagnitude();
            if (this.w < GraphicPrimitive.D_MIN) this.w = GraphicPrimitive.D_MIN;
            this.width = this.xb - this.xa;
            this.height = this.yb - this.ya;
        }

        if (!g.hitClip(this.xa, this.ya, this.width + 1, this.height + 1)) return;
        g.applyStroke(this.w, this.dashStyle);

        if (this.isFilled) {
            g.fillRect(this.xa, this.ya, this.width + 1, this.height + 1);
        } else {
            if (this.xb !== this.xa || this.yb !== this.ya) {
                g.drawLine(this.xa, this.ya, this.xb, this.ya);
                g.drawLine(this.xb, this.ya, this.xb, this.yb);
                g.drawLine(this.xb, this.yb, this.xa, this.yb);
                g.drawLine(this.xa, this.yb, this.xa, this.ya);
            }
        }
    }

    parseTokens(tokens: string[], nn: number): void {
        this.changed = true;
        if (tokens[0] !== 'RV' && tokens[0] !== 'RP')
            throw new Error(`RV/RP: Invalid primitive: ${tokens[0]}`);
        if (nn < 5) throw new Error('Bad arguments on RV/RP');
        const x1 = parseInt(tokens[1]!, 10);
        const y1 = parseInt(tokens[2]!, 10);
        this.virtualPoint[0]!.x = x1; this.virtualPoint[0]!.y = y1;
        this.virtualPoint[1]!.x = parseInt(tokens[3]!, 10);
        this.virtualPoint[1]!.y = parseInt(tokens[4]!, 10);
        this.virtualPoint[this.getNameVirtualPointNumber()]!.x = x1 + 5;
        this.virtualPoint[this.getNameVirtualPointNumber()]!.y = y1 + 5;
        this.virtualPoint[this.getValueVirtualPointNumber()]!.x = x1 + 5;
        this.virtualPoint[this.getValueVirtualPointNumber()]!.y = y1 + 10;
        if (nn > 5) this.parseLayer(tokens[5]!);
        this.isFilled = tokens[0] === 'RP';
        if (nn > 6 && tokens[6] === 'FCJ') {
            this.dashStyle = this.checkDashStyle(parseInt(tokens[7]!, 10));
        }
    }

    getDistanceToPoint(px: number, py: number): number {
        if (this.checkText(px, py)) return 0;
        const xa = Math.min(this.virtualPoint[0]!.x, this.virtualPoint[1]!.x);
        const ya = Math.min(this.virtualPoint[0]!.y, this.virtualPoint[1]!.y);
        const xb = Math.max(this.virtualPoint[0]!.x, this.virtualPoint[1]!.x);
        const yb = Math.max(this.virtualPoint[0]!.y, this.virtualPoint[1]!.y);
        if (this.isFilled) {
            return GeometricDistances.pointInRectangle(xa, ya, xb - xa, yb - ya, px, py)
                ? PrimitiveRectangle.DISTANCE_IN : PrimitiveRectangle.DISTANCE_OUT;
        }
        return GeometricDistances.pointToRectangle(xa, ya, xb - xa, yb - ya, px, py);
    }

    toString(extensions: boolean): string {
        const cmd = this.isFilled ? 'RP' : 'RV';
        let s = `${cmd} ${this.virtualPoint[0]!.x} ${this.virtualPoint[0]!.y} ` +
            `${this.virtualPoint[1]!.x} ${this.virtualPoint[1]!.y} ${this.getLayer()}\n`;
        if (extensions && (this.dashStyle > 0 || this.hasName() || this.hasValue())) {
            const text = (this.name.length !== 0 || this.value.length !== 0) ? '1' : '0';
            s += `FCJ ${this.dashStyle} ${text}\n`;
        }
        s += this.saveText(false);
        return s;
    }

    export(exp: ExportInterface, cs: MapCoordinates): void {
        this.exportText(exp, cs, -1);
        exp.exportRectangle(
            cs.mapX(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y),
            cs.mapY(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y),
            cs.mapX(this.virtualPoint[1]!.x, this.virtualPoint[1]!.y),
            cs.mapY(this.virtualPoint[1]!.x, this.virtualPoint[1]!.y),
            this.isFilled, this.getLayer(), this.dashStyle,
            Globals.lineWidth * cs.getXMagnitude());
    }

    getNameVirtualPointNumber(): number { return 2; }
    getValueVirtualPointNumber(): number { return 3; }

    override intersects(rect: RectangleG, isLeftToRightSelection: boolean): boolean {
        if (!this.getCurrentLayer()?.isVisible()) return false;
        if (isLeftToRightSelection) return this.isFullyContained(rect);
        const x1 = Math.min(this.virtualPoint[0]!.x, this.virtualPoint[1]!.x);
        const y1 = Math.min(this.virtualPoint[0]!.y, this.virtualPoint[1]!.y);
        const x2 = Math.max(this.virtualPoint[0]!.x, this.virtualPoint[1]!.x);
        const y2 = Math.max(this.virtualPoint[0]!.y, this.virtualPoint[1]!.y);
        if (rect.contains(x1, y1) || rect.contains(x2, y1) ||
            rect.contains(x1, y2) || rect.contains(x2, y2)) return true;
        return rect.intersectsLine(x1, y1, x2, y1) || rect.intersectsLine(x1, y2, x2, y2) ||
            rect.intersectsLine(x1, y1, x1, y2) || rect.intersectsLine(x2, y1, x2, y2);
    }
}
