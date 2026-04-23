import type { ColorInterface } from '../ColorInterface.js';

export class ColorCanvas implements ColorInterface {
    private r: number;
    private g: number;
    private b: number;

    constructor(r = 0, g = 0, b = 0) {
        this.r = r & 0xFF;
        this.g = g & 0xFF;
        this.b = b & 0xFF;
    }

    static fromRGB(rgb: number): ColorCanvas {
        const c = new ColorCanvas();
        c.setRGB(rgb);
        return c;
    }

    white(): ColorInterface { return new ColorCanvas(255, 255, 255); }
    gray(): ColorInterface { return new ColorCanvas(128, 128, 128); }
    green(): ColorInterface { return new ColorCanvas(0, 255, 0); }
    red(): ColorInterface { return new ColorCanvas(255, 0, 0); }
    black(): ColorInterface { return new ColorCanvas(0, 0, 0); }

    getRed(): number { return this.r; }
    getGreen(): number { return this.g; }
    getBlue(): number { return this.b; }

    getRGB(): number {
        return ((0xFF << 24) | (this.r << 16) | (this.g << 8) | this.b) | 0;
    }

    setRGB(rgb: number): void {
        this.r = (rgb >>> 16) & 0xFF;
        this.g = (rgb >>> 8) & 0xFF;
        this.b = rgb & 0xFF;
    }

    toCSSColor(): string {
        return `rgb(${this.r},${this.g},${this.b})`;
    }
}
