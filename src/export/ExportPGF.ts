/**
 * @file ExportPGF.ts
 * @author Dante Loi
 * @date 2026-05-09
 * @brief PGF (Portable Graphic File) export for LaTeX documents
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import type { ExportInterface } from './ExportInterface.js';
import type { DimensionG } from '../graphic/DimensionG.js';
import type { PointDouble } from '../graphic/PointDouble.js';
import type { LayerDesc } from '../layers/LayerDesc.js';
import { Globals } from '../globals/Globals.js';
import { Arrow } from '../primitives/Arrow.js';
import { PointPr } from './PointPr.js';
import { escapeLatex } from './AbstractExport.js';

export class ExportPGF implements ExportInterface {
    private buffer: string[] = [];
    private layerV: LayerDesc[] = [];
    private sDash: string[] = [];
    private actualWidth: number = -1;
    private dashPhase: number = 0;
    private currentPhase: number = -1;
    private currentDash: number = -1;
    private currentLayer: number = -1;

    exportStart(totalSize: DimensionG, la: LayerDesc[], _grid: number): void {
        this.layerV = la;

        const wi = Math.round(totalSize.width);
        const he = Math.round(totalSize.height);

        // PGF header
        this.buffer.push(`\\begin{pgfpicture}{0cm}{0cm}{${wi}pt}{${he}pt}`);
        this.buffer.push(`% Created by FidoCadJS, export filter`);
        this.buffer.push(`\\pgfsetxvec{\\pgfpoint{1pt}{0pt}}`);
        this.buffer.push(`\\pgfsetyvec{\\pgfpoint{0pt}{1pt}}`);
        this.buffer.push(`\\pgfsetroundjoin`);
        this.buffer.push(`\\pgfsetroundcap`);
        this.buffer.push(`\\pgftranslateto{\\pgfxy(0,${he})}`);
        this.buffer.push(`\\begin{pgfmagnify}{1}{-1}`);
        this.buffer.push(`% Layer color definitions`);

        // Layer color definitions
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

        this.currentLayer = -1;
        this.actualWidth = -1;
        this.currentDash = -1;
        this.currentPhase = -1;
    }

    exportEnd(): void {
        this.buffer.push(`\\end{pgfmagnify}`);
        this.buffer.push(`\\end{pgfpicture}`);
    }

    setDashUnit(u: number): void {
        this.sDash = [];
        this.sDash[0] = '';

        for (let i = 1; i < Globals.dashNumber; ++i) {
            const pattern = Globals.dash[i]!;
            let stretched = '';
            for (let j = 0; j < pattern.length; ++j) {
                stretched += (pattern[j]! * u) / 2.0;
                if (j < pattern.length - 1) {
                    stretched += 'pt}{';
                }
            }
            this.sDash[i] = `{${stretched}pt}`;
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
        this.registerColorSize(layer, sW);
        this.registerDash(dashStyle);

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
            `\\pgfline{\\pgfxy(${this.cLe(xstart)},${this.cLe(ystart)})}` +
                `{\\pgfxy(${this.cLe(xend)},${this.cLe(yend)})}`,
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
        this.registerColorSize(layer, sW);
        this.registerDash(dashStyle);

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

        this.buffer.push(`\\pgfmoveto{\\pgfxy(${_x1},${_y1})}`);
        this.buffer.push(
            `\\pgfcurveto{\\pgfxy(${this.cLe(x2)},${this.cLe(y2)})}` +
                `{\\pgfxy(${this.cLe(x3)},${this.cLe(y3)})}` +
                `{\\pgfxy(${_x4},${_y4})}`,
        );
        this.buffer.push(`\\pgfstroke`);
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
        this.registerColorSize(layer, sW);
        this.registerDash(dashStyle);

        this.buffer.push(`\\pgfmoveto{\\pgfxy(${this.cLe(x1)},${this.cLe(y1)})}`);
        this.buffer.push(`\\pgflineto{\\pgfxy(${this.cLe(x2)},${this.cLe(y1)})}`);
        this.buffer.push(`\\pgflineto{\\pgfxy(${this.cLe(x2)},${this.cLe(y2)})}`);
        this.buffer.push(`\\pgflineto{\\pgfxy(${this.cLe(x1)},${this.cLe(y2)})}`);
        this.buffer.push(`\\pgfclosepath`);
        if (isFilled) {
            this.buffer.push(`\\pgffill`);
        } else {
            this.buffer.push(`\\pgfqstroke`);
        }
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
        this.registerColorSize(layer, sW);
        this.registerDash(dashStyle);

        const action = isFilled ? 'fillstroke' : 'stroke';
        this.buffer.push(
            `\\pgfellipse[${action}]` +
                `{\\pgfxy(${this.cLe((x1 + x2) / 2.0)},${this.cLe((y1 + y2) / 2.0)})}` +
                `{\\pgfxy(${this.cLe(Math.abs(x2 - x1) / 2.0)},0)}` +
                `{\\pgfxy(0,${this.cLe(Math.abs(y2 - y1) / 2.0)})}`,
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
        this.registerColorSize(layer, sW);
        this.registerDash(dashStyle);

        this.buffer.push(
            `\\pgfmoveto{\\pgfxy(${this.cLe(vertices[0]!.x)},${this.cLe(vertices[0]!.y)})}`,
        );
        for (let i = 1; i < nVertices; ++i) {
            this.buffer.push(
                `\\pgflineto{\\pgfxy(${this.cLe(vertices[i]!.x)},${this.cLe(vertices[i]!.y)})}`,
            );
        }
        this.buffer.push(`\\pgfclosepath`);
        if (isFilled) {
            this.buffer.push(`\\pgffill`);
        } else {
            this.buffer.push(`\\pgfqstroke`);
        }
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

    exportConnection(x: number, y: number, layer: number, nodeSize: number): void {
        this.registerColorSize(layer, 0.33);

        this.buffer.push(
            `\\pgfcircle[fill]{\\pgfxy(${this.cLe(x)},${this.cLe(y)})}` +
                `{${this.cLe(nodeSize / 2.0)}pt}`,
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
        this.registerColorSize(layer, width);
        // PCB lines are always solid
        this.registerDash(0);

        this.buffer.push(
            `\\pgfline{\\pgfxy(${this.cLe(x1)},${this.cLe(y1)})}` +
                `{\\pgfxy(${this.cLe(x2)},${this.cLe(y2)})}`,
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
            // Drill the hole in white
            if (this.currentLayer !== -2) {
                this.currentLayer = -2;
                this.buffer.push(`\\color{white}`);
            }

            this.buffer.push(
                `\\pgfellipse[fillstroke]` +
                    `{\\pgfxy(${this.cLe(x)},${this.cLe(y)})}` +
                    `{\\pgfxy(${this.cLe(indiam / 2.0)},0)}` +
                    `{\\pgfxy(0,${this.cLe(indiam / 2.0)})}`,
            );
        } else {
            this.registerColorSize(layer, 0.33);

            switch (style) {
                case 1: {
                    // Square pad
                    const xdd = x - six / 2.0;
                    const ydd = y - siy / 2.0;
                    this.buffer.push(
                        `\\pgfrect[fillstroke]` +
                            `{\\pgfxy(${this.cLe(xdd)},${this.cLe(ydd)})}` +
                            `{\\pgfxy(${this.cLe(six)},${this.cLe(siy)})}`,
                    );
                    break;
                }
                case 2: {
                    // Rounded pad (rendered as square in PGF)
                    const xdd = x - six / 2.0;
                    const ydd = y - siy / 2.0;
                    this.buffer.push(
                        `\\pgfrect[fillstroke]` +
                            `{\\pgfxy(${this.cLe(xdd)},${this.cLe(ydd)})}` +
                            `{\\pgfxy(${this.cLe(six)},${this.cLe(siy)})}`,
                    );
                    break;
                }
                case 0: // Oval pad
                default:
                    this.buffer.push(
                        `\\pgfellipse[fillstroke]` +
                            `{\\pgfxy(${this.cLe(x)},${this.cLe(y)})}` +
                            `{\\pgfxy(${this.cLe(six / 2.0)},0)}` +
                            `{\\pgfxy(0,${this.cLe(siy / 2.0)})}`,
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
        this.registerColorSize(layer, -1.0);

        /*
         * THIS VERSION OF TEXT EXPORT IS NOT COMPLETE! IN PARTICULAR,
         * MIRRORING EFFECTS, ANGLES AND A PRECISE SIZE CONTROL IS NOT
         * HANDLED at ALL!
         * This is somehow wanted, since the main use of the PGF export is
         * for inserting LaTeX commands inside drawings meant for use in a
         * LaTeX documents. So this is something LaTeX should do, and it is
         * not a business for FidoCadJS.
         *
         * Text is emitted verbatim — no escaping. Users can embed LaTeX
         * commands directly in FidoCad text primitives (e.g. \small $R_1$).
         */

        this.buffer.push(`\\begin{pgfmagnify}{1}{-1}`);
        this.buffer.push(
            `\\pgfputat{\\pgfxy(${this.cLe(x)},${this.cLe(-y)})}` +
                `{\\pgfbox[left,top]{${escapeLatex(text)}}}`,
        );
        this.buffer.push(`\\end{pgfmagnify}`);
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

        this.buffer.push(`\\pgfmoveto{\\pgfxy(${this.cLe(x)},${this.cLe(y)})}`);
        this.buffer.push(`\\pgflineto{\\pgfxy(${this.cLe(x1)},${this.cLe(y1)})}`);
        this.buffer.push(`\\pgflineto{\\pgfxy(${this.cLe(x2)},${this.cLe(y2)})}`);
        this.buffer.push(`\\pgfclosepath`);

        if ((style & Arrow.flagEmpty) === 0) {
            this.buffer.push(`\\pgffill`);
        } else {
            this.buffer.push(`\\pgfqstroke`);
        }

        if ((style & Arrow.flagLimiter) !== 0) {
            const x3 = x - h * Math.sin(alpha);
            const y3 = y + h * Math.cos(alpha);
            const x4 = x + h * Math.sin(alpha);
            const y4 = y - h * Math.cos(alpha);
            this.buffer.push(
                `\\pgfline{\\pgfxy(${this.cLe(x3)},${this.cLe(y3)})}` +
                    `{\\pgfxy(${this.cLe(x4)},${this.cLe(y4)})}`,
            );
        }

        return new PointPr(x0, y0);
    }

    getPgfString(): string {
        return this.buffer.join('\n');
    }

    // ── private helpers ──────────────────────────────────────────────

    /**
     * Format a coordinate value with 2-decimal rounding for cleaner output.
     * Values that are effectively integers are emitted without decimals.
     */
    private cLe(n: number): string {
        const rounded = Math.round(n * 100.0) / 100.0;
        // If it's an integer value, emit without decimal point for cleaner PGF
        if (rounded === Math.round(rounded)) {
            return Math.round(rounded).toString();
        }
        return rounded.toString();
    }

    /**
     * Emit color and line width changes only when they differ from current state.
     * @param layer  the layer number
     * @param strokeWidth  the desired stroke width (no change if ≤ 0)
     */
    private registerColorSize(layer: number, strokeWidth: number): void {
        if (layer !== this.currentLayer) {
            this.currentLayer = layer;
            this.buffer.push(`\\color{layer${layer}}`);
        }
        if (strokeWidth > 0 && strokeWidth !== this.actualWidth) {
            this.actualWidth = strokeWidth;
            this.buffer.push(`\\pgfsetlinewidth{${this.cLe(strokeWidth)}pt}`);
        }
    }

    /**
     * Emit dash pattern changes only when style or phase differs from current state.
     */
    private registerDash(dashStyle: number): void {
        if (dashStyle !== this.currentDash || this.dashPhase !== this.currentPhase) {
            this.currentDash = dashStyle;
            this.currentPhase = this.dashPhase;
            if (dashStyle === 0) {
                this.buffer.push(`\\pgfsetdash{}{0pt}`);
            } else {
                this.buffer.push(`\\pgfsetdash{${this.sDash[dashStyle]}}{${this.dashPhase}pt}`);
            }
        }
    }
}
