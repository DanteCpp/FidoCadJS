import type { GraphicsInterface } from '../graphic/GraphicsInterface.js';
import type { ExportInterface } from '../export/ExportInterface.js';
import { GraphicPrimitive } from './GraphicPrimitive.js';
import { TeXMode } from '../graphic/TeXMode.js';
import { layoutMath, hasMathDelimiter, type MathLayoutResult } from '../graphic/MathLayout.js';
import { MapCoordinates } from '../geom/MapCoordinates.js';
import { LayerDesc } from '../layers/LayerDesc.js';
import { Globals } from '../globals/Globals.js';
import { GeometricDistances } from '../geom/GeometricDistances.js';
import { RectangleG } from '../graphic/RectangleG.js';
import { PointG } from '../graphic/PointG.js';
import { GraphicsNull } from '../graphic/nil/GraphicsNull.js';

export class PrimitiveAdvText extends GraphicPrimitive {
    static readonly TEXT_BOLD = 1;
    static readonly TEXT_ITALIC = 2;
    static readonly TEXT_MIRRORED = 4;

    /** Font height-to-width ratio for default (non-stretched) text. */
    private static readonly DEFAULT_FONT_ASPECT = 10 / 7;
    /** Multiplier to scale logical font size (six) to canvas pixel size. */
    private static readonly FONT_SIZE_RATIO = 12 / 7;
    /** Horizontal stretch factor numerator/denominator when font is stretched. */
    private static readonly STRETCH_FACTOR = 22 / 40;
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

    private xaSCI: number = 0;
    private yaSCI: number = 0;
    private orientationSCI: number = 0;
    private hSCI: number = 0;
    private thSCI: number = 0;
    private wSCI: number = 0;
    private xpSCI: number[] = [];
    private ypSCI: number[] = [];

    private mirror: boolean = false;
    private orientation: number = 0;
    private h: number = 0;
    private th: number = 0;
    private w: number = 0;
    private coordmirroring: boolean = false;
    private x1: number = 0;
    private y1: number = 0;
    private xa: number = 0;
    private ya: number = 0;
    private qq: number = 0;
    private xyfactor: number = 1.0;
    private si: number = 0;
    private co: number = 0;
    private needsStretching: boolean = false;

    /** Canvas px size of one em for the current draw pass (math scale reference). */
    private fontPx: number = 0;
    /** Laid-out math/text segments for the current draw pass, null when no math. */
    private mathLayout: MathLayoutResult | null = null;

    constructor();
    constructor(
        x: number,
        y: number,
        sx: number,
        sy: number,
        fn: string,
        or: number,
        st: number,
        t: string,
        l: number,
    );
    constructor(...args: unknown[]) {
        super();
        this.virtualPoint = new Array(PrimitiveAdvText.N_POINTS);
        for (let i = 0; i < PrimitiveAdvText.N_POINTS; i++) this.virtualPoint[i] = new PointG();
        this.changed = true;
        this.recalcSize = true;
        if (args.length > 0) {
            const [x, y, sx, sy, fn, or_, st, t, l] = args as [
                number,
                number,
                number,
                number,
                string,
                number,
                number,
                string,
                number,
            ];
            this.virtualPoint[0] = new PointG(x, y);
            this.six = sx;
            this.siy = sy;
            this.sty = st;
            this.txt = t;
            this.o = or_;
            this.fontName = fn;
            this.setLayer(l);
            this.changed = true;
            this.recalcSize = true;
        }
    }

    getControlPointNumber(): number {
        return PrimitiveAdvText.N_POINTS;
    }

    checkSizes(): void {
        if (this.siy < PrimitiveAdvText.MINSIZE) this.siy = PrimitiveAdvText.MINSIZE;
        if (this.six < PrimitiveAdvText.MINSIZE) this.six = PrimitiveAdvText.MINSIZE;
        if (this.siy > PrimitiveAdvText.MAXSIZE) this.siy = PrimitiveAdvText.MAXSIZE;
        if (this.six > PrimitiveAdvText.MAXSIZE) this.six = PrimitiveAdvText.MAXSIZE;
    }

