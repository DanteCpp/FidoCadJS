import type { ShapeInterface } from '../ShapeInterface.js';
import { RectangleG } from '../RectangleG.js';

export class ShapeCanvas implements ShapeInterface {
    private path: Path2D;
    private bounds: RectangleG | null = null;

    constructor() {
        this.path = new Path2D();
    }

    getPath(): Path2D { return this.path; }

    moveTo(x: number, y: number): void {
        this.path.moveTo(x, y);
        this.updateBounds(x, y);
    }

    curveTo(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number): void {
        // Cubic Bezier curve from current position through two control points to endpoint
        this.path.bezierCurveTo(x0, y0, x1, y1, x2, y2);
        this.updateBounds(x0, y0);
        this.updateBounds(x1, y1);
        this.updateBounds(x2, y2);
    }

    createCubicCurve(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
        // Cubic curve: start at (x0,y0), control points at (x1,y1) and (x2,y2), end at (x3,y3)
        this.path.moveTo(x0, y0);
        this.path.bezierCurveTo(x1, y1, x2, y2, x3, y3);
        this.updateBounds(x0, y0);
        this.updateBounds(x1, y1);
        this.updateBounds(x2, y2);
        this.updateBounds(x3, y3);
    }

    createGeneralPath(_npoints: number): void {
        // Path2D already initialized in constructor
    }

    closePath(): void {
        this.path.closePath();
    }

    reset(): void {
        this.path = new Path2D();
        this.bounds = null;
    }

    private updateBounds(x: number, y: number): void {
        if (!this.bounds) {
            this.bounds = new RectangleG(x, y, 0, 0);
            return;
        }
        const minX = Math.min(this.bounds.x, x);
        const maxX = Math.max(this.bounds.x + this.bounds.width, x);
        const minY = Math.min(this.bounds.y, y);
        const maxY = Math.max(this.bounds.y + this.bounds.height, y);
        this.bounds.x = minX;
        this.bounds.y = minY;
        this.bounds.width = maxX - minX;
        this.bounds.height = maxY - minY;
    }

    getBounds(): RectangleG {
        return this.bounds ?? new RectangleG();
    }
}
