/**
 * @file editor-actions.test.ts
 * @author Dante Loi
 * @date 2026-05-15
 * @brief Unit tests for EditorActions — selection-driven mutators.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 *
 * EditorActions had zero direct coverage before this file. It exposes the
 * alignment + transform + delete operations that the keyboard shortcuts
 * and menu items call into. Each method:
 *   - is a no-op when nothing is selected (no undo state, no model change)
 *   - pushes exactly one undo state when it does mutate
 *   - leaves unselected primitives untouched
 *
 * The "rotateAllSelected", "mirrorAllSelected" and "moveAllSelected" paths
 * already have indirect coverage via undo-actions.test.ts and the keyboard
 * shortcut tests, so this file focuses on alignment + delete.
 */

import { describe, it, expect } from 'vitest';
import { DrawingModel } from '../../../src/circuit/model/DrawingModel.js';
import { ParserActions } from '../../../src/circuit/controllers/ParserActions.js';
import { UndoActions } from '../../../src/circuit/controllers/UndoActions.js';
import { EditorActions } from '../../../src/circuit/controllers/EditorActions.js';
import { SelectionActions } from '../../../src/circuit/controllers/SelectionActions.js';
import { StandardLayers } from '../../../src/layers/StandardLayers.js';
import { PrimitiveLine } from '../../../src/primitives/PrimitiveLine.js';

function makeWorld() {
    const model = new DrawingModel();
    model.setLayers(StandardLayers.createStandardLayers());
    const parser = new ParserActions(model);
    const undo = new UndoActions(parser);
    const selection = new SelectionActions(model);
    const editor = new EditorActions(model, selection, undo);
    return { model, parser, undo, selection, editor };
}

