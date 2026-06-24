import type { Exporter } from './Exporter.js';
import type { DimensionG } from '../graphic/DimensionG.js';
import type { PointDouble } from '../graphic/PointDouble.js';
import type { LayerDesc } from '../layers/LayerDesc.js';
import { Globals } from '../globals/Globals.js';
import { Arrow } from '../primitives/Arrow.js';
import { PointPr } from './PointPr.js';
import { layoutMath, type MathGeometry } from '../graphic/MathLayout.js';
import { svgPathToPdfOps } from './SvgPathToPdf.js';

const RES_MULT = 200.0 / 72.0;
const BORDER = 5;

export class ExportPDF implements Exporter {
    private layerV: LayerDesc[] = [];
    private content: string[] = [];
    private pageWidthPdf = 0;
    private pageHeightPdf = 0;
    private actualColorRgb: string | null = null;
    private actualWidth: number = -1;
    private currentDash: number = 0;
    private dashPhase: number = 0;
    private currentPhase: number = -1;
    private sDash: string[] = [];

    exportStart(totalSize: DimensionG, la: LayerDesc[], _grid: number): void {
        this.layerV = la;
        this.pageWidthPdf = Math.floor(totalSize.width / RES_MULT + 1 + BORDER);
        this.pageHeightPdf = Math.floor(totalSize.height / RES_MULT + 1 + BORDER);

        // Transform PDF's bottom-left origin to FidoCad's top-left origin.
        // First cm: translate up by page height; second cm: scale down by
        // RES_MULT and flip Y. Round-line-caps everywhere ("1 J").
        this.content.push(`   1 0 0 1 0 ${this.fmt(totalSize.height / RES_MULT + BORDER)}  cm`);
        this.content.push(`  ${this.fmt(1 / RES_MULT)} 0  0 ${this.fmt(-1 / RES_MULT)} 0 0  cm`);
        this.content.push('1 J');
    }

    exportEnd(): void {
        /* finalize() actually builds the PDF buffer */
    }

