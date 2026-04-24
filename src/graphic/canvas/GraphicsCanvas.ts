import type { GraphicsInterface } from '../GraphicsInterface.js';
import type { ColorInterface } from '../ColorInterface.js';
import type { TextInterface } from '../TextInterface.js';
import type { ShapeInterface } from '../ShapeInterface.js';
import type { PolygonInterface } from '../PolygonInterface.js';
import type { MapCoordinates } from '../../geom/MapCoordinates.js';
import type { LayerDesc } from '../../layers/LayerDesc.js';
import { ColorCanvas } from './ColorCanvas.js';
import { TextCanvas } from './TextCanvas.js';
import { ShapeCanvas } from './ShapeCanvas.js';
import { PolygonCanvas } from './PolygonCanvas.js';
import { Globals } from '../../globals/Globals.js';

export class GraphicsCanvas implements GraphicsInterface {
    private ctx: CanvasRenderingContext2D;
    private canvas: HTMLCanvasElement;
    private currentColor: ColorInterface = new ColorCanvas(0, 0, 0);
    private zoom: number = 1.0;
    private textInterface: TextCanvas;
    private fontName: string = 'sans-serif';
    private fontSize: number = 12;
    private fontItalic: boolean = false;
    private fontBold: boolean = false;
    private dirtyRect: { x: number; y: number; w: number; h: number } | null = null;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D context');
        this.ctx = ctx;
        this.textInterface = new TextCanvas(this.ctx);
    }

    getCtx(): CanvasRenderingContext2D { return this.ctx; }

    getColor(): ColorInterface { return this.currentColor; }

    setZoom(z: number): void { this.zoom = z; }
    getZoom(): number { return this.zoom; }

    setColor(c: ColorInterface): void {
        this.currentColor = c;
        this.ctx.fillStyle = (c as ColorCanvas).toCSSColor();
        this.ctx.strokeStyle = (c as ColorCanvas).toCSSColor();
    }

    getTextInterface(): TextInterface { return this.textInterface; }

    applyStroke(w: number, dashStyle: number): void {
        this.ctx.lineWidth = w;
        const pattern = Globals.dash[dashStyle] ?? [10, 0];
        if (pattern[1] === 0) {
            this.ctx.setLineDash([]);
        } else {
            this.ctx.setLineDash(pattern);
        }
    }

    drawRect(x: number, y: number, width: number, height: number): void {
        this.ctx.strokeRect(x, y, width, height);
        this.markDirty(x, y, width, height);
    }

    fillRect(x: number, y: number, width: number, height: number): void {
        this.ctx.fillRect(x, y, width, height);
        this.markDirty(x, y, width, height);
    }

    fillRoundRect(x: number, y: number, width: number, height: number, arcWidth: number, arcHeight: number): void {
        const radii = Math.min(arcWidth / 2, arcHeight / 2);
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, radii);
        this.ctx.fill();
        this.markDirty(x, y, width, height);
    }

    hitClip(x: number, y: number, width: number, height: number): boolean {
        if (!this.dirtyRect) return true;
        return !(x + width < this.dirtyRect.x ||
                 x > this.dirtyRect.x + this.dirtyRect.w ||
                 y + height < this.dirtyRect.y ||
                 y > this.dirtyRect.y + this.dirtyRect.h);
    }

    drawLine(x1: number, y1: number, x2: number, y2: number): void {
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
        const minX = Math.min(x1, x2);
        const minY = Math.min(y1, y2);
        const w = Math.abs(x2 - x1);
        const h = Math.abs(y2 - y1);
        this.markDirty(minX, minY, w, h);
    }

    setFont(name: string, size: number, isItalic?: boolean, isBold?: boolean): void {
        this.fontName = name;
        this.fontSize = size;
        this.fontItalic = isItalic ?? false;
        this.fontBold = isBold ?? false;
        const style = `${this.fontItalic ? 'italic ' : ''}${this.fontBold ? 'bold ' : ''}`;
        this.ctx.font = `${style}${size}px ${name}`;
        this.textInterface.setFont(name, size);
    }

    getFontSize(): number { return this.fontSize; }
    setFontSize(size: number): void { this.setFont(this.fontName, size, this.fontItalic, this.fontBold); }
    getFontAscent(): number { return this.textInterface.getFontAscent(); }
    getFontDescent(): number { return this.textInterface.getFontDescent(); }
    getStringWidth(s: string): number { return this.textInterface.getStringWidth(s); }
    drawString(str: string, x: number, y: number): void {
        this.ctx.fillText(str, x, y);
        this.markDirty(x, y, this.getStringWidth(str), this.fontSize);
    }

    setAlpha(a: number): void {
        this.ctx.globalAlpha = a;
    }

    fillOval(x: number, y: number, width: number, height: number): void {
        this.ctx.beginPath();
        this.ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.markDirty(x, y, width, height);
    }

    drawOval(x: number, y: number, width: number, height: number): void {
        this.ctx.beginPath();
        this.ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
        this.ctx.stroke();
        this.markDirty(x, y, width, height);
    }

    fill(s: ShapeInterface): void {
        const shape = s as unknown as ShapeCanvas;
        this.ctx.fill(shape.getPath());
        const bounds = shape.getBounds();
        this.markDirty(bounds.x, bounds.y, bounds.width, bounds.height);
    }

    draw(s: ShapeInterface): void {
        const shape = s as unknown as ShapeCanvas;
        this.ctx.stroke(shape.getPath());
        const bounds = shape.getBounds();
        this.markDirty(bounds.x, bounds.y, bounds.width, bounds.height);
    }

    fillPolygon(p: PolygonInterface): void {
        const poly = p as unknown as PolygonCanvas;
        this.ctx.fill(poly.toPath2D());
        const bounds = poly.getBounds();
        this.markDirty(bounds.x, bounds.y, bounds.width, bounds.height);
    }

    drawPolygon(p: PolygonInterface): void {
        const poly = p as unknown as PolygonCanvas;
        this.ctx.stroke(poly.toPath2D());
        const bounds = poly.getBounds();
        this.markDirty(bounds.x, bounds.y, bounds.width, bounds.height);
    }

    activateSelectColor(l: LayerDesc): void {
        const baseColor = l.getColor();
        if (baseColor) {
            const r = baseColor.getRed();
            const g = baseColor.getGreen();
            const b = baseColor.getBlue();
            // Blend with green (selection color)
            const blended = new ColorCanvas(Math.floor(r * 0.5), Math.floor(g * 0.8 + 255 * 0.2), Math.floor(b * 0.5));
            this.setColor(blended);
        }
    }

    drawAdvText(xyfactor: number, xa: number, ya: number, _qq: number, h: number, _w: number, _th: number,
        needsStretching: boolean, orientation: number, mirror: boolean, txt: string): void {
        this.ctx.save();
        this.ctx.translate(xa, ya);
        if (orientation !== 0) {
            this.ctx.rotate((orientation * 90 * Math.PI) / 180);
        }
        if (mirror) {
            this.ctx.scale(-1, 1);
        }
        if (needsStretching) {
            this.ctx.scale(xyfactor, 1);
        }
        this.ctx.fillText(txt, 0, h);
        this.ctx.restore();
    }

    drawGrid(cs: MapCoordinates, xmin: number, ymin: number, xmax: number, ymax: number,
        colorDots: ColorInterface, colorLines: ColorInterface): void {
        const xStep = cs.getXGridStep() * cs.getXMagnitude();
        const yStep = cs.getYGridStep() * cs.getYMagnitude();

        const xStart = ((cs.getXCenter() % xStep) + xStep) % xStep;
        const yStart = ((cs.getYCenter() % yStep) + yStep) % yStep;

        if (xStep < 5 || yStep < 5) {
            // Draw dots
            this.setColor(colorDots);
            const dotSize = 1;
            for (let x = xStart; x < xmax; x += xStep) {
                for (let y = yStart; y < ymax; y += yStep) {
                    if (x >= xmin && y >= ymin) {
                        this.ctx.fillRect(x, y, dotSize, dotSize);
                    }
                }
            }
        } else {
            // Draw lines
            this.setColor(colorLines);
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([]);
            this.ctx.beginPath();
            for (let x = xStart; x < xmax; x += xStep) {
                if (x >= xmin) {
                    this.ctx.moveTo(x, ymin);
                    this.ctx.lineTo(x, ymax);
                }
            }
            for (let y = yStart; y < ymax; y += yStep) {
                if (y >= ymin) {
                    this.ctx.moveTo(xmin, y);
                    this.ctx.lineTo(xmax, y);
                }
            }
            this.ctx.stroke();
        }
    }

    createPolygon(): PolygonInterface { return new PolygonCanvas(); }
    createColor(): ColorInterface { return new ColorCanvas(); }
    createShape(): ShapeInterface { return new ShapeCanvas(); }

    getScreenDensity(): number {
        return window.devicePixelRatio * 96 || 96;
    }

    private markDirty(x: number, y: number, w: number, h: number): void {
        if (!this.dirtyRect) {
            this.dirtyRect = { x, y, w, h };
            return;
        }
        const minX = Math.min(this.dirtyRect.x, x);
        const minY = Math.min(this.dirtyRect.y, y);
        const maxX = Math.max(this.dirtyRect.x + this.dirtyRect.w, x + w);
        const maxY = Math.max(this.dirtyRect.y + this.dirtyRect.h, y + h);
        this.dirtyRect = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }

    clearDirtyRect(): void {
        this.dirtyRect = null;
    }

    markDirtyFull(width: number, height: number): void {
        this.dirtyRect = { x: 0, y: 0, w: width, h: height };
    }

    clear(): void {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}
