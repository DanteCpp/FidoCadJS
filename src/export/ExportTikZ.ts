import type { ExportInterface } from './ExportInterface.js';
import type { DimensionG } from '../graphic/DimensionG.js';
import type { PointDouble } from '../graphic/PointDouble.js';
import type { LayerDesc } from '../layers/LayerDesc.js';
import { Globals } from '../globals/Globals.js';
import { Arrow } from '../primitives/Arrow.js';
import { PointPr } from './PointPr.js';
import { escapeLatex } from './LatexEscape.js';

export class ExportTikZ implements ExportInterface {
    private buffer: string[] = [];
    private layerV: LayerDesc[] = [];
    private sDash: string[] = [];
    private dashPhase: number = 0;

    exportStart(_totalSize: DimensionG, la: LayerDesc[], _grid: number): void {
        this.layerV = la;

        // TikZ header — yscale=-1 flips the Y axis so (0,0) is top-left
        // (matching FidoCad logical coordinates)
        this.buffer.push(`% Created by FidoCadJS, TikZ export filter`);
        this.buffer.push(
            `\\begin{tikzpicture}[yscale=-1, x=1pt, y=1pt, ` + `line join=round, line cap=round]`,
        );
        this.buffer.push(`% Layer color definitions`);

        // Layer color definitions (same as PGF)
        for (let i = 0; i < this.layerV.length; ++i) {
            const l = this.layerV[i]!;
            const c = l.getColor();
            if (!c) continue;
            const r = Math.round((100.0 * c.getRed()) / 255.0) / 100.0;
            const g = Math.round((100.0 * c.getGreen()) / 255.0) / 100.0;
            const b = Math.round((100.0 * c.getBlue()) / 255.0) / 100.0;
            this.buffer.push(`\\definecolor{layer${i}}{rgb}{${r},${g},${b}}`);
        }

        this.buffer.push(`% End of color definitions`);
    }

    exportEnd(): void {
        this.buffer.push(`\\end{tikzpicture}`);
    }

    setDashUnit(u: number): void {
        this.sDash = [];
        this.sDash[0] = '';

        for (let i = 1; i < Globals.dashNumber; ++i) {
            const pattern = Globals.dash[i]!;
            const parts: string[] = [];
            for (let j = 0; j < pattern.length; ++j) {
                const val = (pattern[j]! * u) / 2.0;
                if (j % 2 === 0) {
                    parts.push(`on ${this.cLe(val)}pt`);
                } else {
                    parts.push(`off ${this.cLe(val)}pt`);
                }
            }
            this.sDash[i] = parts.join(', ');
        }
    }

    setDashPhase(p: number): void {
        this.dashPhase = p;
    }

    // ── Primitive exports ───────────────────────────────────────────

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

