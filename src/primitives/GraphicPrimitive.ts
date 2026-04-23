import type { GraphicsInterface } from '../graphic/GraphicsInterface.js';
import type { MapCoordinates } from '../geom/MapCoordinates.js';
import type { ExportInterface } from '../export/ExportInterface.js';
import { PointG } from '../graphic/PointG.js';
import { DimensionG } from '../graphic/DimensionG.js';
import { RectangleG } from '../graphic/RectangleG.js';
import { GeometricDistances } from '../geom/GeometricDistances.js';
import { Globals } from '../globals/Globals.js';
import { LayerDesc } from '../layers/LayerDesc.js';

export abstract class GraphicPrimitive {
    static readonly NO_DRAG = -1;
    static readonly DRAG_PRIMITIVE = -2;
    static readonly RECT_SELECTION = -3;

    protected static readonly D_MIN = 0.5;
    private static readonly BASE_RESOLUTION = 112;
    private static readonly HANDLE_WIDTH = 10;
    private static readonly INT_TOLERANCE = 1e-5;
    private static oldalpha: number = 1.0;

    virtualPoint: PointG[] = [];
    protected changed: boolean = true;
    protected macroFont: string = '';
    protected name: string = '';
    protected value: string = '';

    private selectedState: boolean = false;
    private layer: number = 0;
    private mult: number = 1.0;
    private macroFontSize: number = 4;
    private currentLayer: LayerDesc | null = null;
    private alpha: number = 1.0;
    private old_layer: number = -1;

    // Cached text layout state (recomputed when changed=true)
    private _tc_xa: number = 0;
    private _tc_ya: number = 0;
    private _tc_xb: number = 0;
    private _tc_yb: number = 0;
    private _tc_h: number = 0;
    private _tc_th: number = 0;
    private _tc_w1: number = 0;
    private _tc_w2: number = 0;
    private _tc_tth: number = 0;
    private _tc_tw1: number = 0;
    private _tc_tw2: number = 0;
    private _tc_x2: number = 0;
    private _tc_y2: number = 0;
    private _tc_x3: number = 0;
    private _tc_y3: number = 0;

    constructor(f: string = '', size: number = 4) {
        this.macroFont = f;
        this.setMacroFontSize(size);
    }

    getCurrentLayer(): LayerDesc | null { return this.currentLayer; }

    setMacroFont(f: string, size: number): void {
        this.macroFont = f;
        this.setMacroFontSize(size);
        this.changed = true;
    }

    initPrimitive(number: number, font: string, size: number): void {
        this.setMacroFontSize(size);
        this.macroFont = font;
        this.name = '';
        this.value = '';
        const npoints = number < 0 ? this.getControlPointNumber() : number;
        this.virtualPoint = Array.from({ length: npoints }, () => new PointG());
    }

    getMacroFont(): string { return this.macroFont; }
    getMacroFontSize(): number { return this.macroFontSize; }

    setMacroFontSize(size: number): void {
        this.macroFontSize = size <= 0 ? 1 : size;
    }

    checkDashStyle(dashStyle: number): number {
        if (dashStyle >= Globals.dashNumber) return Globals.dashNumber - 1;
        if (dashStyle < 0) return 0;
        return dashStyle;
    }

