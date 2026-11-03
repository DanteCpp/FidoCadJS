import { splitMathSegments } from '../graphic/MathLayout.js';
import { tex2mathgeom } from '../vendor/mathjax-shim.js';

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

/**
 * FidoCad text width (`six`) that maps to the LaTeX document's own font size.
 * New text (TY 4 3) and the default name/value size (3) both use it, so text
 * left at its default size exports exactly as before.
 */
export const LATEX_REFERENCE_TEXT_WIDTH = 3;

/**
 * One line of FidoCad text as LaTeX. `$...$` / `$$...$$` segments that the
 * editor typesets pass through as math; everything else, including math that
 * MathJax rejects (shown literally in the editor), is escaped.
 */
export function latexLine(line: string): string {
    let out = '';
    for (const seg of splitMathSegments(line)) {
        if (seg.type === 'text') {
            out += escapeLatex(seg.content);
            continue;
        }
        const geom = tex2mathgeom(seg.content, { display: seg.display });
        if (geom.error || (geom.glyphs.length === 0 && geom.rects.length === 0)) {
            out += escapeLatex(seg.display ? `$$${seg.content}$$` : `$${seg.content}$`);
        } else if (seg.display) {
            // Node/box text is restricted horizontal mode, where `$$` is an
            // empty formula rather than display math.
            out += '$\\displaystyle ' + seg.content + '$';
        } else {
            out += '$' + seg.content + '$';
        }
    }
    return out;
}

/**
 * Body of a TikZ node / PGF box for a text primitive: escaped text with math
 * kept, "\n" stacked via \shortstack (a box does not break lines on its own),
 * and scaled by the text size relative to LATEX_REFERENCE_TEXT_WIDTH so a
 * larger label, math included, comes out larger. \scalebox comes from
 * graphicx, which pgf already loads.
 */
export function latexTextBody(text: string, sizex: number): string {
    const lines = text.split('\n').map(latexLine);
    const body = lines.length > 1 ? `\\shortstack[l]{${lines.join('\\\\')}}` : lines[0]!;
    const scale = Math.round((sizex / LATEX_REFERENCE_TEXT_WIDTH) * 1000) / 1000;
    if (!Number.isFinite(scale) || scale <= 0 || scale === 1) return body;
    return `\\scalebox{${scale}}{${body}}`;
}