/** Insert a horizontal line `(x1, y) → (x2, y)` and return the primitive. */
function addLine(
    model: DrawingModel,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
): PrimitiveLine {
    const line = new PrimitiveLine(
        x1,
        y1,
        x2,
        y2,
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
    model.addPrimitive(line, true, null);
    return line;
}

describe('EditorActions — alignment', () => {
    describe('alignLeftSelected', () => {
        it('no-op when nothing is selected', () => {
            const { model, editor, undo } = makeWorld();
            addLine(model, 50, 50, 70, 50);
            editor.alignLeftSelected();
            expect(undo.canUndo()).toBe(false);
            expect(model.getPrimitiveVector()[0]!.getPosition().x).toBe(50);
        });

        it('moves selected primitives to the leftmost selected x', () => {
            const { model, editor } = makeWorld();
            const a = addLine(model, 30, 10, 50, 10); // leftmost
            const b = addLine(model, 80, 30, 100, 30);
            a.setSelected(true);
            b.setSelected(true);

            editor.alignLeftSelected();

            expect(a.getPosition().x).toBe(30);
            expect(b.getPosition().x).toBe(30);
        });

        it('leaves unselected primitives untouched', () => {
            const { model, editor } = makeWorld();
            const a = addLine(model, 30, 10, 50, 10);
            const b = addLine(model, 80, 30, 100, 30);
            a.setSelected(true); // b stays unselected

            editor.alignLeftSelected();

            expect(b.getPosition().x).toBe(80);
        });

        it('pushes exactly one undo state', () => {
            const { model, editor, undo } = makeWorld();
            const a = addLine(model, 30, 10, 50, 10);
            const b = addLine(model, 80, 30, 100, 30);
            a.setSelected(true);
            b.setSelected(true);

            editor.alignLeftSelected();

            expect(undo.canUndo()).toBe(true);
            undo.undo();
            // After undo, both lines back to their original x.
            // Re-read from model — undo replaces the primitive vector.
            const prims = model.getPrimitiveVector();
            const xs = prims.map((p) => p.getPosition().x).sort((u, v) => u - v);
            expect(xs).toEqual([30, 80]);
        });
    });

    describe('alignRightSelected', () => {
        it('moves selected primitives to the rightmost selected x+width', () => {
            const { model, editor } = makeWorld();
            const a = addLine(model, 10, 10, 30, 10); // right edge = 30
            const b = addLine(model, 100, 30, 120, 30); // right edge = 120 (rightmost)
            a.setSelected(true);
            b.setSelected(true);

            editor.alignRightSelected();

            // Both right edges should now be at x=120.
            // Using getPosition().x + getSize().width as in the implementation.
            const aRight = a.getPosition().x + a.getSize().width;
            const bRight = b.getPosition().x + b.getSize().width;
            expect(aRight).toBe(120);
            expect(bRight).toBe(120);
        });

        it('no-op when nothing selected', () => {
            const { model, editor, undo } = makeWorld();
            const a = addLine(model, 10, 10, 30, 10);
            editor.alignRightSelected();
            expect(undo.canUndo()).toBe(false);
            expect(a.getPosition().x).toBe(10);
        });
    });

    describe('alignTopSelected', () => {
        it('moves selected primitives to the topmost selected y', () => {
            const { model, editor } = makeWorld();
            const a = addLine(model, 10, 20, 50, 20); // top = 20 (topmost)
            const b = addLine(model, 60, 80, 100, 80); // top = 80
            a.setSelected(true);
            b.setSelected(true);

            editor.alignTopSelected();

            expect(a.getPosition().y).toBe(20);
            expect(b.getPosition().y).toBe(20);
        });

        it('no-op when nothing selected', () => {
            const { model, editor, undo } = makeWorld();
            addLine(model, 10, 20, 50, 20);
            editor.alignTopSelected();
            expect(undo.canUndo()).toBe(false);
        });
    });

    describe('alignBottomSelected', () => {
        it('moves selected primitives to the bottommost selected y+height', () => {
            const { model, editor } = makeWorld();
            const a = addLine(model, 10, 10, 50, 30); // bottom = 30
            const b = addLine(model, 60, 50, 100, 100); // bottom = 100 (bottommost)
            a.setSelected(true);
            b.setSelected(true);

            editor.alignBottomSelected();

            expect(a.getPosition().y + a.getSize().height).toBe(100);
            expect(b.getPosition().y + b.getSize().height).toBe(100);
        });
    });
});

describe('EditorActions — selectRect', () => {
    it('selects primitives fully inside the rectangle', () => {
        const { model, editor } = makeWorld();
        const inside = addLine(model, 20, 20, 30, 30);
        const outside = addLine(model, 200, 200, 300, 300);

        const ok = editor.selectRect(10, 10, 50, 50);

        expect(ok).toBe(true);
        expect(inside.isSelected()).toBe(true);
        expect(outside.isSelected()).toBe(false);
    });

    it('returns false when no primitives are inside', () => {
        const { model, editor } = makeWorld();
        addLine(model, 500, 500, 600, 600);
        const ok = editor.selectRect(10, 10, 50, 50);
        expect(ok).toBe(false);
    });
});

describe('EditorActions — distancePrimitive', () => {
    it('returns the minimum distance to the closest primitive', () => {
        const { model, editor } = makeWorld();
        addLine(model, 0, 0, 100, 0); // along the X axis
        const d = editor.distancePrimitive(50, 0);
        expect(d).toBeLessThanOrEqual(1); // basically on top of the line
    });

    it('returns MAX_SAFE_INTEGER (or similar very large) for empty model', () => {
        const { editor } = makeWorld();
        const d = editor.distancePrimitive(0, 0);
        expect(d).toBeGreaterThan(1_000_000);
    });
});

describe('EditorActions — deleteAllSelected', () => {
    it('removes selected primitives, leaves unselected ones', () => {
        const { model, editor } = makeWorld();
        const a = addLine(model, 10, 10, 20, 20);
        const b = addLine(model, 30, 30, 40, 40);
        a.setSelected(true);

        editor.deleteAllSelected(true);

        const prims = model.getPrimitiveVector();
        expect(prims.length).toBe(1);
        expect(prims[0]).toBe(b);
    });

    it('saveState=true pushes an undo state', () => {
        const { model, editor, undo } = makeWorld();
        const a = addLine(model, 10, 10, 20, 20);
        a.setSelected(true);
        editor.deleteAllSelected(true);
        expect(undo.canUndo()).toBe(true);
    });

    it('saveState=false does NOT push an undo state', () => {
        const { model, editor, undo } = makeWorld();
        const a = addLine(model, 10, 10, 20, 20);
        a.setSelected(true);
        editor.deleteAllSelected(false);
        expect(undo.canUndo()).toBe(false);
    });
});

describe('EditorActions — setLayerForSelectedPrimitives', () => {
    it('changes the layer for selected primitives only', () => {
        const { model, editor } = makeWorld();
        const a = addLine(model, 10, 10, 20, 20);
        const b = addLine(model, 30, 30, 40, 40);
        a.setSelected(true);

        const changed = editor.setLayerForSelectedPrimitives(3);

        expect(changed).toBe(true);
        expect(a.getLayer()).toBe(3);
        expect(b.getLayer()).toBe(0);
    });

    it('returns false when no primitives are selected', () => {
        const { model, editor } = makeWorld();
        addLine(model, 10, 10, 20, 20);
        const changed = editor.setLayerForSelectedPrimitives(3);
        expect(changed).toBe(false);
    });
});
