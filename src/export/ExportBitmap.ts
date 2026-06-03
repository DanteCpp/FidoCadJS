/**
 * @file ExportBitmap.ts
 * @author Dante Loi
 * @date 2026-05-15
 * @brief Bitmap export engine: renders the drawing model to an offscreen
 *        canvas at configurable DPI/pixel resolution, with optional B&W
 *        post-processing and per-layer splitting.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 * @details Mirrors FidoCadJ's ExportGraphic.exportImage / exportImageBW.
 *          The FCD logical unit → pixel mapping is:
 *            magnitude = targetDPI / 72
 *          (72 FCD units per logical inch — the standard screen mapping).
 *          For explicit-pixel mode, magnitude is computed to fit the
 *          drawing bounding box into the requested pixel dimensions while
 *          preserving aspect ratio.
 */

import type { DrawingModel } from '../circuit/model/DrawingModel.js';
import type { MapCoordinates } from '../geom/MapCoordinates.js';
import { MapCoordinates as MapCoordsImpl } from '../geom/MapCoordinates.js';
import { DrawingSize } from '../geom/DrawingSize.js';
import { Drawing } from '../circuit/views/Drawing.js';
import { PointG } from '../graphic/PointG.js';
import { DimensionG } from '../graphic/DimensionG.js';
import { GraphicsCanvas } from '../graphic/canvas/GraphicsCanvas.js';
import { ColorCanvas } from '../graphic/canvas/ColorCanvas.js';
import { TeXMode } from '../graphic/TeXMode.js';
import { Export } from '../circuit/views/Export.js';
import type { ExportBitmapOptions } from './ExportBitmapOptions.js';

/** Default mapping: 1 FCD unit = 1/72 inch at screen resolution. */
const FCD_UNITS_PER_INCH = 72;

/**
 * Paint the opaque white background through the GraphicsCanvas abstraction.
 *
 * Doing this via `graphics.setColor` (rather than touching `ctx.fillStyle`
 * directly) keeps GraphicsCanvas's cached colour in sync with the real
 * context. Otherwise the first black fill — GraphicPrimitive.selectLayer
 * compares the cached colour and skips re-applying an unchanged one — would
 * inherit the leftover white fillStyle and render invisibly (white on white).
 */
function paintWhiteBackground(graphics: GraphicsCanvas, w: number, h: number): void {
    graphics.setColor(new ColorCanvas(255, 255, 255));
    graphics.setAlpha(1);
    graphics.fillRect(0, 0, w, h);
}

/** Result of a single-layer bitmap render. */
export interface BitmapLayerResult {
    layerIndex: number;
    layerName: string;
    blob: Blob;
}

/**
 * Compute the image bounding box in FCD logical units.
 * Returns the DimensionG and origin PointG.
 */
function getImageBounds(model: DrawingModel): { size: DimensionG; origin: PointG } {
    const origin = new PointG(0, 0);
    const size = DrawingSize.getImageSize(model, 1, true, origin);
    return { size, origin };
}

/**
 * Compute the MapCoordinates magnitude needed for the desired output.
 *
 * For 'dpi' mode: magnitude = dpi / FCD_UNITS_PER_INCH  (72)
 * For 'pixels' mode: magnitude = min(pixelW / fcdW, pixelH / fcdH)
 *                     so the drawing fits within the pixel dimensions.
 */
function computeMagnitude(
    fcdWidth: number,
    fcdHeight: number,
    options: ExportBitmapOptions,
): number {
    if (options.resolutionMode === 'dpi') {
        return options.dpi / FCD_UNITS_PER_INCH;
    }
    // pixels mode: fit drawing into specified pixel dimensions
    const magX = options.pixelWidth / (fcdWidth || 1);
    const magY = options.pixelHeight / (fcdHeight || 1);
    return Math.min(magX, magY);
}

/**
 * Compute output pixel dimensions given FCD size and magnitude.
 */
function computePixelSize(
    fcdWidth: number,
    fcdHeight: number,
    magnitude: number,
): { w: number; h: number } {
    return {
        w: Math.max(1, Math.round(fcdWidth * magnitude)),
        h: Math.max(1, Math.round(fcdHeight * magnitude)),
    };
}

/**
 * Build a MapCoordinates suitable for bitmap export rendering.
 *
 * Sets the magnitudes to the computed value, centers on the origin
 * from getImageBounds, and adds the EXPORT_BORDER margin.
 */
function buildExportMapCoords(origin: PointG, magnitude: number): MapCoordinates {
    const mp = new MapCoordsImpl();
    mp.setMagnitudes(magnitude, magnitude);
    // Add the EXPORT_BORDER / 2 offset (in FCD units at magnitude=1),
    // scaled by the current magnitude.
    const borderOffset = (Export.EXPORT_BORDER / 2) * magnitude;
    mp.setXCenter(-origin.x * magnitude + borderOffset);
    mp.setYCenter(-origin.y * magnitude + borderOffset);
    return mp;
}

