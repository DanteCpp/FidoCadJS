import type { PolygonInterface } from '../PolygonInterface.js';
import type { PointG } from '../PointG.js';
import { RectangleG } from '../RectangleG.js';

export class PolygonCanvas implements PolygonInterface {
    private xpoints: number[] = [];
    private ypoints: number[] = [];

    addPoint(x: number, y: number): void {
        this.xpoints.push(x);
        this.ypoints.push(y);
    }

    addPointG(p: PointG): void {
        this.addPoint(p.x, p.y);
    }

    reset(): void {
        this.xpoints = [];
        this.ypoints = [];
    }

    getNpoints(): number { return this.xpoints.length; }
    getXpoints(): number[] { return this.xpoints; }
    getYpoints(): number[] { return this.ypoints; }

    contains(x: number, y: number): boolean {
        if (this.xpoints.length < 3) return false;
        let inside = false;
        for (let i = 0, j = this.xpoints.length - 1; i < this.xpoints.length; j = i++) {
            const xi = this.xpoints[i]!, yi = this.ypoints[i]!;
            const xj = this.xpoints[j]!, yj = this.ypoints[j]!;
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }

    toPath2D(): Path2D {
        const path = new Path2D();
        if (this.xpoints.length === 0) return path;
        path.moveTo(this.xpoints[0]!, this.ypoints[0]!);
        for (let i = 1; i < this.xpoints.length; i++) {
            path.lineTo(this.xpoints[i]!, this.ypoints[i]!);
        }
        path.closePath();
        return path;
    }

    getBounds(): RectangleG {
        if (this.xpoints.length === 0) return new RectangleG();
        let minX = this.xpoints[0]!;
        let minY = this.ypoints[0]!;
        let maxX = minX;
        let maxY = minY;
        for (let i = 1; i < this.xpoints.length; i++) {
            minX = Math.min(minX, this.xpoints[i]!);
            minY = Math.min(minY, this.ypoints[i]!);
            maxX = Math.max(maxX, this.xpoints[i]!);
            maxY = Math.max(maxY, this.ypoints[i]!);
        }
        return new RectangleG(minX, minY, maxX - minX, maxY - minY);
    }
}
