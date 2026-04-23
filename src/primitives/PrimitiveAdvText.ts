import type { GraphicsInterface } from '../graphic/GraphicsInterface.js';
import type { ExportInterface } from '../export/ExportInterface.js';
import { GraphicPrimitive } from './GraphicPrimitive.js';
import { MapCoordinates } from '../geom/MapCoordinates.js';
import { LayerDesc } from '../layers/LayerDesc.js';
import { Globals } from '../globals/Globals.js';
import { GeometricDistances } from '../geom/GeometricDistances.js';
import { RectangleG } from '../graphic/RectangleG.js';
import { PointG } from '../graphic/PointG.js';

export class PrimitiveAdvText extends GraphicPrimitive {
    static readonly TEXT_BOLD = 1;
    static readonly TEXT_ITALIC = 2;
    static readonly TEXT_MIRRORED = 4;
    static readonly MAXSIZE = 2000;
    static readonly MINSIZE = 1;
    private static readonly N_POINTS = 1;

    private txt: string = '';
    private six: number = 3;
    private siy: number = 4;
    private sty: number = 0;
    private o: number = 0;
    private fontName: string = Globals.defaultTextFont;
    private recalcSize: boolean = true;

    private xaSCI: number = 0; private yaSCI: number = 0;
    private orientationSCI: number = 0;
    private hSCI: number = 0; private thSCI: number = 0; private wSCI: number = 0;
    private xpSCI: number[] = []; private ypSCI: number[] = [];

    private mirror: boolean = false;
    private orientation: number = 0;
    private h: number = 0; private th: number = 0; private w: number = 0;
    private ymagnitude: number = 1;
    private coordmirroring: boolean = false;
    private x1: number = 0; private y1: number = 0;
    private xa: number = 0; private ya: number = 0;
    private qq: number = 0;
    private xyfactor: number = 1.0;
    private si: number = 0; private co: number = 0;
    private needsStretching: boolean = false;

    constructor()
    constructor(x: number, y: number, sx: number, sy: number, fn: string,
        or: number, st: number, t: string, l: number)
    constructor(...args: unknown[]) {
        super();
        this.virtualPoint = new Array(PrimitiveAdvText.N_POINTS);
        for (let i = 0; i < PrimitiveAdvText.N_POINTS; i++)
            this.virtualPoint[i] = new PointG();
        this.changed = true;
        this.recalcSize = true;
        if (args.length > 0) {
            const [x, y, sx, sy, fn, or_, st, t, l] = args as
                [number, number, number, number, string, number, number, string, number];
            this.virtualPoint[0] = new PointG(x, y);
            this.six = sx; this.siy = sy; this.sty = st;
            this.txt = t; this.o = or_; this.fontName = fn;
            this.setLayer(l);
            this.changed = true;
            this.recalcSize = true;
        }
    }

    getControlPointNumber(): number { return PrimitiveAdvText.N_POINTS; }

    checkSizes(): void {
        if (this.siy < PrimitiveAdvText.MINSIZE) this.siy = PrimitiveAdvText.MINSIZE;
        if (this.six < PrimitiveAdvText.MINSIZE) this.six = PrimitiveAdvText.MINSIZE;
        if (this.siy > PrimitiveAdvText.MAXSIZE) this.siy = PrimitiveAdvText.MAXSIZE;
        if (this.six > PrimitiveAdvText.MAXSIZE) this.six = PrimitiveAdvText.MAXSIZE;
    }

