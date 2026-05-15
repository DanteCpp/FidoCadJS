/**
 * @file ExportBitmapOptions.ts
 * @author Dante Loi
 * @date 2026-05-15
 * @brief Configuration options for bitmap export (PNG, JPG).
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

/** DPI presets matching FidoCadJ's DialogExport. */
export const DPI_PRESETS = [72, 150, 300, 600, 1200, 1800, 2400] as const;
export type DpiPreset = (typeof DPI_PRESETS)[number];

/** Mode for determining export resolution. */
export type ResolutionMode = 'dpi' | 'pixels';

/** Options controlling bitmap (PNG / JPG) export. */
export interface ExportBitmapOptions {
    /** Resolution mode: 'dpi' uses FCD-units→pixels via DPI; 'pixels' uses explicit w×h. */
    resolutionMode: ResolutionMode;

    /** DPI value (used when resolutionMode === 'dpi'). */
    dpi: DpiPreset;

    /** Explicit pixel width (used when resolutionMode === 'pixels'). */
    pixelWidth: number;

    /** Explicit pixel height (used when resolutionMode === 'pixels'). */
    pixelHeight: number;

    /** Whether to use anti-aliased rendering in the export (default true). */
    antiAlias: boolean;

    /** Whether to render in black-and-white (threshold pass, default false). */
    blackAndWhite: boolean;

    /** Whether to export each visible layer to a separate file. */
    splitLayers: boolean;

    /** JPEG quality (0.1–1.0, used only for JPG; ignored for PNG). */
    jpegQuality: number;

    /** Magnification factor applied to the coordinate mapping (0.01–100×).
     *  Default 1.0 (no magnification). Affects SVG/PGF/TikZ scaling. */
    magnification: number;
}

/** Default bitmap export options. */
export function defaultBitmapOptions(): ExportBitmapOptions {
    return {
        resolutionMode: 'dpi',
        dpi: 150,
        pixelWidth: 800,
        pixelHeight: 600,
        antiAlias: true,
        blackAndWhite: false,
        splitLayers: false,
        jpegQuality: 0.92,
        magnification: 1.0,
    };
}
