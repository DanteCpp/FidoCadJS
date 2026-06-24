import { ElementsEdtActions } from './controllers/ElementsEdtActions.js';
import type { DrawingModel } from './model/DrawingModel.js';
import type { GraphicPrimitive } from '../primitives/GraphicPrimitive.js';
import type { ToolGhostHandler, GhostContext } from './ToolGhostHandler.js';
import { PrimitiveLine } from '../primitives/PrimitiveLine.js';
import { PrimitiveBezier } from '../primitives/PrimitiveBezier.js';
import { PrimitiveRectangle } from '../primitives/PrimitiveRectangle.js';
import { PrimitiveOval } from '../primitives/PrimitiveOval.js';
import { PrimitivePolygon } from '../primitives/PrimitivePolygon.js';
import { PrimitiveComplexCurve } from '../primitives/PrimitiveComplexCurve.js';
import { PrimitivePCBLine } from '../primitives/PrimitivePCBLine.js';
import { PrimitivePCBPad } from '../primitives/PrimitivePCBPad.js';
import { PrimitiveMacro } from '../primitives/PrimitiveMacro.js';
import { StandardLayers } from '../layers/StandardLayers.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Per-tool ghost handlers (strategy implementations)
// ═══════════════════════════════════════════════════════════════════════════════

const lineGhost: ToolGhostHandler = (ctx) => {
    if (ctx.clickNum === 1) {
        return new PrimitiveLine(
            ctx.xpoly[1],
            ctx.ypoly[1],
            ctx.lx,
            ctx.ly,
            ctx.layer,
            false,
            false,
            0,
            3,
            2,
            0,
            ctx.font,
            ctx.fontSize,
        );
    }
    return null;
};

const bezierGhost: ToolGhostHandler = (ctx) => {
    if (ctx.clickNum === 3) {
        return new PrimitiveBezier(
            ctx.xpoly[1],
            ctx.ypoly[1],
            ctx.xpoly[2],
            ctx.ypoly[2],
            ctx.xpoly[3],
            ctx.ypoly[3],
            ctx.lx,
            ctx.ly,
            ctx.layer,
            false,
            false,
            0,
            3,
            2,
            0,
            ctx.font,
            ctx.fontSize,
        );
    } else if (ctx.clickNum >= 1 && ctx.clickNum < 3) {
        const ctrlPoly = new PrimitivePolygon(false, ctx.layer, 0, ctx.font, ctx.fontSize);
        for (let i = 1; i <= ctx.clickNum; i++) {
            ctrlPoly.addPoint(ctx.xpoly[i], ctx.ypoly[i]);
        }
        ctrlPoly.addPoint(ctx.lx, ctx.ly);
        return ctrlPoly;
    }
    return null;
};

const rectangleGhost: ToolGhostHandler = (ctx) => {
    if (ctx.clickNum === 1) {
        return new PrimitiveRectangle(
            ctx.xpoly[1],
            ctx.ypoly[1],
            ctx.lx,
            ctx.ly,
            false,
            ctx.layer,
            0,
            ctx.font,
            ctx.fontSize,
        );
    }
    return null;
};

const ellipseGhost: ToolGhostHandler = (ctx) => {
    if (ctx.clickNum === 1) {
        return new PrimitiveOval(
            ctx.xpoly[1],
            ctx.ypoly[1],
            ctx.lx,
            ctx.ly,
            false,
            ctx.layer,
            0,
            ctx.font,
            ctx.fontSize,
        );
    }
    return null;
};

const polygonGhost: ToolGhostHandler = (ctx) => {
    if (ctx.clickNum >= 1) {
        const poly = new PrimitivePolygon(false, ctx.layer, 0, ctx.font, ctx.fontSize);
        for (let i = 1; i <= ctx.clickNum; i++) {
            poly.addPoint(ctx.xpoly[i], ctx.ypoly[i]);
        }
        poly.addPoint(ctx.lx, ctx.ly);
        return poly;
    }
    return null;
};

const complexCurveGhost: ToolGhostHandler = (ctx) => {
    if (ctx.clickNum >= 1) {
        const cc = new PrimitiveComplexCurve(
            false,
            false,
            ctx.layer,
            false,
            false,
            0,
            3,
            2,
            0,
            ctx.font,
            ctx.fontSize,
        );
        for (let i = 1; i <= ctx.clickNum; i++) {
            cc.addPoint(ctx.xpoly[i], ctx.ypoly[i]);
        }
        cc.addPoint(ctx.lx, ctx.ly);
        return cc;
    }
    return null;
};

