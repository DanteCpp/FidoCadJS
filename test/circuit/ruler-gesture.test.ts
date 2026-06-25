import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { CircuitPanel } from '../../src/circuit/CircuitPanel.js';
import { Tool } from '../../src/circuit/controllers/Tool.js';

// jsdom ships neither ResizeObserver nor a real Canvas 2D context.
beforeAll(() => {
    if (typeof ResizeObserver === 'undefined') {
        (globalThis as any).ResizeObserver = class {
            observe() {}
            unobserve() {}
            disconnect() {}
        };
    }
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        contextId: string,
        ...args: any[]
    ) {
        if (contextId === '2d') return createStub2DContext();
        return origGetContext.call(this, contextId, ...args);
    } as typeof origGetContext;
});

function createStub2DContext(): any {
    const noop = () => {};
    return new Proxy({ measureText: () => ({ width: 0 }), getLineDash: () => [] } as any, {
        get(target, prop) {
            return prop in target ? (target as any)[prop] : noop;
        },
        set() {
            return true;
        },
    });
}

function mouse(
    canvas: HTMLCanvasElement,
    type: string,
    x: number,
    y: number,
    opts: { button?: number; buttons?: number; shiftKey?: boolean } = {},
): void {
    canvas.dispatchEvent(
        new MouseEvent(type, {
            clientX: x,
            clientY: y,
            button: opts.button ?? 0,
            buttons: opts.buttons ?? 0,
            shiftKey: opts.shiftKey ?? false,
            bubbles: true,
            cancelable: true,
        }),
    );
}

describe('Ruler via Shift + left-drag (trackpad-friendly)', () => {
    let container: HTMLDivElement;
    let panel: CircuitPanel;
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        panel = new CircuitPanel(container);
        canvas = container.querySelector('canvas')!;
        canvas.width = 800;
        canvas.height = 600;
        panel.setTool(Tool.SELECTION);
    });

    function ruler() {
        return (panel as any).inputHandler.ruler;
    }

    it('Shift + left-drag activates and draws the ruler', () => {
        mouse(canvas, 'mousedown', 100, 100, { button: 0, shiftKey: true });
        // Drag with the left button held (buttons bit 1).
        mouse(canvas, 'mousemove', 250, 180, { buttons: 1, shiftKey: true });
        expect(ruler().isActive()).toBe(true);

        // Releasing leaves the measurement on screen (like the right-drag ruler).
        mouse(canvas, 'mouseup', 250, 180, { button: 0 });
        expect(ruler().isActive()).toBe(true);
    });

    it('Shift + left-drag does not start a rubber-band selection', () => {
        // A normal left-drag would begin a selection rectangle; Shift suppresses it.
        mouse(canvas, 'mousedown', 100, 100, { button: 0, shiftKey: true });
        mouse(canvas, 'mousemove', 250, 180, { buttons: 1, shiftKey: true });
        expect((panel as any).inputHandler.state.selRectActive).toBe(false);
    });

    it('a plain Shift-click (no drag) leaves no measurement', () => {
        mouse(canvas, 'mousedown', 100, 100, { button: 0, shiftKey: true });
        mouse(canvas, 'mouseup', 100, 100, { button: 0 });
        expect(ruler().isActive()).toBe(false);
    });
});
