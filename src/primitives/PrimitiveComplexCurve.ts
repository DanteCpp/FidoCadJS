import type { GraphicsInterface } from '../graphic/GraphicsInterface.js';
import type { ExportInterface } from '../export/ExportInterface.js';
import type { PolygonInterface } from '../graphic/PolygonInterface.js';
import type { ShapeInterface } from '../graphic/ShapeInterface.js';
import { GraphicPrimitive } from './GraphicPrimitive.js';
import { MapCoordinates } from '../geom/MapCoordinates.js';
import { LayerDesc } from '../layers/LayerDesc.js';
import { Arrow } from './Arrow.js';
import { Globals } from '../globals/Globals.js';
import { GeometricDistances } from '../geom/GeometricDistances.js';
import { RectangleG } from '../graphic/RectangleG.js';
import { PointG } from '../graphic/PointG.js';
import { PointDouble } from '../graphic/PointDouble.js';

class Cubic {
    a: number; b: number; c: number; d: number;
    d1: number = 0; d2: number = 0;
    constructor(a: number, b: number, c: number, d: number) {
        this.a = a; this.b = b; this.c = c; this.d = d;
    }
    eval(u: number): number { return ((this.d * u + this.c) * u + this.b) * u + this.a; }
}

class CurveStorage {
    pp: PointDouble[] = [];
    dd: PointDouble[] = [];
}

export class PrimitiveComplexCurve extends GraphicPrimitive {
    private static readonly STEPS = 24;

    private nPoints: number = 0;
    private isFilled: boolean = false;
    private isClosed: boolean = false;
    private readonly arrowData: Arrow;
    private dashStyle: number = 0;
    storageSize: number = 5;

    private p: PolygonInterface | null = null;
    private q: PolygonInterface | null = null;
    private gp: ShapeInterface | null = null;

    private xmin: number = 0; private ymin: number = 0;
    private width: number = 0; private height: number = 0;
    private w: number = 0;

    constructor(f: string, size: number)
    constructor(f: boolean, c: boolean, layer: number,
        arrowS: boolean, arrowE: boolean,
        arrowSt: number, arrowLe: number, arrowWi: number, dashSt: number,
        font: string, size: number)
    constructor(...args: unknown[]) {
        super();
        this.arrowData = new Arrow();
        if (args.length === 2) {
            this.isFilled = false;
            this.nPoints = 0;
            this.p = null;
            this.initPrimitive(this.storageSize, args[0] as string, args[1] as number);
        } else {
            const [f, c, layer, arrowS, arrowE, arrowSt, arrowLe, arrowWi, dashSt, font, size] =
                args as [boolean, boolean, number, boolean, boolean, number, number, number, number, string, number];
            this.arrowData.setArrowStart(arrowS);
            this.arrowData.setArrowEnd(arrowE);
            this.arrowData.setArrowHalfWidth(arrowWi);
            this.arrowData.setArrowLength(arrowLe);
            this.arrowData.setArrowStyle(arrowSt);
            this.dashStyle = dashSt;
            this.p = null;
            this.initPrimitive(this.storageSize, font, size);
            this.nPoints = 0;
            this.isFilled = f;
            this.isClosed = c;
            this.setLayer(layer);
        }
    }

    getControlPointNumber(): number { return this.nPoints + 2; }

    getFilled(): boolean { return this.isFilled; }
    setFilled(v: boolean): void { this.isFilled = v; this.setChanged(true); }
    getIsClosed(): boolean { return this.isClosed; }
    setIsClosed(v: boolean): void { this.isClosed = v; this.setChanged(true); }
    getDashStyle(): number { return this.dashStyle; }
    setDashStyle(v: number): void { this.dashStyle = this.checkDashStyle(v); this.setChanged(true); }
    getArrowData(): Arrow { return this.arrowData; }

    addPoint(x: number, y: number): void {
        if (this.nPoints + 2 >= this.storageSize) {
            const oN = this.storageSize;
            this.storageSize += 10;
            const nv: PointG[] = new Array(this.storageSize);
            for (let i = 0; i < oN; i++) nv[i] = this.virtualPoint[i]!;
            for (let i = oN; i < this.storageSize; i++) nv[i] = new PointG();
            this.virtualPoint = nv;
        }
        this.virtualPoint[this.nPoints]!.x = x;
        this.virtualPoint[this.nPoints++]!.y = y;
        this.virtualPoint[this.getNameVirtualPointNumber()]!.x = x + 5;
        this.virtualPoint[this.getNameVirtualPointNumber()]!.y = y + 5;
        this.virtualPoint[this.getValueVirtualPointNumber()]!.x = x + 5;
        this.virtualPoint[this.getValueVirtualPointNumber()]!.y = y + 10;
        this.changed = true;
    }

