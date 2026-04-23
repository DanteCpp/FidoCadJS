import type { GraphicsInterface } from '../graphic/GraphicsInterface.js';
import type { MapCoordinates } from '../geom/MapCoordinates.js';
import { GeometricDistances } from '../geom/GeometricDistances.js';
import { PointG } from '../graphic/PointG.js';
import { PointPr } from '../export/PointPr.js';

export class Arrow {
    static readonly flagLimiter = 0x01;
    static readonly flagEmpty = 0x02;

    private arrowLength: number = 3;
    private arrowHalfWidth: number = 1;
    private arrowStyle: number = 0;
    private arrowStart: boolean = false;
    private arrowEnd: boolean = false;
    private h: number = 0;
    private l: number = 0;
    private m: MapCoordinates | null = null;

    private static readonly roundTolerance = 1e-5;

    atLeastOneArrow(): boolean { return this.arrowStart || this.arrowEnd; }

    createArrowTokens(): string {
        const arrows = (this.arrowStart ? 0x01 : 0x00) | (this.arrowEnd ? 0x02 : 0x00);
        const al = this.arrowLength;
        const ahw = this.arrowHalfWidth;
        const alStr = Math.abs(al - Math.round(al)) < Arrow.roundTolerance
            ? String(Math.round(al)) : String(al);
        const ahwStr = Math.abs(ahw - Math.round(ahw)) < Arrow.roundTolerance
            ? String(Math.round(ahw)) : String(ahw);
        return `${arrows} ${this.arrowStyle} ${alStr} ${ahwStr}`;
    }

    isArrowStart(): boolean { return this.arrowStart; }
    setArrowStart(v: boolean): void { this.arrowStart = v; }
    isArrowEnd(): boolean { return this.arrowEnd; }
    setArrowEnd(v: boolean): void { this.arrowEnd = v; }
    getArrowStyle(): number { return this.arrowStyle; }
    setArrowStyle(s: number): void { this.arrowStyle = s; }
    getArrowLength(): number { return this.arrowLength; }
    setArrowLength(v: number): void { this.arrowLength = v; }
    getArrowHalfWidth(): number { return this.arrowHalfWidth; }
    setArrowHalfWidth(v: number): void { this.arrowHalfWidth = v; }

    parseTokens(tokens: string[], startIndex: number): number {
        let i = startIndex;
        const arrows = parseInt(tokens[i++], 10);
        this.arrowStart = (arrows & 0x01) !== 0;
        this.arrowEnd = (arrows & 0x02) !== 0;
        this.arrowStyle = parseInt(tokens[i++], 10);
        this.arrowLength = parseFloat(tokens[i++]);
        this.arrowHalfWidth = parseFloat(tokens[i++]);
        return i;
    }

    prepareCoordinateMapping(coordSys: MapCoordinates): number {
        this.m = coordSys;
        this.h = Math.abs(coordSys.mapXi(this.arrowHalfWidth, this.arrowHalfWidth, false)
            - coordSys.mapXi(0, 0, false));
        this.l = Math.abs(coordSys.mapXi(this.arrowLength, this.arrowLength, false)
            - coordSys.mapXi(0, 0, false));
        if (this.arrowHalfWidth < 0) this.h = -this.h;
        if (this.arrowLength < 0) this.l = -this.l;
        return this.h;
    }

    getControlsForArrow(v: unknown[]): unknown[] {
        // Populated in Phase 4 when ParameterDescription is ported.
        return v;
    }

    drawArrowPixels(g: GraphicsInterface, x: number, y: number, xc: number, yc: number,
        tl: number, th: number, as: number): PointG {
        this.h = th; this.l = tl; this.arrowStyle = as;
        return this.drawArrow(g, x, y, xc, yc);
    }

    isInArrow(xs: number, ys: number, x: number, y: number, xc: number, yc: number,
        pBase: PointG | null): boolean {
        const p = this._calcPoints(x, y, xc, yc);
        const xp = [x, Math.round(p[1].x), Math.round(p[2].x)];
        const yp = [y, Math.round(p[1].y), Math.round(p[2].y)];
        if (pBase) { pBase.x = Math.round(p[0].x); pBase.y = Math.round(p[0].y); }
        return GeometricDistances.pointInPolygon(xp, yp, 3, xs, ys);
    }

    private _calcPoints(x: number, y: number, xc: number, yc: number): PointPr[] {
        const alpha = this._angle(x, y, xc, yc);
        const ca = Math.cos(alpha), sa = Math.sin(alpha);
        const p: PointPr[] = new Array(5);
        p[0] = new PointPr(x - this.l * ca, y - this.l * sa);
        p[1] = new PointPr(p[0].x - this.h * sa, p[0].y + this.h * ca);
        p[2] = new PointPr(p[0].x + this.h * sa, p[0].y - this.h * ca);
        if ((this.arrowStyle & Arrow.flagLimiter) !== 0) {
            p[3] = new PointPr(x - this.h * sa, y + this.h * ca);
            p[4] = new PointPr(x + this.h * sa, y - this.h * ca);
        }
        return p;
    }

    private _angle(x: number, y: number, xc: number, yc: number): number {
        let alpha: number;
        if (x === xc) {
            alpha = Math.PI / 2 + (y - yc < 0 ? 0 : Math.PI);
        } else {
            alpha = Math.atan((y - yc) / (x - xc));
        }
        alpha += x - xc > 0 ? 0 : Math.PI;
        return alpha;
    }

    drawArrow(g: GraphicsInterface, x: number, y: number, xc: number, yc: number): PointG {
        const p = this._calcPoints(x, y, xc, yc);
        const pp = g.createPolygon();
        pp.addPoint(x, y);
        pp.addPoint(Math.round(p[1].x), Math.round(p[1].y));
        pp.addPoint(Math.round(p[2].x), Math.round(p[2].y));
        if (this.m) {
            this.m.trackPoint(x, y);
            this.m.trackPoint(p[1].x, p[1].y);
            this.m.trackPoint(p[2].x, p[2].y);
        }
        if ((this.arrowStyle & Arrow.flagEmpty) === 0) g.fillPolygon(pp);
        else g.drawPolygon(pp);
        if ((this.arrowStyle & Arrow.flagLimiter) !== 0 && p[3] && p[4]) {
            g.drawLine(Math.round(p[3].x), Math.round(p[3].y),
                Math.round(p[4].x), Math.round(p[4].y));
            if (this.m) { this.m.trackPoint(p[3].x, p[3].y); this.m.trackPoint(p[4].x, p[4].y); }
        }
        return new PointG(Math.trunc(p[0].x), Math.trunc(p[0].y));
    }
}
