import { Drawing } from '../circuit/views/Drawing.js';
import { DrawingModel } from '../circuit/model/DrawingModel.js';
import { MapCoordinates } from './MapCoordinates.js';
import { GraphicsNull } from '../graphic/nil/GraphicsNull.js';
import { PointG } from '../graphic/PointG.js';
import { DimensionG } from '../graphic/DimensionG.js';

export class DrawingSize {
    private constructor() {}

    static getImageSize(
        dm: DrawingModel,
        unitPerPixel: number,
        countMin: boolean,
        origin: PointG
    ): DimensionG {
        let width: number;
        let height: number;

        const m = new MapCoordinates();
        m.setMagnitudes(unitPerPixel, unitPerPixel);
        m.setXCenter(0);
        m.setYCenter(0);

        dm.setChanged(true);
        const drawingAgent = new Drawing(dm);
        drawingAgent.draw(new GraphicsNull(), m);
        dm.getImgCanvas().trackExtremePoints(m);
        dm.setChanged(true);

        if (countMin) {
            width = m.getXMax() - m.getXMin();
            height = m.getYMax() - m.getYMin();
        } else {
            width = m.getXMax();
            height = m.getYMax();
        }

        if (width <= 0) {
            width = 1;
        }
        if (height <= 0) {
            height = 1;
        }

        if (m.getXMax() >= m.getXMin() && m.getYMax() >= m.getYMin()) {
            origin.x = m.getXMin();
            origin.y = m.getYMin();
        } else {
            origin.x = 0;
            origin.y = 0;
        }

        return new DimensionG(width, height);
    }

    static getImageOrigin(dm: DrawingModel, unitPerPixel: number): PointG {
        dm.setChanged(true);
        const m = new MapCoordinates();
        m.setMagnitudes(unitPerPixel, unitPerPixel);
        m.setXCenter(0);
        m.setYCenter(0);

        const drawingAgent = new Drawing(dm);
        dm.getImgCanvas().trackExtremePoints(m);
        drawingAgent.draw(new GraphicsNull(), m);
        dm.setChanged(true);

        if (m.getXMax() >= m.getXMin() && m.getYMax() >= m.getYMin()) {
            return new PointG(m.getXMin(), m.getYMin());
        }
        return new PointG(0, 0);
    }

    static calculateZoomToFit(
        dm: DrawingModel,
        sizex: number,
        sizey: number,
        countMin: boolean
    ): MapCoordinates {
        const org = new PointG(0, 0);
        const newZoom = new MapCoordinates();

        const d = DrawingSize.getImageSize(dm, 1, countMin, org);
        const maxsizex = d.width + 1;
        const maxsizey = d.height + 1;

        const centerOrg = countMin ? org : new PointG(0, 0);

        const zoomx = 1.0 / (maxsizex / sizex);
        const zoomy = 1.0 / (maxsizey / sizey);

        let z = zoomx > zoomy ? zoomy : zoomx;
        z = Math.round(z * 100.0) / 100.0;

        if (z < MapCoordinates.MIN_MAGNITUDE) {
            z = MapCoordinates.MIN_MAGNITUDE;
        }

        newZoom.setMagnitudesNoCheck(z, z);
        z = newZoom.getYMagnitude();

        newZoom.setXCenter(-centerOrg.x * z);
        newZoom.setYCenter(-centerOrg.y * z);

        return newZoom;
    }
}