        const opts = this.styleOpts(layer, sW, dashStyle);
        this.buffer.push(
            `\\draw[${opts}] (${this.cLe(xstart)},${this.cLe(ystart)}) -- ` +
                `(${this.cLe(xend)},${this.cLe(yend)});`,
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
        sW: number,
    ): void {
        let _x1 = x1,
            _y1 = y1,
            _x4 = x4,
            _y4 = y4;

        if (arrowStart) {
            const p = this.exportArrow(x1, y1, x2, y2, arrowLength, arrowHalfWidth, arrowStyle);
            if (arrowLength > 0) {
                _x1 = Math.round(p.x);
                _y1 = Math.round(p.y);
            }
        }
        if (arrowEnd) {
            const p = this.exportArrow(x4, y4, x3, y3, arrowLength, arrowHalfWidth, arrowStyle);
            if (arrowLength > 0) {
                _x4 = Math.round(p.x);
                _y4 = Math.round(p.y);
            }
        }

        const opts = this.styleOpts(layer, sW, dashStyle);
        this.buffer.push(
            `\\draw[${opts}] (${_x1},${_y1}) .. controls ` +
                `(${this.cLe(x2)},${this.cLe(y2)}) and (${this.cLe(x3)},${this.cLe(y3)}) .. ` +
                `(${_x4},${_y4});`,
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
        sW: number,
    ): void {
        const opts = this.styleOpts(layer, sW, dashStyle);
        const cmd = isFilled ? '\\filldraw' : '\\draw';
        this.buffer.push(
            `${cmd}[${opts}] (${this.cLe(x1)},${this.cLe(y1)}) rectangle ` +
                `(${this.cLe(x2)},${this.cLe(y2)});`,
        );
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
        const opts = this.styleOpts(layer, sW, dashStyle);
        const cmd = isFilled ? '\\filldraw' : '\\draw';
        const cx = (x1 + x2) / 2.0;
        const cy = (y1 + y2) / 2.0;
        const rx = Math.abs(x2 - x1) / 2.0;
        const ry = Math.abs(y2 - y1) / 2.0;
        this.buffer.push(
            `${cmd}[${opts}] (${this.cLe(cx)},${this.cLe(cy)}) ` +
                `ellipse [x radius=${this.cLe(rx)}, y radius=${this.cLe(ry)}];`,
        );
    }

    exportPolygon(
        vertices: PointDouble[],
        nVertices: number,
        isFilled: boolean,
        layer: number,
        dashStyle: number,
        sW: number,
    ): void {
        const opts = this.styleOpts(layer, sW, dashStyle);
        const cmd = isFilled ? '\\filldraw' : '\\draw';

        const points = vertices
            .slice(0, nVertices)
            .map((v) => `(${this.cLe(v.x)},${this.cLe(v.y)})`);
        this.buffer.push(`${cmd}[${opts}] ${points.join(' -- ')} -- cycle;`);
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
        // before reaching the exporter. This method returns false so the
        // export orchestrator performs the expansion.
        return false;
    }

    exportConnection(x: number, y: number, layer: number, _nodeSize: number): void {
        const opts = `color=layer${layer}`;
        const r = _nodeSize / 2.0;
        this.buffer.push(
            `\\filldraw[${opts}] (${this.cLe(x)},${this.cLe(y)}) circle [radius=${this.cLe(r)}];`,
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
        // PCB lines are always solid, no dash
        const opts = `color=layer${layer}, line width=${width > 0 ? this.cLe(width) : '0.5'}pt`;
        this.buffer.push(
            `\\draw[${opts}] (${this.cLe(x1)},${this.cLe(y1)}) -- (${this.cLe(x2)},${this.cLe(y2)});`,
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
        if (onlyHole) {
            this.buffer.push(
                `\\filldraw[color=white] (${this.cLe(x)},${this.cLe(y)}) ` +
                    `ellipse [x radius=${this.cLe(indiam / 2.0)}, y radius=${this.cLe(indiam / 2.0)}];`,
            );
        } else {
            const opts = `color=layer${layer}`;

            switch (style) {
                case 1: {
                    // Square pad
                    const xdd = x - six / 2.0;
                    const ydd = y - siy / 2.0;
                    this.buffer.push(
                        `\\filldraw[${opts}] (${this.cLe(xdd)},${this.cLe(ydd)}) ` +
                            `rectangle ++(${this.cLe(six)},${this.cLe(siy)});`,
                    );
                    break;
                }
                case 2: {
                    // Rounded pad — rendered as square in TikZ
                    const xdd = x - six / 2.0;
                    const ydd = y - siy / 2.0;
                    this.buffer.push(
                        `\\filldraw[${opts}] (${this.cLe(xdd)},${this.cLe(ydd)}) ` +
                            `rectangle ++(${this.cLe(six)},${this.cLe(siy)});`,
                    );
                    break;
                }
                case 0: // Oval pad
                default:
                    this.buffer.push(
                        `\\filldraw[${opts}] (${this.cLe(x)},${this.cLe(y)}) ` +
                            `ellipse [x radius=${this.cLe(six / 2.0)}, y radius=${this.cLe(siy / 2.0)}];`,
                    );
                    break;
            }
        }
    }

    exportAdvText(
        x: number,
        y: number,
        _sizex: number,
        _sizey: number,
        _fontname: string,
        _isBold: boolean,
        _isMirrored: boolean,
        _isItalic: boolean,
        _orientation: number,
        layer: number,
        text: string,
    ): void {
        /*
         * Text is emitted verbatim — no escaping. Users embed LaTeX
         * commands directly in FidoCad text primitives.
         * Font size/style/orientation are ignored; LaTeX handles formatting.
         */
        this.buffer.push(
            `\\node[anchor=north west, color=layer${layer}] at (${this.cLe(x)},${this.cLe(y)}) ` +
                `{${escapeLatex(text)}};`,
        );
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
        // before reaching the exporter. This method returns false so the
        // export orchestrator performs the expansion.
        return false;
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

        // Arrows use the current layer/color — use layer 0 as default since
        // arrows inherit the context from their parent line/curve.
        // We match the PGF behavior: filled for normal, stroked for empty.
        if ((style & Arrow.flagEmpty) === 0) {
            this.buffer.push(
                `\\filldraw[color=layer0] (${this.cLe(x)},${this.cLe(y)}) -- ` +
                    `(${this.cLe(x1)},${this.cLe(y1)}) -- ` +
                    `(${this.cLe(x2)},${this.cLe(y2)}) -- cycle;`,
            );
        } else {
            this.buffer.push(
                `\\draw[color=layer0] (${this.cLe(x)},${this.cLe(y)}) -- ` +
                    `(${this.cLe(x1)},${this.cLe(y1)}) -- ` +
                    `(${this.cLe(x2)},${this.cLe(y2)}) -- cycle;`,
            );
        }

        // Limiter line
        if ((style & Arrow.flagLimiter) !== 0) {
            const x3 = x - h * Math.sin(alpha);
            const y3 = y + h * Math.cos(alpha);
            const x4 = x + h * Math.sin(alpha);
            const y4 = y - h * Math.cos(alpha);
            this.buffer.push(
                `\\draw[color=layer0] (${this.cLe(x3)},${this.cLe(y3)}) -- ` +
                    `(${this.cLe(x4)},${this.cLe(y4)});`,
            );
        }

        return new PointPr(x0, y0);
    }

    getTikZString(): string {
        return this.buffer.join('\n');
    }

    // ── private helpers ──────────────────────────────────────────────

    /**
     * Format a coordinate value with 2-decimal rounding.
     * Integer values are emitted without decimal point.
     */
    private cLe(n: number): string {
        const rounded = Math.round(n * 100.0) / 100.0;
        if (rounded === Math.round(rounded)) {
            return Math.round(rounded).toString();
        }
        return rounded.toString();
    }

    /**
     * Build the TikZ style option string for a drawing command.
     * Includes color, line width, and (if applicable) dash pattern + phase.
     */
    private styleOpts(layer: number, strokeWidth: number, dashStyle: number): string {
        const parts: string[] = [];

        // Color
        parts.push(`color=layer${layer}`);

        // Line width
        if (strokeWidth > 0) {
            parts.push(`line width=${this.cLe(strokeWidth)}pt`);
        }

        // Dash pattern (TikZ uses "dash pattern=on Xpt off Ypt on Zpt...")
        if (dashStyle > 0) {
            const pattern = this.sDash[dashStyle];
            if (pattern && pattern.length > 0) {
                parts.push(`dash pattern=${pattern}`);
            }
            if (this.dashPhase !== 0) {
                parts.push(`dash phase=${this.cLe(this.dashPhase)}pt`);
            }
        }

        return parts.join(', ');
    }
}
