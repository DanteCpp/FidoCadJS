import type { MapCoordinates } from '../geom/MapCoordinates.js';

export class ImageAsCanvas {
    private imageData: HTMLImageElement | null = null;
    private x: number = 0;
    private y: number = 0;
    private alpha: number = 1.0;

    getImage(): HTMLImageElement | null { return this.imageData; }
    setImage(img: HTMLImageElement | null): void { this.imageData = img; }
    getX(): number { return this.x; }
    getY(): number { return this.y; }
    setX(v: number): void { this.x = v; }
    setY(v: number): void { this.y = v; }
    getAlpha(): number { return this.alpha; }
    setAlpha(v: number): void { this.alpha = v; }

    trackExtremePoints(cs: MapCoordinates): void {
        if (this.imageData) {
            cs.trackPoint(this.x, this.y);
            cs.trackPoint(this.x + this.imageData.width, this.y + this.imageData.height);
        }
    }
}