    addPointClosest(px: number, py: number): void {
        let distance = Math.sqrt((px - this.virtualPoint[0]!.x) ** 2 +
            (py - this.virtualPoint[0]!.y) ** 2);
        let minv = 0;
        if (this.q !== null) {
            const xp = this.q.getXpoints(), yp = this.q.getYpoints();
            const nq = this.q.getNpoints();
            for (let i = 0; i < nq - 1; i++) {
                const d = GeometricDistances.pointToSegment(
                    xp[i]!, yp[i]!, xp[i + 1]!, yp[i + 1]!, px, py);
                if (d < distance) { distance = d; minv = i - 1; }
            }
            minv = Math.floor(minv / PrimitiveComplexCurve.STEPS);
            minv++;
            if (minv < 0) minv = this.nPoints - 1;
        }
        this.addPoint(px, py);
        for (let i = this.nPoints - 1; i > minv; i--) {
            this.virtualPoint[i]!.x = this.virtualPoint[i - 1]!.x;
            this.virtualPoint[i]!.y = this.virtualPoint[i - 1]!.y;
        }
        this.virtualPoint[minv]!.x = px;
        this.virtualPoint[minv]!.y = py;
        this.changed = true;
    }

    removePoint(x: number, y: number, tolerance: number): void {
        if (this.nPoints <= 3) return;
        let minDistance = GeometricDistances.pointToPoint(
            this.virtualPoint[0]!.x, this.virtualPoint[0]!.y, x, y);
        let selI = -1;
        for (let i = 1; i < this.nPoints; i++) {
            const d = GeometricDistances.pointToPoint(
                this.virtualPoint[i]!.x, this.virtualPoint[i]!.y, x, y);
            if (d < minDistance) { minDistance = d; selI = i; }
        }
        if (minDistance <= tolerance) {
            this.nPoints--;
            for (let i = 0; i < this.nPoints; i++) {
                if (i >= selI) {
                    this.virtualPoint[i]!.x = this.virtualPoint[i + 1]!.x;
                    this.virtualPoint[i]!.y = this.virtualPoint[i + 1]!.y;
                }
                this.changed = true;
            }
        }
    }

    createComplexCurve(coordSys: MapCoordinates): CurveStorage | null {
        if (this.nPoints < 2) return null;

        const xPoints: number[] = new Array(this.nPoints);
        const yPoints: number[] = new Array(this.nPoints);
        for (let i = 0; i < this.nPoints; i++) {
            xPoints[i] = coordSys.mapXr(this.virtualPoint[i]!.x, this.virtualPoint[i]!.y);
            yPoints[i] = coordSys.mapYr(this.virtualPoint[i]!.x, this.virtualPoint[i]!.y);
        }

        let xx: Cubic[], yy: Cubic[];
        if (this.isClosed) {
            xx = this.calcNaturalCubicClosed(this.nPoints - 1, xPoints);
            yy = this.calcNaturalCubicClosed(this.nPoints - 1, yPoints);
        } else {
            xx = this.calcNaturalCubic(this.nPoints - 1, xPoints);
            yy = this.calcNaturalCubic(this.nPoints - 1, yPoints);
            if (this.arrowData.atLeastOneArrow()) {
                this.arrowData.prepareCoordinateMapping(coordSys);
                if (this.arrowData.isArrowStart()) {
                    const pp = new PointG();
                    this.arrowData.isInArrow(0, 0,
                        Math.round(xx[0]!.eval(0)), Math.round(yy[0]!.eval(0)),
                        Math.round(xx[0]!.eval(0.05)), Math.round(yy[0]!.eval(0.05)), pp);
                    if (this.arrowData.getArrowLength() > 0) {
                        xPoints[0] = pp.x; yPoints[0] = pp.y;
                    }
                }
                if (this.arrowData.isArrowEnd()) {
                    const l = xx.length - 1;
                    const pp = new PointG();
                    this.arrowData.isInArrow(0, 0,
                        Math.round(xx[l]!.eval(1)), Math.round(yy[l]!.eval(1)),
                        Math.round(xx[l]!.eval(0.95)), Math.round(yy[l]!.eval(0.95)), pp);
                    if (this.arrowData.getArrowLength() > 0) {
                        xPoints[this.nPoints - 1] = pp.x;
                        yPoints[this.nPoints - 1] = pp.y;
                    }
                }
                if (this.arrowData.getArrowLength() > 0) {
                    xx = this.calcNaturalCubic(this.nPoints - 1, xPoints);
                    yy = this.calcNaturalCubic(this.nPoints - 1, yPoints);
                }
            }
        }

        if (!xx || !yy || xx.length === 0) return null;

        const c = new CurveStorage();
        c.pp.push(new PointDouble(xx[0]!.eval(0), yy[0]!.eval(0)));
        for (let i = 0; i < xx.length; i++) {
            c.dd.push(new PointDouble(xx[i]!.d1, yy[i]!.d1));
            for (let j = 1; j <= PrimitiveComplexCurve.STEPS; j++) {
                const u = j / PrimitiveComplexCurve.STEPS;
                c.pp.push(new PointDouble(xx[i]!.eval(u), yy[i]!.eval(u)));
            }
        }
        c.dd.push(new PointDouble(xx[xx.length - 1]!.d2, yy[xx.length - 1]!.d2));
        return c;
    }

