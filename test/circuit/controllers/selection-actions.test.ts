/**
 * @file selection-actions.test.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief Tests for SelectionActions — selection queries
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DrawingModel } from '../../../src/circuit/model/DrawingModel.js';
import { SelectionActions } from '../../../src/circuit/controllers/SelectionActions.js';
import { StandardLayers } from '../../../src/layers/StandardLayers.js';
import { PrimitiveLine } from '../../../src/primitives/PrimitiveLine.js';

describe('SelectionActions', () => {
    let model: DrawingModel;
    let selectionActions: SelectionActions;

    function addLine(x1: number, y1: number, x2: number, y2: number, layer: number): void {
        const prim = new PrimitiveLine(x1, y1, x2, y2, layer, false, false, 0, 3, 2, 0, '', 4);
        model.getPrimitiveVector().push(prim);
    }

    beforeEach(() => {
        model = new DrawingModel();
        model.setLayers(StandardLayers.createStandardLayers());
        selectionActions = new SelectionActions(model);
    });

    it('getFirstSelectedPrimitive returns null when nothing selected', () => {
        expect(selectionActions.getFirstSelectedPrimitive()).toBeNull();
    });

    it('getFirstSelectedPrimitive returns selected primitive', () => {
        addLine(0, 0, 10, 10, 0);
        model.getPrimitiveVector()[0].setSelected(true);
        const first = selectionActions.getFirstSelectedPrimitive();
        expect(first).not.toBeNull();
        expect(first!.isSelected()).toBe(true);
    });

    it('setSelectionAll(true) selects everything', () => {
        addLine(0, 0, 10, 10, 0);
        addLine(10, 10, 20, 20, 0);
        selectionActions.setSelectionAll(true);
        for (const prim of model.getPrimitiveVector()) {
            expect(prim.isSelected()).toBe(true);
        }
    });

    it('setSelectionAll(false) deselects everything', () => {
        addLine(0, 0, 10, 10, 0);
        addLine(10, 10, 20, 20, 0);
        model.getPrimitiveVector()[0].setSelected(true);
        selectionActions.setSelectionAll(false);
        for (const prim of model.getPrimitiveVector()) {
            expect(prim.isSelected()).toBe(false);
        }
    });

    it('getSelectedPrimitives returns only selected primitives', () => {
        addLine(0, 0, 10, 10, 0);
        addLine(10, 10, 20, 20, 0);
        model.getPrimitiveVector()[0].setSelected(true);
        const selected = selectionActions.getSelectedPrimitives();
        expect(selected).toHaveLength(1);
        expect(selected[0].isSelected()).toBe(true);
    });

    it('isUniquePrimitiveSelected is false for 0 selected', () => {
        addLine(0, 0, 10, 10, 0);
        expect(selectionActions.isUniquePrimitiveSelected()).toBe(false);
    });

    it('isUniquePrimitiveSelected is true for 1 selected', () => {
        addLine(0, 0, 10, 10, 0);
        model.getPrimitiveVector()[0].setSelected(true);
        expect(selectionActions.isUniquePrimitiveSelected()).toBe(true);
    });

    it('isUniquePrimitiveSelected is false for 2+ selected', () => {
        addLine(0, 0, 10, 10, 0);
        addLine(10, 10, 20, 20, 0);
        model.getPrimitiveVector()[0].setSelected(true);
        model.getPrimitiveVector()[1].setSelected(true);
        expect(selectionActions.isUniquePrimitiveSelected()).toBe(false);
    });
});