    protected drawText(g: GraphicsInterface, coordSys: MapCoordinates,
        _layerV: LayerDesc[], drawOnlyLayer: number): void {
        if (!this.value && !this.name) return;
        if (this.value === '' && this.name === '') return;
        if (drawOnlyLayer >= 0 && drawOnlyLayer !== this.getLayer()) return;

        if (this.changed) {
            this._tc_x2 = this.virtualPoint[this.getNameVirtualPointNumber()]!.x;
            this._tc_y2 = this.virtualPoint[this.getNameVirtualPointNumber()]!.y;
            this._tc_x3 = this.virtualPoint[this.getValueVirtualPointNumber()]!.x;
            this._tc_y3 = this.virtualPoint[this.getValueVirtualPointNumber()]!.y;

            this._tc_xa = coordSys.mapX(this._tc_x2, this._tc_y2);
            this._tc_ya = coordSys.mapY(this._tc_x2, this._tc_y2);
            this._tc_xb = coordSys.mapX(this._tc_x3, this._tc_y3);
            this._tc_yb = coordSys.mapY(this._tc_x3, this._tc_y3);

            g.setFont(this.macroFont,
                Math.trunc(this.macroFontSize * 12 * coordSys.getYMagnitude() / 7 + 0.5));

            this._tc_h = g.getFontAscent();
            this._tc_th = this._tc_h + g.getFontDescent();
            this._tc_w1 = this.name ? g.getStringWidth(this.name) : 0;
            this._tc_w2 = this.value ? g.getStringWidth(this.value) : 0;

            this._tc_tw1 = Math.trunc(this._tc_w1 / coordSys.getXMagnitude());
            this._tc_tw2 = Math.trunc(this._tc_w2 / coordSys.getXMagnitude());
            this._tc_tth = Math.trunc(this._tc_th / coordSys.getYMagnitude());

            coordSys.trackPoint(this._tc_xa, this._tc_ya);
            coordSys.trackPoint(this._tc_xa + this._tc_w1, this._tc_ya + this._tc_th);
            coordSys.trackPoint(this._tc_xb, this._tc_yb);
            coordSys.trackPoint(this._tc_xb + this._tc_w2, this._tc_yb + this._tc_th);
        }

        if (!g.hitClip(this._tc_xa, this._tc_ya, this._tc_w1, this._tc_th) &&
            !g.hitClip(this._tc_xb, this._tc_yb, this._tc_w2, this._tc_th)) {
            return;
        }

        if (this._tc_th < Globals.textSizeLimit) {
            g.drawLine(this._tc_xa, this._tc_ya, this._tc_xa + this._tc_w1 - 1, this._tc_ya);
            g.drawLine(this._tc_xb, this._tc_yb, this._tc_xb + this._tc_w2 - 1, this._tc_yb);
            return;
        }

        if (!this.changed) {
            g.setFont(this.macroFont,
                Math.trunc(this.macroFontSize * 12 * coordSys.getYMagnitude() / 7 + 0.5));
        }

        // Phase 2: replace with DecoratedText for sub/superscript support
        const dt = g.getTextInterface();
        if (this.name && this.name.length !== 0) dt.drawString(this.name, this._tc_xa, this._tc_ya + this._tc_h);
        if (this.value && this.value.length !== 0) dt.drawString(this.value, this._tc_xb, this._tc_yb + this._tc_h);
    }

    saveText(extensions: boolean): string {
        let subsFont: string;
        if (this.macroFont === Globals.defaultTextFont) {
            subsFont = '*';
        } else {
            subsFont = this.macroFont.replaceAll(' ', '++');
        }

        const hasName = this.name !== '';
        const hasValue = this.value !== '';
        if (!hasName && !hasValue) return '';

        const s: string[] = [];
        if (extensions) s.push('FCJ\n');

        const nvp = this.getNameVirtualPointNumber();
        const vvp = this.getValueVirtualPointNumber();
        const fs43 = Math.trunc(this.macroFontSize * 4 / 3);

        s.push(`TY ${this.virtualPoint[nvp]!.x} ${this.virtualPoint[nvp]!.y}`);
        s.push(` ${fs43} ${this.macroFontSize} 0 0 ${this.getLayer()}`);
        s.push(` ${subsFont} ${this.name}\n`);

        s.push(`TY ${this.virtualPoint[vvp]!.x} ${this.virtualPoint[vvp]!.y}`);
        s.push(` ${fs43} ${this.macroFontSize} 0 0 ${this.getLayer()}`);
        s.push(` ${subsFont} ${this.value}\n`);

        return s.join('');
    }

