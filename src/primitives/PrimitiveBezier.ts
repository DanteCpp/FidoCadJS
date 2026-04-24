import type { GraphicsInterface } from '../graphic/GraphicsInterface.js';
import type { ExportInterface } from '../export/ExportInterface.js';
import type { ShapeInterface } from '../graphic/ShapeInterface.js';
import { GraphicPrimitive } from './GraphicPrimitive.js';
import { MapCoordinates } from '../geom/MapCoordinates.js';
import { LayerDesc } from '../layers/LayerDesc.js';
import { Arrow } from './Arrow.js';
import { Globals } from '../globals/Globals.js';
import { GeometricDistances } from '../geom/GeometricDistances.js';
import { RectangleG } from '../graphic/RectangleG.js';
import { PointG } from '../graphic/PointG.js';

export class PrimitiveBezier extends GraphicPrimitive {
    private static readonly N_POINTS = 6;
    private readonly arrowData: Arrow;
    private dashStyle: number = 0;
    private shape1: ShapeInterface | null = null;
    private w: number = 0;
    private xmin = 0; private ymin = 0; private width = 0; private height = 0;

    constructor(f: string, size: number)
    constructor(x1: number, y1: number, x2: number, y2: number,
        x3: number, y3: number, x4: number, y4: number,
        layer: number, arrowS: boolean, arrowE: boolean, arrowSt: number,
        arrowLe: number, arrowWi: number, dashSt: number, font: string, size: number)
    constructor(...args: unknown[]) {
        super();
        this.arrowData = new Arrow();
        if (args.length === 2) {
            this.initPrimitive(-1, args[0] as string, args[1] as number);
        } else {
            const [x1, y1, x2, y2, x3, y3, x4, y4, layer, arrowS, arrowE,
                arrowSt, arrowLe, arrowWi, dashSt, font, size] = args as
                [number, number, number, number, number, number, number, number,
                number, boolean, boolean, number, number, number, number, string, number];
            this.arrowData.setArrowStart(arrowS);
            this.arrowData.setArrowEnd(arrowE);
            this.arrowData.setArrowHalfWidth(arrowWi);
            this.arrowData.setArrowLength(arrowLe);
            this.arrowData.setArrowStyle(arrowSt);
            this.dashStyle = dashSt;
            this.initPrimitive(-1, font, size);
            this.virtualPoint[0]!.x = x1; this.virtualPoint[0]!.y = y1;
            this.virtualPoint[1]!.x = x2; this.virtualPoint[1]!.y = y2;
            this.virtualPoint[2]!.x = x3; this.virtualPoint[2]!.y = y3;
            this.virtualPoint[3]!.x = x4; this.virtualPoint[3]!.y = y4;
            this.virtualPoint[this.getNameVirtualPointNumber()]!.x = x1 + 5;
            this.virtualPoint[this.getNameVirtualPointNumber()]!.y = y1 + 5;
            this.virtualPoint[this.getValueVirtualPointNumber()]!.x = x1 + 5;
            this.virtualPoint[this.getValueVirtualPointNumber()]!.y = y1 + 10;
            this.setLayer(layer);
        }
    }

    getControlPointNumber(): number { return PrimitiveBezier.N_POINTS; }

    getDashStyle(): number { return this.dashStyle; }
    setDashStyle(v: number): void { this.dashStyle = this.checkDashStyle(v); this.setChanged(true); }
    getArrowData(): Arrow { return this.arrowData; }

    private drawArrow(g: GraphicsInterface, coordSys: MapCoordinates,
        aa: number, bb: number, cc: number, dd: number): PointG {
        let psx = this.virtualPoint[aa]!.x, psy = this.virtualPoint[aa]!.y;
        let pex: number, pey: number;
        if (this.virtualPoint[aa]!.x !== this.virtualPoint[bb]!.x ||
            this.virtualPoint[aa]!.y !== this.virtualPoint[bb]!.y) {
            pex = this.virtualPoint[bb]!.x; pey = this.virtualPoint[bb]!.y;
        } else if (this.virtualPoint[aa]!.x !== this.virtualPoint[cc]!.x ||
            this.virtualPoint[aa]!.y !== this.virtualPoint[cc]!.y) {
            pex = this.virtualPoint[cc]!.x; pey = this.virtualPoint[cc]!.y;
        } else {
            pex = this.virtualPoint[dd]!.x; pey = this.virtualPoint[dd]!.y;
        }
        return this.arrowData.drawArrow(g,
            coordSys.mapX(psx, psy), coordSys.mapY(psx, psy),
            coordSys.mapX(pex, pey), coordSys.mapY(pex, pey));
    }