    setDashUnit(u: number): void {
        // First entry is the solid line.
        this.sDash = [''];
        for (let i = 1; i < Globals.dashNumber; ++i) {
            const parts: string[] = [];
            for (let j = 0; j < Globals.dash[i]!.length; ++j) {
                parts.push(String((Globals.dash[i]![j] * u) / 2.0));
            }
            this.sDash[i] = '[' + parts.join(' ') + ']';
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
        strokeWidth: number,
    ): void {
        let xs = x1,
            ys = y1,
            xe = x2,
            ye = y2;
        this.applyColorAndWidth(layer, strokeWidth);
        this.registerDash(dashStyle);

        if (arrowStart) {
            const p = this.exportArrow(x1, y1, x2, y2, arrowLength, arrowHalfWidth, arrowStyle);
            if (arrowLength > 0) {
                xs = p.x;
                ys = p.y;
            }
        }
        if (arrowEnd) {
            const p = this.exportArrow(x2, y2, x1, y1, arrowLength, arrowHalfWidth, arrowStyle);
            if (arrowLength > 0) {
                xe = p.x;
                ye = p.y;
            }
        }
        this.content.push(
            `  ${this.fmt(xs)} ${this.fmt(ys)} m ${this.fmt(xe)} ${this.fmt(ye)} l S`,
        );
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
        strokeWidth: number,
    ): void {
        let _x1 = x1,
            _y1 = y1,
            _x4 = x4,
            _y4 = y4;
        this.applyColorAndWidth(layer, strokeWidth);
        this.registerDash(dashStyle);

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

        this.content.push(`${this.fmt(_x1)} ${this.fmt(_y1)} m`);
        this.content.push(
            `${this.fmt(x2)} ${this.fmt(y2)} ${this.fmt(x3)} ${this.fmt(y3)} ${this.fmt(_x4)} ${this.fmt(_y4)} c S`,
        );
    }

    exportRectangle(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        isFilled: boolean,
        layer: number,
        dashStyle: number,
        strokeWidth: number,
    ): void {
        this.applyColorAndWidth(layer, strokeWidth);
        this.registerDash(dashStyle);
        this.content.push(`  ${this.fmt(x1)} ${this.fmt(y1)} m`);
        this.content.push(`  ${this.fmt(x2)} ${this.fmt(y1)} l`);
        this.content.push(`  ${this.fmt(x2)} ${this.fmt(y2)} l`);
        this.content.push(`  ${this.fmt(x1)} ${this.fmt(y2)} l`);
        this.content.push(isFilled ? 'f' : 's');
    }

    exportOval(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        isFilled: boolean,
        layer: number,
        dashStyle: number,
        strokeWidth: number,
    ): void {
        this.applyColorAndWidth(layer, strokeWidth);
        this.registerDash(dashStyle);
        this.ellipse(x1, y1, x2, y2, isFilled);
    }

    exportPolygon(
        vertices: PointDouble[],
        nVertices: number,
        isFilled: boolean,
        layer: number,
        dashStyle: number,
        strokeWidth: number,
    ): void {
        if (nVertices < 1) return;
        this.applyColorAndWidth(layer, strokeWidth);
        this.registerDash(dashStyle);
        this.content.push(`  ${this.fmt(vertices[0]!.x)} ${this.fmt(vertices[0]!.y)} m`);
        for (let i = 1; i < nVertices; ++i) {
            this.content.push(`  ${this.fmt(vertices[i]!.x)} ${this.fmt(vertices[i]!.y)} l`);
        }
        this.content.push(isFilled ? '  f*' : '  s');
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
        _strokeWidth: number,
    ): boolean {
        // Complex curves are expanded into polygon/polyline primitives
        // upstream — matches Java behaviour.
        return false;
    }

    exportConnection(x: number, y: number, layer: number, size: number): void {
        this.applyColorAndWidth(layer, 0.33);
        this.ellipse(x - size / 2, y - size / 2, x + size / 2, y + size / 2, true);
    }

    exportPCBLine(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        width: number,
        layer: number,
    ): void {
        this.applyColorAndWidth(layer, width);
        this.registerDash(0);
        this.content.push(
            `  ${this.fmt(x1)} ${this.fmt(y1)} m ${this.fmt(x2)} ${this.fmt(y2)} l S`,
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
        this.applyColorAndWidth(layer, 0.33);
        if (!onlyHole) {
            switch (style) {
                case 2:
                    this.roundRect(x - six / 2, y - siy / 2, six, siy, 4, true);
                    break;
                case 1: {
                    const xd = x - six / 2;
                    const yd = y - siy / 2;
                    this.content.push(`${this.fmt(xd)} ${this.fmt(yd)} m`);
                    this.content.push(`${this.fmt(xd + six)} ${this.fmt(yd)} l`);
                    this.content.push(`${this.fmt(xd + six)} ${this.fmt(yd + siy)} l`);
                    this.content.push(`${this.fmt(xd)} ${this.fmt(yd + siy)} l`);
                    this.content.push('B');
                    break;
                }
                case 0:
                default:
                    this.ellipse(x - six / 2, y - siy / 2, x + six / 2, y + siy / 2, true);
                    break;
            }
        }
        // Drill: paint a white disc — must NOT inherit layer color.
        this.forceColor(1, 1, 1);
        this.actualWidth = -1;
        this.actualColorRgb = 'FFFFFF';
        this.ellipse(x - indiam / 2, y - indiam / 2, x + indiam / 2, y + indiam / 2, true);
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
            alpha = Math.PI / 2.0 + (y - yc < 0 ? 0 : Math.PI);
        } else {
            alpha = Math.atan((y - yc) / (x - xc));
        }
        alpha += x - xc > 0 ? 0 : Math.PI;

        const x0 = x - l * Math.cos(alpha);
        const y0 = y - l * Math.sin(alpha);
        const x1 = x0 - h * Math.sin(alpha);
        const y1 = y0 + h * Math.cos(alpha);
        const x2 = x0 + h * Math.sin(alpha);
        const y2 = y0 - h * Math.cos(alpha);

        this.content.push(`${this.fmt(x)} ${this.fmt(y)} m`);
        this.content.push(`${this.fmt(x1)} ${this.fmt(y1)} l`);
        this.content.push(`${this.fmt(x2)} ${this.fmt(y2)} l`);
        this.content.push((style & Arrow.flagEmpty) === 0 ? '  f*' : '  s');

        if ((style & Arrow.flagLimiter) !== 0) {
            const x3 = x - h * Math.sin(alpha);
            const y3 = y + h * Math.cos(alpha);
            const x4 = x + h * Math.sin(alpha);
            const y4 = y - h * Math.cos(alpha);
            this.content.push(
                `${this.fmt(x3)} ${this.fmt(y3)} m ${this.fmt(x4)} ${this.fmt(y4)} l s`,
            );
        }
        return new PointPr(x0, y0);
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
        if (!text) return;
        this.applyColorAndWidth(layer, 0.33);

        const ys = sizex * (12.0 / 7.0) + 0.5;
        const ratio = sizey / sizex === 10 / 7 ? 1.0 : ((sizey / sizex) * 22.0) / 40.0;
        const font = this.pickFont(fontname, isBold);
        const _italic = isItalic; // accepted; italics need a separate font slot we do not allocate
        void _italic;

        // Render LaTeX math (between $...$) as filled glyph paths; plain text
        // stays a PDF text run. Pen advances come from MathLayout (emPx = ys).
        const layout = layoutMath(text, ys, (s) => s.length * 0.6 * ys);
        if (!layout.hasMath) {
            this.emitPdfTextRun(text, 0, x, y, ys, ratio, isMirrored, orientation, font);
            return;
        }
        for (const seg of layout.segments) {
            if (seg.kind === 'math' && seg.geom) {
                this.emitPdfMathRun(seg.geom, seg.x, x, y, ys, ratio, isMirrored, orientation);
            } else {
                this.emitPdfTextRun(
                    seg.text ?? '',
                    seg.x,
                    x,
                    y,
                    ys,
                    ratio,
                    isMirrored,
                    orientation,
                    font,
                );
            }
        }
    }

    /**
     * Emit a plain-text run. With `dx === 0` this reproduces the original
     * single-string text placement exactly; a non-zero `dx` advances the run
     * horizontally (mixed text/math). Mirror/rotation use the same chain as
     * the original exporter.
     */
    private emitPdfTextRun(
        text: string,
        dx: number,
        x: number,
        y: number,
        ys: number,
        ratio: number,
        isMirrored: boolean,
        orientation: number,
        font: string,
    ): void {
        if (!text) return;
        this.content.push('BT');
        this.content.push(`${font} ${this.fmt(ys)} Tf`);
        this.content.push('q');
        this.content.push(`  1 0 0 1 ${this.fmt(x)} ${this.fmt(y)} cm`);
        if (orientation !== 0) {
            const a = ((isMirrored ? orientation : -orientation) * Math.PI) / 180;
            this.content.push(
                `  ${this.fmt(Math.cos(a))} ${this.fmt(Math.sin(a))} ${this.fmt(-Math.sin(a))} ${this.fmt(Math.cos(a))} 0 0 cm`,
            );
        }
        if (dx !== 0) {
            this.content.push(`  1 0 0 1 ${this.fmt(dx)} 0 cm`);
        }
        this.content.push(isMirrored ? '  -1 0 0 -1 0 0 cm' : '  1 0 0 -1 0 0 cm');
        this.content.push(`  1 0 0 ${this.fmt(ratio)} 0 ${this.fmt(-ys * ratio * 0.8)} cm`);
        this.content.push(`(${this.escapePdfString(text)}) Tj`);
        this.content.push('Q');
        this.content.push('ET');
    }

    /**
     * Emit a math segment as filled glyph paths. The geometry is y-down with
     * the baseline at 0 (no text y-flip), so the baseline is moved down by the
     * ascent to sit where the text baseline does, and `s` scales MathJax native
     * units into PDF user units.
     */
    private emitPdfMathRun(
        geom: MathGeometry,
        dx: number,
        x: number,
        y: number,
        ys: number,
        ratio: number,
        isMirrored: boolean,
        orientation: number,
    ): void {
        const s = ys / geom.unitsPerEm;
        this.content.push('q');
        this.content.push(`  1 0 0 1 ${this.fmt(x)} ${this.fmt(y)} cm`);
        if (orientation !== 0) {
            const a = ((isMirrored ? orientation : -orientation) * Math.PI) / 180;
            this.content.push(
                `  ${this.fmt(Math.cos(a))} ${this.fmt(Math.sin(a))} ${this.fmt(-Math.sin(a))} ${this.fmt(Math.cos(a))} 0 0 cm`,
            );
        }
        if (dx !== 0) {
            this.content.push(`  1 0 0 1 ${this.fmt(dx)} 0 cm`);
        }
        if (isMirrored) {
            this.content.push('  -1 0 0 1 0 0 cm');
        }
        // Stretch y by ratio; drop the baseline by the ascent (content y-down).
        this.content.push(`  1 0 0 ${this.fmt(ratio)} 0 ${this.fmt(ys * ratio * 0.8)} cm`);
        this.content.push(`  ${this.fmt(s)} 0 0 ${this.fmt(s)} 0 0 cm`);
        for (const glyph of geom.glyphs) {
            const m = glyph.m;
            this.content.push('  q');
            this.content.push(
                `    ${this.fmt(m[0])} ${this.fmt(m[1])} ${this.fmt(m[2])} ${this.fmt(m[3])} ${this.fmt(m[4])} ${this.fmt(m[5])} cm`,
            );
            this.content.push(svgPathToPdfOps(glyph.d, (v) => this.fmt(v)));
            this.content.push('  f');
            this.content.push('  Q');
        }
        for (const r of geom.rects) {
            const m = r.m;
            this.content.push('  q');
            this.content.push(
                `    ${this.fmt(m[0])} ${this.fmt(m[1])} ${this.fmt(m[2])} ${this.fmt(m[3])} ${this.fmt(m[4])} ${this.fmt(m[5])} cm`,
            );
            this.content.push(
                `    ${this.fmt(r.x)} ${this.fmt(r.y)} ${this.fmt(r.w)} ${this.fmt(r.h)} re`,
            );
            this.content.push('  f');
            this.content.push('  Q');
        }
        this.content.push('Q');
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
        _m: Map<string, unknown>,
    ): boolean {
        // Macros are flattened into primitives upstream.
        return false;
    }

    /** Return the complete PDF document as a string. */
    getPdfString(): string {
        const head = '%PDF-1.4\n';
        const stream = this.content.join('\n') + '\n';

        // Build deferred-offset objects: 5=Pages, 6-13=Fonts, then 14=Content,
        // then 4=Page (references content), then 2=ProcSet, 1=Info, 3=Catalog.
        const objs: string[] = new Array(15);

        objs[5] =
            `5 0 obj\n` +
            `  <</Kids [4 0 R ]\n` +
            `    /Count 1\n` +
            `    /Type /Pages\n` +
            `    /MediaBox [ 0 0  ${this.pageWidthPdf} ${this.pageHeightPdf} ]\n` +
            `  >> endobj\n`;

        const fontDef = (id: number, base: string) =>
            `${id} 0 obj\n` +
            `  <<   /Type /Font\n` +
            `    /Subtype /Type1\n` +
            `    /BaseFont /${base}\n` +
            `    /Encoding /WinAnsiEncoding\n` +
            `  >> endobj\n`;
        objs[6] = fontDef(6, 'Courier');
        objs[7] = fontDef(7, 'Courier-Bold');
        objs[8] = fontDef(8, 'Times-Roman');
        objs[9] = fontDef(9, 'Times-Bold');
        objs[10] = fontDef(10, 'Helvetica');
        objs[11] = fontDef(11, 'Helvetica-Bold');
        objs[12] = fontDef(12, 'Symbol');
        objs[13] = fontDef(13, 'ZapfDingbats');

        objs[14] =
            `14 0 obj\n` +
            `  <<\n` +
            `    /Length ${stream.length}\n` +
            `  >>\n` +
            `  stream\n` +
            stream +
            `endstream\n` +
            `endobj\n`;

        objs[4] =
            `4 0 obj\n` +
            `<< \n` +
            `  /Type /Page\n` +
            `  /Parent 5 0 R\n` +
            `  /Resources <<\n` +
            `  /Font <<\n` +
            `  /F1 6 0 R\n` +
            `  /F2 7 0 R\n` +
            `  /F3 8 0 R\n` +
            `  /F4 9 0 R\n` +
            `  /F5 10 0 R\n` +
            `  /F6 11 0 R\n` +
            `  /F7 12 0 R\n` +
            `  /F8 13 0 R\n` +
            `>>\n` +
            `/ProcSet 2 0 R\n` +
            `>>\n` +
            `  /Contents 14 0 R\n` +
            `>>\n` +
            `endobj\n`;

        objs[2] = `2 0 obj\n[ /PDF /Text  ]\nendobj\n`;

        objs[1] =
            `1 0 obj\n` +
            `<<\n` +
            `  /Creator (FidoCadJS, PDF export filter)\n` +
            `  /Producer (FidoCadJS)\n` +
            `>>\n` +
            `endobj\n`;

        objs[3] = `3 0 obj\n<<\n  /Pages 5 0 R\n  /Type /Catalog\n>>\nendobj\n`;

        // File layout order: head, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 4, 2, 1, 3
        const order = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 4, 2, 1, 3];
        const offsets = new Array(15).fill(0);
        let pos = head.length;
        for (const id of order) {
            offsets[id] = pos;
            pos += objs[id]!.length;
        }
        const xrefStart = pos;

        // Cross-reference table: entries 0..14 (object 0 is the free list head).
        let xref = `xref\n0 15\n0000000000 65535 f \n`;
        for (let i = 1; i <= 14; ++i) {
            xref += this.addLeadZeros(offsets[i]) + ' 00000 n \n';
        }

        const trailer =
            `trailer\n` +
            `<<\n` +
            `  /Size 15\n` +
            `  /Root 3 0 R\n` +
            `  /Info 1 0 R\n` +
            `>>\n` +
            `startxref\n` +
            `${xrefStart}\n` +
            `%%EOF\n`;

        let out = head;
        for (const id of order) out += objs[id]!;
        out += xref + trailer;
        return out;
    }

