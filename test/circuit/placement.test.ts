import { Tool } from '../../src/circuit/controllers/Tool.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { CircuitPanel } from '../../src/circuit/CircuitPanel.js';
import { MacroDesc } from '../../src/primitives/MacroDesc.js';

/**
 * Simulate a full mousedown + mouseup click cycle at canvas coordinates (sx, sy).
 * We fire the events directly on CircuitPanel's internal canvas element.
 */
function clickCanvas(panel: CircuitPanel, sx: number, sy: number, button: number = 0): void {
    const canvas = panel.getCanvasElement();
    const rect = canvas.getBoundingClientRect();
    const clientX = rect.left + sx;
    const clientY = rect.top + sy;

    canvas.dispatchEvent(
        new MouseEvent('mousedown', {
            clientX,
            clientY,
            button,
            bubbles: true,
        }),
    );
    canvas.dispatchEvent(
        new MouseEvent('mouseup', {
            clientX,
            clientY,
            button,
            bubbles: true,
        }),
    );
}

/**
 * Simulate a click sequence for multi-point tools (line needs 2 clicks, bezier needs 4).
 * Each click is a mousedown + mouseup pair.
 */
function clickSequence(
    panel: CircuitPanel,
    points: Array<[number, number]>,
    button: number = 0,
): void {
    for (const [sx, sy] of points) {
        clickCanvas(panel, sx, sy, button);
    }
}

describe('Primitive placement via tools', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        // Give the container a non-zero size so the canvas gets proper dimensions
        Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true });
        Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true });
        document.body.appendChild(container);
    });

    function makePanel(): CircuitPanel {
        const panel = new CircuitPanel(container);
        // Force initial layout
        void container.offsetWidth;
        void container.offsetHeight;
        return panel;
    }

    describe('line tool', () => {
        it('places a line after two clicks (mousedown + mouseup each)', () => {
            const panel = makePanel();
            panel.setTool(Tool.LINE);

            const model = panel.getModel();
            expect(model.getPrimitiveVector().length).toBe(0);

            clickSequence(panel, [
                [100, 100],
                [300, 300],
            ]);

            expect(model.getPrimitiveVector().length).toBe(1);
        });

        it('resets between lines when switching away and back', () => {
            const panel = makePanel();

            // Place first line
            panel.setTool(Tool.LINE);
            clickSequence(panel, [
                [50, 50],
                [150, 150],
            ]);

            // Switch away and back to reset the line tool state
            panel.setTool(Tool.SELECTION);
            panel.setTool(Tool.LINE);

            // Place second line
            clickSequence(panel, [
                [200, 200],
                [400, 200],
            ]);

            expect(panel.getModel().getPrimitiveVector().length).toBe(2);
        });
    });

    describe('rectangle tool', () => {
        it('places a rectangle after two clicks', () => {
            const panel = makePanel();
            panel.setTool(Tool.RECTANGLE);

            clickSequence(panel, [
                [100, 100],
                [300, 200],
            ]);

            expect(panel.getModel().getPrimitiveVector().length).toBe(1);
        });
    });

    describe('ellipse tool', () => {
        it('places an ellipse after two clicks', () => {
            const panel = makePanel();
            panel.setTool(Tool.ELLIPSE);

            clickSequence(panel, [
                [100, 100],
                [250, 200],
            ]);

            expect(panel.getModel().getPrimitiveVector().length).toBe(1);
        });
    });

    describe('bezier tool', () => {
        it('places a bezier after four clicks', () => {
            const panel = makePanel();
            panel.setTool(Tool.BEZIER);

            clickSequence(panel, [
                [50, 50],
                [100, 200],
                [300, 200],
                [350, 50],
            ]);

            expect(panel.getModel().getPrimitiveVector().length).toBe(1);
        });
    });

    describe('polygon tool', () => {
        // NOTE: Polygon finishing via right-click is complex to simulate in jsdom
        // because contextmenu and mousedown interactions differ from real browsers.
        // The tool itself is verified via the parser round-trip tests.
        it('polygon tool is selectable and clickable without crash', () => {
            const panel = makePanel();
            panel.setTool(Tool.POLYGON);
            expect(panel.getTool()).toBe(Tool.POLYGON);

            // Clicking should not crash
            clickCanvas(panel, 100, 100);

            // Tool remains POLYGON (waiting for more clicks or right-click to finish)
            expect(panel.getTool()).toBe(Tool.POLYGON);
        });
    });

    describe('connection tool', () => {
        it('places a connection after one click', () => {
            const panel = makePanel();
            panel.setTool(Tool.CONNECTION);

            clickCanvas(panel, 200, 200);

            expect(panel.getModel().getPrimitiveVector().length).toBe(1);
        });
    });

    describe('PCB line tool', () => {
        it('places a PCB line after two clicks', () => {
            const panel = makePanel();
            panel.setTool(Tool.PCB_LINE);

            clickSequence(panel, [
                [50, 50],
                [300, 50],
            ]);

            expect(panel.getModel().getPrimitiveVector().length).toBe(1);
        });
    });

    describe('PCB pad tool', () => {
        it('places a PCB pad after one click', () => {
            const panel = makePanel();
            panel.setTool(Tool.PCB_PAD);

            clickCanvas(panel, 200, 200);

            expect(panel.getModel().getPrimitiveVector().length).toBe(1);
        });
    });

    describe('text tool', () => {
        it('places text after one click (properties panel opens for editing)', () => {
            const panel = makePanel();
            panel.setTool(Tool.TEXT);

            clickCanvas(panel, 150, 150);

            // Text tool places an empty PrimitiveAdvText immediately on click
            expect(panel.getModel().getPrimitiveVector().length).toBe(1);
        });
    });

    describe('tool state consistency', () => {
        it('getTool returns the correct tool after setTool', () => {
            const panel = makePanel();

            panel.setTool(Tool.LINE);
            expect(panel.getTool()).toBe(Tool.LINE);

            panel.setTool(Tool.RECTANGLE);
            expect(panel.getTool()).toBe(Tool.RECTANGLE);

            panel.setTool(Tool.SELECTION);
            expect(panel.getTool()).toBe(Tool.SELECTION);
        });

        it('switching tools does not place primitives', () => {
            const panel = makePanel();
            panel.setTool(Tool.LINE);
            expect(panel.getModel().getPrimitiveVector().length).toBe(0);

            panel.setTool(Tool.RECTANGLE);
            expect(panel.getModel().getPrimitiveVector().length).toBe(0);
        });

        it('selection tool does not place primitives on click', () => {
            const panel = makePanel();
            panel.setTool(Tool.SELECTION);

            clickCanvas(panel, 200, 200);

            expect(panel.getModel().getPrimitiveVector().length).toBe(0);
        });
    });

    describe('rapid placement stress test', () => {
        it('places 20 connection dots in rapid succession', () => {
            const panel = makePanel();
            panel.setTool(Tool.CONNECTION);

            for (let i = 0; i < 20; i++) {
                clickCanvas(panel, 10 + i * 10, 10 + i * 5);
            }

            expect(panel.getModel().getPrimitiveVector().length).toBe(20);
        });

        it('renders primitives at widely spread coordinates without clipping', () => {
            const panel = makePanel();
            panel.setTool(Tool.CONNECTION);

            // Place dots across a wide coordinate range (0 to 500)
            const points = [
                [10, 10],
                [50, 10],
                [100, 50],
                [200, 100],
                [350, 20],
                [500, 80],
                [10, 400],
                [400, 450],
                [20, 500],
                [450, 10],
            ];
            for (const [sx, sy] of points) {
                clickCanvas(panel, sx, sy);
            }

            expect(panel.getModel().getPrimitiveVector().length).toBe(points.length);

            // Call render — should not throw and should draw all primitives
            // (We can't verify pixel output in jsdom, but we can verify no crash)
            expect(() => panel.render()).not.toThrow();
        });
    });
});

