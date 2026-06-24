import type { MapCoordinates } from '../geom/MapCoordinates.js';

/** One FidoCadJ logical unit expressed in millimetres (127 microns). */
const MM_PER_UNIT = 0.127;

export class Ruler {
    // Begin and end coordinates, in canvas device pixels.
    private startX = 0;
    private startY = 0;
    private endX = 0;
    private endY = 0;

    private active = false;

    /** Enable or disable drawing of the ruler. */
    setActive(s: boolean): void {
        this.active = s;
    }

    /** Whether the ruler is currently drawn. */
    isActive(): boolean {
        return this.active;
    }

    /** Set the starting point of the ruler (device pixels). */
    setStart(x: number, y: number): void {
        this.startX = x;
        this.startY = y;
    }

    /** Set the ending point of the ruler (device pixels). */
    setEnd(x: number, y: number): void {
        this.endX = x;
        this.endY = y;
    }

    getStartX(): number {
        return this.startX;
    }
    getStartY(): number {
        return this.startY;
    }

    /**
     * Draw the ruler in screen (device-pixel) space.
     *
     * @param g   the 2D canvas context.
     * @param cs  the coordinate mapping (used for length and tick spacing).
     * @param dpr device-pixel ratio, used to keep text and ticks legible.
     */
    draw(g: CanvasRenderingContext2D, cs: MapCoordinates, dpr = 1): void {
        if (!this.active) {
            return;
        }

        const sx = this.startX;
        const sy = this.startY;
        const ex = this.endX;
        const ey = this.endY;

        // Length is computed in logical units, like FidoCadJ.
        const xa = cs.unmapXnosnap(sx);
        const ya = cs.unmapYnosnap(sy);
        const xb = cs.unmapXnosnap(ex);
        const yb = cs.unmapYnosnap(ey);
        const length = Math.sqrt((xa - xb) * (xa - xb) + (ya - yb) * (ya - yb));

        g.save();
        g.setLineDash([]);
        g.strokeStyle = '#00bb00';
        g.lineWidth = Math.max(1, dpr);
        g.beginPath();
        g.moveTo(sx, sy);
        g.lineTo(ex, ey);
        g.stroke();

        // A little bit of trigonometry :-)
        let alpha: number;
        if (sx === ex) {
            alpha = Math.PI / 2.0 + (ey - sy < 0 ? 0 : Math.PI);
        } else {
            alpha = Math.atan((ey - sy) / (ex - sx));
        }
        alpha += ex - sx > 0 ? 0 : Math.PI;

        // Tick spacing (in logical units) depends on the zoom magnitude.
        const xmag = cs.getXMagnitude();
        let l: number;
        if (xmag < 1.0) {
            l = 10;
        } else if (xmag > 5.0) {
            l = 1;
        } else {
            l = 5;
        }

        const ld = 5.0 * dpr;
        const m = 5;
        let j = 0;
        let debut = true;

        const dex = sx + length * Math.cos(alpha) * xmag;
        const dey = sy + length * Math.sin(alpha) * cs.getYMagnitude();

        alpha += Math.PI / 2.0;

        // Draw the ticks (major every m minor ones).
        g.beginPath();
        for (let i = 0.0; i <= length; i += l) {
            let ll: number;
            if (j === m || debut) {
                j = 0;
                ll = 2 * ld;
                debut = false;
            } else {
                ll = ld;
            }
            ++j;
            const x = (dex * i) / length + (sx * (length - i)) / length;
            const y = (dey * i) / length + (sy * (length - i)) / length;

            const x1 = x - ll * Math.cos(alpha);
            const x2 = x + ll * Math.cos(alpha);
            const y1 = y - ll * Math.sin(alpha);
            const y2 = y + ll * Math.sin(alpha);

            g.moveTo(x1, y1);
            g.lineTo(x2, y2);
        }
        g.stroke();

        // Measurement labels: logical units and millimetres.
        const t1 = length.toFixed(2);
        const t2 = `${(length * MM_PER_UNIT).toFixed(2)} mm`;

        const fontPx = 10 * dpr;
        g.font = `${fontPx}px "Lucida Sans", "Segoe UI", sans-serif`;
        const boxW = Math.max(g.measureText(t1).width, g.measureText(t2).width) + 1 * dpr;
        const boxH = 24 * dpr;
        const bx = ex + 10 * dpr;

        g.fillStyle = '#ffffff';
        g.fillRect(bx, ey, boxW, boxH);
        g.strokeStyle = '#00bb00';
        g.lineWidth = Math.max(1, dpr);
        g.strokeRect(ex + 9 * dpr, ey - 1 * dpr, boxW + 2 * dpr, boxH + 1 * dpr);

        g.fillStyle = '#000000';
        g.textBaseline = 'alphabetic';
        g.fillText(t1, bx, ey + 10 * dpr);
        g.fillText(t2, bx, ey + 20 * dpr);

        g.restore();
    }
}
