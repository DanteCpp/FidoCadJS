/**
 * @file TeXOverlay.ts
 * @author Dante Loi
 * @date 2026-05-13
 * @brief KaTeX overlay renderer extracted from CircuitPanel
 * @copyright Copyright 2026 Dante Loi - GPL v3
 * @details Manages a transparent DIV overlay positioned on top of the canvas
 *          to render crisp LaTeX math expressions using KaTeX. Extracted
 *          mechanically during agent-friendly refactoring (P2.4).
 */

import type { DrawingModel } from '../model/DrawingModel.js';
import type { MapCoordinates } from '../../geom/MapCoordinates.js';
import { PrimitiveAdvText } from '../../primitives/PrimitiveAdvText.js';
import { ColorCanvas } from '../../graphic/canvas/ColorCanvas.js';
import { renderMixedText } from '../../graphic/TeXRenderer.js';

export class TeXOverlay {
    private overlay: HTMLDivElement;
    private renderTeX: boolean = false;

    /**
     * Create and attach a TeX overlay to the given host element.
     * The host must have position: relative (or similar) for absolute
     * positioning of the overlay to work correctly.
     */
    static attach(host: HTMLElement): TeXOverlay {
        const overlay = document.createElement('div');
        overlay.style.cssText =
            'position: absolute; top: 0; left: 0; width: 100%; height: 100%; ' +
            'pointer-events: none; overflow: hidden; z-index: 1; display: none;';
        overlay.setAttribute('aria-hidden', 'true');
        host.style.position = 'relative';
        host.appendChild(overlay);
        return new TeXOverlay(overlay);
    }

    constructor(overlay: HTMLDivElement) {
        this.overlay = overlay;
    }

    /** Enable or disable TeX rendering (affects next sync call). */
    setEnabled(enabled: boolean): void {
        this.renderTeX = enabled;
        this.overlay.style.display = enabled ? 'block' : 'none';
        if (!enabled) {
            this.overlay.innerHTML = '';
        }
    }

    /** Populate the TeX overlay div with KaTeX-rendered math from text primitives. */
    sync(model: DrawingModel, mapCoords: MapCoordinates, dpr: number): void {
        if (!this.renderTeX) return;

        const htmlParts: string[] = [];
        const layers = model.getLayers();
        const primitives = model.getPrimitiveVector();

        for (let pi = 0; pi < primitives.length; pi++) {
            const prim = primitives[pi]!;
            if (!(prim instanceof PrimitiveAdvText)) continue;

            const text = prim.getString();
            // Quick skip: if no $ delimiter, no math to render
            if (!text.includes('$')) continue;

            const lx = prim.virtualPoint[0]!.x;
            const ly = prim.virtualPoint[0]!.y;
            const sx = mapCoords.mapX(lx, ly);
            const sy = mapCoords.mapY(lx, ly);

            // Convert canvas pixels to CSS pixels for overlay positioning
            const cssX = sx / dpr;
            const cssY = sy / dpr;

            // Compute font CSS matching the canvas font settings (mirrors draw()).
            // Use the larger of six and the width-equivalent of siy to ensure
            // both font size fields affect the visual rendering.
            const yMag = mapCoords.getYMagnitude();
            const effectiveSix = Math.max(prim.getFontWidth(), (prim.getFontDimension() * 7) / 10);
            const canvasFontSize = (effectiveSix * 12 * yMag) / 7 + 0.5;
            const cssFontSize = canvasFontSize / dpr;
            const isBold = prim.isBold();
            const isItalic = prim.isItalic();
            const fontName = prim.getFontName() || 'Courier New';
            const fontStyle = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}`;

            // Layer color — blend with selection green when selected (matches canvas).
            const layerIdx = prim.getLayer();
            let textColor = '#000000';
            if (layerIdx >= 0 && layerIdx < layers.length) {
                const color = layers[layerIdx].getColor();
                if (color) {
                    if (prim.isSelected()) {
                        // Same blend as GraphicsCanvas.activateSelectColor:
                        // selectedColor(0,255,0) * 0.6 + layerColor * 0.4
                        const r = Math.floor(0 * 0.6 + color.getRed() * 0.4);
                        const g = Math.floor(255 * 0.6 + color.getGreen() * 0.4);
                        const b = Math.floor(0 * 0.6 + color.getBlue() * 0.4);
                        textColor = `rgb(${r},${g},${b})`;
                    } else {
                        textColor = (color as ColorCanvas).toCSSColor();
                    }
                }
            }

            // Orientation and mirror (mirrors draw() coordinate adjustments).
            let orientation = prim.getOrientation();
            let mirror = prim.isMirrored() !== 0;
            if (mirror) orientation = -orientation;
            orientation -= mapCoords.getOrientation() * 90;
            if (mapCoords.getMirror()) {
                mirror = !mirror;
                orientation = -orientation;
            }
            let transformStyle = '';
            if (orientation !== 0 || mirror) {
                transformStyle =
                    `transform: rotate(${orientation}deg)` +
                    (mirror ? ' scaleX(-1)' : '') +
                    '; ' +
                    'transform-origin: 0 0; ';
            }

            const segments = renderMixedText(text);
            const segmentHtml = segments
                .map((seg) => {
                    if (seg.type === 'text') {
                        // Escape HTML in plain text segments
                        const escaped = seg.content
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;');
                        return `<span style="white-space: pre;">${escaped}</span>`;
                    }
                    // Math segments already contain safe KaTeX HTML
                    return seg.content;
                })
                .join('');

            htmlParts.push(
                `<div data-prim-index="${pi}" style="position:absolute; left:${cssX}px; top:${cssY}px; ` +
                    `white-space: nowrap; font: ${fontStyle}${cssFontSize}px ${fontName}; ` +
                    `color: ${textColor}; ${transformStyle}">${segmentHtml}</div>`,
            );
        }

        this.overlay.innerHTML = htmlParts.join('');

        // Measure actual KaTeX overlay dimensions after layout and feed them
        // back to the primitives for accurate click hit-testing.
        requestAnimationFrame(() => {
            const overlayDivs = this.overlay.querySelectorAll('[data-prim-index]');
            for (const div of overlayDivs) {
                const idx = parseInt((div as HTMLElement).dataset['primIndex'] ?? '', 10);
                const prim = primitives[idx];
                if (!(prim instanceof PrimitiveAdvText)) continue;
                const rect = div.getBoundingClientRect();
                if (rect.width <= 0 && rect.height <= 0) continue;
                // Convert CSS pixel dimensions to logical units.
                const wLogical = Math.round((rect.width * dpr) / mapCoords.getXMagnitude());
                const hLogical = Math.round((rect.height * dpr) / mapCoords.getYMagnitude());
                prim.setTeXOverlaySize(wLogical, hLogical);
            }
        });
    }
}