    // ─── helpers ──────────────────────────────────────────────────────────

    private addLeadZeros(n: number): string {
        return String(n).padStart(10, '0');
    }

    private applyColorAndWidth(layer: number, w: number): void {
        const l = this.layerV[layer];
        const c = l?.getColor();
        const r = c ? c.getRed() : 0;
        const g = c ? c.getGreen() : 0;
        const b = c ? c.getBlue() : 0;
        const tag = this.toHexTag(r, g, b);
        if (tag !== this.actualColorRgb) {
            this.actualColorRgb = tag;
            const rN = r / 255,
                gN = g / 255,
                bN = b / 255;
            this.content.push(`  ${this.fmt(rN)} ${this.fmt(gN)} ${this.fmt(bN)} rg`);
            this.content.push(`  ${this.fmt(rN)} ${this.fmt(gN)} ${this.fmt(bN)} RG`);
        }
        if (w !== this.actualWidth) {
            this.content.push(`  ${this.fmt(w)} w`);
            this.actualWidth = w;
        }
    }

    private forceColor(rN: number, gN: number, bN: number): void {
        this.content.push(`  ${this.fmt(rN)} ${this.fmt(gN)} ${this.fmt(bN)} rg`);
        this.content.push(`  ${this.fmt(rN)} ${this.fmt(gN)} ${this.fmt(bN)} RG`);
    }

