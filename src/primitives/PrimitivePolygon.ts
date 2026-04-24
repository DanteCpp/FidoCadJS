import type { GraphicsInterface } from '../graphic/GraphicsInterface.js';
import type { ExportInterface } from '../export/ExportInterface.js';
import type { PolygonInterface } from '../graphic/PolygonInterface.js';
import { GraphicPrimitive } from './GraphicPrimitive.js';
import { MapCoordinates } from '../geom/MapCoordinates.js';
import { LayerDesc } from '../layers/LayerDesc.js';
import { Globals } from '../globals/Globals.js';
import { GeometricDistances } from '../geom/GeometricDistances.js';
import { RectangleG } from '../graphic/RectangleG.js';
import { PointG } from '../graphic/PointG.js';
import { PointDouble } from '../graphic/PointDouble.js';

export class PrimitivePolygon extends GraphicPrimitive {
    private nPoints: number = 0;
    private isFilled: boolean = false;
    private dashStyle: number = 0;
    private p: PolygonInterface | null = null;
    storageSize: number = 5;
    private xmin: number = 0; private ymin: number = 0;
    private width: number = 0; private height: number = 0;
    private w: number = 0;

    constructor(f: string, size: number)
    constructor(f: boolean, layer: number, dashSt: number, font: string, size: number)
    constructor(...args: unknown[]) {
        super();
        if (args.length === 2) {
            this.isFilled = false;
            this.nPoints = 0;
            this.initPrimitive(this.storageSize, args[0] as string, args[1] as number);
        } else {
            const [f, layer, dashSt, font, size] = args as
                [boolean, number, number, string, number];
            this.initPrimitive(this.storageSize, font, size);
            this.nPoints = 0;
            this.isFilled = f;
            this.dashStyle = dashSt;
            this.setLayer(layer);
        }
    }

    getControlPointNumber(): number { return this.nPoints + 2; }

    getFilled(): boolean { return this.isFilled; }
    setFilled(v: boolean): void { this.isFilled = v; this.setChanged(true); }
    getDashStyle(): number { return this.dashStyle; }
    setDashStyle(v: number): void { this.dashStyle = this.checkDashStyle(v); this.setChanged(true); }

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

