import type { Graphics } from '../Graphics.js';
import type { Color } from '../Color.js';
import type { TextRenderer } from '../TextRenderer.js';
import type { Polygon } from '../Polygon.js';
import type { Shape } from '../Shape.js';
import type { MapCoordinates } from '../../geom/MapCoordinates.js';
import type { LayerDesc } from '../../layers/LayerDesc.js';
import type { LaidOutSegment } from '../MathLayout.js';
import { PolygonCanvas } from '../canvas/PolygonCanvas.js';
import { ShapeCanvas } from '../canvas/ShapeCanvas.js';
import { ColorCanvas } from '../canvas/ColorCanvas.js';

export class GraphicsNull implements Graphics {
    private offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;
    private canvas2dCtx: CanvasRenderingContext2D | null = null;
    private fontSize: number = 12;
    private color: Color = new ColorCanvas(0, 0, 0);

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

    getColor(): Color {
        return this.color;
    }
    setZoom(_z: number): void {}
    setColor(c: Color): void {
        this.color = c;
    }
    getTextInterface(): TextRenderer {
        return this;
    }
    applyStroke(_w: number, _dashStyle: number): void {}

    drawRect(_x: number, _y: number, _width: number, _height: number): void {}
    fillRect(_x: number, _y: number, _width: number, _height: number): void {}
    fillRoundRect(
        _x: number,
        _y: number,
        _width: number,
        _height: number,
        _arcWidth: number,
        _arcHeight: number,
    ): void {}
    hitClip(_x: number, _y: number, _width: number, _height: number): boolean {
        return true;
    }

    drawLine(_x1: number, _y1: number, _x2: number, _y2: number): void {}

    setFont(_name: string, _size: number, _isItalic?: boolean, _isBold?: boolean): void {
        this.fontSize = _size;
    }
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

    fill(_s: Shape): void {}
    draw(_s: Shape): void {}

    fillPolygon(_p: Polygon): void {}
    drawPolygon(_p: Polygon): void {}

    activateSelectColor(_l: LayerDesc): void {}
    setSelectedColor(_c: Color): void {}

    drawAdvText(
        _xyfactor: number,
        _xa: number,
        _ya: number,
        _qq: number,
        _h: number,
        _w: number,
        _th: number,
        _needsStretching: boolean,
        _orientation: number,
        _mirror: boolean,
        _txt: string,
    ): void {}

    drawMathSegments(
        _segments: LaidOutSegment[],
        _xa: number,
        _ya: number,
        _baseline: number,
        _fontPx: number,
        _needsStretching: boolean,
        _xyfactor: number,
        _orientation: number,
        _mirror: boolean,
    ): void {}

    drawGrid(
        _cs: MapCoordinates,
        _xmin: number,
        _ymin: number,
        _xmax: number,
        _ymax: number,
        _colorDots: Color,
        _colorLines: Color,
    ): void {}

    createPolygon(): Polygon {
        return new PolygonCanvas();
    }

    createColor(): Color {
        return new ColorCanvas(0, 0, 0);
    }

    createShape(): Shape {
        return new ShapeCanvas();
    }

    getScreenDensity(): number {
        return 1.0;
    }
}