    exportText(exp: ExportInterface, cs: MapCoordinates, drawOnlyLayer: number): void {
        const size = Math.abs(cs.mapXr(this.macroFontSize, this.macroFontSize) - cs.mapXr(0, 0));
        if (drawOnlyLayer >= 0 && drawOnlyLayer !== this.getLayer()) return;

        const nvp = this.getNameVirtualPointNumber();
        const vvp = this.getValueVirtualPointNumber();

        if (this.name !== '') {
            exp.exportAdvText(
                cs.mapX(this.virtualPoint[nvp]!.x, this.virtualPoint[nvp]!.y),
                cs.mapY(this.virtualPoint[nvp]!.x, this.virtualPoint[nvp]!.y),
                size, size * 12.0 / 7.0,
                this.macroFont, false, false, false, 0, this.getLayer(), this.name);
        }
        if (this.value !== '') {
            exp.exportAdvText(
                cs.mapX(this.virtualPoint[vvp]!.x, this.virtualPoint[vvp]!.y),
                cs.mapY(this.virtualPoint[vvp]!.x, this.virtualPoint[vvp]!.y),
                size, size * 12.0 / 7.0,
                this.macroFont, false, false, false, 0, this.getLayer(), this.value);
        }
    }

    checkText(px: number, py: number): boolean {
        const nvp = this.getNameVirtualPointNumber();
        const vvp = this.getValueVirtualPointNumber();
        return (this.name !== '' &&
            GeometricDistances.pointInRectangle(
                this.virtualPoint[nvp]!.x, this.virtualPoint[nvp]!.y,
                this._tc_tw1, this._tc_tth, px, py)) ||
            (this.value !== '' &&
            GeometricDistances.pointInRectangle(
                this.virtualPoint[vvp]!.x, this.virtualPoint[vvp]!.y,
                this._tc_tw2, this._tc_tth, px, py));
    }

    setValue(tokens: string[], nn: number): void {
        this.changed = true;
        if (tokens[0] !== 'TY') throw new Error(`Invalid primitive: ${tokens[0]} programming error?`);
        if (nn < 9) throw new Error('Bad arguments on TY');

        const vvp = this.getValueVirtualPointNumber();
        this.virtualPoint[vvp]!.x = parseInt(tokens[1]!, 10);
        this.virtualPoint[vvp]!.y = parseInt(tokens[2]!, 10);

        this.macroFont = tokens[8] === '*' ? Globals.defaultTextFont
            : tokens[8]!.replaceAll('++', ' ');
        this.setMacroFontSize(parseInt(tokens[4]!, 10));

        const parts: string[] = [];
        for (let j = 9; j < nn; j++) parts.push(tokens[j]!);
        this.value = parts.join(' ');
    }

    setName(tokens: string[], nn: number): void {
        this.changed = true;
        if (tokens[0] !== 'TY') throw new Error(`Invalid primitive: ${tokens[0]} programming error?`);
        if (nn < 9) throw new Error('bad arguments on TY');

        const nvp = this.getNameVirtualPointNumber();
        this.virtualPoint[nvp]!.x = parseInt(tokens[1]!, 10);
        this.virtualPoint[nvp]!.y = parseInt(tokens[2]!, 10);

        const parts: string[] = [];
        for (let j = 9; j < nn; j++) parts.push(tokens[j]!);
        this.name = parts.join(' ');
    }

    setChanged(c: boolean): void { this.changed = c; }
    getFirstPoint(): PointG { return this.virtualPoint[0]!; }

    movePrimitive(dx: number, dy: number): void {
        for (let a = 0; a < this.getControlPointNumber(); a++) {
            if (this.virtualPoint[a]!.x + dx < 0 || this.virtualPoint[a]!.y + dy < 0) return;
        }
        for (let a = 0; a < this.getControlPointNumber(); a++) {
            this.virtualPoint[a]!.x += dx;
            this.virtualPoint[a]!.y += dy;
        }
        this.changed = true;
    }

    mirrorPrimitive(xPos: number): void {
        for (let a = 0; a < this.getControlPointNumber(); a++) {
            this.virtualPoint[a]!.x = 2 * xPos - this.virtualPoint[a]!.x;
        }
        this.changed = true;
    }

