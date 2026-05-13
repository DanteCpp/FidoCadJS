/**
 * @file GhostPreview.ts
 * @author Dante Loi
 * @date 2026-05-13
 * @brief Ghost preview generation for drawing tools, extracted from CircuitPanel
 * @copyright Copyright 2026 Dante Loi - GPL v3
 * @details Generates transparent "ghost" primitives that follow the cursor while
 *          a drawing tool is active. Extracted mechanically during agent-friendly
 *          refactoring (P2.2). No logic changes from the original.
 */

import { ElementsEdtActions } from './controllers/ElementsEdtActions.js';
import type { DrawingModel } from './model/DrawingModel.js';
import type { GraphicPrimitive } from '../primitives/GraphicPrimitive.js';
import { PrimitiveLine } from '../primitives/PrimitiveLine.js';
import { PrimitiveBezier } from '../primitives/PrimitiveBezier.js';
import { PrimitiveRectangle } from '../primitives/PrimitiveRectangle.js';
import { PrimitiveOval } from '../primitives/PrimitiveOval.js';
import { PrimitivePolygon } from '../primitives/PrimitivePolygon.js';
import { PrimitiveComplexCurve } from '../primitives/PrimitiveComplexCurve.js';
import { PrimitivePCBLine } from '../primitives/PrimitivePCBLine.js';
import { PrimitiveMacro } from '../primitives/PrimitiveMacro.js';
import { StandardLayers } from '../layers/StandardLayers.js';

export class GhostPreview {
    /**
     * Generate a ghost (preview) primitive for the active drawing tool.
     * @param lx       Logical X of cursor position
     * @param ly       Logical Y of cursor position
     * @param tool     Current tool ID
     * @param edt      ElementsEdtActions holding click state and macro info
     * @param model    DrawingModel for font, library access
     * @returns A GraphicPrimitive to draw as a ghost, or null
     */
    updateGhost(
        lx: number,
        ly: number,
        tool: number,
        edt: ElementsEdtActions,
        model: DrawingModel
    ): GraphicPrimitive | null {
        const clickNum = edt.clickNumber;
        const xpoly = edt.xpoly;
        const ypoly = edt.ypoly;
        const layer = edt.currentLayer;
        const font = model.getTextFont();
        const fontSize = model.getTextFontSize();

        switch (tool) {
            case ElementsEdtActions.LINE:
                if (clickNum === 1) {
                    return new PrimitiveLine(
                        xpoly[1], ypoly[1], lx, ly, layer,
                        false, false, 0, 3, 2, 0, font, fontSize
                    );
                }
                break;

            case ElementsEdtActions.BEZIER:
                if (clickNum === 3) {
                    return new PrimitiveBezier(
                        xpoly[1], ypoly[1],
                        xpoly[2], ypoly[2],
                        xpoly[3], ypoly[3],
                        lx, ly,
                        layer, false, false, 0, 3, 2, 0, font, fontSize
                    );
                } else if (clickNum >= 1 && clickNum < 3) {
                    const ctrlPoly = new PrimitivePolygon(false, layer, 0, font, fontSize);
                    for (let i = 1; i <= clickNum; i++) {
                        ctrlPoly.addPoint(xpoly[i], ypoly[i]);
                    }
                    ctrlPoly.addPoint(lx, ly);
                    return ctrlPoly;
                }
                break;

            case ElementsEdtActions.RECTANGLE:
                if (clickNum === 1) {
                    return new PrimitiveRectangle(
                        xpoly[1], ypoly[1], lx, ly, false, layer, 0, font, fontSize
                    );
                }
                break;

            case ElementsEdtActions.ELLIPSE:
                if (clickNum === 1) {
                    return new PrimitiveOval(
                        xpoly[1], ypoly[1], lx, ly, false, layer, 0, font, fontSize
                    );
                }
                break;

            case ElementsEdtActions.POLYGON:
                if (clickNum >= 1) {
                    const poly = new PrimitivePolygon(false, layer, 0, font, fontSize);
                    for (let i = 1; i <= clickNum; i++) {
                        poly.addPoint(xpoly[i], ypoly[i]);
                    }
                    poly.addPoint(lx, ly);
                    return poly;
                }
                break;

            case ElementsEdtActions.COMPLEXCURVE:
                if (clickNum >= 1) {
                    const cc = new PrimitiveComplexCurve(
                        false, false, layer,
                        false, false, 0, 3, 2, 0,
                        font, fontSize
                    );
                    for (let i = 1; i <= clickNum; i++) {
                        cc.addPoint(xpoly[i], ypoly[i]);
                    }
                    cc.addPoint(lx, ly);
                    return cc;
                }
                break;

            case ElementsEdtActions.PCB_LINE:
                if (clickNum === 1) {
                    return new PrimitivePCBLine(
                        xpoly[1], ypoly[1], lx, ly,
                        edt.getAddElements().getPcbThickness(),
                        layer, font, fontSize
                    );
                }
                break;

            case ElementsEdtActions.MACRO:
                // Show preview of macro following cursor (like Java version)
                if (edt.macroKey !== '') {
                    try {
                        let orientation = 0;
                        let mirror = false;
                        if (edt.primEdit instanceof PrimitiveMacro) {
                            orientation = edt.primEdit.getOrientation();
                            mirror = edt.primEdit.isMirrored();
                        }

                        const macroPreview = new PrimitiveMacro(
                            model.getLibrary(),
                            StandardLayers.createEditingLayerArray(), // Green preview color
                            font,
                            fontSize
                        );
                        macroPreview.virtualPoint[0]!.x = lx;
                        macroPreview.virtualPoint[0]!.y = ly;
                        macroPreview.virtualPoint[1]!.x = lx + 10;
                        macroPreview.virtualPoint[1]!.y = ly + 10;
                        macroPreview.virtualPoint[2]!.x = lx + 10;
                        macroPreview.virtualPoint[2]!.y = ly + 5;
                        macroPreview.setOrientation(orientation);
                        macroPreview.setMirrored(mirror);
                        macroPreview.initializeFromKey(edt.macroKey);
                        macroPreview.setDrawOnlyLayer(-1);
                        return macroPreview;
                    } catch (e) {
                        // Ignore errors during preview (macro might not be loaded yet)
                    }
                }
                break;
        }

        return null;
    }
}
