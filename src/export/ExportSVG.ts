import type { ExportInterface } from './ExportInterface.js';
import type { DimensionG } from '../graphic/DimensionG.js';
import type { PointDouble } from '../graphic/PointDouble.js';
import type { LayerDesc } from '../layers/LayerDesc.js';
import { Globals } from '../globals/Globals.js';
import { Arrow } from '../primitives/Arrow.js';
import { PointPr } from './PointPr.js';
import { layoutMath, type MathGeometry } from '../graphic/MathLayout.js';

export class ExportSVG implements ExportInterface {
    private buffer: string[] = [];
    private layerV: LayerDesc[] = [];
    private sDash: string[] = [];
    private strokeWidth: number = 1;
    private dashPhase: number = 0;
    private currentPhase: number = -1;
    private currentColor: string = '#000000';
    private layerAlpha: number = 1.0;

    exportStart(totalSize: DimensionG, la: LayerDesc[], _grid: number): void {
        this.layerV = la;
        const wi = Math.round(totalSize.width);
        const he = Math.round(totalSize.height);

        this.buffer.push('<?xml version="1.0" encoding="UTF-8" standalone="no"?> ');
        this.buffer.push(
            '<!DOCTYPE svg PUBLIC "-//W3C//Dtd SVG 1.1//EN" ' +
                '"http://www.w3.org/Graphics/SVG/1.1/Dtd/svg11.dtd">',
        );
        this.buffer.push(
            `<svg width="${this.cLe(wi)}" height="${this.cLe(he)}" ` +
                'version="1.1" xmlns="http://www.w3.org/2000/svg" ' +
                'xmlns:xlink="http://www.w3.org/1999/xlink">',
        );
        this.buffer.push(`<!-- Created by FidoCadTS, export filter -->`);
    }

    exportEnd(): void {
        this.buffer.push('</svg>');
    }

    setDashUnit(u: number): void {
        this.sDash = [];
        this.sDash[0] = '';

        for (let i = 1; i < Globals.dashNumber; ++i) {
            let dashArrayStretched = '';
            for (let j = 0; j < Globals.dash[i]!.length; ++j) {
                dashArrayStretched += (Globals.dash[i]![j] * u) / 2.0;
                if (j < Globals.dash[i]!.length - 1) {
                    dashArrayStretched += ',';
                }
            }
            this.sDash[i] = dashArrayStretched;
        }
    }

    setDashPhase(p: number): void {
        this.dashPhase = p;
    }

    exportLine(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        layer: number,
        arrowStart: boolean,
        arrowEnd: boolean,
        arrowStyle: number,
        arrowLength: number,
        arrowHalfWidth: number,
        dashStyle: number,
        sW: number,
    ): void {
        const l = this.layerV[layer];
        this.currentColor = this.getColorHex(l);
        this.layerAlpha = l.getAlpha();
        this.strokeWidth = sW;

        let xstart = x1;
        let ystart = y1;
        let xend = x2;
        let yend = y2;

        if (arrowStart) {
            const p = this.exportArrow(x1, y1, x2, y2, arrowLength, arrowHalfWidth, arrowStyle);
            if (arrowLength > 0) {
                xstart = p.x;
                ystart = p.y;
            }
        }
        if (arrowEnd) {
            const p = this.exportArrow(x2, y2, x1, y1, arrowLength, arrowHalfWidth, arrowStyle);
            if (arrowLength > 0) {
                xend = p.x;
                yend = p.y;
            }
        }

        this.buffer.push(
            `<line x1="${this.cLe(xstart)}" y1="${this.cLe(ystart)}" x2="${this.cLe(xend)}" y2="${this.cLe(yend)}" `,
        );
        this.checkColorAndWidth('fill="none"', dashStyle);
    }

