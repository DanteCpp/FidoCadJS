/**
 * @file MathLayout.ts
 * @author Dante Loi
 * @date 2026-06-03
 * @brief Splits a FidoCad text string into plain-text and LaTeX-math segments,
 *        renders math to glyph geometry via the vendored MathJax engine, and
 *        lays the segments out left-to-right with x-advances. Shared by the
 *        on-screen canvas renderer and the SVG/PDF exporters so math appears
 *        identically everywhere.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 * @details Math coordinates come back from MathJax in native units
 *          (unitsPerEm, y-down, baseline at 0); a math segment's advance is
 *          `widthEm * emPx`. Text advance is supplied by the caller's
 *          `measure` callback so each backend uses its own font metrics.
 *          Malformed LaTeX degrades to literal `$...$` text.
 */

import { tex2mathgeom, type MathGeometry } from '../vendor/mathjax-shim.js';

/** A raw segment produced by splitting on `$`/`$$` delimiters. */
export interface MathTextSegment {
    type: 'text' | 'math';
    /** For 'text': the raw text. For 'math': the LaTeX source (no delimiters). */
    content: string;
    /** Display (centered, `$$`) vs inline (`$`) math. */
    display: boolean;
}

/** A positioned segment ready to render. */
export interface LaidOutSegment {
    kind: 'text' | 'math';
    /** Pen x-offset from the start of the run, in the same space as `measure`. */
    x: number;
    /** Advance width, same space as `x`. */
    width: number;
    /** Present when `kind === 'text'`. */
    text?: string;
    /** Present when `kind === 'math'`. */
    geom?: MathGeometry;
}

/** Result of laying out a mixed text/math string. */
export interface MathLayoutResult {
    segments: LaidOutSegment[];
    totalWidth: number;
    /** True if at least one segment rendered as math (vs all-text/fallback). */
    hasMath: boolean;
}

/**
 * Split text on `$...$` (inline) and `$$...$$` (display) math delimiters.
 * Unclosed delimiters are treated as literal text. Mirrors the original
 * KaTeX-era splitter so existing drawings parse identically.
 */
export function splitMathSegments(text: string): MathTextSegment[] {
    const segments: MathTextSegment[] = [];
    if (!text) return segments;
    let remaining = text;

    while (remaining.length > 0) {
        const displayIdx = remaining.indexOf('$$');
        const inlineIdx = remaining.indexOf('$');

        if (inlineIdx === -1) {
            segments.push({ type: 'text', content: remaining, display: false });
            break;
        }

        const firstDelim = displayIdx !== -1 && displayIdx <= inlineIdx ? displayIdx : inlineIdx;
        if (firstDelim > 0) {
            segments.push({
                type: 'text',
                content: remaining.slice(0, firstDelim),
                display: false,
            });
            remaining = remaining.slice(firstDelim);
            continue;
        }

        if (displayIdx === 0) {
            const closingIdx = remaining.indexOf('$$', 2);
            if (closingIdx === -1) {
                segments.push({ type: 'text', content: '$$', display: false });
                remaining = remaining.slice(2);
            } else {
                segments.push({
                    type: 'math',
                    content: remaining.slice(2, closingIdx),
                    display: true,
                });
                remaining = remaining.slice(closingIdx + 2);
            }
        } else {
            const closingIdx = remaining.indexOf('$', 1);
            if (closingIdx === -1) {
                segments.push({ type: 'text', content: '$', display: false });
                remaining = remaining.slice(1);
            } else {
                segments.push({
                    type: 'math',
                    content: remaining.slice(1, closingIdx),
                    display: false,
                });
                remaining = remaining.slice(closingIdx + 1);
            }
        }
    }

    return segments;
}

/** True if the geometry has nothing renderable. */
function isEmptyGeom(g: MathGeometry): boolean {
    return g.glyphs.length === 0 && g.rects.length === 0;
}

/**
 * Lay out a mixed text/math string into positioned segments.
 *
 * @param text     The full FidoCad text-primitive string.
 * @param emPx     Size of one em, in the same units `measure` returns; math
 *                 advance is `widthEm * emPx`.
 * @param measure  Backend-specific text width measurement.
 */
export function layoutMath(
    text: string,
    emPx: number,
    measure: (s: string) => number,
): MathLayoutResult {
    const segments: LaidOutSegment[] = [];
    let x = 0;
    let hasMath = false;

    for (const seg of splitMathSegments(text)) {
        if (seg.type === 'text') {
            if (!seg.content) continue;
            const width = measure(seg.content);
            segments.push({ kind: 'text', x, width, text: seg.content });
            x += width;
            continue;
        }

        const geom = tex2mathgeom(seg.content, { display: seg.display });
        if (geom.error || isEmptyGeom(geom)) {
            // Fall back to the literal source, delimiters included.
            const literal = seg.display ? `$$${seg.content}$$` : `$${seg.content}$`;
            const width = measure(literal);
            segments.push({ kind: 'text', x, width, text: literal });
            x += width;
        } else {
            hasMath = true;
            const width = geom.widthEm * emPx;
            segments.push({ kind: 'math', x, width, geom });
            x += width;
        }
    }

    return { segments, totalWidth: x, hasMath };
}

/** Does this string contain any math delimiter at all? Cheap pre-check. */
export function hasMathDelimiter(text: string): boolean {
    return text.includes('$');
}
