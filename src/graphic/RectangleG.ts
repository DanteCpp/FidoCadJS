export class RectangleG {
    x: number;
    y: number;
    width: number;
    height: number;

    constructor(x = 0, y = 0, width = 0, height = 0) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    getX(): number { return this.x; }
    getY(): number { return this.y; }
    getWidth(): number { return this.width; }
    getHeight(): number { return this.height; }

    contains(px: number, py: number): boolean {
        return px >= this.x && px <= this.x + this.width
            && py >= this.y && py <= this.y + this.height;
    }

    intersects(other: RectangleG): boolean {
        return other.x < this.x + this.width
            && other.x + other.width > this.x
            && other.y < this.y + this.height
            && other.y + other.height > this.y;
    }

    intersectsLine(x1: number, y1: number, x2: number, y2: number): boolean {
        const { x, y, width, height } = this;
        return this._lineXline(x1, y1, x2, y2, x, y, x + width, y)
            || this._lineXline(x1, y1, x2, y2, x, y, x, y + height)
            || this._lineXline(x1, y1, x2, y2, x + width, y, x + width, y + height)
            || this._lineXline(x1, y1, x2, y2, x, y + height, x + width, y + height);
    }

    private _dir(px: number, py: number, qx: number, qy: number, rx: number, ry: number): number {
        const val = (qy - py) * (rx - qx) - (qx - px) * (ry - qy);
        return val === 0 ? 0 : val > 0 ? 1 : 2;
    }

    private _onSeg(px: number, py: number, qx: number, qy: number, rx: number, ry: number): boolean {
        return rx >= Math.min(px, qx) && rx <= Math.max(px, qx)
            && ry >= Math.min(py, qy) && ry <= Math.max(py, qy);
    }

    private _lineXline(x1: number, y1: number, x2: number, y2: number,
        x3: number, y3: number, x4: number, y4: number): boolean {
        const d1 = this._dir(x3, y3, x4, y4, x1, y1);
        const d2 = this._dir(x3, y3, x4, y4, x2, y2);
        const d3 = this._dir(x1, y1, x2, y2, x3, y3);
        const d4 = this._dir(x1, y1, x2, y2, x4, y4);
        if (d1 !== d2 && d3 !== d4) return true;
        if (d1 === 0 && this._onSeg(x3, y3, x4, y4, x1, y1)) return true;
        if (d2 === 0 && this._onSeg(x3, y3, x4, y4, x2, y2)) return true;
        if (d3 === 0 && this._onSeg(x1, y1, x2, y2, x3, y3)) return true;
        if (d4 === 0 && this._onSeg(x1, y1, x2, y2, x4, y4)) return true;
        return false;
    }
}