    exportBezier(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        x3: number,
        y3: number,
        x4: number,
        y4: number,
        layer: number,
        arrowStart: boolean,
        arrowEnd: boolean,
        arrowStyle: number,
        arrowLength: number,
        arrowHalfWidth: number,
        dashStyle: number,
        sW: number,
    ): void {
        const l = this.layerV[layer];
        this.currentColor = this.getColorHex(l);
        this.layerAlpha = l.getAlpha();
        this.strokeWidth = sW;

        let _x1 = x1,
            _y1 = y1,
            _x4 = x4,
            _y4 = y4;

        if (arrowStart) {
            const p = this.exportArrow(x1, y1, x2, y2, arrowLength, arrowHalfWidth, arrowStyle);
            if (arrowLength > 0) {
                _x1 = p.x;
                _y1 = p.y;
            }
        }
        if (arrowEnd) {
            const p = this.exportArrow(x4, y4, x3, y3, arrowLength, arrowHalfWidth, arrowStyle);
            if (arrowLength > 0) {
                _x4 = p.x;
                _y4 = p.y;
            }
        }

        this.buffer.push(
            `<path d="M ${this.cLe(_x1)},${this.cLe(_y1)} C ${this.cLe(x2)},${this.cLe(y2)} ` +
                `${this.cLe(x3)},${this.cLe(y3)} ${this.cLe(_x4)},${this.cLe(_y4)}" `,
        );
        this.checkColorAndWidth('fill="none"', dashStyle);
    }

    exportRectangle(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        isFilled: boolean,
        layer: number,
        dashStyle: number,
        sW: number,
    ): void {
        this.strokeWidth = sW;
        const l = this.layerV[layer];
        this.currentColor = this.getColorHex(l);
        this.layerAlpha = l.getAlpha();

        const fillPattern = isFilled ? `fill="${this.currentColor}"` : 'fill="none"';

        let rw = Math.abs(x2 - x1);
        let rh = Math.abs(y2 - y1);
        if (rw === 0) rw = 0.5;
        if (rh === 0) rh = 0.5;

        this.buffer.push(
            `<rect x="${this.cLe(Math.min(x1, x2))}" y="${this.cLe(Math.min(y1, y2))}" ` +
                `rx="0" ry="0" width="${this.cLe(rw)}" height="${this.cLe(rh)}" `,
        );
        this.checkColorAndWidth(fillPattern, dashStyle);
    }

    exportOval(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        isFilled: boolean,
        layer: number,
        dashStyle: number,
        sW: number,
    ): void {
        const l = this.layerV[layer];
        this.currentColor = this.getColorHex(l);
        this.layerAlpha = l.getAlpha();
        this.strokeWidth = sW;

        const fillPattern = isFilled ? `fill="${this.currentColor}"` : 'fill="none"';

        this.buffer.push(
            `<ellipse cx="${this.cLe((x1 + x2) / 2.0)}" cy="${this.cLe((y1 + y2) / 2.0)}" ` +
                `rx="${this.cLe(Math.abs(x2 - x1) / 2.0)}" ry="${this.cLe(Math.abs(y2 - y1) / 2.0)}" `,
        );
        this.checkColorAndWidth(fillPattern, dashStyle);
    }

    exportPolygon(
        vertices: PointDouble[],
        nVertices: number,
        isFilled: boolean,
        layer: number,
        dashStyle: number,
        sW: number,
    ): void {
        const l = this.layerV[layer];
        this.currentColor = this.getColorHex(l);
        this.layerAlpha = l.getAlpha();
        this.strokeWidth = sW;

        const fillPattern = isFilled ? `fill="${this.currentColor}"` : 'fill="none"';

        this.buffer.push('<polygon points="');
        for (let i = 0; i < nVertices; ++i) {
            this.buffer.push(`${this.cLe(vertices[i]!.x)},${this.cLe(vertices[i]!.y)} `);
        }
        this.buffer.push('" ');
        this.checkColorAndWidth(fillPattern, dashStyle);
    }

    exportCurve(
        _vertices: PointDouble[],
        _nVertices: number,
        _isFilled: boolean,
        _isClosed: boolean,
        _layer: number,
        _arrowStart: boolean,
        _arrowEnd: boolean,
        _arrowStyle: number,
        _arrowLength: number,
        _arrowHalfWidth: number,
        _dashStyle: number,
        _sW: number,
    ): boolean {
        // LIMITATION: complex curves are expanded into polygon/line primitives
        // before reaching the exporter (24-segment polyline approximation).
        return false;
    }

