import type { TextInterface } from '../TextInterface.js';

export class TextCanvas implements TextInterface {
    private ctx: CanvasRenderingContext2D;
    private font: string = '12px sans-serif';
    private fontSize: number = 12;

    constructor(ctx: CanvasRenderingContext2D) {
        this.ctx = ctx;
    }

    setFont(name: string, size: number, isItalic?: boolean, isBold?: boolean): void {
        this.fontSize = size;
        const style = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}`;
        this.font = `${style}${size}px ${name}`;
        this.ctx.font = this.font;
    }

    getFontAscent(): number {
        // Use textMetrics for accurate ascent
        const metrics = this.ctx.measureText('M');
        return Math.ceil(metrics.actualBoundingBoxAscent || this.fontSize * 0.8);
    }

    getFontDescent(): number {
        const metrics = this.ctx.measureText('M');
        return Math.ceil(metrics.actualBoundingBoxDescent || this.fontSize * 0.2);
    }

    getStringWidth(s: string): number {
        this.ctx.font = this.font;
        return Math.ceil(this.ctx.measureText(s).width);
    }

    drawString(str: string, x: number, y: number): void {
        this.ctx.font = this.font;
        this.ctx.fillText(str, x, y);
    }

    getFontSize(): number {
        return this.fontSize;
    }

    setFontSize(size: number): void {
        this.fontSize = size;
        this.font = `${size}px sans-serif`;
        this.ctx.font = this.font;
    }
}
