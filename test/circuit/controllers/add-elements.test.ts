/**
 * @file add-elements.test.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief Tests for AddElements — primitive creation for each drawing tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DrawingModel } from '../../../src/circuit/model/DrawingModel.js';
import { AddElements } from '../../../src/circuit/controllers/AddElements.js';
import { StandardLayers } from '../../../src/layers/StandardLayers.js';
import { PrimitiveLine } from '../../../src/primitives/PrimitiveLine.js';
import { PrimitiveRectangle } from '../../../src/primitives/PrimitiveRectangle.js';
import { PrimitiveOval } from '../../../src/primitives/PrimitiveOval.js';
import { PrimitiveConnection } from '../../../src/primitives/PrimitiveConnection.js';
import { PrimitivePCBLine } from '../../../src/primitives/PrimitivePCBLine.js';
import { PrimitivePCBPad } from '../../../src/primitives/PrimitivePCBPad.js';
import { PrimitiveBezier } from '../../../src/primitives/PrimitiveBezier.js';

describe('AddElements', () => {
    let model: DrawingModel;
    let addElements: AddElements;

    beforeEach(() => {
        model = new DrawingModel();
        model.setLayers(StandardLayers.createStandardLayers());
        // Pass null for UndoActions — will not save undo states
        addElements = new AddElements(model, null);
    });

    it('addConnection creates a PrimitiveConnection', () => {
        addElements.addConnection(100, 100, 0);
        const prims = model.getPrimitiveVector();
        expect(prims).toHaveLength(1);
        expect(prims[0]).toBeInstanceOf(PrimitiveConnection);
    });

    it('addPCBPad creates a PrimitivePCBPad', () => {
        addElements.addPCBPad(50, 50, 0);
        const prims = model.getPrimitiveVector();
        expect(prims).toHaveLength(1);
        expect(prims[0]).toBeInstanceOf(PrimitivePCBPad);
    });

    it('addLine creates a PrimitiveLine after two clicks', () => {
        addElements.addLine(10, 10, false, 0);
        addElements.addLine(100, 100, false, 0);
        const prims = model.getPrimitiveVector();
        expect(prims).toHaveLength(1);
        expect(prims[0]).toBeInstanceOf(PrimitiveLine);
    });

    it('addRectangle creates a PrimitiveRectangle after two clicks', () => {
        addElements.addRectangle(10, 10, false, 0);
        addElements.addRectangle(100, 100, false, 0);
        const prims = model.getPrimitiveVector();
        expect(prims).toHaveLength(1);
        expect(prims[0]).toBeInstanceOf(PrimitiveRectangle);
    });

    it('addEllipse creates a PrimitiveOval after two clicks', () => {
        addElements.addEllipse(10, 10, false, 0);
        addElements.addEllipse(100, 100, false, 0);
        const prims = model.getPrimitiveVector();
        expect(prims).toHaveLength(1);
        expect(prims[0]).toBeInstanceOf(PrimitiveOval);
    });

    it('addBezier creates a PrimitiveBezier after four clicks', () => {
        addElements.addBezier(10, 10, 0);
        addElements.addBezier(50, 5, 0);
        addElements.addBezier(20, 60, 0);
        addElements.addBezier(70, 35, 0);
        const prims = model.getPrimitiveVector();
        expect(prims).toHaveLength(1);
        expect(prims[0]).toBeInstanceOf(PrimitiveBezier);
    });

    it('addPCBLine creates a PrimitivePCBLine after two clicks', () => {
        addElements.addPCBLine(10, 10, false, 0);
        addElements.addPCBLine(100, 100, false, 0);
        const prims = model.getPrimitiveVector();
        expect(prims).toHaveLength(1);
        expect(prims[0]).toBeInstanceOf(PrimitivePCBLine);
    });

    it('resetClickNumber clears click state', () => {
        addElements.addLine(10, 10, false, 0);
        expect(addElements.clickNumber).toBe(1);
        addElements.resetClickNumber();
        expect(addElements.clickNumber).toBe(0);
    });

    it('pcb thickness getters/setters round-trip', () => {
        addElements.setPcbThickness(8);
        expect(addElements.getPcbThickness()).toBe(8);
    });
});