const pcbPadGhost: ToolGhostHandler = (ctx, edt) => {
    const ae = edt.getAddElements();
    return new PrimitivePCBPad(
        ctx.lx,
        ctx.ly,
        ae.getPcbPadSizeX(),
        ae.getPcbPadSizeY(),
        ae.getPcbPadDrill(),
        ae.getPcbPadStyle(),
        ctx.layer,
        ctx.font,
        ctx.fontSize,
    );
};

const pcbLineGhost: ToolGhostHandler = (ctx, edt) => {
    if (ctx.clickNum === 1) {
        return new PrimitivePCBLine(
            ctx.xpoly[1],
            ctx.ypoly[1],
            ctx.lx,
            ctx.ly,
            edt.getAddElements().getPcbThickness(),
            ctx.layer,
            ctx.font,
            ctx.fontSize,
        );
    }
    return null;
};

const macroGhost: ToolGhostHandler = (ctx, edt, model) => {
    if (edt.macroKey === '') return null;
    try {
        let orientation = 0;
        let mirror = false;
        if (edt.primEdit instanceof PrimitiveMacro) {
            orientation = edt.primEdit.getOrientation();
            mirror = edt.primEdit.isMirrored();
        }

        const macroPreview = new PrimitiveMacro(
            model.getLibrary(),
            StandardLayers.createEditingLayerArray(),
            ctx.font,
            ctx.fontSize,
        );
        macroPreview.virtualPoint[0]!.x = ctx.lx;
        macroPreview.virtualPoint[0]!.y = ctx.ly;
        macroPreview.virtualPoint[1]!.x = ctx.lx + 10;
        macroPreview.virtualPoint[1]!.y = ctx.ly + 10;
        macroPreview.virtualPoint[2]!.x = ctx.lx + 10;
        macroPreview.virtualPoint[2]!.y = ctx.ly + 5;
        macroPreview.setOrientation(orientation);
        macroPreview.setMirrored(mirror);
        macroPreview.initializeFromKey(edt.macroKey);
        macroPreview.setDrawOnlyLayer(-1);
        return macroPreview;
    } catch (e) {
        // Ignore errors during preview
    }
    return null;
};

// ═══════════════════════════════════════════════════════════════════════════════
// Registry: maps tool IDs to their ghost handlers
// ═══════════════════════════════════════════════════════════════════════════════

const registry = new Map<number, ToolGhostHandler>([
    [ElementsEdtActions.LINE, lineGhost],
    [ElementsEdtActions.BEZIER, bezierGhost],
    [ElementsEdtActions.RECTANGLE, rectangleGhost],
    [ElementsEdtActions.ELLIPSE, ellipseGhost],
    [ElementsEdtActions.POLYGON, polygonGhost],
    [ElementsEdtActions.COMPLEXCURVE, complexCurveGhost],
    [ElementsEdtActions.PCB_LINE, pcbLineGhost],
    [ElementsEdtActions.PCB_PAD, pcbPadGhost],
    [ElementsEdtActions.MACRO, macroGhost],
]);

// ═══════════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════════

export class GhostPreview {
    /**
     * Generate a ghost (preview) primitive for the active drawing tool.
     * Delegates to the tool-specific strategy handler.
     */
    updateGhost(
        lx: number,
        ly: number,
        tool: number,
        edt: ElementsEdtActions,
        model: DrawingModel,
    ): GraphicPrimitive | null {
        const handler = registry.get(tool);
        if (!handler) return null;

        const ctx: GhostContext = {
            lx,
            ly,
            clickNum: edt.clickNumber,
            xpoly: edt.xpoly,
            ypoly: edt.ypoly,
            layer: edt.currentLayer,
            font: model.getTextFont(),
            fontSize: model.getTextFontSize(),
        };

        return handler(ctx, edt, model);
    }

    /**
     * Register an additional tool ghost handler (for extensions).
     */
    static register(toolId: number, handler: ToolGhostHandler): void {
        registry.set(toolId, handler);
    }
}