    createComplexCurvePoly(coordSys: MapCoordinates, poly: PolygonInterface): PolygonInterface | null {
        this.xmin = Number.MAX_SAFE_INTEGER; this.ymin = Number.MAX_SAFE_INTEGER;
        let xmax = -Number.MAX_SAFE_INTEGER, ymax = -Number.MAX_SAFE_INTEGER;

        const c = this.createComplexCurve(coordSys);
        if (!c) return null;
        const pp = c.pp;
        if (!pp) return null;

        for (const ppp of pp) {
            const x = Math.round(ppp.x);
            const y = Math.round(ppp.y);
            poly.addPoint(x, y);
            coordSys.trackPoint(x, y);
            if (x < this.xmin) this.xmin = x;
            if (x > xmax) xmax = x;
            if (y < this.ymin) this.ymin = y;
            if (y > ymax) ymax = y;
        }
        this.width = xmax - this.xmin;
        this.height = ymax - this.ymin;
        return poly;
    }

    calcNaturalCubic(n: number, x: number[]): Cubic[] {
        if (n < 1) return [];
        const gamma: number[] = new Array(n + 1);
        const delta: number[] = new Array(n + 1);
        const dd: number[] = new Array(n + 1);

        gamma[0] = 0.5;
        for (let i = 1; i < n; i++) gamma[i] = 1.0 / (4.0 - gamma[i - 1]);
        gamma[n] = 1.0 / (2.0 - gamma[n - 1]);

        delta[0] = 3 * (x[1]! - x[0]!) * gamma[0]!;
        for (let i = 1; i < n; i++)
            delta[i] = (3.0 * (x[i + 1]! - x[i - 1]!) - delta[i - 1]!) * gamma[i]!;
        delta[n] = (3.0 * (x[n]! - x[n - 1]!) - delta[n - 1]!) * gamma[n]!;

        dd[n] = delta[n]!;
        for (let i = n - 1; i >= 0; i--)
            dd[i] = delta[i]! - gamma[i]! * dd[i + 1]!;

        const cc: Cubic[] = new Array(n);
        for (let i = 0; i < n; i++) {
            cc[i] = new Cubic(x[i]!, dd[i]!,
                3.0 * (x[i + 1]! - x[i]!) - 2.0 * dd[i]! - dd[i + 1]!,
                2.0 * (x[i]! - x[i + 1]!) + dd[i]! + dd[i + 1]!);
            cc[i]!.d1 = dd[i]!;
            cc[i]!.d2 = dd[i + 1]!;
        }
        return cc;
    }