    private toHexTag(r: number, g: number, b: number): string {
        return ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    }

    private registerDash(dashStyle: number): void {
        if (this.currentDash !== dashStyle || this.currentPhase !== this.dashPhase) {
            this.currentDash = dashStyle;
            this.currentPhase = this.dashPhase;
            if (dashStyle === 0) {
                this.content.push('[] 0 d');
            } else {
                this.content.push(`${this.sDash[dashStyle] ?? '[]'} ${this.fmt(this.dashPhase)} d`);
            }
        }
    }

    private ellipse(x1: number, y1: number, x2: number, y2: number, filled: boolean): void {
        const cx = (x1 + x2) / 2.0;
        const cy = (y1 + y2) / 2.0;
        const rx = Math.abs(x2 - x1) / 2.0;
        const ry = Math.abs(y2 - y1) / 2.0;
        const nMAX = 32;
        const tt = 1.01;
        this.content.push(`  ${this.fmt(cx + rx)} ${this.fmt(cy)} m`);
        for (let i = 0; i < nMAX; ++i) {
            let alpha = (2.0 * Math.PI * i) / nMAX;
            alpha += (2.0 * Math.PI) / nMAX / 3.0;
            alpha += (2.0 * Math.PI) / nMAX / 3.0;
            const xC = cx + tt * rx * Math.cos(alpha);
            const yC = cy + tt * ry * Math.sin(alpha);
            alpha += (2.0 * Math.PI) / nMAX / 3.0;
            const xD = cx + rx * Math.cos(alpha);
            const yD = cy + ry * Math.sin(alpha);
            this.content.push(`${this.fmt(xC)} ${this.fmt(yC)} ${this.fmt(xD)} ${this.fmt(yD)} y`);
        }
        this.content.push(filled ? '  f' : '  s');
    }

