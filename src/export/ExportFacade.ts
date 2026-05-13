/**
 * @file ExportFacade.ts
 * @author Dante Loi
 * @date 2026-05-13
 * @brief Export methods (SVG, PGF, TikZ) extracted from CircuitPanel
 * @copyright Copyright 2026 Dante Loi - GPL v3
 * @details Delegates to the export/ package. CircuitPanel used to own these
 *          methods even though they don't touch the canvas or DOM.
 */

import { MapCoordinates } from '../geom/MapCoordinates.js';
import { Export } from '../circuit/views/Export.js';
import { ExportSVG } from './ExportSVG.js';
import { ExportPGF } from './ExportPGF.js';
import { ExportTikZ } from './ExportTikZ.js';
import type { DrawingModel } from '../circuit/model/DrawingModel.js';

export class ExportFacade {
    private model: DrawingModel;

    constructor(model: DrawingModel) {
        this.model = model;
    }

    exportSVG(): string {
        const mp = new MapCoordinates();
        mp.setMagnitudes(1, 1);
        const svg = new ExportSVG();
        const exportView = new Export(this.model);
        exportView.exportHeader(svg, mp);
        exportView.exportDrawing(svg, false, mp);
        svg.exportEnd();
        return svg.getSvgString();
    }

    exportPGF(): string {
        const mp = new MapCoordinates();
        mp.setMagnitudes(1, 1);
        const pgf = new ExportPGF();
        const exportView = new Export(this.model);
        exportView.exportHeader(pgf, mp);
        exportView.exportDrawing(pgf, false, mp);
        pgf.exportEnd();
        return pgf.getPgfString();
    }

    exportTikZ(): string {
        const mp = new MapCoordinates();
        mp.setMagnitudes(1, 1);
        const tikz = new ExportTikZ();
        const exportView = new Export(this.model);
        exportView.exportHeader(tikz, mp);
        exportView.exportDrawing(tikz, false, mp);
        tikz.exportEnd();
        return tikz.getTikZString();
    }
}
