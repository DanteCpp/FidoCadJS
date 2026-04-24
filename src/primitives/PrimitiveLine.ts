import type { GraphicsInterface } from '../graphic/GraphicsInterface.js';
import type { ExportInterface } from '../export/ExportInterface.js';
import { GraphicPrimitive } from './GraphicPrimitive.js';
import { MapCoordinates } from '../geom/MapCoordinates.js';
import { LayerDesc } from '../layers/LayerDesc.js';
import { Arrow } from './Arrow.js';
import { Globals } from '../globals/Globals.js';
import { GeometricDistances } from '../geom/GeometricDistances.js';
import { RectangleG } from '../graphic/RectangleG.js';
import { PointG } from '../graphic/PointG.js';

export class PrimitiveLine extends GraphicPrimitive {
    private static readonly N_POINTS = 4;
    private readonly arrowData: Arrow;
    private dashStyle: number = 0;

    private xa = 0; private ya = 0; private xb = 0; private yb = 0;
    private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
    private w = 0;
    private length2 = 0;
    private xbpap1 = 0; private ybpap1 = 0;
    private arrows = false;

    constructor(f: string, size: number)
    constructor(x1: number, y1: number, x2: number, y2: number, layer: number,
        arrowS: boolean, arrowE: boolean, arrowSt: number, arrowLe: number,
        arrowWi: number, dashSt: number, f: string, size: number)
    constructor(...args: unknown[]) {
        super();
        this.arrowData = new Arrow();
        if (args.length === 2) {
            this.initPrimitive(-1, args[0] as string, args[1] as number);
        } else {
            const [x1, y1, x2, y2, layer, arrowS, arrowE, arrowSt, arrowLe,
                arrowWi, dashSt, f, size] = args as
                [number, number, number, number, number, boolean, boolean,
                number, number, number, number, string, number];
            this.arrowData.setArrowStart(arrowS);
            this.arrowData.setArrowEnd(arrowE);
            this.arrowData.setArrowHalfWidth(arrowWi);
            this.arrowData.setArrowLength(arrowLe);
            this.arrowData.setArrowStyle(arrowSt);
            this.dashStyle = dashSt;
            this.initPrimitive(-1, f, size);
            this.virtualPoint[0]!.x = x1; this.virtualPoint[0]!.y = y1;
            this.virtualPoint[1]!.x = x2; this.virtualPoint[1]!.y = y2;
            this.virtualPoint[this.getNameVirtualPointNumber()]!.x = x1 + 5;
            this.virtualPoint[this.getNameVirtualPointNumber()]!.y = y1 + 5;
            this.virtualPoint[this.getValueVirtualPointNumber()]!.x = x1 + 5;
            this.virtualPoint[this.getValueVirtualPointNumber()]!.y = y1 + 10;
            this.setLayer(layer);
        }
    }

    getControlPointNumber(): number { return PrimitiveLine.N_POINTS; }

