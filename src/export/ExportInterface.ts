import type { DimensionG } from '../graphic/DimensionG.js';
import type { PointDouble } from '../graphic/PointDouble.js';
import type { LayerDesc } from '../layers/LayerDesc.js';
import type { MacroDesc } from '../primitives/MacroDesc.js';
import type { PointPr } from './PointPr.js';

export interface ExportInterface {
    exportStart(totalSize: DimensionG, la: LayerDesc[], grid: number): void;
    exportEnd(): void;
    setDashUnit(u: number): void;
    setDashPhase(p: number): void;

    exportAdvText(x: number, y: number, sizex: number, sizey: number,
        fontname: string, isBold: boolean, isMirrored: boolean, isItalic: boolean,
        orientation: number, layer: number, text: string): void;

    exportBezier(x1: number, y1: number, x2: number, y2: number,
        x3: number, y3: number, x4: number, y4: number, layer: number,
        arrowStart: boolean, arrowEnd: boolean, arrowStyle: number,
        arrowLength: number, arrowHalfWidth: number,
        dashStyle: number, strokeWidth: number): void;

    exportConnection(x: number, y: number, layer: number, size: number): void;

    exportLine(x1: number, y1: number, x2: number, y2: number, layer: number,
        arrowStart: boolean, arrowEnd: boolean, arrowStyle: number,
        arrowLength: number, arrowHalfWidth: number,
        dashStyle: number, strokeWidth: number): void;

    exportMacro(x: number, y: number, isMirrored: boolean,
        orientation: number, macroName: string, macroDesc: string,
        name: string, xn: number, yn: number,
        value: string, xv: number, yv: number,
        font: string, fontSize: number,
        m: Map<string, MacroDesc>): boolean;

    exportOval(x1: number, y1: number, x2: number, y2: number,
        isFilled: boolean, layer: number,
        dashStyle: number, strokeWidth: number): void;

    exportPCBLine(x1: number, y1: number, x2: number, y2: number,
        width: number, layer: number): void;

    exportPCBPad(x: number, y: number, style: number,
        six: number, siy: number, indiam: number,
        layer: number, onlyHole: boolean): void;

    exportPolygon(vertices: PointDouble[], nVertices: number,
        isFilled: boolean, layer: number,
        dashStyle: number, strokeWidth: number): void;

    exportCurve(vertices: PointDouble[], nVertices: number,
        isFilled: boolean, isClosed: boolean, layer: number,
        arrowStart: boolean, arrowEnd: boolean, arrowStyle: number,
        arrowLength: number, arrowHalfWidth: number,
        dashStyle: number, strokeWidth: number): boolean;

    exportRectangle(x1: number, y1: number, x2: number, y2: number,
        isFilled: boolean, layer: number,
        dashStyle: number, strokeWidth: number): void;

    exportArrow(x: number, y: number, xc: number, yc: number,
        l: number, h: number, style: number): PointPr;
}