    draw(g: GraphicsInterface, coordSys: MapCoordinates, layerV: LayerDesc[]): void {
        if (!this.selectLayer(g, layerV)) return;
        let h = 0;
        let p0 = new PointG(coordSys.mapX(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y),
            coordSys.mapY(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y));
        let p3 = new PointG(coordSys.mapX(this.virtualPoint[3]!.x, this.virtualPoint[3]!.y),
            coordSys.mapY(this.virtualPoint[3]!.x, this.virtualPoint[3]!.y));
        this.drawText(g, coordSys, layerV, -1);
        if (this.changed) {
            this.w = Globals.lineWidth * coordSys.getXMagnitude();
            if (this.w < GraphicPrimitive.D_MIN) this.w = GraphicPrimitive.D_MIN;
        }
        g.applyStroke(this.w, this.dashStyle);
        if (this.arrowData.atLeastOneArrow()) {
            h = this.arrowData.prepareCoordinateMapping(coordSys);
            if (this.arrowData.isArrowStart()) {
                const np = this.drawArrow(g, coordSys, 0, 1, 2, 3);
                if (this.arrowData.getArrowLength() > 0) p0 = np;
            }
            if (this.arrowData.isArrowEnd()) {
                const np = this.drawArrow(g, coordSys, 3, 2, 1, 0);
                if (this.arrowData.getArrowLength() > 0) p3 = np;
            }
        }
        if (this.changed) {
            this.changed = false;
            this.shape1 = g.createShape();
            this.shape1.createCubicCurve(
                p0.x, p0.y,
                coordSys.mapX(this.virtualPoint[1]!.x, this.virtualPoint[1]!.y),
                coordSys.mapY(this.virtualPoint[1]!.x, this.virtualPoint[1]!.y),
                coordSys.mapX(this.virtualPoint[2]!.x, this.virtualPoint[2]!.y),
                coordSys.mapY(this.virtualPoint[2]!.x, this.virtualPoint[2]!.y),
                p3.x, p3.y);
            const r = this.shape1.getBounds();
            this.xmin = r.x - h; this.ymin = r.y - h;
            this.width = r.width + 2 * h; this.height = r.height + 2 * h;
        }
        if (!g.hitClip(this.xmin, this.ymin, this.width + 1, this.height + 1)) return;
        if (this.width === 0 || this.height === 0) {
            g.drawLine(coordSys.mapX(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y),
                coordSys.mapY(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y),
                coordSys.mapX(this.virtualPoint[3]!.x, this.virtualPoint[3]!.y),
                coordSys.mapY(this.virtualPoint[3]!.x, this.virtualPoint[3]!.y));
        } else if (this.shape1) {
            g.draw(this.shape1);
        }
    }

    parseTokens(tokens: string[], nn: number): void {
        this.changed = true;
        if (tokens[0] !== 'BE') throw new Error('Invalid primitive: programming error?');
        if (nn < 9) throw new Error('Bad arguments on BE');
        const x1 = parseInt(tokens[1]!, 10);
        const y1 = parseInt(tokens[2]!, 10);
        this.virtualPoint[0]!.x = x1; this.virtualPoint[0]!.y = y1;
        this.virtualPoint[1]!.x = parseInt(tokens[3]!, 10);
        this.virtualPoint[1]!.y = parseInt(tokens[4]!, 10);
        this.virtualPoint[2]!.x = parseInt(tokens[5]!, 10);
        this.virtualPoint[2]!.y = parseInt(tokens[6]!, 10);
        this.virtualPoint[3]!.x = parseInt(tokens[7]!, 10);
        this.virtualPoint[3]!.y = parseInt(tokens[8]!, 10);
        this.virtualPoint[this.getNameVirtualPointNumber()]!.x = x1 + 5;
        this.virtualPoint[this.getNameVirtualPointNumber()]!.y = y1 + 5;
        this.virtualPoint[this.getValueVirtualPointNumber()]!.x = x1 + 5;
        this.virtualPoint[this.getValueVirtualPointNumber()]!.y = y1 + 10;
        if (nn > 9) this.parseLayer(tokens[9]!);
        if (nn > 10 && tokens[10] === 'FCJ') {
            const i = this.arrowData.parseTokens(tokens, 11);
            this.dashStyle = this.checkDashStyle(parseInt(tokens[i]!, 10));
        }
    }