/**
 * Render the full drawing (all visible layers) to an offscreen canvas.
 *
 * @param model   The drawing model to render.
 * @param options Export options controlling resolution, anti-alias, etc.
 * @returns The offscreen canvas with the rendered drawing.
 */
export function renderToOffscreen(
    model: DrawingModel,
    options: ExportBitmapOptions,
): HTMLCanvasElement {
    const { size, origin } = getImageBounds(model);
    const magnitude = computeMagnitude(size.width, size.height, options);
    const { w, h } = computePixelSize(size.width, size.height, magnitude);
    const mp = buildExportMapCoords(origin, magnitude);

    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;

    const ctx = offscreen.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context for offscreen canvas');

    // Anti-alias control
    ctx.imageSmoothingEnabled = options.antiAlias;

    // Wrap in GraphicsCanvas so Drawing can use it
    const graphics = new GraphicsCanvas(offscreen);
    graphics.setZoom(1);
    paintWhiteBackground(graphics, w, h);

    // Render. Enable typeset math so exported bitmaps show LaTeX, then restore
    // the previous flag (the next on-screen render resets it from renderTeX).
    const prevTeX = TeXMode.active;
    TeXMode.active = true;
    const drawing = new Drawing(model);
    drawing.draw(graphics, mp);
    TeXMode.active = prevTeX;

    // Black-and-white post-processing
    if (options.blackAndWhite) {
        applyBlackAndWhite(offscreen);
    }

    return offscreen;
}

/**
 * Render a single layer to an offscreen canvas.
 *
 * Temporarily sets the model's draw-only layer so only that layer is
 * rendered, then restores.
 */
export function renderLayerToOffscreen(
    model: DrawingModel,
    layerIndex: number,
    options: ExportBitmapOptions,
): HTMLCanvasElement {
    const { size, origin } = getImageBounds(model);
    const magnitude = computeMagnitude(size.width, size.height, options);
    const { w, h } = computePixelSize(size.width, size.height, magnitude);
    const mp = buildExportMapCoords(origin, magnitude);

    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');

    ctx.imageSmoothingEnabled = options.antiAlias;

    const graphics = new GraphicsCanvas(offscreen);
    graphics.setZoom(1);
    paintWhiteBackground(graphics, w, h);

    const prevTeX = TeXMode.active;
    TeXMode.active = true;
    const drawing = new Drawing(model);

    // Set draw-only layer for this render pass
    const prevLayer = model.getDrawOnlyLayer();
    model.setDrawOnlyLayer(layerIndex);
    drawing.draw(graphics, mp);
    model.setDrawOnlyLayer(prevLayer);
    TeXMode.active = prevTeX;

    if (options.blackAndWhite) {
        applyBlackAndWhite(offscreen);
    }

    return offscreen;
}

/**
 * Convert a canvas to a PNG Blob.
 */
export function canvasToPNGBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to create PNG blob'));
        }, 'image/png');
    });
}

/**
 * Convert a canvas to a JPEG Blob with the given quality.
 */
export function canvasToJPEGBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Failed to create JPEG blob'));
            },
            'image/jpeg',
            quality,
        );
    });
}

/**
 * Post-process: apply black-and-white threshold to every pixel.
 * Pixels with luminance > 128 become white, others become black.
 */
function applyBlackAndWhite(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        // Luminance formula: 0.299 R + 0.587 G + 0.114 B
        const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        const bw = lum > 128 ? 255 : 0;
        data[i] = bw;
        data[i + 1] = bw;
        data[i + 2] = bw;
        // Keep alpha at 255
        data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
}

/**
 * Export the drawing to one or more bitmap blobs.
 *
 * If options.splitLayers is true, returns one blob per visible layer.
 * Otherwise returns a single blob for all visible layers combined.
 *
 * @returns Array of { layerIndex, layerName, blob } results.
 */
export async function exportBitmapBlobs(
    model: DrawingModel,
    options: ExportBitmapOptions,
    format: 'png' | 'jpg',
): Promise<BitmapLayerResult[]> {
    const layers = model.getLayers();
    const results: BitmapLayerResult[] = [];

    if (options.splitLayers) {
        for (let i = 0; i < layers.length; i++) {
            if (!layers[i].isVisible()) continue;
            const canvas = renderLayerToOffscreen(model, i, options);
            const blob =
                format === 'png'
                    ? await canvasToPNGBlob(canvas)
                    : await canvasToJPEGBlob(canvas, options.jpegQuality);
            results.push({
                layerIndex: i,
                layerName: layers[i].getDescription() || `Layer ${i}`,
                blob,
            });
        }
    } else {
        const canvas = renderToOffscreen(model, options);
        const blob =
            format === 'png'
                ? await canvasToPNGBlob(canvas)
                : await canvasToJPEGBlob(canvas, options.jpegQuality);
        results.push({
            layerIndex: -1,
            layerName: 'all',
            blob,
        });
    }

    return results;
}