    exportConnection(x: number, y: number, layer: number, nodeSize: number): void {
        const l = this.layerV[layer];
        this.currentColor = this.getColorHex(l);
        this.layerAlpha = l.getAlpha();
        this.strokeWidth = 0.33;

        this.buffer.push(
            `<circle cx="${this.cLe(x)}" cy="${this.cLe(y)}" r="${this.cLe(nodeSize / 2.0)}" ` +
                `style="stroke:${this.currentColor};stroke-width:${this.strokeWidth}" ` +
                `fill="${this.currentColor}"${this.opacityAttr()}/>\n`,
        );
    }

    exportPCBLine(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        width: number,
        layer: number,
    ): void {
        const l = this.layerV[layer];
        this.currentColor = this.getColorHex(l);
        this.layerAlpha = l.getAlpha();

        this.buffer.push(
            `<line x1="${this.cLe(x1)}" y1="${this.cLe(y1)}" x2="${this.cLe(x2)}" y2="${this.cLe(y2)}" ` +
                `style="stroke:${this.currentColor};stroke-linejoin:round;stroke-linecap:round;` +
                `stroke-width:${width > 0 ? width : 0.5}"${this.opacityAttr()}/>\n`,
        );
    }

    exportPCBPad(
        x: number,
        y: number,
        style: number,
        six: number,
        siy: number,
        indiam: number,
        layer: number,
        onlyHole: boolean,
    ): void {
        this.strokeWidth = 0.33;
        const l = this.layerV[layer];
        this.currentColor = this.getColorHex(l);
        this.layerAlpha = l.getAlpha();

        if (onlyHole) {
            // Hole pass overpaints with solid white — must NOT inherit
            // layer alpha (matches Java).
            this.buffer.push(
                `<circle cx="${this.cLe(x)}" cy="${this.cLe(y)}" r="${this.cLe(indiam / 2.0)}" ` +
                    `style="stroke:white;stroke-width:${this.strokeWidth}" fill="white"/>\n`,
            );
        } else {
            const op = this.opacityAttr();
            switch (style) {
                case 1: {
                    const xdd = this.cLe(x - six / 2.0);
                    const ydd = this.cLe(y - siy / 2.0);
                    this.buffer.push(
                        `<rect x="${xdd}" y="${ydd}" rx="0" ry="0" width="${this.cLe(six)}" ` +
                            `height="${this.cLe(siy)}" style="stroke:${this.currentColor};stroke-width:` +
                            `${this.strokeWidth}" fill="${this.currentColor}"${op}/>\n`,
                    );
                    break;
                }
                case 2: {
                    const xdd = this.cLe(x - six / 2.0);
                    const ydd = this.cLe(y - siy / 2.0);
                    const rd = this.cLe(2.5);
                    this.buffer.push(
                        `<rect x="${xdd}" y="${ydd}" rx="${rd}" ry="${rd}" width="${this.cLe(six)}" ` +
                            `height="${this.cLe(siy)}" style="stroke:${this.currentColor};stroke-width:` +
                            `${this.strokeWidth}" fill="${this.currentColor}"${op}/>\n`,
                    );
                    break;
                }
                case 0:
                default:
                    this.buffer.push(
                        `<ellipse cx="${this.cLe(x)}" cy="${this.cLe(y)}" rx="${this.cLe(six / 2.0)}" ` +
                            `ry="${this.cLe(siy / 2.0)}" style="stroke:${this.currentColor};stroke-width:` +
                            `${this.strokeWidth}" fill="${this.currentColor}"${op}/>\n`,
                    );
                    break;
            }
        }
    }

    /** Returns ` opacity="<a>"` for translucent layers, or `''`. */
    private opacityAttr(): string {
        return this.layerAlpha < 1.0 ? ` opacity="${this.layerAlpha}"` : '';
    }

