/**
 * @file mathjax-shim.ts
 * @author Dante Loi
 * @date 2026-06-03
 * @brief Typed wrapper around the vendored MathJax SVG engine.
 *        Isolates the untyped bundle so the rest of the codebase has full TS
 *        types. The bundle (src/vendor/mathjax/mathjax.mjs) is generated from
 *        scripts/mathjax-svg-entry.mjs by scripts/vendor-mathjax.sh.
 * @copyright Copyright 2026 Dante Loi - GPL v3 (wraps MathJax, Apache-2.0)
 */

// Vendored JS bundle — no types available, suppressed inline.
// @ts-expect-error untyped vendored module
import { tex2mathgeom as _tex2mathgeom, tex2svg as _tex2svg } from './mathjax/mathjax.mjs';

/** A single glyph: an SVG path `d` string and its affine placement matrix. */
export interface MathGlyph {
    /** SVG path data, in MathJax native units (see {@link MathGeometry.unitsPerEm}). */
    d: string;
    /** Affine matrix `[a,b,c,d,e,f]` (SVG convention), y-down, baseline at y=0. */
    m: [number, number, number, number, number, number];
}

/** A rule rectangle (fraction bars, roots, etc.). */
export interface MathRect {
    x: number;
    y: number;
    w: number;
    h: number;
    /** Affine matrix `[a,b,c,d,e,f]`, same space as {@link MathGlyph.m}. */
    m: [number, number, number, number, number, number];
}

/**
 * Flattened math geometry. All coordinates are in MathJax native units
 * (`unitsPerEm` per em), y-down, with the text baseline at y = 0. A consumer
 * places it with `translate(penX, baselineY)` then a uniform
 * `scale(fontSizePx / unitsPerEm)`.
 */
export interface MathGeometry {
    /** Advance width, in em. */
    widthEm: number;
    /** Height above the baseline, in em. */
    heightEm: number;
    /** Depth below the baseline, in em. */
    depthEm: number;
    /** Native units per em (1000 for MathJax). */
    unitsPerEm: number;
    glyphs: MathGlyph[];
    rects: MathRect[];
    /** Set when the LaTeX failed to parse; geometry is empty. */
    error?: string;
}

/** Options for rendering LaTeX math. */
export interface MathRenderOptions {
    /** Render in display mode (centered, larger operators). Default: false. */
    display?: boolean;
}

/**
 * Render a LaTeX math expression to flattened glyph-path geometry.
 * @param latex  Math source (without surrounding `$` delimiters).
 * @param options  Rendering options.
 */
export function tex2mathgeom(latex: string, options?: MathRenderOptions): MathGeometry {
    return _tex2mathgeom(latex, options ?? {}) as MathGeometry;
}

/**
 * Render a LaTeX math expression to a self-contained SVG string.
 * @param latex  Math source (without surrounding `$` delimiters).
 * @param options  Rendering options.
 */
export function tex2svg(latex: string, options?: MathRenderOptions): string {
    return _tex2svg(latex, options ?? {}) as string;
}
