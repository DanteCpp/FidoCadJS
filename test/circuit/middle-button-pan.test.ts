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
    return new Proxy(
        {
            measureText: () => ({ width: 0 }),
            getLineDash: () => [],
        } as any,
        {
            get(target, prop) {
                return prop in target ? (target as any)[prop] : noop;
            },
            set() {
                return true;
            },
        },
    );
}

/** Dispatch a mouse event in device-pixel space (jsdom: rect=0, dpr=1). */
function mouse(
    canvas: HTMLCanvasElement,
    type: string,
    x: number,
    y: number,
    button: number,
    buttons: number,
): MouseEvent {
    const ev = new MouseEvent(type, {
        clientX: x,
        clientY: y,
        button,
        buttons,
        bubbles: true,
        cancelable: true,
    });
    canvas.dispatchEvent(ev);
    return ev;
}

const MIDDLE = 1; // MouseEvent.button for the middle button
const MIDDLE_MASK = 4; // MouseEvent.buttons bit while the middle button is held

describe('Middle-button drag pans the view', () => {
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
        const mc = panel.getMapCoordinates();
        mc.setMagnitudesNoCheck(1, 1);
        mc.setXCenter(0);
        mc.setYCenter(0);
    });

    it('pans from any tool, scrolling the view origin', () => {
        // Even with a drawing tool active, the middle button scrolls.
        panel.setTool(Tool.LINE);
        const mc = panel.getMapCoordinates();

        mouse(canvas, 'mousedown', 400, 400, MIDDLE, MIDDLE_MASK);
        // Drag up-left so the clamped centre (≤ 0) actually moves.
        mouse(canvas, 'mousemove', 300, 250, 0, MIDDLE_MASK);
        mouse(canvas, 'mouseup', 300, 250, MIDDLE, 0);

        // panDx = 300-400 = -100, panDy = 250-400 = -150.
        expect(mc.getXCenter()).toBeCloseTo(-100, 6);
        expect(mc.getYCenter()).toBeCloseTo(-150, 6);
        // The transient pan must not change the selected tool.
        expect(panel.getTool()).toBe(Tool.LINE);
    });

    it('suppresses the browser native middle-click autoscroll', () => {
        panel.setTool(Tool.SELECTION);
        const ev = mouse(canvas, 'mousedown', 400, 400, MIDDLE, MIDDLE_MASK);
        expect(ev.defaultPrevented).toBe(true);
    });
});
