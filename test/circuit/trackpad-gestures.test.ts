import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { CircuitPanel } from '../../src/circuit/CircuitPanel.js';

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

/** Dispatch a wheel event (deltaMode 0 = pixels, like a trackpad/macOS mouse). */
function wheel(
    canvas: HTMLCanvasElement,
    init: {
        deltaX?: number;
        deltaY?: number;
        ctrlKey?: boolean;
        metaKey?: boolean;
        x?: number;
        y?: number;
    },
): void {
    const ev = new WheelEvent('wheel', {
        deltaX: init.deltaX ?? 0,
        deltaY: init.deltaY ?? 0,
        deltaMode: 0,
        ctrlKey: init.ctrlKey ?? false,
        metaKey: init.metaKey ?? false,
        clientX: init.x ?? 0,
        clientY: init.y ?? 0,
        bubbles: true,
        cancelable: true,
    });
    canvas.dispatchEvent(ev);
}

describe('Trackpad gestures', () => {
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

    it('pinch (ctrl-wheel) zooms in when fingers spread', () => {
        const mc = panel.getMapCoordinates();
        // Negative deltaY = pinch-out = zoom in.
        wheel(canvas, { deltaY: -50, ctrlKey: true, x: 100, y: 100 });
        expect(mc.getXMagnitude()).toBeGreaterThan(1);
    });

    it('pinch (ctrl-wheel) zooms out when fingers pinch together', () => {
        const mc = panel.getMapCoordinates();
        wheel(canvas, { deltaY: 50, ctrlKey: true, x: 100, y: 100 });
        expect(mc.getXMagnitude()).toBeLessThan(1);
    });

    it('Cmd (meta) + wheel zooms — the mouse-user zoom path', () => {
        const mc = panel.getMapCoordinates();
        wheel(canvas, { deltaY: -50, metaKey: true, x: 100, y: 100 });
        expect(mc.getXMagnitude()).toBeGreaterThan(1);
    });

    it('a plain vertical two-finger swipe pans without changing zoom', () => {
        const mc = panel.getMapCoordinates();
        wheel(canvas, { deltaY: 40 });
        expect(mc.getXMagnitude()).toBe(1); // zoom unchanged
        // Scrolling down moves the view origin the opposite way.
        expect(mc.getYCenter()).toBeCloseTo(-40, 6);
    });

    it('a plain horizontal two-finger swipe pans without changing zoom', () => {
        const mc = panel.getMapCoordinates();
        wheel(canvas, { deltaX: 40, deltaY: 30 });
        expect(mc.getXMagnitude()).toBe(1); // zoom unchanged
        expect(mc.getXCenter()).toBeCloseTo(-40, 6);
        expect(mc.getYCenter()).toBeCloseTo(-30, 6);
    });
});