    calcNaturalCubicClosed(n: number, x: number[]): Cubic[] {
        if (n < 1) return [];
        const w: number[] = new Array(n + 1).fill(0);
        const v: number[] = new Array(n + 1).fill(0);
        const y: number[] = new Array(n + 1).fill(0);
        const dd: number[] = new Array(n + 1).fill(0);

        w[1] = v[1] = 0.25;
        y[0] = 0.25 * 3 * (x[1]! - x[n]!);
        let hh = 4, ff = 3 * (x[0]! - x[n - 1]!), gg = 1;

        for (let k = 1; k < n; k++) {
            const z = 1 / (4 - v[k]!);
            v[k + 1] = z;
            w[k + 1] = -z * w[k]!;
            y[k] = z * (3 * (x[k + 1]! - x[k - 1]!) - y[k - 1]!);
            hh = hh - gg * w[k]!;
            ff = ff - gg * y[k - 1]!;
            gg = -v[k]! * gg;
        }
        hh = hh - (gg + 1) * (v[n]! + w[n]!);
        y[n] = ff - (gg + 1) * y[n - 1]!;

        dd[n] = y[n]! / hh;
        dd[n - 1] = y[n - 1]! - (v[n]! + w[n]!) * dd[n]!;
        for (let k = n - 2; k >= 0; k--)
            dd[k] = y[k]! - v[k + 1]! * dd[k + 1]! - w[k + 1]! * dd[n]!;

        const cc: Cubic[] = new Array(n + 1);
        for (let k = 0; k < n; k++) {
            cc[k] = new Cubic(x[k]!, dd[k]!,
                3 * (x[k + 1]! - x[k]!) - 2 * dd[k]! - dd[k + 1]!,
                2 * (x[k]! - x[k + 1]!) + dd[k]! + dd[k + 1]!);
            cc[k]!.d1 = dd[k]!;
            cc[k]!.d2 = dd[k + 1]!;
        }
        cc[n] = new Cubic(x[n]!, dd[n]!,
            3 * (x[0]! - x[n]!) - 2 * dd[n]! - dd[0]!,
            2 * (x[n]! - x[0]!) + dd[n]! + dd[0]!);
        cc[n]!.d1 = dd[n]!;
        cc[n]!.d2 = dd[0]!;
        return cc;
    }

    draw(g: GraphicsInterface, coordSys: MapCoordinates, layerV: LayerDesc[]): void {
        if (!this.selectLayer(g, layerV)) return;
        this.drawText(g, coordSys, layerV, -1);

        if (this.changed) {
            this.changed = false;
            // Order matters: q sets xmin/ymin/width/height in logical coords,
            // then p overwrites them in screen coords (used for hitClip).
            this.q = this.createComplexCurvePoly(new MapCoordinates(), g.createPolygon());
            this.p = this.createComplexCurvePoly(coordSys, g.createPolygon());

            const c = this.createComplexCurve(coordSys);
            if (!c) return;
            const dd = c.dd, pp = c.pp;
            if (!this.q) return;

            this.gp = g.createShape();
            this.gp.createGeneralPath(this.q.getNpoints());
            this.gp.moveTo(pp[0]!.x, pp[0]!.y);

            const increment = PrimitiveComplexCurve.STEPS;
            const w1 = 0.666667, w2 = 0.666667;
            let j = 0;
            for (let i = 0; i < pp.length - increment; i += increment) {
                const derX1 = dd[j]!.x / 2.0 * w1;
                const derY1 = dd[j]!.y / 2.0 * w1;
                const derX2 = dd[j + 1]!.x / 2.0 * w2;
                const derY2 = dd[j + 1]!.y / 2.0 * w2;
                j++;
                this.gp.curveTo(
                    pp[i]!.x + derX1, pp[i]!.y + derY1,
                    pp[i + increment]!.x - derX2, pp[i + increment]!.y - derY2,
                    pp[i + increment]!.x, pp[i + increment]!.y);
            }
            if (this.isClosed) this.gp.closePath();

            this.w = Globals.lineWidth * coordSys.getXMagnitude();
            if (this.w < GraphicPrimitive.D_MIN) this.w = GraphicPrimitive.D_MIN;
        }

        if (!this.p || !this.gp) return;
        g.applyStroke(this.w, this.dashStyle);

        if (this.arrowData.atLeastOneArrow() && this.p.getNpoints() > 2) {
            this.arrowData.prepareCoordinateMapping(coordSys);
            const px = this.p.getXpoints(), py = this.p.getYpoints();
            if (this.arrowData.isArrowStart() && !this.isClosed) {
                this.arrowData.drawArrow(g,
                    coordSys.mapX(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y),
                    coordSys.mapY(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y),
                    px[1]!, py[1]!);
            }
            if (this.arrowData.isArrowEnd() && !this.isClosed) {
                const l = this.nPoints - 1;
                const np = this.p.getNpoints();
                this.arrowData.drawArrow(g,
                    coordSys.mapX(this.virtualPoint[l]!.x, this.virtualPoint[l]!.y),
                    coordSys.mapY(this.virtualPoint[l]!.x, this.virtualPoint[l]!.y),
                    px[np - 2]!, py[np - 2]!);
            }
        }

        if (!g.hitClip(this.xmin, this.ymin, this.width + 1, this.height + 1)) return;

        if (this.isFilled) g.fill(this.gp);

        if (this.width === 0 || this.height === 0) {
            const d = this.nPoints - 1;
            g.drawLine(
                coordSys.mapX(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y),
                coordSys.mapY(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y),
                coordSys.mapX(this.virtualPoint[d]!.x, this.virtualPoint[d]!.y),
                coordSys.mapY(this.virtualPoint[d]!.x, this.virtualPoint[d]!.y));
        } else {
            g.draw(this.gp);
        }
    }

