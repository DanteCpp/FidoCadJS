import type { RectangleG } from './RectangleG.js';

export interface ShapeInterface {
    getBounds(): RectangleG;
    createCubicCurve(x0: number, y0: number, x1: number, y1: number,
        x2: number, y2: number, x3: number, y3: number): void;
    createGeneralPath(npoints: number): void;
    moveTo(x: number, y: number): void;
    curveTo(x0: number, y0: number, x1: number, y1: number,
        x2: number, y2: number): void;
    closePath(): void;
}