    exportAdvText(
        x: number,
        y: number,
        sizex: number,
        sizey: number,
        fontname: string,
        isBold: boolean,
        isMirrored: boolean,
        isItalic: boolean,
        orientation: number,
        layer: number,
        text: string,
    ): void {
        const l = this.layerV[layer];
        this.currentColor = this.getColorHex(l);
        this.layerAlpha = l.getAlpha();

        const xscale = isMirrored ? -1 : 1;
        const yscale = sizey / sizex === 10 / 7 ? 1.0 : (sizey / sizex) * (22.0 / 40.0);

        this.buffer.push(`<g transform="translate(${this.cLe(x)},${this.cLe(y)})`);
        if (orientation !== 0) {
            // Mirror flips the rotation sign — matches Java
            // ExportSVG.exportAdvText (see FidoCadJ source).
            const alpha = isMirrored ? orientation : -orientation;
            this.buffer.push(` rotate(${alpha})`);
        }
        this.buffer.push(` scale(${xscale},${yscale})">`);

        // Render LaTeX math (between $...$) as embedded glyph paths; plain text
        // stays an SVG <text>. The whole run shares this group's transform.
        const fontSize = sizex * 2;
        const layout = layoutMath(text, fontSize, (s) => s.length * 0.6 * fontSize);
        if (layout.hasMath) {
            for (const seg of layout.segments) {
                if (seg.kind === 'math' && seg.geom) {
                    this.buffer.push(this.svgMathGroup(seg.geom, seg.x, fontSize));
                } else {
                    this.buffer.push(
                        this.svgTextElement(
                            seg.text ?? '',
                            seg.x,
                            fontSize,
                            isBold,
                            isItalic,
                            fontname,
                        ),
                    );
                }
            }
        } else {
            this.buffer.push(this.svgTextElement(text, 0, fontSize, isBold, isItalic, fontname));
        }
        this.buffer.push('</g>\n');
    }

    /** Format a number for SVG output, trimming to 3 decimals. */
    private fmt(v: number): string {
        return (Math.round(v * 1000) / 1000).toString();
    }

    /** A plain-text run as an SVG <text> at the given x-offset (baseline y=0). */
    private svgTextElement(
        text: string,
        x: number,
        fontSize: number,
        isBold: boolean,
        isItalic: boolean,
        fontname: string,
    ): string {
        const xs = x === 0 ? '0' : this.fmt(x);
        return (
            `<text x="${xs}" y="0" font-family="${this.escapeXml(fontname)}" font-size="${fontSize}" ` +
            `fill="${this.currentColor}" style="font-weight:${isBold ? 'bold' : 'normal'};` +
            `font-style:${isItalic ? 'italic' : 'normal'}">${this.escapeXml(text)}</text>`
        );
    }

    /** A math segment as a scaled group of MathJax glyph paths and rule rects. */
    private svgMathGroup(geom: MathGeometry, x: number, fontSize: number): string {
        const s = fontSize / geom.unitsPerEm;
        let out =
            `<g transform="translate(${this.fmt(x)},0) scale(${this.fmt(s)})" ` +
            `fill="${this.currentColor}"${this.opacityAttr()}>`;
        for (const glyph of geom.glyphs) {
            out += `<path transform="matrix(${glyph.m.map((v) => this.fmt(v)).join(' ')})" d="${glyph.d}"/>`;
        }
        for (const r of geom.rects) {
            out +=
                `<rect transform="matrix(${r.m.map((v) => this.fmt(v)).join(' ')})" ` +
                `x="${this.fmt(r.x)}" y="${this.fmt(r.y)}" width="${this.fmt(r.w)}" height="${this.fmt(r.h)}"/>`;
        }
        out += '</g>';
        return out;
    }

    exportMacro(
        _x: number,
        _y: number,
        _isMirrored: boolean,
        _orientation: number,
        _macroName: string,
        _macroDesc: string,
        _name: string,
        _xn: number,
        _yn: number,
        _value: string,
        _xv: number,
        _yv: number,
        _font: string,
        _fontSize: number,
        _m: Map<string, any>,
    ): boolean {
        // LIMITATION: macros are flattened into constituent primitives
        // before reaching the exporter.
        return false;
    }