    rotatePrimitive(bCounterClockWise: boolean, ix: number, iy: number): void {
        for (let b = 0; b < this.getControlPointNumber(); b++) {
            const tx = this.virtualPoint[b]!.x;
            const ty = this.virtualPoint[b]!.y;
            if (bCounterClockWise) {
                this.virtualPoint[b]!.x = ix + ty - iy;
                this.virtualPoint[b]!.y = iy - (tx - ix);
            } else {
                this.virtualPoint[b]!.x = ix - (ty - iy);
                this.virtualPoint[b]!.y = iy + tx - ix;
            }
        }
        this.changed = true;
    }

    setDrawOnlyLayer(_i: number): void { /* overridden by PrimitiveMacro */ }
    containsLayer(l: number): boolean { return l === this.layer; }
    getMaxLayer(): number { return this.layer; }

    setSelected(s: boolean): void { this.selectedState = s; }
    isSelected(): boolean { return this.selectedState; }
    getLayer(): number { return this.layer; }

    parseLayer(token: string): void {
        let l = parseInt(token, 10);
        if (isNaN(l)) l = 0;
        this.layer = (l < 0 || l >= LayerDesc.MAX_LAYERS) ? 0 : l;
        this.changed = true;
    }

    setLayer(l: number): void {
        this.layer = (l < 0 || l >= LayerDesc.MAX_LAYERS) ? 0 : l;
        this.changed = true;
    }

    protected selectLayer(g: GraphicsInterface, layerV: LayerDesc[]): boolean {
        if (this.old_layer !== this.layer || this.changed) {
            if (this.layer >= layerV.length) this.layer = layerV.length - 1;
            this.currentLayer = layerV[this.layer]!;
            this.old_layer = this.layer;
        }

        if (!this.currentLayer!.isVisible()) return false;

        if (this.selectedState) {
            g.activateSelectColor(this.currentLayer!);
        } else {
            const layerColor = this.currentLayer!.getColor();
            if (layerColor && (g.getColor() !== layerColor ||
                GraphicPrimitive.oldalpha !== this.alpha)) {
                g.setColor(layerColor);
                this.alpha = this.currentLayer!.getAlpha();
                GraphicPrimitive.oldalpha = this.alpha;
                g.setAlpha(this.alpha);
            }
        }
        return true;
    }

    drawHandles(g: GraphicsInterface, cs: MapCoordinates): void {
        g.setColor(g.getColor().red());
        g.applyStroke(2.0, 0);
        this.mult = g.getScreenDensity() / GraphicPrimitive.BASE_RESOLUTION;
        const sizeX = Math.round(this.mult * GraphicPrimitive.HANDLE_WIDTH);
        const sizeY = sizeX;

        for (let i = 0; i < this.getControlPointNumber(); i++) {
            if (!this.testIfValidHandle(i)) continue;
            const xa = cs.mapX(this.virtualPoint[i]!.x, this.virtualPoint[i]!.y);
            const ya = cs.mapY(this.virtualPoint[i]!.x, this.virtualPoint[i]!.y);
            if (!g.hitClip(xa - sizeX / 2, ya - sizeY / 2, sizeX, sizeY)) continue;
            g.fillRect(xa - sizeX / 2, ya - sizeY / 2, sizeX, sizeY);
        }
    }

    onHandle(cs: MapCoordinates, px: number, py: number): number {
        const increase = 5;
        const hw2 = Math.round(this.mult * GraphicPrimitive.HANDLE_WIDTH / 2);
        const hl2 = hw2;
        const ext = Math.round(this.mult * (GraphicPrimitive.HANDLE_WIDTH + 2 * increase));

        for (let i = 0; i < this.getControlPointNumber(); i++) {
            if (!this.testIfValidHandle(i)) continue;
            const xa = cs.mapX(this.virtualPoint[i]!.x, this.virtualPoint[i]!.y);
            const ya = cs.mapY(this.virtualPoint[i]!.x, this.virtualPoint[i]!.y);
            const off = Math.round(this.mult * increase);
            if (GeometricDistances.pointInRectangle(
                xa - hw2 - off, ya - hl2 - off, ext, ext, px, py)) {
                return i;
            }
        }
        return GraphicPrimitive.NO_DRAG;
    }

