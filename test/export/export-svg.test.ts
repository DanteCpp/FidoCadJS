/**
 * @file export-svg.test.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief Tests for ExportSVG — SVG element generation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExportSVG } from '../../src/export/ExportSVG.js';
import { DimensionG } from '../../src/graphic/DimensionG.js';
import { StandardLayers } from '../../src/layers/StandardLayers.js';
import { PointDouble } from '../../src/graphic/PointDouble.js';

describe('ExportSVG', () => {
    let svg: ExportSVG;
    const layers = StandardLayers.createStandardLayers();

    beforeEach(() => {
        svg = new ExportSVG();
        svg.exportStart(new DimensionG(200, 200), layers, 0);
    });

    it('exportStart / exportEnd produce valid SVG wrapper', () => {
        svg.exportEnd();
        const result = svg.getSvgString();
        expect(result).toContain('<?xml');
        expect(result).toContain('<svg');
        expect(result).toContain('</svg>');
    });

    it('exportLine produces line element', () => {
        // exportLine(x1, y1, x2, y2, layer, arrowStart, arrowEnd, arrowStyle, arrowLength, arrowHalfWidth, dashStyle, sW)
        svg.exportLine(10, 10, 100, 100, 0, false, false, 0, 0, 0, 0, 1);
        svg.exportEnd();
        const result = svg.getSvgString();
        expect(result).toContain('<line');
        expect(result).toContain('x1="10"');
        expect(result).toContain('y1="10"');
        expect(result).toContain('x2="100"');
        expect(result).toContain('y2="100"');
    });

    it('exportRectangle produces rect element', () => {
        svg.exportRectangle(20, 30, 80, 60, false, 0, 0, 1);
        svg.exportEnd();
        const result = svg.getSvgString();
        expect(result).toContain('<rect');
        expect(result).toContain('x="20"');
        expect(result).toContain('y="30"');
        expect(result).toContain('width=');
        expect(result).toContain('height=');
    });

    it('exportOval produces ellipse element', () => {
        svg.exportOval(20, 20, 80, 80, false, 0, 0, 1);
        svg.exportEnd();
        const result = svg.getSvgString();
        expect(result).toContain('<ellipse');
        expect(result).toContain('cx="50"');
        expect(result).toContain('cy="50"');
        expect(result).toContain('rx="30"');
        expect(result).toContain('ry="30"');
    });

    it('exportConnection produces circle element', () => {
        svg.exportConnection(70, 60, 0, 6);
        svg.exportEnd();
        const result = svg.getSvgString();
        expect(result).toContain('<circle');
        expect(result).toContain('cx="70"');
        expect(result).toContain('cy="60"');
        expect(result).toContain('r="3"');
    });

    it('exportPolygon produces polygon element', () => {
        const pts = [new PointDouble(0, 0), new PointDouble(50, 0), new PointDouble(25, 50)];
        svg.exportPolygon(pts, 3, false, 0, 0, 1);
        svg.exportEnd();
        const result = svg.getSvgString();
        expect(result).toContain('<polygon');
        expect(result).toContain('points=');
    });

    it('exportBezier produces path element', () => {
        svg.exportBezier(10, 10, 30, 50, 50, 20, 70, 40, 0, false, false, 0, 0, 0, 0, 1);
        svg.exportEnd();
        const result = svg.getSvgString();
        expect(result).toContain('<path');
        expect(result).toContain('d="');
        expect(result).toContain('C');
    });

    it('exportPCBLine produces line with stroke-width', () => {
        svg.exportPCBLine(10, 10, 100, 100, 5, 0);
        svg.exportEnd();
        const result = svg.getSvgString();
        expect(result).toContain('<line');
        expect(result).toContain('stroke-width');
    });

    it('exportPCBPad with oval style produces ellipse', () => {
        svg.exportPCBPad(50, 50, 0, 10, 10, 3, 0, false);
        svg.exportEnd();
        const result = svg.getSvgString();
        expect(result).toContain('<ellipse');
    });

    it('exportPCBPad with rect style produces rect', () => {
        svg.exportPCBPad(50, 50, 1, 10, 10, 3, 0, false);
        svg.exportEnd();
        const result = svg.getSvgString();
        expect(result).toContain('<rect');
    });

    it('exportAdvText produces text element', () => {
        svg.exportAdvText(100, 100, 6, 6, 'Arial', false, false, false, 0, 0, 'Hello');
        svg.exportEnd();
        const result = svg.getSvgString();
        expect(result).toContain('<text');
        expect(result).toContain('Hello');
        expect(result).toContain('font-family="Arial"');
    });

    it('dash style produces stroke-dasharray attribute', () => {
        svg.setDashUnit(4);
        svg.exportLine(10, 10, 100, 100, 0, false, false, 0, 0, 0, 1, 1);
        svg.exportEnd();
        const result = svg.getSvgString();
        expect(result).toContain('stroke-dasharray');
    });

    it('layer alpha < 1 produces opacity attribute', () => {
        // Layer 12 has alpha 0.95
        svg.exportLine(10, 10, 100, 100, 12, false, false, 0, 0, 0, 0, 1);
        svg.exportEnd();
        const result = svg.getSvgString();
        expect(result).toContain('opacity');
    });
});
