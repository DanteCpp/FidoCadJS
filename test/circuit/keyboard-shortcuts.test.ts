/**
 * @file keyboard-shortcuts.test.ts
 * @author Dante Loi
 * @date 2026-05-08
 * @brief Tests for all keyboard shortcuts in CircuitPanel
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { CircuitPanel } from '../../src/circuit/CircuitPanel.js';
import { ElementsEdtActions } from '../../src/circuit/controllers/ElementsEdtActions.js';
import { PrimitiveLine } from '../../src/primitives/PrimitiveLine.js';

// jsdom does not ship ResizeObserver or full Canvas 2D — provide minimal stubs
beforeAll(() => {
    if (typeof ResizeObserver === 'undefined') {
        (globalThis as any).ResizeObserver = class {
            observe() {}
            unobserve() {}
            disconnect() {}
        };
    }

    // Provide a stub 2D context so GraphicsCanvas can construct
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string, ...args: any[]) {
        if (contextId === '2d') {
            return createStub2DContext();
        }
        return origGetContext.call(this, contextId, ...args);
    } as typeof origGetContext;
});

function createStub2DContext(): any {
    return {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        font: '12px sans-serif',
        globalAlpha: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
        miterLimit: 10,
        measureText(_text: string) {
            return { width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 };
        },
        fillText() {},
        strokeText() {},
        fillRect() {},
        strokeRect() {},
        clearRect() {},
        beginPath() {},
        closePath() {},
        moveTo() {},
        lineTo() {},
        arc() {},
        arcTo() {},
        bezierCurveTo() {},
        quadraticCurveTo() {},
        rect() {},
        ellipse() {},
        fill() {},
        stroke() {},
        clip() {},
        save() {},
        restore() {},
        scale() {},
        rotate() {},
        translate() {},
        transform() {},
        setTransform() {},
        drawImage() {},
        createImageData() {
            return { data: new Uint8ClampedArray(), width: 0, height: 0 };
        },
        getImageData() {
            return { data: new Uint8ClampedArray(), width: 0, height: 0 };
        },
        putImageData() {},
        setLineDash() {},
        getLineDash() {
            return [];
        },
    };
}

/** Dispatch a keydown event that bubbles to the document listener */
function pressKey(
    target: HTMLElement,
    key: string,
    opts: { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean } = {}
): void {
    target.dispatchEvent(
        new KeyboardEvent('keydown', {
            key,
            ctrlKey: opts.ctrlKey ?? false,
            shiftKey: opts.shiftKey ?? false,
            altKey: opts.altKey ?? false,
            metaKey: opts.metaKey ?? false,
            bubbles: true,
            cancelable: true,
        })
    );
}

/** Create a simple line primitive and add it to the panel's model */
function addLineToPanel(panel: CircuitPanel, x1: number, y1: number, x2: number, y2: number, layer: number): void {
    const prim = new PrimitiveLine(x1, y1, x2, y2, layer, false, false, 0, 3, 2, 0, '', 4);
    // Access model via the canvas back-reference
    const model = (panel as any).model;
    model.getPrimitiveVector().push(prim);
}

function selectAll(panel: CircuitPanel): void {
    (panel as any).selectionActions.setSelectionAll(true);
}

function getModelPrimitives(panel: CircuitPanel): any[] {
    return (panel as any).model.getPrimitiveVector();
}

