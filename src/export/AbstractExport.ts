/**
 * @file AbstractExport.ts
 * @author Dante Loi
 * @date 2026-05-13
 * @brief Abstract base class for export filters (SVG, PGF, TikZ)
 * @copyright Copyright 2026 Dante Loi - GPL v3
 * @details Provides shared buffer management, layer tracking, dash style,
 *          and stroke width bookkeeping. Format-specific subclasses only
 *          override the per-primitive rendering methods defined in
 *          ExportInterface.
 */

import type { ExportInterface } from './ExportInterface.js';
import type { DimensionG } from '../graphic/DimensionG.js';
import type { PointDouble } from '../graphic/PointDouble.js';
import type { LayerDesc } from '../layers/LayerDesc.js';
import type { MacroDesc } from '../primitives/MacroDesc.js';
import type { PointPr } from './PointPr.js';

/**
 * Escape special LaTeX characters in user-supplied text.
 * Characters escaped: \ { } # $ % & _ ^ ~
 * This prevents malformed output when user labels contain characters
 * that are active in LaTeX (e.g. underscores in component names).
 */
export function escapeLatex(s: string): string {
    // Escape special LaTeX characters: \ { } # $ % & _ ^ ~
    //
    // The tricky part is that replacement strings (e.g. \textbackslash{})
    // themselves contain special chars (\, {, }). We use the standard
    // approach: replace \ with a placeholder token first, do all other
    // escaping, then replace the placeholder last.
    //
    // Sentinel: \x00 is forbidden in JavaScript strings so it cannot
    // appear in user-supplied FidoCad text (which is ASCII text lines).
    const BS = '\x00BS\x00';
    const CIRC = '\x00CIRC\x00';
    const TILDE = '\x00TILDE\x00';

    return s
        .replace(/\\/g, BS)
        .replace(/\^/g, CIRC)
        .replace(/~/g, TILDE)
        .replace(/[#$%&_]/g, (c) => '\\' + c)
        .replace(/[{}]/g, (c) => '\\' + c)
        .replace(new RegExp(BS, 'g'), '\\textbackslash{}')
        .replace(new RegExp(CIRC, 'g'), '\\textasciicircum{}')
        .replace(new RegExp(TILDE, 'g'), '\\textasciitilde{}');
}

export abstract class AbstractExport implements ExportInterface {
    /** Output buffer — format-specific content is pushed here. */
    protected buffer: string[] = [];

    /** Active layer vector (set by exportStart). */
    protected layerV: LayerDesc[] = [];

    /** Current dash style index (for change detection). */
    protected currentDash: number = -1;

    /** Dash unit (px). */
    protected dashUnit: number = 10;

    /** Dash phase offset. */
    protected dashPhase: number = 0;

    /** Current stroke width (for change detection). */
    protected currentStrokeWidth: number = 1;

    // ── Buffer helpers ────────────────────────────────────────────────────

    /** Append a line to the output buffer. */
    protected emit(line: string): void {
        this.buffer.push(line);
    }

    /** Append a formatted line to the output buffer. */
    protected emitFmt(format: string, ...args: (string | number)[]): void {
        this.buffer.push(format.replace(/%s/g, () => String(args.shift() ?? '')));
    }

    /** Join all buffered lines into a single string. */
    protected join(): string {
        return this.buffer.join('\n');
    }

    // ── Dash helpers ──────────────────────────────────────────────────────

    setDashUnit(u: number): void {
        this.dashUnit = u;
    }

    setDashPhase(p: number): void {
        this.dashPhase = p;
    }

    /** Compute a dash-array pattern from FidoCadJ dash style index. */
    protected dashArray(style: number): number[] {
        const u = this.dashUnit;
        switch (style) {
            case 1:
                return [u * 2, u * 2];
            case 2:
                return [u * 2, u * 2, u, u * 2];
            case 3:
                return [u * 3, u * 2];
            case 4:
                return [u, u];
            default:
                return [];
        }
    }

    // ── Coordinate helpers ────────────────────────────────────────────────

    /** Round a number to one decimal place. */
    protected r1(v: number): string {
        return (Math.round(v * 10) / 10).toString();
    }

    /** Round a number to two decimal places. */
    protected r2(v: number): string {
        return (Math.round(v * 100) / 100).toString();
    }

    // ── Abstract: lifecycle (implemented by subclass) ─────────────────────

    abstract exportStart(totalSize: DimensionG, la: LayerDesc[], grid: number): void;
    abstract exportEnd(): void;

    // ── Abstract: per-primitive rendering ─────────────────────────────────

    abstract exportAdvText(
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
    ): void;

    abstract exportBezier(
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
    ): void;

    abstract exportConnection(x: number, y: number, layer: number, size: number): void;

    abstract exportLine(
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
    ): void;

    abstract exportMacro(
        x: number,
        y: number,
        isMirrored: boolean,
        orientation: number,
        macroName: string,
        macroDesc: string,
        name: string,
        xn: number,
        yn: number,
        value: string,
        xv: number,
        yv: number,
        font: string,
        fontSize: number,
        m: Map<string, MacroDesc>,
    ): boolean;

    abstract exportOval(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        isFilled: boolean,
        layer: number,
        dashStyle: number,
        strokeWidth: number,
    ): void;

    abstract exportPCBLine(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        width: number,
        layer: number,
    ): void;

    abstract exportPCBPad(
        x: number,
        y: number,
        style: number,
        six: number,
        siy: number,
        indiam: number,
        layer: number,
        onlyHole: boolean,
    ): void;

    abstract exportPolygon(
        vertices: PointDouble[],
        nVertices: number,
        isFilled: boolean,
        layer: number,
        dashStyle: number,
        strokeWidth: number,
    ): void;

    abstract exportCurve(
        vertices: PointDouble[],
        nVertices: number,
        isFilled: boolean,
        isClosed: boolean,
        layer: number,
        arrowStart: boolean,
        arrowEnd: boolean,
        arrowStyle: number,
        arrowLength: number,
        arrowHalfWidth: number,
        dashStyle: number,
        strokeWidth: number,
    ): boolean;

    abstract exportRectangle(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        isFilled: boolean,
        layer: number,
        dashStyle: number,
        strokeWidth: number,
    ): void;

    abstract exportArrow(
        x: number,
        y: number,
        xc: number,
        yc: number,
        l: number,
        h: number,
        style: number,
    ): PointPr;
}