    addPointClosest(px: number, py: number): void {
        const xp = this.virtualPoint.slice(0, this.nPoints).map(v => v.x);
        const yp = this.virtualPoint.slice(0, this.nPoints).map(v => v.y);
        let distance = Math.sqrt((px - xp[0]!) ** 2 + (py - yp[0]!) ** 2);
        let minv = 0;
        for (let i = 0; i < this.nPoints; i++) {
            const j = i === this.nPoints - 1 ? -1 : i;
            const d = GeometricDistances.pointToSegment(
                xp[i]!, yp[i]!, xp[j + 1]!, yp[j + 1]!, px, py);
            if (d < distance) { distance = d; minv = j + 1; }
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

    addPoint(x: number, y: number): void {
        if (this.nPoints + 2 >= this.storageSize) {
            const oldSize = this.storageSize;
            this.storageSize += 10;
            const nv: PointG[] = new Array(this.storageSize);
            for (let i = 0; i < oldSize; i++) nv[i] = this.virtualPoint[i]!;
            for (let i = oldSize; i < this.storageSize; i++) nv[i] = new PointG();
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

    createPolygon(coordSys: MapCoordinates, g: GraphicsInterface): void {
        this.xmin = Number.MAX_SAFE_INTEGER; this.ymin = Number.MAX_SAFE_INTEGER;
        let xmax = -Number.MAX_SAFE_INTEGER, ymax = -Number.MAX_SAFE_INTEGER;
        this.p = g.createPolygon();
        this.p.reset();
        for (let j = 0; j < this.nPoints; j++) {
            const x = coordSys.mapX(this.virtualPoint[j]!.x, this.virtualPoint[j]!.y);
            const y = coordSys.mapY(this.virtualPoint[j]!.x, this.virtualPoint[j]!.y);
            this.p.addPoint(x, y);
            if (x < this.xmin) this.xmin = x;
            if (x > xmax) xmax = x;
            if (y < this.ymin) this.ymin = y;
            if (y > ymax) ymax = y;
        }
        this.width = xmax - this.xmin;
        this.height = ymax - this.ymin;
    }

    draw(g: GraphicsInterface, coordSys: MapCoordinates, layerV: LayerDesc[]): void {
        if (!this.selectLayer(g, layerV)) return;
        this.drawText(g, coordSys, layerV, -1);
        if (this.changed) {
            this.changed = false;
            this.createPolygon(coordSys, g);
            this.w = Globals.lineWidth * coordSys.getXMagnitude();
            if (this.w < GraphicPrimitive.D_MIN) this.w = GraphicPrimitive.D_MIN;
        }
        if (!this.p) return;
        if (!g.hitClip(this.xmin, this.ymin, this.width, this.height)) return;
        g.applyStroke(this.w, this.dashStyle);
        if (this.isFilled && this.width >= 2 && this.height >= 2) g.fillPolygon(this.p);
        g.drawPolygon(this.p);
    }

    parseTokens(tokens: string[], nn: number): void {
        this.changed = true;
        if (tokens[0] !== 'PP' && tokens[0] !== 'PV')
            throw new Error(`PP/PV: Invalid primitive: ${tokens[0]}`);
        if (nn < 6) throw new Error('Bad arguments on PP/PV');
        let j = 1, i = 0, x1 = 0, y1 = 0;
        while (j < nn - 1) {
            if (j + 1 < nn - 1 && tokens[j + 1] === 'FCJ') break;
            x1 = parseInt(tokens[j++]!, 10);
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
            if (j < nn - 1 && tokens[j] === 'FCJ') {
                this.dashStyle = this.checkDashStyle(parseInt(tokens[++j]!, 10));
            }
            j++;
        }
        this.isFilled = tokens[0] === 'PP';
    }

    getDistanceToPoint(px: number, py: number): number {
        if (this.checkText(px, py)) return 0;
        const xp = this.virtualPoint.slice(0, this.nPoints).map(v => v.x);
        const yp = this.virtualPoint.slice(0, this.nPoints).map(v => v.y);
        if (this.isFilled && GeometricDistances.pointInPolygon(xp, yp, this.nPoints, px, py)) return 1;
        let distance = Math.trunc(Math.sqrt((px - xp[0]!) ** 2 + (py - yp[0]!) ** 2));
        for (let i = 0; i < this.nPoints; i++) {
            const j = i === this.nPoints - 1 ? -1 : i;
            const d = GeometricDistances.pointToSegment(
                xp[i]!, yp[i]!, xp[j + 1]!, yp[j + 1]!, px, py);
            if (d < distance) distance = d;
        }
        return distance;
    }

    toString(extensions: boolean): string {
        const parts: string[] = [this.isFilled ? 'PP ' : 'PV '];
        for (let i = 0; i < this.nPoints; i++) {
            parts.push(`${this.virtualPoint[i]!.x} ${this.virtualPoint[i]!.y} `);
        }
        parts.push(`${this.getLayer()}\n`);
        let cmd = parts.join('');
        if (extensions && (this.dashStyle > 0 || this.hasName() || this.hasValue())) {
            const text = (this.name.length !== 0 || this.value.length !== 0) ? '1' : '0';
            cmd += `FCJ ${this.dashStyle} ${text}\n`;
        }
        cmd += this.saveText(false);
        return cmd;
    }

    export(exp: ExportInterface, cs: MapCoordinates): void {
        this.exportText(exp, cs, -1);
        const vertices: PointDouble[] = [];
        for (let i = 0; i < this.nPoints; i++) {
            const pd = new PointDouble();
            pd.x = cs.mapX(this.virtualPoint[i]!.x, this.virtualPoint[i]!.y);
            pd.y = cs.mapY(this.virtualPoint[i]!.x, this.virtualPoint[i]!.y);
            vertices.push(pd);
        }
        exp.exportPolygon(vertices, this.nPoints, this.isFilled, this.getLayer(),
            this.dashStyle, Globals.lineWidth * cs.getXMagnitude());
    }

    getNameVirtualPointNumber(): number { return this.nPoints; }
    getValueVirtualPointNumber(): number { return this.nPoints + 1; }

    override intersects(rect: RectangleG, isLeftToRightSelection: boolean): boolean {
        if (!this.getCurrentLayer()?.isVisible()) return false;
        const xp = this.virtualPoint.slice(0, this.nPoints).map(v => v.x);
        const yp = this.virtualPoint.slice(0, this.nPoints).map(v => v.y);
        if (isLeftToRightSelection) {
            for (let i = 0; i < this.nPoints; i++) {
                if (!rect.contains(xp[i]!, yp[i]!)) return false;
            }
            return true;
        }
        for (let i = 0; i < this.nPoints; i++) {
            if (rect.contains(xp[i]!, yp[i]!)) return true;
        }
        for (let i = 0; i < this.nPoints; i++) {
            const next = (i + 1) % this.nPoints;
            if (rect.intersectsLine(xp[i]!, yp[i]!, xp[next]!, yp[next]!)) return true;
        }
        if (this.isFilled) {
            const rx = rect.getX(), ry = rect.getY();
            const rw = rect.getWidth(), rh = rect.getHeight();
            if (GeometricDistances.pointInPolygon(xp, yp, this.nPoints, rx, ry) &&
                GeometricDistances.pointInPolygon(xp, yp, this.nPoints, rx + rw, ry) &&
                GeometricDistances.pointInPolygon(xp, yp, this.nPoints, rx, ry + rh) &&
                GeometricDistances.pointInPolygon(xp, yp, this.nPoints, rx + rw, ry + rh)) {
                return true;
            }
        }
        return false;
    }
}