describe('Keyboard Shortcuts', () => {
    let container: HTMLDivElement;
    let panel: CircuitPanel;
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
        container = document.createElement('div');
        container.style.width = '800px';
        container.style.height = '600px';
        document.body.appendChild(container);

        panel = new CircuitPanel(container);
        panel.addKeyboardListeners();
        canvas = container.querySelector('canvas')!;

        // Focus the canvas so key events target it
        canvas.focus();
    });

    // ─── Tool selection shortcuts (single key, no modifier) ────────────────

    describe('Tool selection shortcuts', () => {
        it('A selects the Selection tool', () => {
            panel.setTool(ElementsEdtActions.LINE);
            pressKey(canvas, 'a');
            expect(panel.getTool()).toBe(ElementsEdtActions.SELECTION);
        });

        it('L selects the Line tool', () => {
            pressKey(canvas, 'l');
            expect(panel.getTool()).toBe(ElementsEdtActions.LINE);
        });

        it('T selects the Text tool', () => {
            pressKey(canvas, 't');
            expect(panel.getTool()).toBe(ElementsEdtActions.TEXT);
        });

        it('B selects the Bezier tool', () => {
            pressKey(canvas, 'b');
            expect(panel.getTool()).toBe(ElementsEdtActions.BEZIER);
        });

        it('P selects the Polygon tool', () => {
            pressKey(canvas, 'p');
            expect(panel.getTool()).toBe(ElementsEdtActions.POLYGON);
        });

        it('O selects the Complex curve tool', () => {
            pressKey(canvas, 'o');
            expect(panel.getTool()).toBe(ElementsEdtActions.COMPLEXCURVE);
        });

        it('E selects the Ellipse tool', () => {
            pressKey(canvas, 'e');
            expect(panel.getTool()).toBe(ElementsEdtActions.ELLIPSE);
        });

        it('G selects the Rectangle tool', () => {
            pressKey(canvas, 'g');
            expect(panel.getTool()).toBe(ElementsEdtActions.RECTANGLE);
        });

        it('C selects the Connection tool', () => {
            pressKey(canvas, 'c');
            expect(panel.getTool()).toBe(ElementsEdtActions.CONNECTION);
        });

        it('I selects the PCB track tool', () => {
            pressKey(canvas, 'i');
            expect(panel.getTool()).toBe(ElementsEdtActions.PCB_LINE);
        });

        it('Z selects the PCB pad tool', () => {
            pressKey(canvas, 'z');
            expect(panel.getTool()).toBe(ElementsEdtActions.PCB_PAD);
        });

        it('uppercase letters also work for tool selection', () => {
            pressKey(canvas, 'L');
            expect(panel.getTool()).toBe(ElementsEdtActions.LINE);

            pressKey(canvas, 'G');
            expect(panel.getTool()).toBe(ElementsEdtActions.RECTANGLE);
        });
    });

    // ─── Special action keys ────────────────────────────────────────────────

    describe('Special keys', () => {
        it('Space triggers fit-to-view', () => {
            // Add primitives to create non-zero bounding box
            addLineToPanel(panel, 0, 0, 100, 100, 0);
            panel.render();

            // Force a known zoom state first, then fit
            panel.setZoom(1); // 5%
            const zoomBefore = panel.getZoomPercent();
            expect(zoomBefore).toBeLessThan(100);

            pressKey(canvas, ' ');
            const zoomAfter = panel.getZoomPercent();

            // Fit-to-view should zoom to fit the 100×100 content,
            // which should be different from the forced 5%
            expect(zoomAfter).not.toBe(zoomBefore);
        });

        it('Escape clears selection and switches to Selection tool', () => {
            panel.setTool(ElementsEdtActions.LINE);
            addLineToPanel(panel, 0, 0, 10, 10, 0);
            selectAll(panel);

            pressKey(canvas, 'Escape');

            expect(panel.getTool()).toBe(ElementsEdtActions.SELECTION);
            // All primitives should be deselected
            for (const prim of getModelPrimitives(panel)) {
                expect(prim.isSelected()).toBe(false);
            }
        });

        it('+ zooms in', () => {
            const before = panel.getZoomPercent();
            pressKey(canvas, '+');
            expect(panel.getZoomPercent()).toBeGreaterThan(before);
        });

        it('= also zooms in (same key without Shift)', () => {
            const before = panel.getZoomPercent();
            pressKey(canvas, '=');
            expect(panel.getZoomPercent()).toBeGreaterThan(before);
        });

        it('- zooms out', () => {
            // Zoom in first to have room to zoom out
            panel.setZoom(4); // 20%
            const before = panel.getZoomPercent();
            pressKey(canvas, '-');
            expect(panel.getZoomPercent()).toBeLessThan(before);
        });

        it('Ctrl+Z triggers undo', () => {
            // Verify the shortcut dispatches without errors
            addLineToPanel(panel, 0, 0, 10, 10, 0);
            (panel as any).undoActions.saveUndoState();
            expect(() => pressKey(canvas, 'z', { ctrlKey: true })).not.toThrow();
        });

        it('Ctrl+Y triggers redo', () => {
            expect(() => pressKey(canvas, 'y', { ctrlKey: true })).not.toThrow();
        });

        it('Ctrl+Shift+Z also triggers redo', () => {
            expect(() => pressKey(canvas, 'z', { ctrlKey: true, shiftKey: true })).not.toThrow();
        });
    });

    // ─── Transform shortcuts (require selection) ────────────────────────────

    describe('Transform shortcuts (with selection)', () => {
        it('R rotates selected primitives', () => {
            addLineToPanel(panel, 10, 10, 30, 10, 0);
            selectAll(panel);
            const prim = getModelPrimitives(panel)[0];
            const x0 = prim.virtualPoint[0].x;
            const y0 = prim.virtualPoint[0].y;
            const x1 = prim.virtualPoint[1].x;
            const y1 = prim.virtualPoint[1].y;

            pressKey(canvas, 'r');

            // After 90° clockwise rotation, coordinates should change
            const x0r = prim.virtualPoint[0].x;
            const y0r = prim.virtualPoint[0].y;
            const x1r = prim.virtualPoint[1].x;
            const y1r = prim.virtualPoint[1].y;

            // At least one coordinate should have changed
            const changed =
                x0 !== x0r || y0 !== y0r || x1 !== x1r || y1 !== y1r;
            expect(changed).toBe(true);
        });

        it('R does nothing when nothing is selected', () => {
            panel.setTool(ElementsEdtActions.LINE);
            pressKey(canvas, 'r');
            // Tool should NOT change to selection — R is not a tool shortcut
            expect(panel.getTool()).toBe(ElementsEdtActions.LINE);
        });

        it('S mirrors selected primitives horizontally', () => {
            // Line from (10,10) to (40,10), layer 0
            // Mirror axis is first point's x = 10
            // Point at x=10 stays (on the axis)
            // Point at x=40 → mirror = 10 - (40-10) = -20
            addLineToPanel(panel, 10, 10, 40, 10, 0);
            selectAll(panel);
            const prim = getModelPrimitives(panel)[0];

            pressKey(canvas, 's');

            expect(prim.virtualPoint[0].x).toBe(10);   // on axis, unchanged
            expect(prim.virtualPoint[1].x).toBe(-20);  // mirrored across x=10
        });

        it('M starts move mode for selected elements', () => {
            addLineToPanel(panel, 10, 10, 30, 10, 0);
            selectAll(panel);

            const cursorBefore = canvas.style.cursor;
            pressKey(canvas, 'm');

            // Cursor should change to 'move'
            expect(canvas.style.cursor).toBe('move');
            expect(canvas.style.cursor).not.toBe(cursorBefore);
        });

        it('M does nothing when nothing is selected', () => {
            panel.setTool(ElementsEdtActions.LINE);
            pressKey(canvas, 'm');
            // Tool should not change — M is a transform, not a tool shortcut
            expect(panel.getTool()).toBe(ElementsEdtActions.LINE);
        });

        it('Delete removes selected primitives', () => {
            addLineToPanel(panel, 0, 0, 10, 10, 0);
            addLineToPanel(panel, 10, 10, 20, 20, 0);
            selectAll(panel);
            expect(getModelPrimitives(panel)).toHaveLength(2);

            pressKey(canvas, 'Delete');
            expect(getModelPrimitives(panel)).toHaveLength(0);
        });

        it('Backspace removes selected primitives', () => {
            addLineToPanel(panel, 0, 0, 10, 10, 0);
            selectAll(panel);
            expect(getModelPrimitives(panel)).toHaveLength(1);

            pressKey(canvas, 'Backspace');
            expect(getModelPrimitives(panel)).toHaveLength(0);
        });

        it('Delete does nothing when nothing is selected', () => {
            addLineToPanel(panel, 0, 0, 10, 10, 0);
            expect(getModelPrimitives(panel)).toHaveLength(1);

            pressKey(canvas, 'Delete');
            // Nothing selected, so nothing deleted
            expect(getModelPrimitives(panel)).toHaveLength(1);
        });
    });

    // ─── Alt + arrow nudge ──────────────────────────────────────────────────

    describe('Nudge with Alt + arrow keys', () => {
        it('Alt+ArrowLeft nudges selected left by 1 unit', () => {
            addLineToPanel(panel, 10, 10, 30, 10, 0);
            selectAll(panel);
            const prim = getModelPrimitives(panel)[0];
            const x0 = prim.virtualPoint[0].x;
            const x1 = prim.virtualPoint[1].x;

            pressKey(canvas, 'ArrowLeft', { altKey: true });

            expect(prim.virtualPoint[0].x).toBe(x0 - 1);
            expect(prim.virtualPoint[1].x).toBe(x1 - 1);
        });

        it('Alt+ArrowRight nudges selected right by 1 unit', () => {
            addLineToPanel(panel, 10, 10, 30, 10, 0);
            selectAll(panel);
            const prim = getModelPrimitives(panel)[0];
            const x0 = prim.virtualPoint[0].x;

            pressKey(canvas, 'ArrowRight', { altKey: true });

            expect(prim.virtualPoint[0].x).toBe(x0 + 1);
        });

        it('Alt+ArrowUp nudges selected up by 1 unit', () => {
            addLineToPanel(panel, 10, 10, 30, 10, 0);
            selectAll(panel);
            const prim = getModelPrimitives(panel)[0];
            const y0 = prim.virtualPoint[0].y;

            pressKey(canvas, 'ArrowUp', { altKey: true });

            expect(prim.virtualPoint[0].y).toBe(y0 + 1);
        });

        it('Alt+ArrowDown nudges selected down by 1 unit', () => {
            addLineToPanel(panel, 10, 10, 30, 10, 0);
            selectAll(panel);
            const prim = getModelPrimitives(panel)[0];
            const y0 = prim.virtualPoint[0].y;

            pressKey(canvas, 'ArrowDown', { altKey: true });

            expect(prim.virtualPoint[0].y).toBe(y0 - 1);
        });

        it('Alt+arrow does nothing when nothing is selected', () => {
            addLineToPanel(panel, 10, 10, 30, 10, 0);
            const prim = getModelPrimitives(panel)[0];
            const x0 = prim.virtualPoint[0].x;

            pressKey(canvas, 'ArrowLeft', { altKey: true });
            // Nothing selected, coordinates should be unchanged
            expect(prim.virtualPoint[0].x).toBe(x0);
        });
    });

    // ─── Clipboard shortcuts ────────────────────────────────────────────────

    describe('Clipboard shortcuts', () => {
        it('Ctrl+C copies selected primitives to clipboard', () => {
            addLineToPanel(panel, 10, 10, 30, 10, 0);
            selectAll(panel);

            // clipboard is private; verify no crash
            expect(() => pressKey(canvas, 'c', { ctrlKey: true })).not.toThrow();
        });

        it('Ctrl+X cuts selected primitives', () => {
            addLineToPanel(panel, 10, 10, 30, 10, 0);
            selectAll(panel);
            expect(getModelPrimitives(panel)).toHaveLength(1);

            pressKey(canvas, 'x', { ctrlKey: true });
            // Cut should delete selected
            expect(getModelPrimitives(panel)).toHaveLength(0);
        });

        it('Ctrl+D duplicates selected primitives', () => {
            addLineToPanel(panel, 10, 10, 30, 10, 0);
            selectAll(panel);
            expect(getModelPrimitives(panel)).toHaveLength(1);

            // Ctrl+D copy + paste — verify no crash
            expect(() => pressKey(canvas, 'd', { ctrlKey: true })).not.toThrow();
        });
    });

    // ─── Input element blocking ─────────────────────────────────────────────

    describe('Input element does not steal shortcuts', () => {
        it('tool shortcut keys are blocked when focus is on an input element', () => {
            const input = document.createElement('input');
            input.type = 'text';
            document.body.appendChild(input);
            input.focus();

            panel.setTool(ElementsEdtActions.LINE);

            // Press L while input is focused — should NOT change tool
            pressKey(input, 'l');
            expect(panel.getTool()).toBe(ElementsEdtActions.LINE);

            document.body.removeChild(input);
            canvas.focus();
        });

        it('tool shortcut keys are blocked when focus is on a textarea', () => {
            const textarea = document.createElement('textarea');
            document.body.appendChild(textarea);
            textarea.focus();

            panel.setTool(ElementsEdtActions.LINE);

            pressKey(textarea, 'g');
            expect(panel.getTool()).toBe(ElementsEdtActions.LINE);

            document.body.removeChild(textarea);
            canvas.focus();
        });

        it('tool shortcut keys are blocked when focus is on a select element', () => {
            const select = document.createElement('select');
            document.body.appendChild(select);
            select.focus();

            panel.setTool(ElementsEdtActions.LINE);

            pressKey(select, 'c');
            expect(panel.getTool()).toBe(ElementsEdtActions.LINE);

            document.body.removeChild(select);
            canvas.focus();
        });

        it('global Ctrl shortcuts still work when focus is on an input', () => {
            // Ctrl+S should still forward even from input
            const input = document.createElement('input');
            input.type = 'text';
            document.body.appendChild(input);
            input.focus();

            // Verify no crash when Ctrl+S is pressed while input is focused
            // (menuBar is null so saveFile is not called, but the event is forwarded)
            expect(() => pressKey(input, 's', { ctrlKey: true })).not.toThrow();

            document.body.removeChild(input);
            canvas.focus();
        });
    });

    // ─── Edge cases ─────────────────────────────────────────────────────────

    describe('Edge cases', () => {
        it('Ctrl+Shift+S triggers save-as without triggering mirror', () => {
            // mirror uses 's' without Ctrl; Ctrl+Shift+S should not mirror
            panel.setTool(ElementsEdtActions.LINE);
            pressKey(canvas, 's', { ctrlKey: true, shiftKey: true });

            // Should not have changed tool (not a mirror shortcut)
            expect(panel.getTool()).toBe(ElementsEdtActions.LINE);
        });

        it('Ctrl+E does not switch to Ellipse tool', () => {
            panel.setTool(ElementsEdtActions.LINE);
            pressKey(canvas, 'e', { ctrlKey: true });

            // Ctrl+E is export, not ellipse tool
            expect(panel.getTool()).toBe(ElementsEdtActions.LINE);
        });

        it('Ctrl+P does not switch to Polygon tool', () => {
            panel.setTool(ElementsEdtActions.LINE);
            pressKey(canvas, 'p', { ctrlKey: true });

            // Ctrl+P is print, not polygon tool
            expect(panel.getTool()).toBe(ElementsEdtActions.LINE);
        });

        it('Ctrl+O does not switch to Complex curve tool', () => {
            panel.setTool(ElementsEdtActions.LINE);
            pressKey(canvas, 'o', { ctrlKey: true });

            // Ctrl+O is open file, not complex curve tool
            expect(panel.getTool()).toBe(ElementsEdtActions.LINE);
        });

        it('Ctrl+Z does not switch to PCB pad tool', () => {
            panel.setTool(ElementsEdtActions.LINE);
            pressKey(canvas, 'z', { ctrlKey: true });

            // Ctrl+Z is undo, not PCB pad tool
            expect(panel.getTool()).toBe(ElementsEdtActions.LINE);
        });

        it('unknown keys do not crash or change state', () => {
            panel.setTool(ElementsEdtActions.LINE);
            pressKey(canvas, 'q');
            expect(panel.getTool()).toBe(ElementsEdtActions.LINE);

            pressKey(canvas, '1');
            expect(panel.getTool()).toBe(ElementsEdtActions.LINE);

            pressKey(canvas, 'F1');
            expect(panel.getTool()).toBe(ElementsEdtActions.LINE);
        });
    });
});
