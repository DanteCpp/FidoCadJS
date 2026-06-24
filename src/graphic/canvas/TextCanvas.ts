import type { TextRenderer } from '../TextRenderer.js';

export class TextCanvas implements TextRenderer {
    private ctx: CanvasRenderingContext2D;
    private font: string = '12px sans-serif';
    private fontSize: number = 12;

    constructor(ctx: CanvasRenderingContext2D) {
        this.ctx = ctx;
    }

    setFont(name: string, size: number, isItalic?: boolean, isBold?: boolean): void {
        this.fontSize = size;
        const style = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}`;
        // Match GraphicsCanvas.setFont: quote the family and append a generic
        // monospace fallback so width measurement uses the same font the
        // renderer does — and so headless Linux WebKit, which won't fall back
        // for a missing named canvas font, still measures/draws real glyphs.
        this.font = `${style}${size}px "${name}", monospace`;
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
}
