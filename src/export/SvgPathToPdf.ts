/** Tokenise a path `d` string into command letters and numbers. */
function tokenize(d: string): Array<string | number> {
    const out: Array<string | number> = [];
    const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:[eE][-+]?\d+)?)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(d)) !== null) {
        out.push(m[1] !== undefined ? m[1] : parseFloat(m[2]!));
    }
    return out;
}

/**
 * Convert an SVG path to PDF path operators.
 * @param d    The SVG path data.
 * @param fmt  Number formatter (trims decimals) shared with the exporter.
 * @returns A newline-joined string of PDF path operators (no fill/stroke op).
 */
export function svgPathToPdfOps(d: string, fmt: (v: number) => string): string {
    const t = tokenize(d);
    const ops: string[] = [];
    let i = 0;
    let cx = 0,
        cy = 0; // current point
    let sx = 0,
        sy = 0; // subpath start
    // Reflection control points for S/T smoothing.
    let lastCubicCx = 0,
        lastCubicCy = 0;
    let lastQuadCx = 0,
        lastQuadCy = 0;
    let prevCmd = '';

    const num = () => t[i++] as number;
    const moveTo = (x: number, y: number) => ops.push(`${fmt(x)} ${fmt(y)} m`);
    const lineTo = (x: number, y: number) => ops.push(`${fmt(x)} ${fmt(y)} l`);
    const curveTo = (x1: number, y1: number, x2: number, y2: number, x: number, y: number) =>
        ops.push(`${fmt(x1)} ${fmt(y1)} ${fmt(x2)} ${fmt(y2)} ${fmt(x)} ${fmt(y)} c`);

    // Quadratic (control qx,qy; end ex,ey) → cubic from the current point.
    const quadTo = (qx: number, qy: number, ex: number, ey: number) => {
        const c1x = cx + (2 / 3) * (qx - cx);
        const c1y = cy + (2 / 3) * (qy - cy);
        const c2x = ex + (2 / 3) * (qx - ex);
        const c2y = ey + (2 / 3) * (qy - ey);
        curveTo(c1x, c1y, c2x, c2y, ex, ey);
        lastQuadCx = qx;
        lastQuadCy = qy;
    };

    while (i < t.length) {
        const cmd = t[i] as string;
        if (typeof cmd !== 'string') break; // malformed
        i++;
        const rel = cmd === cmd.toLowerCase();
        const C = cmd.toUpperCase();

        switch (C) {
            case 'M': {
                let x = num(),
                    y = num();
                if (rel) {
                    x += cx;
                    y += cy;
                }
                moveTo(x, y);
                cx = sx = x;
                cy = sy = y;
                // Subsequent pairs are implicit lineTos.
                while (i < t.length && typeof t[i] === 'number') {
                    let lx = num(),
                        ly = num();
                    if (rel) {
                        lx += cx;
                        ly += cy;
                    }
                    lineTo(lx, ly);
                    cx = lx;
                    cy = ly;
                }
                break;
            }
            case 'L': {
                while (i < t.length && typeof t[i] === 'number') {
                    let x = num(),
                        y = num();
                    if (rel) {
                        x += cx;
                        y += cy;
                    }
                    lineTo(x, y);
                    cx = x;
                    cy = y;
                }
                break;
            }
            case 'H': {
                while (i < t.length && typeof t[i] === 'number') {
                    let x = num();
                    if (rel) x += cx;
                    lineTo(x, cy);
                    cx = x;
                }
                break;
            }
            case 'V': {
                while (i < t.length && typeof t[i] === 'number') {
                    let y = num();
                    if (rel) y += cy;
                    lineTo(cx, y);
                    cy = y;
                }
                break;
            }
            case 'C': {
                while (i < t.length && typeof t[i] === 'number') {
                    let x1 = num(),
                        y1 = num(),
                        x2 = num(),
                        y2 = num(),
                        x = num(),
                        y = num();
                    if (rel) {
                        x1 += cx;
                        y1 += cy;
                        x2 += cx;
                        y2 += cy;
                        x += cx;
                        y += cy;
                    }
                    curveTo(x1, y1, x2, y2, x, y);
                    lastCubicCx = x2;
                    lastCubicCy = y2;
                    cx = x;
                    cy = y;
                }
                break;
            }
            case 'S': {
                while (i < t.length && typeof t[i] === 'number') {
                    let x2 = num(),
                        y2 = num(),
                        x = num(),
                        y = num();
                    if (rel) {
                        x2 += cx;
                        y2 += cy;
                        x += cx;
                        y += cy;
                    }
                    const reflect = prevCmd === 'C' || prevCmd === 'S';
                    const x1 = reflect ? 2 * cx - lastCubicCx : cx;
                    const y1 = reflect ? 2 * cy - lastCubicCy : cy;
                    curveTo(x1, y1, x2, y2, x, y);
                    lastCubicCx = x2;
                    lastCubicCy = y2;
                    cx = x;
                    cy = y;
                    prevCmd = 'S';
                }
                break;
            }
            case 'Q': {
                while (i < t.length && typeof t[i] === 'number') {
                    let qx = num(),
                        qy = num(),
                        x = num(),
                        y = num();
                    if (rel) {
                        qx += cx;
                        qy += cy;
                        x += cx;
                        y += cy;
                    }
                    quadTo(qx, qy, x, y);
                    cx = x;
                    cy = y;
                    prevCmd = 'Q';
                }
                break;
            }
            case 'T': {
                while (i < t.length && typeof t[i] === 'number') {
                    let x = num(),
                        y = num();
                    if (rel) {
                        x += cx;
                        y += cy;
                    }
                    const reflect = prevCmd === 'Q' || prevCmd === 'T';
                    const qx = reflect ? 2 * cx - lastQuadCx : cx;
                    const qy = reflect ? 2 * cy - lastQuadCy : cy;
                    quadTo(qx, qy, x, y);
                    cx = x;
                    cy = y;
                    prevCmd = 'T';
                }
                break;
            }
            case 'Z': {
                ops.push('h');
                cx = sx;
                cy = sy;
                break;
            }
            case 'A': {
                // Arcs do not occur in MathJax glyph outlines; approximate by a
                // line to the endpoint so output stays well-formed if one appears.
                while (i < t.length && typeof t[i] === 'number') {
                    num(); // rx
                    num(); // ry
                    num(); // x-axis-rotation
                    num(); // large-arc
                    num(); // sweep
                    let x = num(),
                        y = num();
                    if (rel) {
                        x += cx;
                        y += cy;
                    }
                    lineTo(x, y);
                    cx = x;
                    cy = y;
                }
                break;
            }
            default:
                break;
        }
        if (C !== 'S' && C !== 'Q' && C !== 'T') prevCmd = C;
    }

    return ops.join('\n');
}
