import { describe, it, expect, beforeEach } from 'vitest';
import { DrawingModel } from '../../src/circuit/model/DrawingModel.js';
import { ParserActions } from '../../src/circuit/controllers/ParserActions.js';
import { UndoActions } from '../../src/circuit/controllers/UndoActions.js';
import * as StandardLayers from '../../src/layers/StandardLayers.js';
import { PrimitiveLine } from '../../src/primitives/PrimitiveLine.js';

function makeModel(): DrawingModel {
    const m = new DrawingModel();
    m.setLayers(StandardLayers.createStandardLayers());
    return m;
}

describe('UndoActions', () => {
    let model: DrawingModel;
    let parser: ParserActions;
    let undo: UndoActions;

    beforeEach(() => {
        model = makeModel();
        parser = new ParserActions(model);
        undo = new UndoActions(parser);
    });

    describe('stack management', () => {
        it('new manager cannot undo or redo', () => {
            expect(undo.canUndo()).toBe(false);
            expect(undo.canRedo()).toBe(false);
        });

        it('saving state enables undo', () => {
            undo.saveUndoState();
            expect(undo.canUndo()).toBe(true);
            expect(undo.canRedo()).toBe(false);
        });

        it('undoing pushes to redo stack', () => {
            undo.saveUndoState();
            undo.undo();
            expect(undo.canRedo()).toBe(true);
        });

        it('redo after undo restores redoability', () => {
            undo.saveUndoState();
            undo.undo();
            undo.redo();
            expect(undo.canUndo()).toBe(true);
            expect(undo.canRedo()).toBe(false);
        });

        it('reset clears everything', () => {
            undo.saveUndoState();
            undo.reset();
            expect(undo.canUndo()).toBe(false);
            expect(undo.canRedo()).toBe(false);
        });

        it('new mutation clears redo stack', () => {
            undo.saveUndoState();
            undo.undo();
            expect(undo.canRedo()).toBe(true);
            undo.saveUndoState();
            expect(undo.canRedo()).toBe(false);
        });
    });

    describe('add primitive', () => {
        it('addPrimitive pushes undo state', () => {
            expect(undo.canUndo()).toBe(false);

            const line = new PrimitiveLine(
                10,
                20,
                30,
                40,
                0,
                false,
                false,
                0,
                3,
                2,
                0,
                model.getTextFont(),
                model.getTextFontSize(),
            );
            model.addPrimitive(line, false, undo);

            expect(undo.canUndo()).toBe(true);
        });

        it('multiple adds create multiple undo entries', () => {
            const line1 = new PrimitiveLine(
                0,
                0,
                10,
                10,
                0,
                false,
                false,
                0,
                3,
                2,
                0,
                model.getTextFont(),
                model.getTextFontSize(),
            );
            model.addPrimitive(line1, false, undo);

            const line2 = new PrimitiveLine(
                20,
                20,
                30,
                30,
                0,
                false,
                false,
                0,
                3,
                2,
                0,
                model.getTextFont(),
                model.getTextFontSize(),
            );
            model.addPrimitive(line2, false, undo);

            expect(model.getPrimitiveVector().length).toBe(2);

            // First undo restores state before line2 was added (only line1 present).
            undo.undo();
            expect(model.getPrimitiveVector().length).toBe(1);
            const p = model.getPrimitiveVector()[0]!;
            expect(p.virtualPoint[0]!.x).toBe(0);

            // Second undo restores state before line1 was added (empty model).
            undo.undo();
            expect(model.getPrimitiveVector().length).toBe(0);
        });
    });

    describe('modified flag', () => {
        it('starts unmodified', () => {
            expect(undo.getModified()).toBe(false);
        });

        it('setModified toggles flag', () => {
            undo.setModified(true);
            expect(undo.getModified()).toBe(true);
            undo.setModified(false);
            expect(undo.getModified()).toBe(false);
        });
    });
});
