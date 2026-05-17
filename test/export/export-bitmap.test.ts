/**
 * @file export-bitmap.test.ts
 * @author Dante Loi
 * @date 2026-05-15
 * @brief Unit tests for ExportBitmap — offscreen rendering, DPI/pixel sizing,
 *        B&W post-processing, and split-layers export.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 *
 * Note: jsdom canvas is largely a no-op renderer, so we test dimensions,
 * option plumbing, blob creation, and split-layer counts. Visual fidelity
 * (actual pixel content, B&W threshold) is covered by E2E tests.
 */

import { describe, it, expect, vi } from 'vitest';
import {
    renderToOffscreen,
    renderLayerToOffscreen,
    exportBitmapBlobs,
    canvasToPNGBlob,
    canvasToJPEGBlob,
} from '../../src/export/ExportBitmap.js';
import { defaultBitmapOptions, DPI_PRESETS } from '../../src/export/ExportBitmapOptions.js';

/** Build a minimal drawing model stub. */
function makeModel(primitives: any[] = []): any {
    return {
        getLayers: vi.fn(() => {
            const mkLayer = (desc: string) => ({
                isVisible: () => true,
                getDescription: () => desc,
                getColor: () => ({ r: 0, g: 0, b: 0 }),
            });
            return Array.from({ length: 16 }, (_, i) => mkLayer(`Layer ${i}`));
        }),
        getDrawOnlyLayer: vi.fn(() => -1),
        setDrawOnlyLayer: vi.fn(),
        getDrawOnlyPads: vi.fn(() => false),
        getChanged: vi.fn(() => true),
        setChanged: vi.fn(),
        getPrimitiveVector: vi.fn(() => primitives),
        containsLayer: vi.fn(() => true),
        getImgCanvas: vi.fn(() => ({
            trackExtremePoints: vi.fn(),
            draw: vi.fn(),
            isAttached: () => false,
            getState: () => null,
        })),
    };
}

/** Build a primitive that tracks bounding box via draw(). */
function makeBBoxPrim(x1: number, y1: number, x2: number, y2: number, layer = 0): any {
    return {
        getLayer: () => layer,
        isSelected: () => false,
        draw: vi.fn((_g: any, cs: any) => {
            cs.trackPoint(x1, y1);
            cs.trackPoint(x2, y2);
        }),
        drawHandles: vi.fn(),
        export: vi.fn(),
        setChanged: vi.fn(),
        setDrawOnlyLayer: vi.fn(),
        setDrawOnlyPads: vi.fn(),
        needsHoles: () => false,
        containsLayer: () => true,
    };
}