    getDashStyle(): number { return this.dashStyle; }
    setDashStyle(v: number): void { this.dashStyle = this.checkDashStyle(v); this.setChanged(true); }
    getArrowData(): Arrow { return this.arrowData; }

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
            this.length2 = (this.xa - this.xb) ** 2 + (this.ya - this.yb) ** 2;
            this.arrows = this.arrowData.atLeastOneArrow();
            if (this.arrows) {
                const h = this.arrowData.prepareCoordinateMapping(coordSys);
                this.xa -= Math.abs(h); this.ya -= Math.abs(h);
                this.xb += Math.abs(h); this.yb += Math.abs(h);
            }
            this.xbpap1 = this.xb - this.xa + 1;
            this.ybpap1 = this.yb - this.ya + 1;
        }

        if (this.length2 > 2) {
            if (!g.hitClip(this.xa, this.ya, this.xbpap1, this.ybpap1)) return;
            g.applyStroke(this.w, this.dashStyle);
            let xs = this.x1, ys = this.y1, xe = this.x2, ye = this.y2;
            if (this.arrows) {
                this.arrowData.prepareCoordinateMapping(coordSys);
                if (this.arrowData.isArrowStart()) {
                    const p = this.arrowData.drawArrow(g, this.x1, this.y1, this.x2, this.y2);
                    if (this.arrowData.getArrowLength() > 0) { xs = p.x; ys = p.y; }
                }
                if (this.arrowData.isArrowEnd()) {
                    const p = this.arrowData.drawArrow(g, this.x2, this.y2, this.x1, this.y1);
                    if (this.arrowData.getArrowLength() > 0) { xe = p.x; ye = p.y; }
                }
            }
            g.drawLine(xs, ys, xe, ye);
        }
    }

    parseTokens(tokens: string[], nn: number): void {
        this.changed = true;
        if (tokens[0] !== 'LI') throw new Error(`LI: Invalid primitive: ${tokens[0]}`);
        if (nn < 5) throw new Error('Bad arguments on LI');
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
        if (nn > 6 && tokens[6] === 'FCJ') {
            const i = this.arrowData.parseTokens(tokens, 7);
            this.dashStyle = this.checkDashStyle(parseInt(tokens[i]!, 10));
        }
    }

    getDistanceToPoint(px: number, py: number): number {
        if (this.checkText(px, py)) return 0;
        if (this.arrowData.atLeastOneArrow()) {
            const m = new MapCoordinates();
            this.arrowData.prepareCoordinateMapping(m);
            let r = false, t = false;
            if (this.arrowData.isArrowStart()) {
                t = this.arrowData.isInArrow(px, py,
                    this.virtualPoint[0]!.x, this.virtualPoint[0]!.y,
                    this.virtualPoint[1]!.x, this.virtualPoint[1]!.y, new PointG());
            }
            if (this.arrowData.isArrowEnd()) {
                r = this.arrowData.isInArrow(px, py,
                    this.virtualPoint[1]!.x, this.virtualPoint[1]!.y,
                    this.virtualPoint[0]!.x, this.virtualPoint[0]!.y, new PointG());
            }
            if (r || t) return 1;
        }
        return GeometricDistances.pointToSegment(
            this.virtualPoint[0]!.x, this.virtualPoint[0]!.y,
            this.virtualPoint[1]!.x, this.virtualPoint[1]!.y, px, py);
    }

    toString(extensions: boolean): string {
        if (this.name.length === 0 && this.value.length === 0 &&
            this.virtualPoint[0]!.x === this.virtualPoint[1]!.x &&
            this.virtualPoint[0]!.y === this.virtualPoint[1]!.y) return '';
        let s = `LI ${this.virtualPoint[0]!.x} ${this.virtualPoint[0]!.y} ` +
            `${this.virtualPoint[1]!.x} ${this.virtualPoint[1]!.y} ${this.getLayer()}\n`;
        if (extensions && (this.arrowData.atLeastOneArrow() || this.dashStyle > 0 ||
            this.name.length !== 0 || this.value.length !== 0)) {
            const text = (this.hasName() || this.hasValue()) ? '1' : '0';
            s += `FCJ ${this.arrowData.createArrowTokens()} ${this.dashStyle} ${text}\n`;
        }
        s += this.saveText(false);
        return s;
    }

    export(exp: ExportInterface, cs: MapCoordinates): void {
        this.exportText(exp, cs, -1);
        exp.exportLine(
            cs.mapX(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y),
            cs.mapY(this.virtualPoint[0]!.x, this.virtualPoint[0]!.y),
            cs.mapX(this.virtualPoint[1]!.x, this.virtualPoint[1]!.y),
            cs.mapY(this.virtualPoint[1]!.x, this.virtualPoint[1]!.y),
            this.getLayer(),
            this.arrowData.isArrowStart(), this.arrowData.isArrowEnd(),
            this.arrowData.getArrowStyle(),
            Math.trunc(this.arrowData.getArrowLength() * cs.getXMagnitude()),
            Math.trunc(this.arrowData.getArrowHalfWidth() * cs.getXMagnitude()),
            this.dashStyle, Globals.lineWidth * cs.getXMagnitude());
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