    draw(g: GraphicsInterface, coordSys: MapCoordinates, layerV: LayerDesc[]): void {
        if (!this.selectLayer(g, layerV)) return;
        if (this.txt.length === 0) return;

        this.changed = true;
        this.ymagnitude = coordSys.getYMagnitude();
        this.coordmirroring = coordSys.getMirror();

        if (this.changed) {
            this.changed = false;
            this.mirror = false;
            this.recalcSize = true;

            this.x1 = this.virtualPoint[0]!.x;
            this.y1 = this.virtualPoint[0]!.y;
            this.xa = coordSys.mapX(this.x1, this.y1);
            this.ya = coordSys.mapY(this.x1, this.y1);

            g.setFont(this.fontName, this.six * 12 * coordSys.getYMagnitude() / 7 + 0.5,
                (this.sty & PrimitiveAdvText.TEXT_ITALIC) !== 0,
                (this.sty & PrimitiveAdvText.TEXT_BOLD) !== 0);

            this.orientation = this.o;
            this.mirror = false;
            if ((this.sty & PrimitiveAdvText.TEXT_MIRRORED) !== 0) {
                this.mirror = !this.mirror;
                this.orientation = -this.orientation;
            }
            if (this.six === 0 || this.siy === 0) { this.siy = 10; this.six = 7; }
            this.orientation -= coordSys.getOrientation() * 90;

            if (this.coordmirroring) {
                this.mirror = !this.mirror;
                this.orientation = -this.orientation;
            }

            this.h = g.getFontAscent();
            this.th = this.h + g.getFontDescent();
            // Phase 2: replace with DecoratedText.getDecoratedStringWidth(txt)
            this.w = g.getStringWidth(this.txt);

            this.xyfactor = 1.0;
            this.needsStretching = false;
            if (this.siy / this.six !== 10 / 7) {
                this.xyfactor = this.siy / this.six * 22.0 / 40.0;
                this.needsStretching = true;
            }

            if (this.orientation === 0) {
                if (this.mirror) {
                    coordSys.trackPoint(this.xa - this.w, this.ya);
                    coordSys.trackPoint(this.xa, this.ya + Math.trunc(this.th * this.xyfactor));
                } else {
                    coordSys.trackPoint(this.xa + this.w, this.ya);
                    coordSys.trackPoint(this.xa, this.ya + Math.trunc(this.h * this.xyfactor));
                }
            } else {
                if (this.mirror) {
                    this.si = Math.sin((-this.orientation) * Math.PI / 180);
                    this.co = Math.cos((-this.orientation) * Math.PI / 180);
                } else {
                    this.si = Math.sin(this.orientation * Math.PI / 180);
                    this.co = Math.cos(this.orientation * Math.PI / 180);
                }
                const bbx1 = this.xa, bby1 = this.ya;
                let bbx2 = this.xa + this.th * this.si;
                const bby2 = this.ya + this.th * this.co * this.xyfactor;
                let bbx3 = this.xa + this.w * this.co + this.th * this.si;
                const bby3 = this.ya + (this.th * this.co - this.w * this.si) * this.xyfactor;
                let bbx4 = this.xa + this.w * this.co;
                const bby4 = this.ya - this.w * this.si * this.xyfactor;
                if (this.mirror) {
                    bbx2 = this.xa - this.th * this.si;
                    bbx3 = this.xa - this.w * this.co - this.th * this.si;
                    bbx4 = this.xa - this.w * this.co;
                }
                coordSys.trackPoint(Math.trunc(bbx1), Math.trunc(bby1));
                coordSys.trackPoint(Math.trunc(bbx2), Math.trunc(bby2));
                coordSys.trackPoint(Math.trunc(bbx3), Math.trunc(bby3));
                coordSys.trackPoint(Math.trunc(bbx4), Math.trunc(bby4));
            }
            this.qq = Math.trunc(this.ya / this.xyfactor);
        }

        g.drawAdvText(this.xyfactor, this.xa, this.ya, this.qq,
            this.h, this.w, this.h, this.needsStretching,
            this.orientation, this.mirror, this.txt);
    }

    parseTokens(tokens: string[], nn: number): void {
        this.changed = true;
        this.recalcSize = true;
        if (tokens[0] === 'TY') {
            if (nn < 9) throw new Error('Bad arguments on TY');
            this.virtualPoint[0]!.x = parseInt(tokens[1]!, 10);
            this.virtualPoint[0]!.y = parseInt(tokens[2]!, 10);
            this.siy = Math.round(parseFloat(tokens[3]!));
            this.six = Math.round(parseFloat(tokens[4]!));
            this.checkSizes();
            this.o = parseInt(tokens[5]!, 10);
            this.sty = parseInt(tokens[6]!, 10);
            this.parseLayer(tokens[7]!);
            let j = 8;
            this.fontName = tokens[8] === '*'
                ? Globals.defaultTextFont
                : tokens[8]!.replaceAll('++', ' ');
            const parts: string[] = [];
            while (j < nn - 1) {
                parts.push(tokens[++j]!);
                if (j < nn - 1) parts.push(' ');
            }
            this.txt = parts.join('');
        } else if (tokens[0] === 'TE') {
            if (nn < 4) throw new Error('Bad arguments on TE');
            this.virtualPoint[0]!.x = parseInt(tokens[1]!, 10);
            this.virtualPoint[0]!.y = parseInt(tokens[2]!, 10);
            this.six = 3; this.siy = 4; this.o = 0; this.sty = 0;
            let j = 2;
            const teParts: string[] = [];
            while (j < nn - 1) { teParts.push(tokens[++j]!); if (j < nn - 1) teParts.push(' '); }
            this.txt = teParts.join('');
            this.parseLayer('0');
        } else {
            throw new Error('Invalid primitive: programming error?');
        }
    }

