import type { ExportInterface } from './ExportInterface.js';
import type { DimensionG } from '../graphic/DimensionG.js';
import type { PointDouble } from '../graphic/PointDouble.js';
import type { LayerDesc } from '../layers/LayerDesc.js';
import { Globals } from '../globals/Globals.js';
import { PointPr } from './PointPr.js';

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
            '"http://www.w3.org/Graphics/SVG/1.1/Dtd/svg11.dtd">'
        );
        this.buffer.push(
            `<svg width="${this.cLe(wi)}" height="${this.cLe(he)}" ` +
            'version="1.1" xmlns="http://www.w3.org/2000/svg" ' +
            'xmlns:xlink="http://www.w3.org/1999/xlink">'
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
        x1: number, y1: number,
        x2: number, y2: number,
        layer: number,
        arrowStart: boolean,
        arrowEnd: boolean,
        arrowStyle: number,
        arrowLength: number,
        arrowHalfWidth: number,
        dashStyle: number,
        sW: number
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
            `<line x1="${this.cLe(xstart)}" y1="${this.cLe(ystart)}" x2="${this.cLe(xend)}" y2="${this.cLe(yend)}" `
        );
        this.checkColorAndWidth('fill="none"', dashStyle);
    }

    exportBezier(
        x1: number, y1: number,
        x2: number, y2: number,
        x3: number, y3: number,
        x4: number, y4: number,
        layer: number,
        arrowStart: boolean,
        arrowEnd: boolean,
        arrowStyle: number,
        arrowLength: number,
        arrowHalfWidth: number,
        dashStyle: number,
        sW: number
    ): void {
        const l = this.layerV[layer];
        this.currentColor = this.getColorHex(l);
        this.layerAlpha = l.getAlpha();
        this.strokeWidth = sW;

        let _x1 = x1, _y1 = y1, _x4 = x4, _y4 = y4;

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
            `${this.cLe(x3)},${this.cLe(y3)} ${this.cLe(_x4)},${this.cLe(_y4)}" `
        );
        this.checkColorAndWidth('fill="none"', dashStyle);
    }

    exportRectangle(
        x1: number, y1: number,
        x2: number, y2: number,
        isFilled: boolean,
        layer: number,
        dashStyle: number,
        sW: number
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
            `rx="0" ry="0" width="${this.cLe(rw)}" height="${this.cLe(rh)}" `
        );
        this.checkColorAndWidth(fillPattern, dashStyle);
    }

    exportOval(
        x1: number, y1: number,
        x2: number, y2: number,
        isFilled: boolean,
        layer: number,
        dashStyle: number,
        sW: number
    ): void {
        const l = this.layerV[layer];
        this.currentColor = this.getColorHex(l);
        this.layerAlpha = l.getAlpha();
        this.strokeWidth = sW;

        const fillPattern = isFilled ? `fill="${this.currentColor}"` : 'fill="none"';

        this.buffer.push(
            `<ellipse cx="${this.cLe((x1 + x2) / 2.0)}" cy="${this.cLe((y1 + y2) / 2.0)}" ` +
            `rx="${this.cLe(Math.abs(x2 - x1) / 2.0)}" ry="${this.cLe(Math.abs(y2 - y1) / 2.0)}" `
        );
        this.checkColorAndWidth(fillPattern, dashStyle);
    }

    exportPolygon(
        vertices: PointDouble[],
        nVertices: number,
        isFilled: boolean,
        layer: number,
        dashStyle: number,
        sW: number
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
        _sW: number
    ): boolean {
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
            `fill="${this.currentColor}"/>\n`
        );
    }

    exportPCBLine(
        x1: number, y1: number,
        x2: number, y2: number,
        width: number,
        layer: number
    ): void {
        const l = this.layerV[layer];
        this.currentColor = this.getColorHex(l);
        this.layerAlpha = l.getAlpha();

        this.buffer.push(
            `<line x1="${this.cLe(x1)}" y1="${this.cLe(y1)}" x2="${this.cLe(x2)}" y2="${this.cLe(y2)}" ` +
            `style="stroke:${this.currentColor};stroke-linejoin:round;stroke-linecap:round;` +
            `stroke-width:${width > 0 ? width : 0.5}"/>\n`
        );
    }

    exportPCBPad(
        x: number, y: number,
        style: number,
        six: number, siy: number,
        indiam: number,
        layer: number,
        onlyHole: boolean
    ): void {
        this.strokeWidth = 0.33;
        const l = this.layerV[layer];
        this.currentColor = this.getColorHex(l);
        this.layerAlpha = l.getAlpha();

        if (onlyHole) {
            this.buffer.push(
                `<circle cx="${this.cLe(x)}" cy="${this.cLe(y)}" r="${this.cLe(indiam / 2.0)}" ` +
                `style="stroke:white;stroke-width:${this.strokeWidth}" fill="white"/>\n`
            );
        } else {
            switch (style) {
                case 1: {
                    const xdd = this.cLe(x - six / 2.0);
                    const ydd = this.cLe(y - siy / 2.0);
                    this.buffer.push(
                        `<rect x="${xdd}" y="${ydd}" rx="0" ry="0" width="${this.cLe(six)}" ` +
                        `height="${this.cLe(siy)}" style="stroke:${this.currentColor};stroke-width:` +
                        `${this.strokeWidth}" fill="${this.currentColor}"/>\n`
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
                        `${this.strokeWidth}" fill="${this.currentColor}"/>\n`
                    );
                    break;
                }
                case 0:
                default:
                    this.buffer.push(
                        `<ellipse cx="${this.cLe(x)}" cy="${this.cLe(y)}" rx="${this.cLe(six / 2.0)}" ` +
                        `ry="${this.cLe(siy / 2.0)}" style="stroke:${this.currentColor};stroke-width:` +
                        `${this.strokeWidth}" fill="${this.currentColor}"/>\n`
                    );
                    break;
            }
        }
    }

    exportAdvText(
        x: number, y: number,
        sizex: number, sizey: number,
        fontname: string,
        isBold: boolean,
        isMirrored: boolean,
        isItalic: boolean,
        orientation: number,
        layer: number,
        text: string
    ): void {
        const l = this.layerV[layer];
        this.currentColor = this.getColorHex(l);
        this.layerAlpha = l.getAlpha();

        const xscale = isMirrored ? -1 : 1;
        const yscale = (sizey / sizex) === 10 / 7 ? 1.0 : (sizey / sizex) * (22.0 / 40.0);

        this.buffer.push(
            `<g transform="translate(${this.cLe(x)},${this.cLe(y)})`
        );
        if (orientation !== 0) {
            this.buffer.push(` rotate(${-orientation})`);
        }
        this.buffer.push(` scale(${xscale},${yscale})">`);
        this.buffer.push(
            `<text x="0" y="0" font-family="${fontname}" font-size="${sizex * 2}" ` +
            `fill="${this.currentColor}" style="font-weight:${isBold ? 'bold' : 'normal'};` +
            `font-style:${isItalic ? 'italic' : 'normal'}">${this.escapeXml(text)}</text>`
        );
        this.buffer.push('</g>\n');
    }

    exportMacro(
        _x: number, _y: number,
        _isMirrored: boolean,
        _orientation: number,
        _macroName: string,
        _macroDesc: string,
        _name: string, _xn: number, _yn: number,
        _value: string, _xv: number, _yv: number,
        _font: string,
        _fontSize: number,
        _m: Map<string, any>
    ): boolean {
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
            `;stroke-width:${sw};stroke-linejoin:round;stroke-linecap:round;fill-rule: evenodd;"`
        );

        if (this.layerAlpha < 1.0) {
            this.buffer.push(` opacity="${this.layerAlpha}"`);
        }

        this.buffer.push(` ${fillPattern}/>\n`);
    }

    exportArrow(
        x: number, y: number,
        xc: number, yc: number,
        l: number, h: number,
        style: number
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
            `${this.roundTo(x2)},${this.roundTo(y2)}" `
        );

        if (style === 0) {
            this.checkColorAndWidth(`fill="${this.currentColor}"`, 0);
        } else {
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