    private roundRect(
        x1: number,
        y1: number,
        w: number,
        h: number,
        r: number,
        filled: boolean,
    ): void {
        this.content.push(`${this.fmt(x1 + r)} ${this.fmt(y1)} m`);
        this.content.push(`${this.fmt(x1 + w - r)} ${this.fmt(y1)} l`);
        this.content.push(
            `${this.fmt(x1 + w)} ${this.fmt(y1)} ${this.fmt(x1 + w)} ${this.fmt(y1 + r)} y`,
        );
        this.content.push(`${this.fmt(x1 + w)} ${this.fmt(y1 + h - r)} l`);
        this.content.push(
            `${this.fmt(x1 + w)} ${this.fmt(y1 + h)} ${this.fmt(x1 + w - r)} ${this.fmt(y1 + h)} y`,
        );
        this.content.push(`${this.fmt(x1 + r)} ${this.fmt(y1 + h)} l`);
        this.content.push(
            `${this.fmt(x1)} ${this.fmt(y1 + h)} ${this.fmt(x1)} ${this.fmt(y1 + h - r)} y`,
        );
        this.content.push(`${this.fmt(x1)} ${this.fmt(y1 + r)} l`);
        this.content.push(`${this.fmt(x1)} ${this.fmt(y1)} ${this.fmt(x1 + r)} ${this.fmt(y1)} y `);
        this.content.push(filled ? '  f' : '  s');
    }