    parseTokens(tokens: string[], nn: number): void {
        this.changed = true;
        if (tokens[0] !== 'CP' && tokens[0] !== 'CV')
            throw new Error(`CP/CV: Invalid primitive: ${tokens[0]}`);
        if (nn < 6) throw new Error('Bad arguments on CP/CV');

        let j = 1, i = 0, x1 = 0, y1 = 0;
        this.isClosed = tokens[j++] === '1';

        while (j < nn - 1) {
            if (j + 1 < nn - 1 && tokens[j + 1] === 'FCJ') break;
            x1 = parseInt(tokens[j++]!, 10);
            if (j >= nn - 1) throw new Error('Bad arguments on CP/CV');
            y1 = parseInt(tokens[j++]!, 10);
            i++;
            this.addPoint(x1, y1);
        }
        this.nPoints = i;

        this.virtualPoint[this.getNameVirtualPointNumber()]!.x = x1 + 5;
        this.virtualPoint[this.getNameVirtualPointNumber()]!.y = y1 + 5;
        this.virtualPoint[this.getValueVirtualPointNumber()]!.x = x1 + 5;
        this.virtualPoint[this.getValueVirtualPointNumber()]!.y = y1 + 10;

        if (nn > j) {
            this.parseLayer(tokens[j++]!);
            if (nn > j && tokens[j] === 'FCJ') {
                j++;
                j = this.arrowData.parseTokens(tokens, j);
                this.dashStyle = this.checkDashStyle(parseInt(tokens[j++]!, 10));
            } else {
                j++;
            }
        }
        this.isFilled = tokens[0] === 'CP';
    }

    getDistanceToPoint(px: number, py: number): number {
        if (this.checkText(px, py)) return 0;

        if (!this.p) {
            return GeometricDistances.pointToPoint(
                this.virtualPoint[0]!.x, this.virtualPoint[0]!.y, px, py);
        }

        if (this.isFilled && this.q!.contains(px, py)) return 1;

        const xpoints = this.q!.getXpoints();
        const ypoints = this.q!.getYpoints();

        if (this.arrowData.atLeastOneArrow() && !this.isClosed) {
            const m = new MapCoordinates();
            this.arrowData.prepareCoordinateMapping(m);
            let r = false, t = false;
            if (this.arrowData.isArrowStart()) {
                t = this.arrowData.isInArrow(px, py,
                    this.virtualPoint[0]!.x, this.virtualPoint[0]!.y,
                    xpoints[0]!, ypoints[0]!, null);
            }
            if (this.arrowData.isArrowEnd()) {
                const nq = this.q!.getNpoints();
                r = this.arrowData.isInArrow(px, py,
                    xpoints[nq - 1]!, ypoints[nq - 1]!,
                    this.virtualPoint[this.nPoints - 1]!.x,
                    this.virtualPoint[this.nPoints - 1]!.y, null);
            }
            if (r || t) return 1;
        }

        let distance = 100;
        const nq = this.q!.getNpoints();
        for (let i = 0; i < nq - 1; i++) {
            const d = GeometricDistances.pointToSegment(
                xpoints[i]!, ypoints[i]!, xpoints[i + 1]!, ypoints[i + 1]!, px, py);
            if (d < distance) distance = d;
        }
        return distance;
    }

