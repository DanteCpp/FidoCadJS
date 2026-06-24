export const MIN_DISTANCE = 100;
export const MAX_BEZIER_SEGMENTS = 10;

export function pointToPoint(xa: number, ya: number, xb: number, yb: number): number {
    if (Math.abs(xa - xb) < MIN_DISTANCE || Math.abs(ya - yb) < MIN_DISTANCE) {
        return Math.sqrt((xa - xb) ** 2 + (ya - yb) ** 2);
    }
    return MIN_DISTANCE;
}

export function pointToSegment(
    xa: number,
    ya: number,
    xb: number,
    yb: number,
    x: number,
    y: number,
): number {
    const xmin = Math.min(xa, xb);
    const xmax = Math.max(xa, xb);
    if (x < xmin - MIN_DISTANCE || x > xmax + MIN_DISTANCE) return MIN_DISTANCE;
    const ymin = Math.min(ya, yb);
    const ymax = Math.max(ya, yb);
    if (y < ymin - MIN_DISTANCE || y > ymax + MIN_DISTANCE) return MIN_DISTANCE;

    let dx = xb - xa;
    let dy = yb - ya;
    if (dx === 0 && dy === 0) {
        return Math.sqrt((x - xa) ** 2 + (y - ya) ** 2);
    }
    const t = ((x - xa) * dx + (y - ya) * dy) / (dx * dx + dy * dy);
    if (t < 0) {
        dx = x - xa;
        dy = y - ya;
    } else if (t > 1) {
        dx = x - xb;
        dy = y - yb;
    } else {
        dx = x - (xa + t * dx);
        dy = y - (ya + t * dy);
    }
    return Math.sqrt(dx * dx + dy * dy);
}

export function pointInPolygon(
    xp: number[],
    yp: number[],
    npol: number,
    x: number,
    y: number,
): boolean {
    let c = false;
    for (let i = 0, j = npol - 1; i < npol; j = i++) {
        if (
            ((yp[i] <= y && y < yp[j]) || (yp[j] <= y && y < yp[i])) &&
            x < ((xp[j] - xp[i]) * (y - yp[i])) / (yp[j] - yp[i]) + xp[i]
        ) {
            c = !c;
        }
    }
    return c;
}

export function pointInEllipse(
    ex: number,
    ey: number,
    w: number,
    h: number,
    px: number,
    py: number,
): boolean {
    const dx = Math.abs(px - (ex + w / 2));
    const dy = Math.abs(py - (ey + h / 2));
    if (dx > w / 2 || dy > h / 2) return false;
    return (4 * dx * dx) / w / w + (4 * dy * dy) / h / h < 1;
}

export function pointToEllipse(
    ex: number,
    ey: number,
    w: number,
    h: number,
    px: number,
    py: number,
): number {
    const dx = Math.abs(px - (ex + w / 2));
    const dy = Math.abs(py - (ey + h / 2));
    if (w === 0) return pointToSegment(ex, ey, ex, ey + h, px, py);
    if (h === 0) return pointToSegment(ex, ey, ex + w, ey, px, py);
    const l = ((dx * dx) / w / w + (dy * dy) / h / h) * 4;
    return (Math.abs(l - 1) * Math.min(w, h)) / 4;
}

export function pointInRectangle(
    ex: number,
    ey: number,
    w: number,
    h: number,
    px: number,
    py: number,
): boolean {
    return !(ex > px || px > ex + w || ey > py || py > ey + h);
}

export function pointToRectangle(
    ex: number,
    ey: number,
    w: number,
    h: number,
    px: number,
    py: number,
): number {
    const d1 = pointToSegment(ex, ey, ex + w, ey, px, py);
    const d2 = pointToSegment(ex + w, ey, ex + w, ey + h, px, py);
    const d3 = pointToSegment(ex + w, ey + h, ex, ey + h, px, py);
    const d4 = pointToSegment(ex, ey + h, ex, ey, px, py);
    return Math.min(Math.min(d1, d2), Math.min(d3, d4));
}

export function pointToBezier(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    x4: number,
    y4: number,
    px: number,
    py: number,
): number {
    let distance = Number.MAX_SAFE_INTEGER;
    const xs = new Array<number>(MAX_BEZIER_SEGMENTS + 1);
    const ys = new Array<number>(MAX_BEZIER_SEGMENTS + 1);
    for (let i = 0; i <= MAX_BEZIER_SEGMENTS; i++) {
        const u = i / MAX_BEZIER_SEGMENTS;
        const umu = 1 - u;
        const b03 = umu * umu * umu;
        const b13 = 3 * u * umu * umu;
        const b23 = 3 * u * u * umu;
        const b33 = u * u * u;
        xs[i] = Math.round(x1 * b03 + x2 * b13 + x3 * b23 + x4 * b33);
        ys[i] = Math.round(y1 * b03 + y2 * b13 + y3 * b23 + y4 * b33);
    }
    for (let j = 0; j < MAX_BEZIER_SEGMENTS; j++) {
        distance = Math.min(distance, pointToSegment(xs[j], ys[j], xs[j + 1], ys[j + 1], px, py));
    }
    return distance;
}