describe('ExportBitmap', () => {
    describe('renderToOffscreen', () => {
        it('produces a canvas with valid dimensions at 150 DPI', () => {
            const prim = makeBBoxPrim(0, 0, 100, 100);
            const model = makeModel([prim]);

            const opts = defaultBitmapOptions();
            opts.dpi = 150;
            opts.resolutionMode = 'dpi';

            const canvas = renderToOffscreen(model, opts);
            expect(canvas).toBeInstanceOf(HTMLCanvasElement);
            expect(canvas.width).toBeGreaterThan(100);
            expect(canvas.height).toBeGreaterThan(100);
        });

        it('scales proportionally with DPI', () => {
            const prim = makeBBoxPrim(0, 0, 72, 72);
            const model = makeModel([prim]);

            const opts72 = defaultBitmapOptions();
            opts72.dpi = 72;
            const c72 = renderToOffscreen(model, opts72);

            const opts300 = defaultBitmapOptions();
            opts300.dpi = 300;
            const c300 = renderToOffscreen(model, opts300);

            // 300 DPI canvas should be larger than 72 DPI
            expect(c300.width).toBeGreaterThan(c72.width);
            expect(c300.height).toBeGreaterThan(c72.height);
        });

        it('respects pixel mode dimensions (fits within bounds)', () => {
            const prim = makeBBoxPrim(0, 0, 100, 50);
            const model = makeModel([prim]);

            const opts = defaultBitmapOptions();
            opts.resolutionMode = 'pixels';
            opts.pixelWidth = 400;
            opts.pixelHeight = 200;

            const canvas = renderToOffscreen(model, opts);
            // Should fit within 400×200
            expect(canvas.width).toBeLessThanOrEqual(400);
            expect(canvas.height).toBeLessThanOrEqual(200);
        });

        it('accepts antiAlias option without error', () => {
            const prim = makeBBoxPrim(0, 0, 20, 20);
            const model = makeModel([prim]);

            const optsAA = defaultBitmapOptions();
            optsAA.dpi = 150;
            optsAA.antiAlias = true;
            expect(() => renderToOffscreen(model, optsAA)).not.toThrow();

            const optsNoAA = defaultBitmapOptions();
            optsNoAA.dpi = 150;
            optsNoAA.antiAlias = false;
            expect(() => renderToOffscreen(model, optsNoAA)).not.toThrow();
        });

        it('accepts blackAndWhite option without error', () => {
            const prim = makeBBoxPrim(0, 0, 20, 20);
            const model = makeModel([prim]);

            const opts = defaultBitmapOptions();
            opts.dpi = 150;
            opts.blackAndWhite = true;
            expect(() => renderToOffscreen(model, opts)).not.toThrow();
        });
    });

    describe('renderLayerToOffscreen', () => {
        it('renders a single layer and restores drawOnlyLayer to -1', () => {
            const prim0 = makeBBoxPrim(0, 0, 50, 50, 0);
            const prim1 = makeBBoxPrim(0, 0, 50, 50, 1);
            const model = makeModel([prim0, prim1]);

            const opts = defaultBitmapOptions();
            opts.dpi = 150;

            const canvas = renderLayerToOffscreen(model, 0, opts);
            expect(canvas).toBeInstanceOf(HTMLCanvasElement);
            expect(canvas.width).toBeGreaterThan(0);
            // Should have restored drawOnlyLayer
            expect(model.setDrawOnlyLayer).toHaveBeenCalledWith(-1);
        });
    });

    describe('canvasToPNGBlob', () => {
        it('converts canvas to PNG blob via stubbed toBlob', async () => {
            const canvas = document.createElement('canvas');
            canvas.width = 10;
            canvas.height = 10;

            const blob = await canvasToPNGBlob(canvas);
            expect(blob).toBeInstanceOf(Blob);
            expect(blob.size).toBeGreaterThan(0);
        });
    });

    describe('canvasToJPEGBlob', () => {
        it('converts canvas to JPEG blob via stubbed toBlob', async () => {
            const canvas = document.createElement('canvas');
            canvas.width = 10;
            canvas.height = 10;

            const blob = await canvasToJPEGBlob(canvas, 0.85);
            expect(blob).toBeInstanceOf(Blob);
            expect(blob.size).toBeGreaterThan(0);
        });
    });

    describe('exportBitmapBlobs', () => {
        it('exports single PNG blob when splitLayers is false', async () => {
            const prim = makeBBoxPrim(0, 0, 20, 20);
            const model = makeModel([prim]);

            const opts = defaultBitmapOptions();
            opts.dpi = 150;
            opts.splitLayers = false;

            const results = await exportBitmapBlobs(model, opts, 'png');
            expect(results).toHaveLength(1);
            expect(results[0]!.layerIndex).toBe(-1);
            expect(results[0]!.blob).toBeInstanceOf(Blob);
        });

        it('exports multiple blobs when splitLayers is true', async () => {
            const prim0 = makeBBoxPrim(0, 0, 20, 20, 0);
            const prim1 = makeBBoxPrim(0, 0, 20, 20, 1);
            const model = makeModel([prim0, prim1]);

            const opts = defaultBitmapOptions();
            opts.dpi = 150;
            opts.splitLayers = true;

            const results = await exportBitmapBlobs(model, opts, 'png');
            // All 16 layers visible in stub → 16 results
            expect(results.length).toBe(16);
            for (const r of results) {
                expect(r.layerIndex).toBeGreaterThanOrEqual(0);
                expect(r.blob).toBeInstanceOf(Blob);
            }
        });

        it('exports JPG blob', async () => {
            const prim = makeBBoxPrim(0, 0, 20, 20);
            const model = makeModel([prim]);

            const opts = defaultBitmapOptions();
            opts.dpi = 150;
            opts.jpegQuality = 0.75;

            const results = await exportBitmapBlobs(model, opts, 'jpg');
            expect(results).toHaveLength(1);
            expect(results[0]!.blob).toBeInstanceOf(Blob);
        });
    });

    describe('DPI presets', () => {
        it('matches FidoCadJ standard presets', () => {
            expect(DPI_PRESETS).toEqual([72, 150, 300, 600, 1200, 1800, 2400]);
        });
    });

    describe('defaultBitmapOptions', () => {
        it('returns sensible defaults', () => {
            const opts = defaultBitmapOptions();
            expect(opts.resolutionMode).toBe('dpi');
            expect(opts.dpi).toBe(150);
            expect(opts.antiAlias).toBe(true);
            expect(opts.blackAndWhite).toBe(false);
            expect(opts.splitLayers).toBe(false);
            expect(opts.jpegQuality).toBe(0.92);
            expect(opts.magnification).toBe(1.0);
        });
    });
});
