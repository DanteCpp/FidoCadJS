/**
 * @file ColorCanvas.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief HTML Canvas colour implementation
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import type { ColorInterface } from '../ColorInterface.js';

export class ColorCanvas implements ColorInterface {
    private r: number;
    private g: number;
    private b: number;

    constructor(r = 0, g = 0, b = 0) {
        this.r = r & 0xff;
        this.g = g & 0xff;
        this.b = b & 0xff;
    }

    static fromRGB(rgb: number): ColorCanvas {
        const c = new ColorCanvas();
        c.setRGB(rgb);
        return c;
    }

    white(): ColorInterface {
        return new ColorCanvas(255, 255, 255);
    }
    gray(): ColorInterface {
        return new ColorCanvas(128, 128, 128);
    }
    green(): ColorInterface {
        return new ColorCanvas(0, 255, 0);
    }
    red(): ColorInterface {
        return new ColorCanvas(255, 0, 0);
    }
    black(): ColorInterface {
        return new ColorCanvas(0, 0, 0);
    }

    getRed(): number {
        return this.r;
    }
    getGreen(): number {
        return this.g;
    }
    getBlue(): number {
        return this.b;
    }

    getRGB(): number {
        // Return 24-bit RGB (no alpha) to keep the value positive
        // and round-trippable through setRGB / toString(16).
        return ((this.r << 16) | (this.g << 8) | this.b) >>> 0;
    }

    setRGB(rgb: number): void {
        this.r = (rgb >>> 16) & 0xff;
        this.g = (rgb >>> 8) & 0xff;
        this.b = rgb & 0xff;
    }

    toCSSColor(): string {
        return `rgb(${this.r},${this.g},${this.b})`;
    }
}
