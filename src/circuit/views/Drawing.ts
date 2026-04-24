import type { GraphicsInterface } from '../../graphic/GraphicsInterface.js';
import type { MapCoordinates } from '../../geom/MapCoordinates.js';
import { DrawingModel } from '../model/DrawingModel.js';
import { LayerDesc } from '../../layers/LayerDesc.js';
import { PrimitiveMacro } from '../../primitives/PrimitiveMacro.js';
import { GraphicPrimitive } from '../../primitives/GraphicPrimitive.js';

export class Drawing {
    private oZ: number = 0;
    private oX: number = 0;
    private oY: number = 0;
    private oO: number = 0;
    private needHoles: boolean = false;

    constructor(private readonly drawingModel: DrawingModel) {}

    drawSelectedHandles(gi: GraphicsInterface, cs: MapCoordinates): void {
        for (const gp of this.drawingModel.getPrimitiveVector()) {
            if (gp.isSelected()) {
                gp.drawHandles(gi, cs);
            }
        }
    }

    draw(gG: GraphicsInterface, cs: MapCoordinates): void {
        if (cs === null) {
            console.error('Drawing.draw: ouch... cs not initialized :-(');
            return;
        }

        // Reset alpha state at start of each render
        GraphicPrimitive.resetAlphaForRender();

        if (
            this.drawingModel.getChanged() ||
            this.oZ !== cs.getXMagnitude() ||
            this.oX !== cs.getXCenter() ||
            this.oY !== cs.getYCenter() ||
            this.oO !== cs.getOrientation()
        ) {
            this.oZ = cs.getXMagnitude();
            this.oX = cs.getXCenter();
            this.oY = cs.getYCenter();
            this.oO = cs.getOrientation();
            this.drawingModel.setChanged(false);

            for (const gp of this.drawingModel.getPrimitiveVector()) {
                gp.setChanged(true);
            }

            if (!this.drawingModel.getDrawOnlyPads()) {
                cs.resetMinMax();
            }
        }

        this.needHoles = this.drawingModel.getDrawOnlyPads();

        if (
            this.drawingModel.getDrawOnlyLayer() >= 0 &&
            !this.drawingModel.getDrawOnlyPads()
        ) {
            if (!this.drawingModel.containsLayer(this.drawingModel.getDrawOnlyLayer())) {
                return;
            }

            this.drawPrimitives(this.drawingModel.getDrawOnlyLayer(), gG, cs);
            return;
        } else if (!this.drawingModel.getDrawOnlyPads()) {
            for (let jIndex = 0; jIndex < LayerDesc.MAX_LAYERS; ++jIndex) {
                if (!this.drawingModel.containsLayer(jIndex)) {
                    continue;
                }
                this.drawPrimitives(jIndex, gG, cs);
            }
        }

        if (this.needHoles) {
            for (const gg of this.drawingModel.getPrimitiveVector()) {
                if (gg.needsHoles()) {
                    gg.setDrawOnlyPads(true);
                    gg.draw(gG, cs, this.drawingModel.getLayers());
                    gg.setDrawOnlyPads(false);
                }
            }
        }
    }

    getNeedHoles(): boolean {
        return this.needHoles;
    }

    private drawPrimitives(jIndex: number, graphic: GraphicsInterface, cs: MapCoordinates): void {
        for (const gg of this.drawingModel.getPrimitiveVector()) {
            if (jIndex > 0 && gg.getLayer() > jIndex) {
                break;
            }

            if (gg.containsLayer(jIndex)) {
                gg.setDrawOnlyLayer(jIndex);
                gg.draw(graphic, cs, this.drawingModel.getLayers());
            }

            if (gg.needsHoles()) {
                this.needHoles = true;
            }
        }
    }
}

export function registerDrawingHooks(): void {
    PrimitiveMacro.drawFn = (model: DrawingModel, g: GraphicsInterface, cs: MapCoordinates): void => {
        const d = new Drawing(model);
        d.draw(g, cs);
    };
}
