/**
 * @file undo-actions.test.ts
 * @author Dante Loi
 * @date 2026-05-09
 * @brief Tests for UndoActions correctness — verifies undo actually restores previous state
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DrawingModel } from '../../src/circuit/model/DrawingModel.js';
import { ParserActions } from '../../src/circuit/controllers/ParserActions.js';
import { UndoActions } from '../../src/circuit/controllers/UndoActions.js';
import { SelectionActions } from '../../src/circuit/controllers/SelectionActions.js';
import { EditorActions } from '../../src/circuit/controllers/EditorActions.js';
import { StandardLayers } from '../../src/layers/StandardLayers.js';
import { PrimitiveLine } from '../../src/primitives/PrimitiveLine.js';

function makeModel(): DrawingModel {
    const m = new DrawingModel();
    m.setLayers(StandardLayers.createStandardLayers());
    return m;
}

describe('UndoActions correctness', () => {
    let model: DrawingModel;
    let parser: ParserActions;
    let undo: UndoActions;
    let editor: EditorActions;
    let selection: SelectionActions;

    beforeEach(() => {
        model = makeModel();
        parser = new ParserActions(model);
        undo = new UndoActions(parser);
        selection = new SelectionActions(model);
        editor = new EditorActions(model, selection, undo);
    });

    describe('add primitive', () => {
        it('undo restores state before primitive was added', () => {
            const origCount = model.getPrimitiveVector().length;

            const line = new PrimitiveLine(10, 20, 30, 40, 0, false, false, 0, 3, 2, 0,
                model.getTextFont(), model.getTextFontSize());
            model.addPrimitive(line, false, undo);

            expect(model.getPrimitiveVector().length).toBe(origCount + 1);

            // Undo should remove the primitive
            undo.undo();
            expect(model.getPrimitiveVector().length).toBe(origCount);
        });

        it('redo restores the primitive after undo', () => {
            const origCount = model.getPrimitiveVector().length;

            const line = new PrimitiveLine(10, 20, 30, 40, 0, false, false, 0, 3, 2, 0,
                model.getTextFont(), model.getTextFontSize());
            model.addPrimitive(line, false, undo);

            undo.undo();
            expect(model.getPrimitiveVector().length).toBe(origCount);

            undo.redo();
            expect(model.getPrimitiveVector().length).toBe(origCount + 1);
        });

        it('undo removes the correct primitive when multiple exist', () => {
            const line1 = new PrimitiveLine(0, 0, 10, 10, 0, false, false, 0, 3, 2, 0,
                model.getTextFont(), model.getTextFontSize());
            model.addPrimitive(line1, false, undo);

            const line2 = new PrimitiveLine(20, 20, 30, 30, 0, false, false, 0, 3, 2, 0,
                model.getTextFont(), model.getTextFontSize());
            model.addPrimitive(line2, false, undo);

            expect(model.getPrimitiveVector().length).toBe(2);

            undo.undo();
            expect(model.getPrimitiveVector().length).toBe(1);
            // The first primitive should still be there
            const p = model.getPrimitiveVector()[0]!;
            expect(p.virtualPoint[0]!.x).toBe(0);
        });
    });

    describe('move', () => {
        it('undo restores original position after move', () => {
            const line = new PrimitiveLine(10, 20, 30, 40, 0, false, false, 0, 3, 2, 0,
                model.getTextFont(), model.getTextFontSize());
            model.addPrimitive(line, false, null);
            line.setSelected(true);

            const x0 = line.virtualPoint[0]!.x;
            const y0 = line.virtualPoint[0]!.y;

            editor.moveAllSelected(5, 10);

            expect(line.virtualPoint[0]!.x).toBe(x0 + 5);
            expect(line.virtualPoint[0]!.y).toBe(y0 + 10);

            undo.undo();

            // After undo, model is re-parsed — query from model, not old reference
            const restored = model.getPrimitiveVector()[0]!;
            expect(restored.virtualPoint[0]!.x).toBe(x0);
            expect(restored.virtualPoint[0]!.y).toBe(y0);
        });

        it('redo re-applies the move', () => {
            const line = new PrimitiveLine(10, 20, 30, 40, 0, false, false, 0, 3, 2, 0,
                model.getTextFont(), model.getTextFontSize());
            model.addPrimitive(line, false, null);
            line.setSelected(true);

            const x0 = line.virtualPoint[0]!.x;

            editor.moveAllSelected(5, 10);
            undo.undo();
            undo.redo();

            // After redo, model is re-parsed — query from model
            const restored = model.getPrimitiveVector()[0]!;
            expect(restored.virtualPoint[0]!.x).toBe(x0 + 5);
        });
    });

    describe('delete', () => {
        it('undo restores deleted primitives', () => {
            const line1 = new PrimitiveLine(0, 0, 10, 10, 0, false, false, 0, 3, 2, 0,
                model.getTextFont(), model.getTextFontSize());
            model.addPrimitive(line1, false, null);
            line1.setSelected(true);

            expect(model.getPrimitiveVector().length).toBe(1);

            editor.deleteAllSelected(true);
            expect(model.getPrimitiveVector().length).toBe(0);

            undo.undo();
            expect(model.getPrimitiveVector().length).toBe(1);
        });
    });

    describe('rotate', () => {
        it('undo restores original orientation after rotate', () => {
            const line = new PrimitiveLine(10, 20, 40, 20, 0, false, false, 0, 3, 2, 0,
                model.getTextFont(), model.getTextFontSize());
            model.addPrimitive(line, false, null);
            line.setSelected(true);

            const x0 = line.virtualPoint[0]!.x;
            const y0 = line.virtualPoint[0]!.y;
            const x1 = line.virtualPoint[1]!.x;
            const y1 = line.virtualPoint[1]!.y;

            editor.rotateAllSelected();

            // First point is the rotation pivot — it should not move.
            // The second point should have changed.
            expect(line.virtualPoint[1]!.x).not.toBe(x1);

            undo.undo();

            const restored = model.getPrimitiveVector()[0]!;
            expect(restored.virtualPoint[0]!.x).toBe(x0);
            expect(restored.virtualPoint[0]!.y).toBe(y0);
            expect(restored.virtualPoint[1]!.x).toBe(x1);
            expect(restored.virtualPoint[1]!.y).toBe(y1);
        });
    });

    describe('mirror', () => {
        it('undo restores original state after mirror', () => {
            const line = new PrimitiveLine(10, 20, 40, 20, 0, false, false, 0, 3, 2, 0,
                model.getTextFont(), model.getTextFontSize());
            model.addPrimitive(line, false, null);
            line.setSelected(true);

            const x1 = line.virtualPoint[1]!.x;

            editor.mirrorAllSelected();

            expect(line.virtualPoint[1]!.x).not.toBe(x1);

            undo.undo();

            const restored = model.getPrimitiveVector()[0]!;
            expect(restored.virtualPoint[1]!.x).toBe(x1);
        });
    });

    describe('reset', () => {
        it('clearCircuit does not leave stale undo references', () => {
            const line = new PrimitiveLine(10, 20, 30, 40, 0, false, false, 0, 3, 2, 0,
                model.getTextFont(), model.getTextFontSize());
            model.addPrimitive(line, false, undo);

            expect(undo.canUndo()).toBe(true);

            undo.reset();

            expect(undo.canUndo()).toBe(false);
            expect(undo.canRedo()).toBe(false);
        });
    });

    describe('multiple undo', () => {
        it('can undo multiple actions in reverse order', () => {
            const line1 = new PrimitiveLine(0, 0, 10, 10, 0, false, false, 0, 3, 2, 0,
                model.getTextFont(), model.getTextFontSize());
            model.addPrimitive(line1, false, undo);

            const line2 = new PrimitiveLine(20, 20, 30, 30, 0, false, false, 0, 3, 2, 0,
                model.getTextFont(), model.getTextFontSize());
            model.addPrimitive(line2, false, undo);

            expect(model.getPrimitiveVector().length).toBe(2);

            undo.undo();
            expect(model.getPrimitiveVector().length).toBe(1);

            undo.undo();
            expect(model.getPrimitiveVector().length).toBe(0);
        });
    });
});