    selectRect(px: number, py: number, w: number, h: number): boolean {
        for (let i = 0; i < this.getControlPointNumber(); i++) {
            if (!this.testIfValidHandle(i)) continue;
            const xa = this.virtualPoint[i]!.x;
            const ya = this.virtualPoint[i]!.y;
            if (px <= xa && xa < px + w && py <= ya && ya < py + h) {
                this.setSelected(true);
                return true;
            }
        }
        return false;
    }

    hasName(): boolean { return this.name.length !== 0; }
    hasValue(): boolean { return this.value.length !== 0; }

    protected testIfValidHandle(i: number): boolean {
        if (i === this.getNameVirtualPointNumber() && this.name.length === 0) return false;
        if (i === this.getValueVirtualPointNumber() && this.value.length === 0) return false;
        return true;
    }

    // Phase 4: getControls/setControls use ParameterDescription
    getControls(): unknown[] { return []; }
    setControls(_v: unknown[]): number { return 0; }

    needsHoles(): boolean { return false; }
    setDrawOnlyPads(_t: boolean): void { /* overridden by PrimitiveMacro and PrimitivePCBPad */ }

    getSize(): DimensionG {
        let qx = 0, qy = 0;
        const nvp = this.getNameVirtualPointNumber();
        const vvp = this.getValueVirtualPointNumber();
        for (let i = 0; i < this.getControlPointNumber(); i++) {
            if (i === nvp || i === vvp) continue;
            for (let j = i + 1; j < this.getControlPointNumber(); j++) {
                if (j === nvp || j === vvp) continue;
                qx = Math.abs(this.virtualPoint[i]!.x - this.virtualPoint[j]!.x);
                qy = Math.abs(this.virtualPoint[i]!.y - this.virtualPoint[j]!.y);
            }
        }
        return new DimensionG(qx, qy);
    }

    getPosition(): PointG {
        let qx = Number.MAX_SAFE_INTEGER;
        let qy = Number.MAX_SAFE_INTEGER;
        const nvp = this.getNameVirtualPointNumber();
        const vvp = this.getValueVirtualPointNumber();
        for (let i = 0; i < this.getControlPointNumber(); i++) {
            if (i === nvp || i === vvp) continue;
            if (this.virtualPoint[i]!.x < qx) qx = this.virtualPoint[i]!.x;
            if (this.virtualPoint[i]!.y < qy) qy = this.virtualPoint[i]!.y;
        }
        return new PointG(qx, qy);
    }

    roundIntelligently(v: number): string {
        if (Math.abs(v - Math.round(v)) < GraphicPrimitive.INT_TOLERANCE) {
            return String(Math.round(v));
        }
        return String(v);
    }

    isFullyContained(rect: RectangleG): boolean {
        for (const point of this.virtualPoint) {
            if (!rect.contains(point.x, point.y)) return false;
        }
        return true;
    }

    intersects(rect: RectangleG, isLeftToRightSelection: boolean): boolean {
        if (isLeftToRightSelection) return this.isFullyContained(rect);
        for (const point of this.virtualPoint) {
            if (rect.contains(point.x, point.y)) return true;
        }
        return false;
    }

    abstract draw(g: GraphicsInterface, coordSys: MapCoordinates, layerDesc: LayerDesc[]): void;
    abstract parseTokens(tokens: string[], nn: number): void;
    abstract getDistanceToPoint(px: number, py: number): number;
    abstract getControlPointNumber(): number;
    abstract toString(extensions: boolean): string;
    abstract export(exp: ExportInterface, cs: MapCoordinates): void;
    abstract getNameVirtualPointNumber(): number;
    abstract getValueVirtualPointNumber(): number;
}