    toString(extensions: boolean): string {
        if (this.name.length === 0 && this.value.length === 0 && this.nPoints === 1) return '';
        let s = this.isFilled ? 'CP ' : 'CV ';
        s += this.isClosed ? '1 ' : '0 ';
        for (let i = 0; i < this.nPoints; i++)
            s += `${this.virtualPoint[i]!.x} ${this.virtualPoint[i]!.y} `;
        s += `${this.getLayer()}\n`;
        if (extensions && (this.arrowData.atLeastOneArrow() || this.dashStyle > 0 ||
            this.hasName() || this.hasValue())) {
            const text = (this.name.length !== 0 || this.value.length !== 0) ? '1' : '0';
            s += `FCJ ${this.arrowData.createArrowTokens()} ${this.dashStyle} ${text}\n`;
        }
        s += this.saveText(false);
        return s;
    }

    export(exp: ExportInterface, cs: MapCoordinates): void {
        const xPoints: number[] = new Array(this.nPoints);
        const yPoints: number[] = new Array(this.nPoints);
        const vertices: PointDouble[] = new Array(this.nPoints * PrimitiveComplexCurve.STEPS + 1);

        for (let i = 0; i < this.nPoints; i++) {
            xPoints[i] = cs.mapXr(this.virtualPoint[i]!.x, this.virtualPoint[i]!.y);
            yPoints[i] = cs.mapYr(this.virtualPoint[i]!.x, this.virtualPoint[i]!.y);
            vertices[i] = new PointDouble(xPoints[i]!, yPoints[i]!);
        }

        if (!exp.exportCurve(vertices, this.nPoints, this.isFilled, this.isClosed,
            this.getLayer(),
            this.arrowData.isArrowStart(), this.arrowData.isArrowEnd(),
            this.arrowData.getArrowStyle(),
            Math.trunc(this.arrowData.getArrowLength() * cs.getXMagnitude()),
            Math.trunc(this.arrowData.getArrowHalfWidth() * cs.getXMagnitude()),
            this.dashStyle, Globals.lineWidth * cs.getXMagnitude())) {
            const totalnP = this.exportAsPolygonInterface(xPoints, yPoints, vertices, exp, cs);
            if (totalnP > 2) {
                if (this.arrowData.isArrowStart() && !this.isClosed) {
                    exp.exportArrow(
                        cs.mapX(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y),
                        cs.mapY(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y),
                        vertices[1]!.x, vertices[1]!.y,
                        this.arrowData.getArrowLength() * cs.getXMagnitude(),
                        this.arrowData.getArrowHalfWidth() * cs.getXMagnitude(),
                        this.arrowData.getArrowStyle());
                }
                if (this.arrowData.isArrowEnd() && !this.isClosed) {
                    const l = this.nPoints - 1;
                    exp.exportArrow(
                        cs.mapX(this.virtualPoint[l]!.x, this.virtualPoint[l]!.y),
                        cs.mapY(this.virtualPoint[l]!.x, this.virtualPoint[l]!.y),
                        vertices[totalnP - 2]!.x, vertices[totalnP - 2]!.y,
                        this.arrowData.getArrowLength() * cs.getXMagnitude(),
                        this.arrowData.getArrowHalfWidth() * cs.getXMagnitude(),
                        this.arrowData.getArrowStyle());
                }
            }
        }
        this.exportText(exp, cs, -1);
    }