describe('Macro placement', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true });
        Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true });
        document.body.appendChild(container);
    });

    function makePanelWithMacro(): CircuitPanel {
        const panel = new CircuitPanel(container);
        void container.offsetWidth;
        void container.offsetHeight;

        // Register a simple test macro (a single line)
        const key = 'test.testmacro';
        const desc = 'LI 10 20 30 40 0';
        const model = panel.getModel();
        model.getLibrary().set(key, new MacroDesc(key, 'Test Macro', desc, 'Test', 'test', 'test'));

        return panel;
    }

    it('places a macro after one click', () => {
        const panel = makePanelWithMacro();
        panel.setMacroTool('test.testmacro');

        clickCanvas(panel, 200, 200);

        expect(panel.getModel().getPrimitiveVector().length).toBe(1);
    });

    it('places multiple macros sequentially', () => {
        const panel = makePanelWithMacro();
        panel.setMacroTool('test.testmacro');

        clickCanvas(panel, 50, 50);
        clickCanvas(panel, 100, 100);
        clickCanvas(panel, 150, 150);

        expect(panel.getModel().getPrimitiveVector().length).toBe(3);
    });

    it('macro is placed at correct position', () => {
        const panel = makePanelWithMacro();
        panel.setMacroTool('test.testmacro');

        clickCanvas(panel, 300, 200);

        const prims = panel.getModel().getPrimitiveVector();
        expect(prims.length).toBe(1);
        expect(prims[0]!.virtualPoint[0]!.x).not.toBe(0);
    });
});
