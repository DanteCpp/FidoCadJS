import type { Color } from './Color.js';
import type { TextRenderer } from './TextRenderer.js';
import type { Shape } from './Shape.js';
import type { Polygon } from './Polygon.js';
import type { MapCoordinates } from '../geom/MapCoordinates.js';
import type { LayerDesc } from '../layers/LayerDesc.js';
import type { LaidOutSegment } from './MathLayout.js';

export interface Graphics {
    getColor(): Color;
    setZoom(z: number): void;
    setColor(c: Color): void;
    getTextInterface(): TextRenderer;
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
    getFontAscent(): number;
    getFontDescent(): number;
    getStringWidth(s: string): number;
    drawString(str: string, x: number, y: number): void;
    setAlpha(alpha: number): void;
    fillOval(x: number, y: number, width: number, height: number): void;
    drawOval(x: number, y: number, width: number, height: number): void;
    fill(s: Shape): void;
    draw(s: Shape): void;
    fillPolygon(p: Polygon): void;
    drawPolygon(p: Polygon): void;
    activateSelectColor(l: LayerDesc): void;
    setSelectedColor(c: Color): void;
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
        colorDots: Color,
        colorLines: Color,
    ): void;
    createPolygon(): Polygon;
    createColor(): Color;
    createShape(): Shape;
    getScreenDensity(): number;
}