    private exportAsPolygonInterface(xPoints: number[], yPoints: number[],
        vertices: PointDouble[], exp: ExportInterface, cs: MapCoordinates): number {
        let xx: Cubic[], yy: Cubic[];
        if (this.isClosed) {
            xx = this.calcNaturalCubicClosed(this.nPoints - 1, xPoints);
            yy = this.calcNaturalCubicClosed(this.nPoints - 1, yPoints);
        } else {
            xx = this.calcNaturalCubic(this.nPoints - 1, xPoints);
            yy = this.calcNaturalCubic(this.nPoints - 1, yPoints);
            if (this.arrowData.atLeastOneArrow()) {
                this.arrowData.prepareCoordinateMapping(cs);
                if (this.arrowData.isArrowStart()) {
                    const pp = new PointG();
                    this.arrowData.isInArrow(0, 0,
                        Math.round(xx[0]!.eval(0)), Math.round(yy[0]!.eval(0)),
                        Math.round(xx[0]!.eval(0.05)), Math.round(yy[0]!.eval(0.05)), pp);
                    if (this.arrowData.getArrowLength() > 0) {
                        xPoints[0] = pp.x; yPoints[0] = pp.y;
                    }
                }
                if (this.arrowData.isArrowEnd()) {
                    const l = xx.length - 1;
                    const pp = new PointG();
                    this.arrowData.isInArrow(0, 0,
                        Math.round(xx[l]!.eval(1)), Math.round(yy[l]!.eval(1)),
                        Math.round(xx[l]!.eval(0.95)), Math.round(yy[l]!.eval(0.95)), pp);
                    if (this.arrowData.getArrowLength() > 0) {
                        xPoints[this.nPoints - 1] = pp.x;
                        yPoints[this.nPoints - 1] = pp.y;
                    }
                }
                if (this.arrowData.getArrowLength() > 0) {
                    xx = this.calcNaturalCubic(this.nPoints - 1, xPoints);
                    yy = this.calcNaturalCubic(this.nPoints - 1, yPoints);
                }
            }
        }
        if (!xx || !yy || xx.length === 0) return 0;

        vertices[0] = new PointDouble(xx[0]!.eval(0), yy[0]!.eval(0));
        for (let i = 0; i < xx.length; i++) {
            for (let j = 1; j <= PrimitiveComplexCurve.STEPS; j++) {
                const u = j / PrimitiveComplexCurve.STEPS;
                vertices[i * PrimitiveComplexCurve.STEPS + j] =
                    new PointDouble(xx[i]!.eval(u), yy[i]!.eval(u));
            }
        }
        vertices[xx.length * PrimitiveComplexCurve.STEPS] =
            new PointDouble(xx[xx.length - 1]!.eval(1.0), yy[xx.length - 1]!.eval(1.0));

        const totalnP = xx.length * PrimitiveComplexCurve.STEPS + 1;

        if (this.isClosed || this.isFilled) {
            exp.exportPolygon(vertices, totalnP, this.isFilled, this.getLayer(),
                this.dashStyle, Globals.lineWidth * cs.getXMagnitude());
        } else {
            let phase = 0;
            for (let i = 1; i < totalnP; i++) {
                exp.setDashPhase(phase);
                exp.exportLine(vertices[i - 1]!.x, vertices[i - 1]!.y,
                    vertices[i]!.x, vertices[i]!.y,
                    this.getLayer(), false, false, 0, 0, 0,
                    this.dashStyle, Globals.lineWidth * cs.getXMagnitude());
                phase += Math.sqrt(
                    (vertices[i - 1]!.x - vertices[i]!.x) ** 2 +
                    (vertices[i - 1]!.y - vertices[i]!.y) ** 2);
            }
        }
        return totalnP;
    }

    getNameVirtualPointNumber(): number { return this.nPoints; }
    getValueVirtualPointNumber(): number { return this.nPoints + 1; }

    override intersects(rect: RectangleG, isLeftToRightSelection: boolean): boolean {
        if (!this.getCurrentLayer()?.isVisible()) return false;
        if (!this.q) return false;
        const xpoints = this.q.getXpoints();
        const ypoints = this.q.getYpoints();
        const nq = this.q.getNpoints();
        if (isLeftToRightSelection) {
            for (let i = 0; i < nq; i++) {
                if (!rect.contains(xpoints[i]!, ypoints[i]!)) return false;
            }
            return true;
        }
        for (let i = 0; i < nq; i++) {
            if (rect.contains(xpoints[i]!, ypoints[i]!)) return true;
        }
        for (let i = 0; i < nq - 1; i++) {
            if (rect.intersectsLine(xpoints[i]!, ypoints[i]!, xpoints[i + 1]!, ypoints[i + 1]!))
                return true;
        }
        if (this.isClosed && nq > 1) {
            if (rect.intersectsLine(xpoints[nq - 1]!, ypoints[nq - 1]!, xpoints[0]!, ypoints[0]!))
                return true;
        }
        return false;
    }
}
