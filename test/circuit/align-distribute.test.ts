import { describe, it, expect, vi } from 'vitest';
import { DrawingModel } from '../../src/circuit/model/DrawingModel.js';
import { EditorActions } from '../../src/circuit/controllers/EditorActions.js';
import { PrimitiveLine } from '../../src/primitives/PrimitiveLine.js';
import { PrimitiveRectangle } from '../../src/primitives/PrimitiveRectangle.js';

/** Create an EditorActions instance with a real model and stubs. */
function makeEditorActions(model: DrawingModel): EditorActions {
    const undoActions = {
        saveUndoState: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        canUndo: () => false,
        canRedo: () => false,
    } as any;

    const selectionActions = {
        setSelectionAll: vi.fn(),
        setSelectionNone: vi.fn(),
        getSelection: () => [],
    } as any;

    return new EditorActions(model, selectionActions, undoActions);
}

/** Create a PrimitiveLine at a specific position with a known size. */
function makeLine(x: number, y: number, x2: number, y2: number): PrimitiveLine {
    const line = new PrimitiveLine('sans-serif', 12);
    line.parseTokens(['LI', String(x), String(y), String(x2), String(y2), '0'], 6);
    return line;
}

/** Create a PrimitiveRectangle at a specific position. */
function makeRect(x: number, y: number, w: number, h: number): PrimitiveRectangle {
    const rect = new PrimitiveRectangle('sans-serif', 12);
    rect.parseTokens(['RV', String(x), String(y), String(x + w), String(y + h), '0'], 6);
    return rect;
}

describe('Align Center', () => {
    it('alignHorizontalCenter aligns primitives to the horizontal center of selection', () => {
        const model = new DrawingModel();
        const actions = makeEditorActions(model);

        // Add three primitives at different X positions, select all
        const p1 = makeLine(0, 0, 10, 0); // x=0, w=10
        const p2 = makeLine(20, 10, 50, 10); // x=20, w=30
        const p3 = makeLine(50, 20, 80, 20); // x=50, w=30
        model.addPrimitive(p1, false, null);
        model.addPrimitive(p2, false, null);
        model.addPrimitive(p3, false, null);

        // Select all
        for (const p of model.getPrimitiveVector()) {
            (p as any).setSelected?.(true);
        }

        // Bounding box: minX=0, maxX=80, centerX=40
        // p1 center: 5 → dx=35
        // p2 center: 35 → dx=5
        // p3 center: 65 → dx=-25
        actions.alignHorizontalCenterSelected();

        expect(p1.getPosition().x).toBe(35);
        expect(p2.getPosition().x).toBe(25);
        expect(p3.getPosition().x).toBe(25);
    });

    it('alignVerticalCenter aligns primitives to the vertical center of selection', () => {
        const model = new DrawingModel();
        const actions = makeEditorActions(model);

        // Use rectangles so width/height are well-defined
        const p1 = makeRect(0, 0, 10, 10); // y=0, h=10, center y=5
        const p2 = makeRect(10, 20, 10, 30); // y=20, h=30, center y=35
        const p3 = makeRect(20, 50, 10, 30); // y=50, h=30, center y=65
        model.addPrimitive(p1, false, null);
        model.addPrimitive(p2, false, null);
        model.addPrimitive(p3, false, null);

        for (const p of model.getPrimitiveVector()) {
            (p as any).setSelected?.(true);
        }

        // Bounding box: minY=0, maxY=80, centerY=40
        // p1 center: 5 → dy=35
        // p2 center: 35 → dy=5
        // p3 center: 65 → dy=-25
        actions.alignVerticalCenterSelected();

        expect(p1.getPosition().y).toBe(35);
        expect(p2.getPosition().y).toBe(25);
        expect(p3.getPosition().y).toBe(25);
    });

    it('no-op when nothing selected', () => {
        const model = new DrawingModel();
        const actions = makeEditorActions(model);

        const p = makeLine(0, 0, 10, 0);
        model.addPrimitive(p, false, null);
        // Not selected

        expect(() => actions.alignHorizontalCenterSelected()).not.toThrow();
        expect(p.getPosition().x).toBe(0); // unchanged
        expect(() => actions.alignVerticalCenterSelected()).not.toThrow();
        expect(p.getPosition().y).toBe(0); // unchanged
    });
});

describe('Distribute', () => {
    it('distributeHorizontally spaces primitives evenly between extremes', () => {
        const model = new DrawingModel();
        const actions = makeEditorActions(model);

        const p1 = makeRect(0, 0, 10, 10); // center x=5
        const p2 = makeRect(20, 10, 10, 10); // center x=25
        const p3 = makeRect(60, 20, 10, 10); // center x=65
        const p4 = makeRect(100, 30, 10, 10); // center x=105
        model.addPrimitive(p1, false, null);
        model.addPrimitive(p2, false, null);
        model.addPrimitive(p3, false, null);
        model.addPrimitive(p4, false, null);

        for (const p of model.getPrimitiveVector()) {
            (p as any).setSelected?.(true);
        }

        // Extremes: first=5, last=105, step=(105-5)/3 = 33.33
        // p1 stays at 5
        // p2 target: 5 + 33.33 = 38.33, current=25 → +13.33
        // p3 target: 5 + 66.67 = 71.67, current=65 → +6.67
        // p4 stays at 105
        actions.distributeHorizontallySelected();

        expect(p1.getPosition().x).toBe(0); // unchanged (first)
        expect(p4.getPosition().x).toBe(100); // unchanged (last)
        // p2 and p3 should have moved
        expect(p2.getPosition().x).toBeCloseTo(33.33, 0);
        expect(p3.getPosition().x).toBeCloseTo(66.67, 0);
    });

    it('distributeVertically spaces primitives evenly between extremes', () => {
        const model = new DrawingModel();
        const actions = makeEditorActions(model);

        const p1 = makeRect(0, 0, 10, 10); // center y=5
        const p2 = makeRect(10, 20, 10, 10); // center y=25
        const p3 = makeRect(20, 60, 10, 10); // center y=65
        const p4 = makeRect(30, 100, 10, 10); // center y=105
        model.addPrimitive(p1, false, null);
        model.addPrimitive(p2, false, null);
        model.addPrimitive(p3, false, null);
        model.addPrimitive(p4, false, null);

        for (const p of model.getPrimitiveVector()) {
            (p as any).setSelected?.(true);
        }

        actions.distributeVerticallySelected();

        expect(p1.getPosition().y).toBe(0); // unchanged (first)
        expect(p4.getPosition().y).toBe(100); // unchanged (last)
        expect(p2.getPosition().y).toBeCloseTo(33.33, 0);
        expect(p3.getPosition().y).toBeCloseTo(66.67, 0);
    });

    it('no-op when fewer than 3 selected', () => {
        const model = new DrawingModel();
        const actions = makeEditorActions(model);

        const p1 = makeRect(0, 0, 10, 10);
        const p2 = makeRect(50, 0, 10, 10);
        model.addPrimitive(p1, false, null);
        model.addPrimitive(p2, false, null);

        for (const p of model.getPrimitiveVector()) {
            (p as any).setSelected?.(true);
        }

        expect(() => actions.distributeHorizontallySelected()).not.toThrow();
        expect(() => actions.distributeVerticallySelected()).not.toThrow();
        // Positions unchanged
        expect(p1.getPosition().x).toBe(0);
        expect(p2.getPosition().x).toBe(50);
    });
});
