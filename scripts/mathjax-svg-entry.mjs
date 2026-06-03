/*
 * mathjax-svg-entry.mjs
 * Author: Dante Loi
 * Date: 2026-06-03
 * Description: Bundle entry that wraps MathJax (mathjax-full) SVG output with a
 *   DOM-free liteAdaptor and exposes two functions:
 *     - tex2mathgeom(latex, opts): flattened glyph-path geometry in MathJax
 *       native units (1000 per em), y-down with the baseline at y=0, ready for
 *       a consumer to place with translate(penX, baseline) + scale(size/1000).
 *     - tex2svg(latex, opts): the raw self-contained MathJax SVG string.
 *   esbuild bundles this into src/vendor/mathjax/mathjax.mjs. The source lives
 *   here (version-controlled); the .mjs is generated, like katex.mjs.
 * Copyright: (c) 2026 Dante Loi - GPL v3 (wraps MathJax, Apache-2.0)
 */

import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
// Rethrow TeX parse errors instead of rendering an merror node, so callers can
// fall back to literal-text rendering on malformed input.
const texInput = new TeX({
    packages: AllPackages,
    formatError: (_jax, err) => {
        throw err;
    },
});
// fontCache:'none' emits each glyph as a plain <path> (no <use>/<defs>),
// so the output is self-contained and trivial to flatten.
const svgOutput = new SVG({ fontCache: 'none' });
const doc = mathjax.document('', { InputJax: texInput, OutputJax: svgOutput });

/** MathJax internal units per em. */
const UNITS_PER_EM = 1000;

/** Multiply two affine matrices [a,b,c,d,e,f] (SVG convention). */
function mul(x, y) {
    return [
        x[0] * y[0] + x[2] * y[1],
        x[1] * y[0] + x[3] * y[1],
        x[0] * y[2] + x[2] * y[3],
        x[1] * y[2] + x[3] * y[3],
        x[0] * y[4] + x[2] * y[5] + x[4],
        x[1] * y[4] + x[3] * y[5] + x[5],
    ];
}

/** Parse an SVG transform attribute into an affine matrix. */
function parseTransform(s) {
    let m = [1, 0, 0, 1, 0, 0];
    if (!s) return m;
    const re = /(translate|scale|matrix)\(([^)]*)\)/g;
    let g;
    while ((g = re.exec(s))) {
        const n = g[2].split(/[\s,]+/).filter((v) => v.length).map(Number);
        if (g[1] === 'translate') m = mul(m, [1, 0, 0, 1, n[0] || 0, n[1] || 0]);
        else if (g[1] === 'scale') m = mul(m, [n[0], 0, 0, n.length > 1 ? n[1] : n[0], 0, 0]);
        else if (g[1] === 'matrix') m = mul(m, n);
    }
    return m;
}

function getSvgNode(latex, display) {
    const node = doc.convert(latex, { display: !!display });
    return adaptor.childNodes(node)[0];
}

/**
 * Render LaTeX to flattened glyph geometry.
 * @param {string} latex  Math source (no surrounding $ delimiters).
 * @param {{display?: boolean}} [opts]
 * @returns {{widthEm:number,heightEm:number,depthEm:number,unitsPerEm:number,
 *            glyphs:{d:string,m:number[]}[],rects:{x:number,y:number,w:number,h:number,m:number[]}[],
 *            error?:string}}
 */
export function tex2mathgeom(latex, opts) {
    const display = opts && opts.display;
    try {
        const svgNode = getSvgNode(latex, display);
        const vb = (adaptor.getAttribute(svgNode, 'viewBox') || '0 0 0 0')
            .split(/\s+/)
            .map(Number);
        const glyphs = [];
        const rects = [];
        const walk = (n, m) => {
            const t = adaptor.getAttribute(n, 'transform');
            const cm = t ? mul(m, parseTransform(t)) : m;
            const kind = adaptor.kind(n);
            if (kind === 'path') {
                const d = adaptor.getAttribute(n, 'd');
                if (d) glyphs.push({ d, m: cm });
            } else if (kind === 'rect') {
                rects.push({
                    x: +adaptor.getAttribute(n, 'x') || 0,
                    y: +adaptor.getAttribute(n, 'y') || 0,
                    w: +adaptor.getAttribute(n, 'width') || 0,
                    h: +adaptor.getAttribute(n, 'height') || 0,
                    m: cm,
                });
            }
            for (const c of adaptor.childNodes(n) || []) {
                if (adaptor.kind(c) !== '#text') walk(c, cm);
            }
        };
        walk(svgNode, [1, 0, 0, 1, 0, 0]);
        const [, minY, w, h] = vb;
        return {
            widthEm: w / UNITS_PER_EM,
            heightEm: -minY / UNITS_PER_EM,
            depthEm: (minY + h) / UNITS_PER_EM,
            unitsPerEm: UNITS_PER_EM,
            glyphs,
            rects,
        };
    } catch (e) {
        return {
            widthEm: 0,
            heightEm: 0,
            depthEm: 0,
            unitsPerEm: UNITS_PER_EM,
            glyphs: [],
            rects: [],
            error: String((e && e.message) || e),
        };
    }
}

/**
 * Render LaTeX to a self-contained SVG string.
 * @param {string} latex
 * @param {{display?: boolean}} [opts]
 * @returns {string}
 */
export function tex2svg(latex, opts) {
    const svgNode = getSvgNode(latex, opts && opts.display);
    return adaptor.outerHTML(svgNode);
}
