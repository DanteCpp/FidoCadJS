import type { GraphicsInterface } from '../GraphicsInterface.js';
import type { ColorInterface } from '../ColorInterface.js';
import type { TextInterface } from '../TextInterface.js';
import type { PolygonInterface } from '../PolygonInterface.js';
import type { ShapeInterface } from '../ShapeInterface.js';
import type { MapCoordinates } from '../../geom/MapCoordinates.js';
import type { LayerDesc } from '../../layers/LayerDesc.js';
import { PolygonCanvas } from '../canvas/PolygonCanvas.js';
import { ShapeCanvas } from '../canvas/ShapeCanvas.js';
import { ColorCanvas } from '../canvas/ColorCanvas.js';

export class GraphicsNull implements GraphicsInterface {
    private offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;
    private canvas2dCtx: CanvasRenderingContext2D | null = null;
    private fontSize: number = 12;
    private color: ColorInterface = new ColorCanvas(0, 0, 0);

    constructor() {
        try {
            const offscreen = new OffscreenCanvas(100, 100);
            this.offscreenCtx = offscreen.getContext('2d');
        } catch {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 100;
            tempCanvas.height = 100;
            this.canvas2dCtx = tempCanvas.getContext('2d');
        }
    }

    private getContext(): OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null {
        return this.offscreenCtx ?? this.canvas2dCtx;
    }

    getColor(): ColorInterface { return this.color; }
    setZoom(_z: number): void {}
    getZoom(): number { return 1; }
    setColor(c: ColorInterface): void { this.color = c; }
    getTextInterface(): TextInterface { return this; }
    applyStroke(_w: number, _dashStyle: number): void {}

    drawRect(_x: number, _y: number, _width: number, _height: number): void {}
    fillRect(_x: number, _y: number, _width: number, _height: number): void {}
    fillRoundRect(_x: number, _y: number, _width: number, _height: number,
        _arcWidth: number, _arcHeight: number): void {}
    hitClip(_x: number, _y: number, _width: number, _height: number): boolean {
        return true;
    }

    drawLine(_x1: number, _y1: number, _x2: number, _y2: number): void {}

    setFont(_name: string, _size: number, _isItalic?: boolean, _isBold?: boolean): void {}
    getFontSize(): number { return this.fontSize; }
    setFontSize(size: number): void { this.fontSize = size; }
    getFontAscent(): number {
        const ctx = this.getContext();
        if (!ctx) return this.fontSize * 0.8;
        ctx.font = `${this.fontSize}px sans-serif`;
        const metrics = ctx.measureText('M');
        return (metrics as any).actualBoundingBoxAscent || this.fontSize * 0.8;
    }

    getFontDescent(): number {
        const ctx = this.getContext();
        if (!ctx) return this.fontSize * 0.2;
        ctx.font = `${this.fontSize}px sans-serif`;
        const metrics = ctx.measureText('M');
        return (metrics as any).actualBoundingBoxDescent || this.fontSize * 0.2;
    }

    getStringWidth(s: string): number {
        const ctx = this.getContext();
        if (!ctx) return s.length * (this.fontSize * 0.5);
        ctx.font = `${this.fontSize}px sans-serif`;
        return ctx.measureText(s).width;
    }

    drawString(_str: string, _x: number, _y: number): void {}

    setAlpha(_alpha: number): void {}

    fillOval(_x: number, _y: number, _width: number, _height: number): void {}
    drawOval(_x: number, _y: number, _width: number, _height: number): void {}

    fill(_s: ShapeInterface): void {}
    draw(_s: ShapeInterface): void {}

    fillPolygon(_p: PolygonInterface): void {}
    drawPolygon(_p: PolygonInterface): void {}

    activateSelectColor(_l: LayerDesc): void {}

    drawAdvText(_xyfactor: number, _xa: number, _ya: number,
        _qq: number, _h: number, _w: number, _th: number,
        _needsStretching: boolean, _orientation: number, _mirror: boolean,
        _txt: string): void {}

    drawGrid(_cs: MapCoordinates, _xmin: number, _ymin: number,
        _xmax: number, _ymax: number,
        _colorDots: ColorInterface, _colorLines: ColorInterface): void {}

    createPolygon(): PolygonInterface {
        return new PolygonCanvas();
    }

    createColor(): ColorInterface {
        return new ColorCanvas(0, 0, 0);
    }

    createShape(): ShapeInterface {
        return new ShapeCanvas();
    }

    getScreenDensity(): number {
        return 1.0;
    }
}
