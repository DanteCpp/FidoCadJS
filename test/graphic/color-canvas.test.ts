import { describe, it, expect } from 'vitest';
import { ColorCanvas } from '../../src/graphic/canvas/ColorCanvas.js';

describe('ColorCanvas.getRGB', () => {
    it('returns a non-negative integer', () => {
        const c = new ColorCanvas(255, 0, 0);
        expect(c.getRGB()).toBeGreaterThanOrEqual(0);
    });

    it('round-trips through setRGB', () => {
        const original = new ColorCanvas(100, 150, 200);
        const rgb = original.getRGB();
        const restored = ColorCanvas.fromRGB(rgb);
        expect(restored.getRed()).toBe(100);
        expect(restored.getGreen()).toBe(150);
        expect(restored.getBlue()).toBe(200);
    });

    it('toString(16) produces valid 6-digit hex', () => {
        const c = new ColorCanvas(0, 0, 0);
        const hex = c.getRGB().toString(16).padStart(6, '0');
        expect(hex).toBe('000000');
        expect(hex.length).toBe(6);
    });

    it('red (255,0,0) produces #ff0000', () => {
        const c = new ColorCanvas(255, 0, 0);
        const hex = '#' + c.getRGB().toString(16).padStart(6, '0');
        expect(hex).toBe('#ff0000');
    });

    it('white (255,255,255) produces #ffffff', () => {
        const c = new ColorCanvas(255, 255, 255);
        const hex = '#' + c.getRGB().toString(16).padStart(6, '0');
        expect(hex).toBe('#ffffff');
    });

    it('navy (0,0,128) produces #000080', () => {
        const c = new ColorCanvas(0, 0, 128);
        const hex = '#' + c.getRGB().toString(16).padStart(6, '0');
        expect(hex).toBe('#000080');
    });

    it('all standard layer colors produce valid 6-digit hex', () => {
        // These are the 16 layer colors from StandardLayers.
        const layerColors: [number, number, number][] = [
            [0, 0, 0], // 0  Circuit (black)
            [0, 0, 128], // 1  Bottom copper (navy)
            [255, 0, 0], // 2  Top copper (red)
            [0, 128, 128], // 3  Silkscreen (teal)
            [255, 200, 0], // 4  Other 1 (orange)
            [127, 255, 0], // 5  Other 2 (chartreuse)
            [0, 255, 255], // 6  Other 3 (cyan)
            [0, 128, 0], // 7  Other 4 (dark green)
            [154, 205, 50], // 8  Other 5 (yellow-green)
            [255, 20, 147], // 9  Other 6 (deep pink)
            [181, 155, 12], // 10 Other 7 (olive)
            [1, 128, 255], // 11 Other 8 (medium blue)
            [225, 225, 225], // 12 Other 9 (light gray)
            [162, 162, 162], // 13 Other 10 (medium gray)
            [95, 95, 95], // 14 Other 11 (dark gray)
            [0, 0, 0], // 15 Other 12 (black)
        ];

        for (const [r, g, b] of layerColors) {
            const c = new ColorCanvas(r, g, b);
            const rgb = c.getRGB();
            expect(rgb).toBeGreaterThanOrEqual(0);
            expect(rgb).toBeLessThanOrEqual(0xffffff);

            const hex = rgb.toString(16).padStart(6, '0');
            expect(hex.length).toBe(6);
            expect(hex).toMatch(/^[0-9a-f]{6}$/);
        }
    });

    it('fromRGB + getRGB is idempotent', () => {
        const c1 = ColorCanvas.fromRGB(0x123456);
        expect(c1.getRed()).toBe(0x12);
        expect(c1.getGreen()).toBe(0x34);
        expect(c1.getBlue()).toBe(0x56);

        const c2 = ColorCanvas.fromRGB(c1.getRGB());
        expect(c2.getRed()).toBe(0x12);
        expect(c2.getGreen()).toBe(0x34);
        expect(c2.getBlue()).toBe(0x56);
    });
});