    getDistanceToPoint(px: number, py: number): number {
        if (this.changed || this.recalcSize) {
            if (this.changed) {
                // Phase 2: use GraphicsNull for accurate measurement.
                // Phase 1 approximation: character width ≈ six * 12/7 * 0.6
                const approxCharW = this.six * 12.0 / 7.0 * 0.6;
                this.wSCI = Math.trunc(this.txt.length * approxCharW);
                const approxH = Math.trunc(this.six * 12.0 / 7.0);
                this.hSCI = approxH;
                this.thSCI = Math.trunc(approxH * 1.2);
            } else {
                this.hSCI = Math.trunc(this.h / this.ymagnitude);
                this.thSCI = Math.trunc(this.th / this.ymagnitude);
                this.wSCI = Math.trunc(this.w / this.ymagnitude);
            }
            this.recalcSize = false;
            this.xaSCI = this.virtualPoint[0]!.x;
            this.yaSCI = this.virtualPoint[0]!.y;
            this.orientationSCI = this.o;

            if (this.siy / this.six !== 10 / 7) {
                this.hSCI = Math.round(this.hSCI * (this.siy * 22.0 / 40.0 / this.six));
                this.thSCI = Math.round(this.thSCI * (this.siy * 22.0 / 40.0 / this.six));
            }
            if ((this.sty & PrimitiveAdvText.TEXT_MIRRORED) !== 0) {
                this.orientationSCI = -this.orientationSCI;
                this.wSCI = -this.wSCI;
            }
            if (this.coordmirroring) this.wSCI = -this.wSCI;

            if (this.orientationSCI !== 0) {
                const si = Math.sin(this.orientation * Math.PI / 180);
                const co = Math.cos(this.orientation * Math.PI / 180);
                this.xpSCI = [
                    this.xaSCI,
                    Math.trunc(this.xaSCI + this.thSCI * si),
                    Math.trunc(this.xaSCI + this.thSCI * si + this.wSCI * co),
                    Math.trunc(this.xaSCI + this.wSCI * co)
                ];
                this.ypSCI = [
                    this.yaSCI,
                    Math.trunc(this.yaSCI + this.thSCI * co),
                    Math.trunc(this.yaSCI + this.thSCI * co - this.wSCI * si),
                    Math.trunc(this.yaSCI - this.wSCI * si)
                ];
            }
        }

        if (this.orientationSCI === 0) {
            if (GeometricDistances.pointInRectangle(
                Math.min(this.xaSCI, this.xaSCI + this.wSCI), this.yaSCI,
                Math.abs(this.wSCI), this.thSCI, px, py)) return 0;
        } else {
            if (GeometricDistances.pointInPolygon(this.xpSCI, this.ypSCI, 4, px, py)) return 0;
        }
        return Math.trunc(Number.MAX_SAFE_INTEGER / 2);
    }

    toString(_extensions: boolean): string {
        const fn = this.fontName === null ? Globals.defaultTextFont : this.fontName;
        const subsFont = fn === Globals.defaultTextFont ? '*' : fn.replaceAll(' ', '++');
        return `TY ${this.virtualPoint[0]!.x} ${this.virtualPoint[0]!.y} ` +
            `${this.siy} ${this.six} ${this.o} ${this.sty} ${this.getLayer()} ` +
            `${subsFont} ${this.txt}\n`;
    }