    getDistanceToPoint(px: number, py: number): number {
        if (this.checkText(px, py)) return 0;
        const p0 = new PointG(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y);
        const p3 = new PointG(this.virtualPoint[3]!.x, this.virtualPoint[3]!.y);
        if (this.arrowData.atLeastOneArrow()) {
            const m = new MapCoordinates();
            this.arrowData.prepareCoordinateMapping(m);
            let r = false, t = false;
            if (this.arrowData.isArrowStart()) {
                t = this.arrowData.isInArrow(px, py,
                    this.virtualPoint[0]!.x, this.virtualPoint[0]!.y,
                    this.virtualPoint[1]!.x, this.virtualPoint[1]!.y,
                    this.arrowData.getArrowLength() > 0 ? p0 : null);
            }
            if (this.arrowData.isArrowEnd()) {
                r = this.arrowData.isInArrow(px, py,
                    this.virtualPoint[3]!.x, this.virtualPoint[3]!.y,
                    this.virtualPoint[2]!.x, this.virtualPoint[2]!.y,
                    this.arrowData.getArrowLength() > 0 ? p3 : null);
            }
            if (r || t) return 1;
        }
        return GeometricDistances.pointToBezier(
            p0.x, p0.y,
            this.virtualPoint[1]!.x, this.virtualPoint[1]!.y,
            this.virtualPoint[2]!.x, this.virtualPoint[2]!.y,
            p3.x, p3.y, px, py);
    }

    toString(extensions: boolean): string {
        let s = `BE ${this.virtualPoint[0]!.x} ${this.virtualPoint[0]!.y} ` +
            `${this.virtualPoint[1]!.x} ${this.virtualPoint[1]!.y} ` +
            `${this.virtualPoint[2]!.x} ${this.virtualPoint[2]!.y} ` +
            `${this.virtualPoint[3]!.x} ${this.virtualPoint[3]!.y} ${this.getLayer()}\n`;
        if (extensions && (this.arrowData.atLeastOneArrow() || this.dashStyle > 0 ||
            this.hasName() || this.hasValue())) {
            const text = (this.name.length !== 0 || this.value.length !== 0) ? '1' : '0';
            s += `FCJ ${this.arrowData.createArrowTokens()} ${this.dashStyle} ${text}\n`;
        }
        s += this.saveText(false);
        return s;
    }

    export(exp: ExportInterface, cs: MapCoordinates): void {
        this.exportText(exp, cs, -1);
        exp.exportBezier(
            cs.mapX(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y),
            cs.mapY(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y),
            cs.mapX(this.virtualPoint[1]!.x, this.virtualPoint[1]!.y),
            cs.mapY(this.virtualPoint[1]!.x, this.virtualPoint[1]!.y),
            cs.mapX(this.virtualPoint[2]!.x, this.virtualPoint[2]!.y),
            cs.mapY(this.virtualPoint[2]!.x, this.virtualPoint[2]!.y),
            cs.mapX(this.virtualPoint[3]!.x, this.virtualPoint[3]!.y),
            cs.mapY(this.virtualPoint[3]!.x, this.virtualPoint[3]!.y),
            this.getLayer(),
            this.arrowData.isArrowStart(), this.arrowData.isArrowEnd(),
            this.arrowData.getArrowStyle(),
            Math.trunc(this.arrowData.getArrowLength() * cs.getXMagnitude()),
            Math.trunc(this.arrowData.getArrowHalfWidth() * cs.getXMagnitude()),
            this.dashStyle, Globals.lineWidth * cs.getXMagnitude());
    }

    getNameVirtualPointNumber(): number { return 4; }
    getValueVirtualPointNumber(): number { return 5; }

    override intersects(rect: RectangleG, isLeftToRightSelection: boolean): boolean {
        if (!this.getCurrentLayer()?.isVisible()) return false;
        if (isLeftToRightSelection) return this.isFullyContained(rect);
        for (let i = 0; i < 4; i++) {
            if (rect.contains(this.virtualPoint[i]!.x, this.virtualPoint[i]!.y)) return true;
        }
        const segments = 100;
        let px = this.virtualPoint[0]!.x, py = this.virtualPoint[0]!.y;
        for (let i = 1; i <= segments; i++) {
            const t = i / segments;
            const [cx, cy] = this._bezierPoint(t,
                this.virtualPoint[0]!.x, this.virtualPoint[0]!.y,
                this.virtualPoint[1]!.x, this.virtualPoint[1]!.y,
                this.virtualPoint[2]!.x, this.virtualPoint[2]!.y,
                this.virtualPoint[3]!.x, this.virtualPoint[3]!.y);
            if (rect.intersectsLine(px, py, cx, cy)) return true;
            px = cx; py = cy;
        }
        return false;
    }

    private _bezierPoint(t: number,
        x0: number, y0: number, x1: number, y1: number,
        x2: number, y2: number, x3: number, y3: number): [number, number] {
        const u = 1 - t, uu = u * u, tt = t * t;
        const uuu = uu * u, ttt = tt * t;
        return [
            uuu * x0 + 3 * uu * t * x1 + 3 * u * tt * x2 + ttt * x3,
            uuu * y0 + 3 * uu * t * y1 + 3 * u * tt * y2 + ttt * y3
        ];
    }
}
