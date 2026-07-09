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

export interface TextInkMetrics {
    advance: number;
    left: number;
    right: number;
    ascent: number;
    descent: number;
}

export class GraphicsNull implements Graphics {
    private static readonly glyphMetrics = new Map<string, TextInkMetrics>();
    private offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;
    private canvas2dCtx: CanvasRenderingContext2D | null = null;
    private fontSize: number = 12;
    private font: string = '12px sans-serif';
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

    setFont(name: string, size: number, isItalic?: boolean, isBold?: boolean): void {
        this.fontSize = size;
        const style = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}`;
        this.font = `${style}${size}px "${name}", monospace`;
        const ctx = this.getContext();
        if (ctx) ctx.font = this.font;
    }

    measureTextInk(s: string): TextInkMetrics {
        const ctx = this.getContext();
        if (!ctx) {
            const advance = s.length * this.fontSize * 0.5;
            return {
                advance,
                left: 0,
                right: /^\s*$/.test(s) ? 0 : advance * 0.8,
                ascent: /^\s*$/.test(s) ? 0 : this.fontSize * 0.8,
                descent: /^\s*$/.test(s) ? 0 : this.fontSize * 0.2,
            };
        }

        ctx.font = this.font;
        const metrics = ctx.measureText(s);
        const whitespace = /^\s*$/.test(s);
        return {
            advance: metrics.width,
            left:
                whitespace || !Number.isFinite(metrics.actualBoundingBoxLeft)
                    ? 0
                    : metrics.actualBoundingBoxLeft,
            right:
                whitespace || !Number.isFinite(metrics.actualBoundingBoxRight)
                    ? whitespace
                        ? 0
                        : metrics.width * 0.8
                    : metrics.actualBoundingBoxRight,
            ascent:
                whitespace || !Number.isFinite(metrics.actualBoundingBoxAscent)
                    ? whitespace
                        ? 0
                        : this.fontSize * 0.8
                    : metrics.actualBoundingBoxAscent,
            descent:
                whitespace || !Number.isFinite(metrics.actualBoundingBoxDescent)
                    ? whitespace
                        ? 0
                        : this.fontSize * 0.2
                    : metrics.actualBoundingBoxDescent,
        };
    }

    measureGlyphInk(character: string): TextInkMetrics {
        const measured = this.measureTextInk(character);
        if (/^\s$/u.test(character)) return measured;

        const cacheKey = `${this.font}\u0000${character}`;
        const cached = GraphicsNull.glyphMetrics.get(cacheKey);
        if (cached) return cached;
        if (this.fontSize > 256) return measured;

        try {
            const margin = Math.max(4, Math.ceil(this.fontSize * 2));
            const width = Math.max(1, Math.ceil(measured.advance + margin * 2));
            const height = Math.max(1, Math.ceil(this.fontSize * 4 + margin * 2));
            const canvas =
                typeof OffscreenCanvas !== 'undefined'
                    ? new OffscreenCanvas(width, height)
                    : document.createElement('canvas');
            if (canvas instanceof HTMLCanvasElement) {
                canvas.width = width;
                canvas.height = height;
            }
            const ctx = canvas.getContext('2d') as
                | OffscreenCanvasRenderingContext2D
                | CanvasRenderingContext2D
                | null;
            if (!ctx || typeof ctx.getImageData !== 'function') return measured;

            const originX = margin;
            const baseline = margin + Math.ceil(this.fontSize * 2);
            ctx.font = this.font;
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = '#000';
            ctx.fillText(character, originX, baseline);
            const pixels = ctx.getImageData(0, 0, width, height).data;

            let minX = width;
            let minY = height;
            let maxX = -1;
            let maxY = -1;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    if (pixels[(y * width + x) * 4 + 3]! < 16) continue;
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }
            if (maxX < minX || maxY < minY) return measured;

            const rasterized = {
                advance: measured.advance,
                left: originX - minX,
                right: maxX + 1 - originX,
                ascent: baseline - minY,
                descent: maxY + 1 - baseline,
            };
            GraphicsNull.glyphMetrics.set(cacheKey, rasterized);
            return rasterized;
        } catch {
            return measured;
        }
    }
    getFontAscent(): number {
        return this.measureTextInk('M').ascent || this.fontSize * 0.8;
    }

    getFontDescent(): number {
        return this.measureTextInk('M').descent || this.fontSize * 0.2;
    }

    getStringWidth(s: string): number {
        return this.measureTextInk(s).advance;
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
