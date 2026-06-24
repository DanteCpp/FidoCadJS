import { MapCoordinates } from '../geom/MapCoordinates.js';
import { Export } from '../circuit/views/Export.js';
import { DrawingSize } from '../geom/DrawingSize.js';
import { PointG } from '../graphic/PointG.js';
import { ExportSVG } from './ExportSVG.js';
import { ExportPGF } from './ExportPGF.js';
import { ExportTikZ } from './ExportTikZ.js';
import { ExportPDF } from './ExportPDF.js';
import type { DrawingModel } from '../circuit/model/DrawingModel.js';

export class ExportFacade {
    private model: DrawingModel;

    constructor(model: DrawingModel) {
        this.model = model;
    }

    /**
     * Build a coordinate mapping that translates the model's bounding box
     * to the SVG/PGF origin, with a half-`EXPORT_BORDER` margin on top and
     * left. Matches Java ExportGraphic.exportSizeP (FidoCadJ:182-226).
     * Without this, drawings authored with large or negative coordinates
     * render off-canvas in the exported file.
     */
    private makeCenteredMap(): MapCoordinates {
        const mp = new MapCoordinates();
        mp.setMagnitudes(1, 1);
        const org = new PointG(0, 0);
        DrawingSize.getImageSize(this.model, 1, true, org);
        org.x -= Export.EXPORT_BORDER / 2;
        org.y -= Export.EXPORT_BORDER / 2;
        mp.setXCenter(-org.x);
        mp.setYCenter(-org.y);
        return mp;
    }

    exportSVG(): string {
        const mp = this.makeCenteredMap();
        const svg = new ExportSVG();
        const exportView = new Export(this.model);
        exportView.exportHeader(svg, mp);
        exportView.exportDrawing(svg, false, mp);
        svg.exportEnd();
        return svg.getSvgString();
    }

    exportPGF(): string {
        const mp = this.makeCenteredMap();
        const pgf = new ExportPGF();
        const exportView = new Export(this.model);
        exportView.exportHeader(pgf, mp);
        exportView.exportDrawing(pgf, false, mp);
        pgf.exportEnd();
        return pgf.getPgfString();
    }

    exportTikZ(): string {
        const mp = this.makeCenteredMap();
        const tikz = new ExportTikZ();
        const exportView = new Export(this.model);
        exportView.exportHeader(tikz, mp);
        exportView.exportDrawing(tikz, false, mp);
        tikz.exportEnd();
        return tikz.getTikZString();
    }

    exportPDF(): string {
        const mp = this.makeCenteredMap();
        const pdf = new ExportPDF();
        const exportView = new Export(this.model);
        exportView.exportHeader(pdf, mp);
        exportView.exportDrawing(pdf, false, mp);
        pdf.exportEnd();
        return pdf.getPdfString();
    }
}
