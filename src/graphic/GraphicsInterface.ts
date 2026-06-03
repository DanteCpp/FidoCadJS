/**
 * @file GraphicsInterface.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief Graphics abstraction layer interface
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import type { ColorInterface } from './ColorInterface.js';
import type { TextInterface } from './TextInterface.js';
import type { ShapeInterface } from './ShapeInterface.js';
import type { PolygonInterface } from './PolygonInterface.js';
import type { MapCoordinates } from '../geom/MapCoordinates.js';
import type { LayerDesc } from '../layers/LayerDesc.js';
import type { LaidOutSegment } from './MathLayout.js';

export interface GraphicsInterface {
    getColor(): ColorInterface;
    setZoom(z: number): void;
    getZoom(): number;
    setColor(c: ColorInterface): void;
    getTextInterface(): TextInterface;
    applyStroke(w: number, dashStyle: number): void;
    drawRect(x: number, y: number, width: number, height: number): void;
    fillRect(x: number, y: number, width: number, height: number): void;
    fillRoundRect(
        x: number,
        y: number,
        width: number,
        height: number,
        arcWidth: number,
        arcHeight: number,
    ): void;
    hitClip(x: number, y: number, width: number, height: number): boolean;
    drawLine(x1: number, y1: number, x2: number, y2: number): void;
    setFont(name: string, size: number, isItalic?: boolean, isBold?: boolean): void;
    getFontSize(): number;
    setFontSize(size: number): void;
    getFontAscent(): number;
    getFontDescent(): number;
    getStringWidth(s: string): number;
    drawString(str: string, x: number, y: number): void;
    setAlpha(alpha: number): void;
    fillOval(x: number, y: number, width: number, height: number): void;
    drawOval(x: number, y: number, width: number, height: number): void;
    fill(s: ShapeInterface): void;
    draw(s: ShapeInterface): void;
    fillPolygon(p: PolygonInterface): void;
    drawPolygon(p: PolygonInterface): void;
    activateSelectColor(l: LayerDesc): void;
    setSelectedColor(c: ColorInterface): void;
    drawAdvText(
        xyfactor: number,
        xa: number,
        ya: number,
        qq: number,
        h: number,
        w: number,
        th: number,
        needsStretching: boolean,
        orientation: number,
        mirror: boolean,
        txt: string,
    ): void;
    /**
     * Draw a laid-out mixed text/math run (see MathLayout). Plain-text segments
     * are drawn with the current font; math segments are filled as glyph paths
     * scaled from MathJax native units by `fontPx`. Shares the placement
     * transform (anchor, orientation, mirror, vertical stretch) with drawAdvText.
     */
    drawMathSegments(
        segments: LaidOutSegment[],
        xa: number,
        ya: number,
        baseline: number,
        fontPx: number,
        needsStretching: boolean,
        xyfactor: number,
        orientation: number,
        mirror: boolean,
    ): void;
    drawGrid(
        cs: MapCoordinates,
        xmin: number,
        ymin: number,
        xmax: number,
        ymax: number,
        colorDots: ColorInterface,
        colorLines: ColorInterface,
    ): void;
    createPolygon(): PolygonInterface;
    createColor(): ColorInterface;
    createShape(): ShapeInterface;
    getScreenDensity(): number;
}