    private pickFont(fontname: string, isBold: boolean): string {
        const f = fontname.toLowerCase();
        if (f === 'courier' || f === 'courier new') return isBold ? '/F2' : '/F1';
        if (f === 'times' || f === 'times new roman' || f === 'times roman') {
            return isBold ? '/F4' : '/F3';
        }
        if (f === 'symbol') return '/F7';
        // Default: Helvetica / Helvetica-Bold (matches most Arial / sans-serif
        // labels in FidoCad files).
        return isBold ? '/F6' : '/F5';
    }

    /** Escape PDF literal-string special characters: ( ) and \\. */
    private escapePdfString(s: string): string {
        let out = '';
        for (const c of s) {
            const ch = c.charCodeAt(0);
            if (ch === 0x28) out += '\\(';
            else if (ch === 0x29) out += '\\)';
            else if (ch === 0x5c) out += '\\\\';
            else if (ch < 0x20 || ch > 0x7e) out += '?';
            else out += c;
        }
        return out;
    }

    private fmt(n: number): string {
        // Compact decimal — strip trailing zeros, but keep at least one
        // significant digit so PDF parsers don't choke on "1.".
        if (!isFinite(n)) return '0';
        const v = Math.round(n * 1000) / 1000;
        return Number.isInteger(v) ? String(v) : v.toString();
    }
}