    export(exp: ExportInterface, cs: MapCoordinates): void {
        let resultingO = this.o;
        let resultingMirror = (this.sty & PrimitiveAdvText.TEXT_MIRRORED) !== 0;
        if (resultingMirror) resultingO = -resultingO;
        resultingO -= cs.getOrientation() * 90;
        if (cs.getMirror()) { resultingMirror = !resultingMirror; resultingO = -resultingO; }

        exp.exportAdvText(
            cs.mapX(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y),
            cs.mapY(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y),
            Math.abs(cs.mapXr(this.six, this.six) - cs.mapXr(0, 0)),
            Math.abs(cs.mapYr(this.siy, this.siy) - cs.mapYr(0, 0)),
            this.fontName,
            (this.sty & PrimitiveAdvText.TEXT_BOLD) !== 0,
            resultingMirror,
            (this.sty & PrimitiveAdvText.TEXT_ITALIC) !== 0,
            resultingO, this.getLayer(), this.txt);
    }

    getNameVirtualPointNumber(): number { return -1; }
    getValueVirtualPointNumber(): number { return -1; }

    getString(): string { return this.txt; }
    setString(s: string): void { this.txt = s; this.recalcSize = true; }

    getFontDimension(): number { return this.siy; }
    setFontDimension(s: number): void { this.siy = s; this.checkSizes(); this.recalcSize = true; }

    getOrientation(): number { return this.o; }
    setOrientation(o: number): void { this.o = o; this.recalcSize = true; }

    isMirrored(): number { return (this.sty & PrimitiveAdvText.TEXT_MIRRORED) ? 1 : 0; }
    setMirrored(m: number): void {
        if (m !== 0) {
            this.sty |= PrimitiveAdvText.TEXT_MIRRORED;
        } else {
            this.sty &= ~PrimitiveAdvText.TEXT_MIRRORED;
        }
        this.recalcSize = true;
    }

    override rotatePrimitive(bCounterClockWise: boolean, ix: number, iy: number): void {
        super.rotatePrimitive(bCounterClockWise, ix, iy);
        let po = Math.trunc(this.o / 90);
        const mirrored = (this.sty & PrimitiveAdvText.TEXT_MIRRORED) !== 0;
        const ccw = mirrored ? !bCounterClockWise : bCounterClockWise;
        if (ccw) { po = (po + 1) % 4; } else { po = (po + 3) % 4; }
        this.o = 90 * po;
    }

    override mirrorPrimitive(xPos: number): void {
        super.mirrorPrimitive(xPos);
        this.sty ^= PrimitiveAdvText.TEXT_MIRRORED;
        this.changed = true;
        this.recalcSize = true;
    }

    override intersects(rect: RectangleG, isLeftToRightSelection: boolean): boolean {
        if (!this.getCurrentLayer()?.isVisible()) return false;
        if (isLeftToRightSelection) return this.isFullyContained(rect);

        // Phase 2: use GraphicsNull for accurate measurement.
        const approxCharW = this.six * 12.0 / 7.0 * 0.6;
        const textWidth = Math.trunc(this.txt.length * approxCharW);
        const textHeight = Math.trunc(this.six * 12.0 / 7.0 * 1.2);

        const angleRad = this.o * Math.PI / 180;
        let cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
        if ((this.sty & PrimitiveAdvText.TEXT_MIRRORED) !== 0) cos = -cos;

        const x = this.virtualPoint[0]!.x, y = this.virtualPoint[0]!.y;
        const x1 = x, y1 = y - textHeight;
        const x2 = x + Math.trunc(textWidth * cos);
        const y2 = y - Math.trunc(textWidth * sin);
        const x3 = x + Math.trunc(textWidth * cos - textHeight * sin);
        const y3 = y - Math.trunc(textWidth * sin + textHeight * cos);
        const x4 = x - Math.trunc(textHeight * sin);
        const y4 = y - Math.trunc(textHeight * cos);

        const minX = Math.min(x1, x2, x3, x4);
        const minY = Math.min(y1, y2, y3, y4);
        const maxX = Math.max(x1, x2, x3, x4);
        const maxY = Math.max(y1, y2, Math.min(y3, y4));

        const boundingBox = new RectangleG(minX, minY, maxX - minX, maxY - minY);
        return rect.intersects(boundingBox);
    }
}