    getSvgString(): string {
        return this.buffer.join('');
    }

    private cLe(l: number): string {
        return (Math.round(l * 100.0) / 100.0).toString();
    }

    private convertToHex2(v: number): string {
        let s = v.toString(16);
        if (s.length === 1) {
            s = '0' + s;
        }
        return s;
    }

    private getColorHex(layer: LayerDesc): string {
        const c = layer.getColor();
        if (!c) return '#000000';
        return (
            '#' +
            this.convertToHex2(c.getRed()) +
            this.convertToHex2(c.getGreen()) +
            this.convertToHex2(c.getBlue())
        );
    }

    private checkColorAndWidth(fillPattern: string, dashStyle: number): void {
        this.buffer.push('style="stroke:' + this.currentColor);

        if (dashStyle > 0) {
            this.buffer.push(';stroke-dasharray: ' + this.sDash[dashStyle]);
        }

        if (this.currentPhase !== this.dashPhase) {
            this.currentPhase = this.dashPhase;
            this.buffer.push(';stroke-dashoffset: ' + this.dashPhase);
        }

        const sw = this.strokeWidth > 0 ? this.strokeWidth : 0.5;
        this.buffer.push(
            `;stroke-width:${sw};stroke-linejoin:round;stroke-linecap:round;fill-rule: evenodd;"`,
        );

        if (this.layerAlpha < 1.0) {
            this.buffer.push(` opacity="${this.layerAlpha}"`);
        }

        this.buffer.push(` ${fillPattern}/>\n`);
    }

    exportArrow(
        x: number,
        y: number,
        xc: number,
        yc: number,
        l: number,
        h: number,
        style: number,
    ): PointPr {
        let alpha: number;

        if (x === xc) {
            alpha = Math.PI / 2.0 + (y - yc < 0.0 ? 0.0 : Math.PI);
        } else {
            alpha = Math.atan((y - yc) / (x - xc));
        }

        alpha += x - xc > 0.0 ? 0.0 : Math.PI;

        const x0 = x - l * Math.cos(alpha);
        const y0 = y - l * Math.sin(alpha);

        const x1 = x0 - h * Math.sin(alpha);
        const y1 = y0 + h * Math.cos(alpha);

        const x2 = x0 + h * Math.sin(alpha);
        const y2 = y0 - h * Math.cos(alpha);

        this.buffer.push(
            `<polygon points="${this.roundTo(x)},${this.roundTo(y)} ` +
                `${this.roundTo(x1)},${this.roundTo(y1)} ` +
                `${this.roundTo(x2)},${this.roundTo(y2)}" `,
        );

        // Fill iff flagEmpty is NOT set. Matches Java ExportSVG.exportArrow
        // (FidoCadJ:814). Earlier code used `style === 0`, which wrongly
        // excluded style=1 (limiter alone) from being filled.
        if ((style & Arrow.flagEmpty) === 0) {
            this.checkColorAndWidth(`fill="${this.currentColor}"`, 0);
        } else {
            this.checkColorAndWidth('fill="none"', 0);
        }

        // Limiter cross-line: a stroke perpendicular to the arrow at its
        // base point. Matches Java ExportSVG.exportArrow (FidoCadJ:825).
        if ((style & Arrow.flagLimiter) !== 0) {
            const x3 = x - h * Math.sin(alpha);
            const y3 = y + h * Math.cos(alpha);
            const x4 = x + h * Math.sin(alpha);
            const y4 = y - h * Math.cos(alpha);
            this.buffer.push(
                `<line x1="${this.cLe(x3)}" y1="${this.cLe(y3)}" ` +
                    `x2="${this.cLe(x4)}" y2="${this.cLe(y4)}" `,
            );
            this.checkColorAndWidth('fill="none"', 0);
        }

        return new PointPr(x0, y0);
    }

    private roundTo(d: number): number {
        return Math.round(d);
    }

    private escapeXml(s: string): string {
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}
