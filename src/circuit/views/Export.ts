import type { ExportInterface } from '../../export/ExportInterface.js';
import type { MapCoordinates } from '../../geom/MapCoordinates.js';
import { DrawingModel } from '../model/DrawingModel.js';
import { DrawingSize } from '../../geom/DrawingSize.js';
import { LayerDesc } from '../../layers/LayerDesc.js';
import { PrimitiveMacro } from '../../primitives/PrimitiveMacro.js';
import { PrimitivePCBPad } from '../../primitives/PrimitivePCBPad.js';
import { PointG } from '../../graphic/PointG.js';

export class Export {
    static readonly EXPORT_BORDER = 6;

    constructor(private readonly drawingModel: DrawingModel) {}

    exportHeader(exp: ExportInterface, mp: MapCoordinates): void {
        const o = new PointG(0, 0);
        const d = DrawingSize.getImageSize(this.drawingModel, 1, true, o);
        d.width += Export.EXPORT_BORDER;
        d.height += Export.EXPORT_BORDER;

        exp.setDashUnit(mp.getXMagnitude());
        exp.exportStart(d, this.drawingModel.getLayers(), mp.getXGridStep());
    }

    exportDrawing(exp: ExportInterface, exportInvisible: boolean, mp: MapCoordinates): void {
        if (
            this.drawingModel.getDrawOnlyLayer() >= 0 &&
            !this.drawingModel.getDrawOnlyPads()
        ) {
            this.exportAllObjects(exp, exportInvisible, mp);
        } else if (!this.drawingModel.getDrawOnlyPads()) {
            for (let j = 0; j < this.drawingModel.getLayers().length; ++j) {
                this.drawingModel.setDrawOnlyLayer(j);
                this.exportAllObjects(exp, exportInvisible, mp);
            }
            this.drawingModel.setDrawOnlyLayer(-1);
        }

        for (const g of this.drawingModel.getPrimitiveVector()) {
            if (g instanceof PrimitivePCBPad) {
                (g as PrimitivePCBPad).setDrawOnlyPads(true);

                if (
                    (this.drawingModel.getLayers()[g.getLayer()] as LayerDesc).isVisible() ||
                    exportInvisible
                ) {
                    g.export(exp, mp);
                }
                (g as PrimitivePCBPad).setDrawOnlyPads(false);
            } else if (g instanceof PrimitiveMacro) {
                (g as PrimitiveMacro).setExportInvisible(exportInvisible);
                (g as PrimitiveMacro).setDrawOnlyPads(true);
                if (
                    (this.drawingModel.getLayers()[g.getLayer()] as LayerDesc).isVisible() ||
                    exportInvisible
                ) {
                    g.export(exp, mp);
                }
                (g as PrimitiveMacro).setDrawOnlyPads(false);
                (g as PrimitiveMacro).resetExport();
            }
        }
    }

    private exportAllObjects(
        exp: ExportInterface,
        exportInvisible: boolean,
        mp: MapCoordinates
    ): void {
        for (let i = 0; i < this.drawingModel.getPrimitiveVector().length; ++i) {
            const g = this.drawingModel.getPrimitiveVector()[i];

            if (
                g.getLayer() === this.drawingModel.getDrawOnlyLayer() &&
                !(g instanceof PrimitiveMacro)
            ) {
                if (
                    (this.drawingModel.getLayers()[g.getLayer()] as LayerDesc).isVisible() ||
                    exportInvisible
                ) {
                    g.export(exp, mp);
                }
            } else if (g instanceof PrimitiveMacro) {
                (g as PrimitiveMacro).setDrawOnlyLayer(this.drawingModel.getDrawOnlyLayer());
                (g as PrimitiveMacro).setExportInvisible(exportInvisible);

                if (
                    (this.drawingModel.getLayers()[g.getLayer()] as LayerDesc).isVisible() ||
                    exportInvisible
                ) {
                    g.export(exp, mp);
                }
            }
        }
    }
}

export function registerExportHooks(): void {
    PrimitiveMacro.exportFn = (
        model: DrawingModel,
        exp: ExportInterface,
        exportInvisible: boolean,
        cs: MapCoordinates
    ): void => {
        const e = new Export(model);
        e.exportDrawing(exp, exportInvisible, cs);
    };
}