    draw(g: GraphicsInterface, coordSys: MapCoordinates, layerV: LayerDesc[]): void {
        if (!this.selectLayer(g, layerV)) return;
        if (this.txt.length === 0) return;

        // Always recompute font metrics when rendering — the zoom/mirror
        // may have changed since the last draw call.
        this.changed = true;
        this.coordmirroring = coordSys.getMirror();

        if (this.changed) {
            this.changed = false;
            this.mirror = false;
            this.recalcSize = true;

            this.x1 = this.virtualPoint[0]!.x;
            this.y1 = this.virtualPoint[0]!.y;
            this.xa = coordSys.mapX(this.x1, this.y1);
            this.ya = coordSys.mapY(this.x1, this.y1);

            this.fontPx =
                this.six * PrimitiveAdvText.FONT_SIZE_RATIO * coordSys.getYMagnitude() + 0.5;
            g.setFont(
                this.fontName,
                this.fontPx,
                (this.sty & PrimitiveAdvText.TEXT_ITALIC) !== 0,
                (this.sty & PrimitiveAdvText.TEXT_BOLD) !== 0,
            );

            this.orientation = this.o;
            this.mirror = false;
            if ((this.sty & PrimitiveAdvText.TEXT_MIRRORED) !== 0) {
                this.mirror = !this.mirror;
                this.orientation = -this.orientation;
            }
            if (this.six === 0 || this.siy === 0) {
                this.siy = 10;
                this.six = 7;
            }
            this.orientation -= coordSys.getOrientation() * 90;

            if (this.coordmirroring) {
                this.mirror = !this.mirror;
                this.orientation = -this.orientation;
            }

            this.h = g.getFontAscent();
            this.th = this.h + g.getFontDescent();
            // Phase 2: replace with DecoratedText.getDecoratedStringWidth(txt)
            this.w = g.getStringWidth(this.txt);

            // Render LaTeX math to glyph geometry when enabled. The advance and
            // height come back analytically from MathJax, so the bounding box
            // below (zoom-to-fit, selection) reflects the typeset math.
            this.mathLayout = null;
            if (TeXMode.active && hasMathDelimiter(this.txt)) {
                const layout = layoutMath(this.txt, this.fontPx, (s) => g.getStringWidth(s));
                if (layout.hasMath) {
                    this.mathLayout = layout;
                    this.w = layout.totalWidth;
                    let asc = this.h;
                    let desc = this.th - this.h;
                    for (const seg of layout.segments) {
                        if (!seg.geom) continue;
                        asc = Math.max(asc, seg.geom.heightEm * this.fontPx);
                        desc = Math.max(desc, seg.geom.depthEm * this.fontPx);
                    }
                    this.h = asc;
                    this.th = asc + desc;
                }
            }

            this.xyfactor = 1.0;
            this.needsStretching = false;
            if (this.siy / this.six !== PrimitiveAdvText.DEFAULT_FONT_ASPECT) {
                this.xyfactor = (this.siy / this.six) * PrimitiveAdvText.STRETCH_FACTOR;
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
                    this.si = Math.sin((-this.orientation * Math.PI) / 180);
                    this.co = Math.cos((-this.orientation * Math.PI) / 180);
                } else {
                    this.si = Math.sin((this.orientation * Math.PI) / 180);
                    this.co = Math.cos((this.orientation * Math.PI) / 180);
                }
                const bbx1 = this.xa,
                    bby1 = this.ya;
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

        // Render typeset math directly on the canvas when present; otherwise
        // draw the string with the plain-text path (unchanged behaviour).
        if (this.mathLayout) {
            g.drawMathSegments(
                this.mathLayout.segments,
                this.xa,
                this.ya,
                this.h,
                this.fontPx,
                this.needsStretching,
                this.xyfactor,
                this.orientation,
                this.mirror,
            );
        } else {
            g.drawAdvText(
                this.xyfactor,
                this.xa,
                this.ya,
                this.qq,
                this.h,
                this.w,
                this.h,
                this.needsStretching,
                this.orientation,
                this.mirror,
                this.txt,
            );
        }
    }

    parseTokens(tokens: string[], nn: number): void {
        this.changed = true;
        this.recalcSize = true;
        if (tokens[0] === 'TY') {
            if (nn < 9) throw new Error('Bad arguments on TY');
            this.virtualPoint[0]!.x = Globals.coord(tokens[1]);
            this.virtualPoint[0]!.y = Globals.coord(tokens[2]);
            this.siy = Math.round(parseFloat(tokens[3]!));
            this.six = Math.round(parseFloat(tokens[4]!));
            this.checkSizes();
            this.o = parseInt(tokens[5]!, 10);
            this.sty = parseInt(tokens[6]!, 10);
            this.parseLayer(tokens[7]!);
            let j = 8;
            this.fontName =
                tokens[8] === '*' ? Globals.defaultTextFont : tokens[8]!.replaceAll('++', ' ');
            const parts: string[] = [];
            while (j < nn - 1) {
                parts.push(tokens[++j]!);
                if (j < nn - 1) parts.push(' ');
            }
            this.txt = parts.join('');
        } else if (tokens[0] === 'TE') {
            if (nn < 4) throw new Error('Bad arguments on TE');
            this.virtualPoint[0]!.x = Globals.coord(tokens[1]);
            this.virtualPoint[0]!.y = Globals.coord(tokens[2]);
            this.six = 3;
            this.siy = 4;
            this.o = 0;
            this.sty = 0;
            let j = 2;
            const teParts: string[] = [];
            while (j < nn - 1) {
                teParts.push(tokens[++j]!);
                if (j < nn - 1) teParts.push(' ');
            }
            this.txt = teParts.join('');
            this.parseLayer('0');
        } else {
            throw new Error('Invalid primitive: programming error?');
        }
    }

    getDistanceToPoint(px: number, py: number): number {
        if (this.changed || this.recalcSize) {
            // Use GraphicsNull for accurate text measurement in logical units.
            // Avoids coordinate-scale mismatch between canvas zoomed metrics
            // and unmapXnosnap/unmapYnosnap used by findPrimitiveAt.
            const gSCI = new GraphicsNull();
            gSCI.setFont(
                this.fontName,
                Math.trunc(this.six * PrimitiveAdvText.FONT_SIZE_RATIO + 0.5),
                (this.sty & PrimitiveAdvText.TEXT_ITALIC) !== 0,
                (this.sty & PrimitiveAdvText.TEXT_BOLD) !== 0,
            );
            this.wSCI = Math.trunc(gSCI.getStringWidth(this.txt));
            this.hSCI = gSCI.getFontAscent();
            this.thSCI = this.hSCI + gSCI.getFontDescent();

            // For LaTeX text, size the selection box from the typeset math
            // geometry (analytical, in logical units), matching what is drawn.
            if (TeXMode.active && hasMathDelimiter(this.txt)) {
                const emPxLogical = Math.trunc(this.six * PrimitiveAdvText.FONT_SIZE_RATIO + 0.5);
                const layout = layoutMath(this.txt, emPxLogical, (s) => gSCI.getStringWidth(s));
                if (layout.hasMath) {
                    this.wSCI = Math.trunc(layout.totalWidth);
                    let asc = this.hSCI;
                    let desc = this.thSCI - this.hSCI;
                    for (const seg of layout.segments) {
                        if (!seg.geom) continue;
                        asc = Math.max(asc, seg.geom.heightEm * emPxLogical);
                        desc = Math.max(desc, seg.geom.depthEm * emPxLogical);
                    }
                    this.hSCI = Math.trunc(asc);
                    this.thSCI = Math.trunc(asc + desc);
                }
            }
            this.recalcSize = false;
            this.xaSCI = this.virtualPoint[0]!.x;
            this.yaSCI = this.virtualPoint[0]!.y;
            this.orientationSCI = this.o;

            if (this.siy / this.six !== 10 / 7) {
                this.hSCI = Math.round(this.hSCI * ((this.siy * 22.0) / 40.0 / this.six));
                this.thSCI = Math.round(this.thSCI * ((this.siy * 22.0) / 40.0 / this.six));
            }
            if ((this.sty & PrimitiveAdvText.TEXT_MIRRORED) !== 0) {
                this.orientationSCI = -this.orientationSCI;
                this.wSCI = -this.wSCI;
            }
            if (this.coordmirroring) this.wSCI = -this.wSCI;

            if (this.orientationSCI !== 0) {
                const si = Math.sin((this.orientationSCI * Math.PI) / 180);
                const co = Math.cos((this.orientationSCI * Math.PI) / 180);
                this.xpSCI = [
                    this.xaSCI,
                    Math.trunc(this.xaSCI + this.thSCI * si),
                    Math.trunc(this.xaSCI + this.thSCI * si + this.wSCI * co),
                    Math.trunc(this.xaSCI + this.wSCI * co),
                ];
                this.ypSCI = [
                    this.yaSCI,
                    Math.trunc(this.yaSCI + this.thSCI * co),
                    Math.trunc(this.yaSCI + this.thSCI * co - this.wSCI * si),
                    Math.trunc(this.yaSCI - this.wSCI * si),
                ];
            }
        }

        if (this.orientationSCI === 0) {
            if (
                GeometricDistances.pointInRectangle(
                    Math.min(this.xaSCI, this.xaSCI + this.wSCI),
                    this.yaSCI,
                    Math.abs(this.wSCI),
                    this.thSCI,
                    px,
                    py,
                )
            )
                return 0;
        } else {
            if (GeometricDistances.pointInPolygon(this.xpSCI, this.ypSCI, 4, px, py)) return 0;
        }
        return Math.trunc(Number.MAX_SAFE_INTEGER / 2);
    }

    toString(_extensions: boolean): string {
        const fn = this.fontName === null ? Globals.defaultTextFont : this.fontName;
        const subsFont = fn === Globals.defaultTextFont ? '*' : fn.replaceAll(' ', '++');
        return (
            `TY ${Globals.formatCoord(this.virtualPoint[0]!.x)} ` +
            `${Globals.formatCoord(this.virtualPoint[0]!.y)} ` +
            `${this.siy} ${this.six} ${this.o} ${this.sty} ${this.getLayer()} ` +
            `${subsFont} ${this.txt}\n`
        );
    }

    export(exp: ExportInterface, cs: MapCoordinates): void {
        // Mirror-aware rotation is the exporter's responsibility (matches
        // Java PrimitiveAdvText.export at FidoCadJ:712). Earlier versions
        // pre-negated `resultingO` here to compensate for a missing branch
        // in ExportSVG.exportAdvText — that branch is now fixed.
        const resultingO = this.o - cs.getOrientation() * 90;
        const resultingMirror = (this.sty & PrimitiveAdvText.TEXT_MIRRORED) !== 0;

        exp.exportAdvText(
            cs.mapX(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y),
            cs.mapY(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y),
            Math.abs(cs.mapXr(this.six, this.six) - cs.mapXr(0, 0)),
            Math.abs(cs.mapYr(this.siy, this.siy) - cs.mapYr(0, 0)),
            this.fontName,
            (this.sty & PrimitiveAdvText.TEXT_BOLD) !== 0,
            resultingMirror,
            (this.sty & PrimitiveAdvText.TEXT_ITALIC) !== 0,
            resultingO,
            this.getLayer(),
            this.txt,
        );
    }

    getNameVirtualPointNumber(): number {
        return -1;
    }
    getValueVirtualPointNumber(): number {
        return -1;
    }

    getString(): string {
        return this.txt;
    }
    setString(s: string): void {
        this.txt = s;
        this.recalcSize = true;
    }

    getFontDimension(): number {
        return this.siy;
    }
    setFontDimension(s: number): void {
        this.siy = s;
        this.checkSizes();
        this.recalcSize = true;
    }

    getFontWidth(): number {
        return this.six;
    }
    setFontWidth(s: number): void {
        this.six = s;
        this.checkSizes();
        this.recalcSize = true;
    }

    getFontName(): string {
        return this.fontName;
    }
    setFontName(name: string): void {
        this.fontName =
            name && name.trim() !== '' && name !== '*' ? name.trim() : Globals.defaultTextFont;
        this.recalcSize = true;
    }

    getOrientation(): number {
        return this.o;
    }
    setOrientation(o: number): void {
        this.o = o;
        this.recalcSize = true;
    }

    isMirrored(): number {
        return this.sty & PrimitiveAdvText.TEXT_MIRRORED ? 1 : 0;
    }
    setMirrored(m: number): void {
        if (m !== 0) {
            this.sty |= PrimitiveAdvText.TEXT_MIRRORED;
        } else {
            this.sty &= ~PrimitiveAdvText.TEXT_MIRRORED;
        }
        this.recalcSize = true;
    }

    isBold(): boolean {
        return (this.sty & PrimitiveAdvText.TEXT_BOLD) !== 0;
    }
    setBold(v: boolean): void {
        if (v) this.sty |= PrimitiveAdvText.TEXT_BOLD;
        else this.sty &= ~PrimitiveAdvText.TEXT_BOLD;
        this.recalcSize = true;
    }

    isItalic(): boolean {
        return (this.sty & PrimitiveAdvText.TEXT_ITALIC) !== 0;
    }
    setItalic(v: boolean): void {
        if (v) this.sty |= PrimitiveAdvText.TEXT_ITALIC;
        else this.sty &= ~PrimitiveAdvText.TEXT_ITALIC;
        this.recalcSize = true;
    }

    override rotatePrimitive(bCounterClockWise: boolean, ix: number, iy: number): void {
        super.rotatePrimitive(bCounterClockWise, ix, iy);
        let po = Math.trunc(this.o / 90);
        const mirrored = (this.sty & PrimitiveAdvText.TEXT_MIRRORED) !== 0;
        const ccw = mirrored ? !bCounterClockWise : bCounterClockWise;
        if (ccw) {
            po = (po + 1) % 4;
        } else {
            po = (po + 3) % 4;
        }
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

        // Use GraphicsNull for accurate text measurement.
        const gSCI = new GraphicsNull();
        gSCI.setFont(
            this.fontName,
            Math.trunc(this.six * PrimitiveAdvText.FONT_SIZE_RATIO + 0.5),
            (this.sty & PrimitiveAdvText.TEXT_ITALIC) !== 0,
            (this.sty & PrimitiveAdvText.TEXT_BOLD) !== 0,
        );
        const textWidth = Math.trunc(gSCI.getStringWidth(this.txt));
        const textAscent = gSCI.getFontAscent();
        const textHeight = textAscent + gSCI.getFontDescent();

        const angleRad = (this.o * Math.PI) / 180;
        let cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
        if ((this.sty & PrimitiveAdvText.TEXT_MIRRORED) !== 0) cos = -cos;

        // Bounding box: text extends downward from the virtual point.
        const x = this.virtualPoint[0]!.x,
            y = this.virtualPoint[0]!.y;
        const x1 = x,
            y1 = y;
        const x2 = x + Math.trunc(textWidth * cos);
        const y2 = y + Math.trunc(textWidth * sin);
        const x3 = x + Math.trunc(textWidth * cos + textHeight * sin);
        const y3 = y + Math.trunc(textWidth * sin + textHeight * cos);
        const x4 = x + Math.trunc(textHeight * sin);
        const y4 = y + Math.trunc(textHeight * cos);

        const minX = Math.min(x1, x2, x3, x4);
        const minY = Math.min(y1, y2, y3, y4);
        const maxX = Math.max(x1, x2, x3, x4);
        const maxY = Math.max(y1, y2, y3, y4);

        const boundingBox = new RectangleG(minX, minY, maxX - minX, maxY - minY);
        return rect.intersects(boundingBox);
    }
}
