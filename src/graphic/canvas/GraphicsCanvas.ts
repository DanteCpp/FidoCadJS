import type { GraphicsInterface } from '../GraphicsInterface.js';
import type { ColorInterface } from '../ColorInterface.js';
import type { TextInterface } from '../TextInterface.js';
import type { ShapeInterface } from '../ShapeInterface.js';
import type { PolygonInterface } from '../PolygonInterface.js';
import type { MapCoordinates } from '../../geom/MapCoordinates.js';
import type { LayerDesc } from '../../layers/LayerDesc.js';
import type { LaidOutSegment } from '../MathLayout.js';
import { ColorCanvas } from './ColorCanvas.js';
import { TextCanvas } from './TextCanvas.js';
import { ShapeCanvas } from './ShapeCanvas.js';
import { PolygonCanvas } from './PolygonCanvas.js';
import { Globals } from '../../globals/Globals.js';

export class GraphicsCanvas implements GraphicsInterface {
    private ctx: CanvasRenderingContext2D;
    private canvas: HTMLCanvasElement;
    private currentColor: ColorInterface = new ColorCanvas(0, 0, 0);
    private textInterface: TextCanvas;
    private fontItalic: boolean = false;
    private fontBold: boolean = false;
    private selectedColor: ColorCanvas = new ColorCanvas(0, 255, 0);

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D context');
        this.ctx = ctx;
        this.textInterface = new TextCanvas(this.ctx);
    }

    getCtx(): CanvasRenderingContext2D {
        return this.ctx;
    }

    getColor(): ColorInterface {
        return this.currentColor;
    }

    setZoom(_z: number): void {}

    setColor(c: ColorInterface): void {
        this.currentColor = c;
        this.ctx.fillStyle = (c as ColorCanvas).toCSSColor();
        this.ctx.strokeStyle = (c as ColorCanvas).toCSSColor();
    }

    getTextInterface(): TextInterface {
        return this.textInterface;
    }

    applyStroke(w: number, dashStyle: number): void {
        this.ctx.lineWidth = w;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        const pattern = Globals.dash[dashStyle] ?? [10, 0];
        if (pattern[1] === 0) {
            this.ctx.setLineDash([]);
        } else {
            // Dash patterns are in logical units; scale to pixels.
            // w = Globals.lineWidth * xMagnitude, so scale = w / Globals.lineWidth.
            const scale = w / (Globals.lineWidth || 0.5);
            this.ctx.setLineDash(pattern.map((d) => d * scale));
        }
    }

    drawRect(x: number, y: number, width: number, height: number): void {
        this.ctx.strokeRect(x, y, width, height);
    }

    fillRect(x: number, y: number, width: number, height: number): void {
        this.ctx.fillRect(x, y, width, height);
    }

    fillRoundRect(
        x: number,
        y: number,
        width: number,
        height: number,
        arcWidth: number,
        arcHeight: number,
    ): void {
        const radii = Math.min(arcWidth / 2, arcHeight / 2);
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, radii);
        this.ctx.fill();
    }

    // Dirty-rect tracking removed (Phase 4.5) — always render.
    hitClip(_x: number, _y: number, _width: number, _height: number): boolean {
        return true;
    }

    drawLine(x1: number, y1: number, x2: number, y2: number): void {
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
    }

    setFont(name: string, size: number, isItalic?: boolean, isBold?: boolean): void {
        this.fontItalic = isItalic ?? false;
        this.fontBold = isBold ?? false;
        const style = `${this.fontItalic ? 'italic ' : ''}${this.fontBold ? 'bold ' : ''}`;
        // Quote the family and always append a generic fallback. Without a
        // generic family, headless WebKit on Linux (where named fonts such as
        // "Courier New" are absent) renders canvas text as nothing instead of
        // falling back, which silently drops text from bitmap exports. The
        // app's default text font is monospace, so monospace is the closest
        // fallback. Where the named font exists this changes nothing.
        this.ctx.font = `${style}${size}px "${name}", monospace`;
        this.textInterface.setFont(name, size, isItalic, isBold);
    }

    getFontAscent(): number {
        return this.textInterface.getFontAscent();
    }
    getFontDescent(): number {
        return this.textInterface.getFontDescent();
    }
    getStringWidth(s: string): number {
        return this.textInterface.getStringWidth(s);
    }
    drawString(str: string, x: number, y: number): void {
        this.ctx.fillText(str, x, y);
    }

    setAlpha(a: number): void {
        this.ctx.globalAlpha = a;
    }

    fillOval(x: number, y: number, width: number, height: number): void {
        this.ctx.beginPath();
        this.ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawOval(x: number, y: number, width: number, height: number): void {
        this.ctx.beginPath();
        this.ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
        this.ctx.stroke();
    }

    fill(s: ShapeInterface): void {
        const shape = s as unknown as ShapeCanvas;
        this.ctx.fill(shape.getPath());
    }

    draw(s: ShapeInterface): void {
        const shape = s as unknown as ShapeCanvas;
        this.ctx.stroke(shape.getPath());
    }

    fillPolygon(p: PolygonInterface): void {
        const poly = p as unknown as PolygonCanvas;
        this.ctx.fill(poly.toPath2D());
    }

    drawPolygon(p: PolygonInterface): void {
        const poly = p as unknown as PolygonCanvas;
        this.ctx.stroke(poly.toPath2D());
    }

    activateSelectColor(l: LayerDesc): void {
        const baseColor = l.getColor();
        if (baseColor) {
            const sr = this.selectedColor.getRed();
            const sg = this.selectedColor.getGreen();
            const sb = this.selectedColor.getBlue();
            const lr = baseColor.getRed();
            const lg = baseColor.getGreen();
            const lb = baseColor.getBlue();
            // Java-style blend: selectedColor * 0.6 + layerColor * 0.4
            const blended = new ColorCanvas(
                Math.floor(sr * 0.6 + lr * 0.4),
                Math.floor(sg * 0.6 + lg * 0.4),
                Math.floor(sb * 0.6 + lb * 0.4),
            );
            this.setColor(blended);
        }
        // Force full opacity for selected elements (matches Java behavior)
        this.ctx.globalAlpha = 1.0;
    }

    setSelectedColor(c: ColorInterface): void {
        this.selectedColor = new ColorCanvas(c.getRed(), c.getGreen(), c.getBlue());
    }

    drawAdvText(
        xyfactor: number,
        xa: number,
        ya: number,
        qq: number,
        h: number,
        _w: number,
        _th: number,
        needsStretching: boolean,
        orientation: number,
        mirror: boolean,
        txt: string,
    ): void {
        // Faithful port of FidoCadJ Graphics2DSwing.drawAdvText. The four cases
        // (orientation 0/non-zero x not-mirrored/mirrored) must match the Java
        // transform exactly, otherwise rendered text disagrees with the
        // bounding box computed in PrimitiveAdvText.draw (which already mirrors
        // the Java geometry: text extends along (cos o, -sin o), i.e. a
        // -orientation rotation). Note `rotate(theta, cx, cy)` in AWT and a
        // positive canvas rotate are both clockwise, so the sign carries over
        // directly. The draw point is (xa, qq+h) — qq = ya / xyfactor, so after
        // the vertical stretch the baseline lands at ya + h*xyfactor.
        const rad = (orientation * Math.PI) / 180;
        this.ctx.save();
        if (orientation === 0) {
            if (mirror) {
                // Mirrored, unrotated: Java does at.scale(-1, xyfactor) then
                // drawString(txt, -xa, qq+h) so the glyphs land at +xa flipped.
                this.ctx.scale(-1, xyfactor);
                this.ctx.fillText(txt, -xa, qq + h);
            } else {
                if (needsStretching) this.ctx.scale(1, xyfactor);
                this.ctx.fillText(txt, xa, qq + h);
            }
        } else if (mirror) {
            // Rotated and mirrored: Java concatenates scale(-1,1), then
            // rotate(+orientation) about (-xa, ya), then optional stretch, and
            // draws at (-xa, qq+h).
            this.ctx.scale(-1, 1);
            this.ctx.translate(-xa, ya);
            this.ctx.rotate(rad);
            this.ctx.translate(xa, -ya);
            if (needsStretching) this.ctx.scale(1, xyfactor);
            this.ctx.fillText(txt, -xa, qq + h);
        } else {
            // Rotated only: Java rotates by -orientation about (xa, ya), then
            // optional stretch, and draws at (xa, qq+h).
            this.ctx.translate(xa, ya);
            this.ctx.rotate(-rad);
            this.ctx.translate(-xa, -ya);
            if (needsStretching) this.ctx.scale(1, xyfactor);
            this.ctx.fillText(txt, xa, qq + h);
        }
        this.ctx.restore();
    }

    drawMathSegments(
        segments: LaidOutSegment[],
        xa: number,
        ya: number,
        baseline: number,
        fontPx: number,
        needsStretching: boolean,
        xyfactor: number,
        orientation: number,
        mirror: boolean,
    ): void {
        this.ctx.save();
        this.ctx.translate(xa, ya);
        if (orientation !== 0) {
            this.ctx.rotate((orientation * Math.PI) / 180);
        }
        if (mirror) {
            this.ctx.scale(-1, 1);
        }
        if (needsStretching) {
            this.ctx.scale(1, xyfactor);
        }
        for (const seg of segments) {
            if (seg.kind === 'text') {
                this.ctx.fillText(seg.text ?? '', seg.x, baseline);
                continue;
            }
            const geom = seg.geom;
            if (!geom) continue;
            // Native MathJax units (y-down, baseline 0) → px.
            const s = fontPx / geom.unitsPerEm;
            this.ctx.save();
            this.ctx.translate(seg.x, baseline);
            this.ctx.scale(s, s);
            for (const glyph of geom.glyphs) {
                const m = glyph.m;
                this.ctx.save();
                this.ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
                this.ctx.fill(new Path2D(glyph.d));
                this.ctx.restore();
            }
            for (const r of geom.rects) {
                const m = r.m;
                this.ctx.save();
                this.ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
                this.ctx.fillRect(r.x, r.y, r.w, r.h);
                this.ctx.restore();
            }
            this.ctx.restore();
        }
        this.ctx.restore();
    }

    drawGrid(
        cs: MapCoordinates,
        xmin: number,
        ymin: number,
        xmax: number,
        ymax: number,
        colorDots: ColorInterface,
        colorLines: ColorInterface,
    ): void {
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

    createPolygon(): PolygonInterface {
        return new PolygonCanvas();
    }
    createColor(): ColorInterface {
        return new ColorCanvas();
    }
    createShape(): ShapeInterface {
        return new ShapeCanvas();
    }

    getScreenDensity(): number {
        return window.devicePixelRatio * 96 || 96;
    }

    /** @deprecated Dirty-rect tracking removed (Phase 4.5). No-op. */
    clearDirtyRect(): void {}

    /** @deprecated Dirty-rect tracking removed (Phase 4.5). No-op. */
    markDirtyFull(_width: number, _height: number): void {}

    clear(): void {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}
