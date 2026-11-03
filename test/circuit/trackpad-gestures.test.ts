import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest';
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
        deltaMode?: number;
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
        deltaMode: init.deltaMode ?? 0,
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

    afterEach(() => {
        vi.restoreAllMocks();
        container.remove();
    });

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
        expect(mc.getYCenter()).toBeCloseTo(-50, 6);
    });

    it('a plain horizontal two-finger swipe pans without changing zoom', () => {
        const mc = panel.getMapCoordinates();
        wheel(canvas, { deltaX: 40, deltaY: 30 });
        expect(mc.getXMagnitude()).toBe(1); // zoom unchanged
        expect(mc.getXCenter()).toBeCloseTo(-50, 6);
        expect(mc.getYCenter()).toBeCloseTo(-37.5, 6);
    });
    it('coalesces redraws without dropping fractional pan deltas', () => {
        let frame: FrameRequestCallback | undefined;
        const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
            frame = cb;
            return 1;
        });
        const render = vi.spyOn(panel, 'render');
        for (let i = 0; i < 10; i++) wheel(canvas, { deltaX: 0.2, deltaY: 0.4 });
        expect(panel.getMapCoordinates().getXCenter()).toBeCloseTo(-2.5);
        expect(panel.getMapCoordinates().getYCenter()).toBeCloseTo(-5);
        expect(raf).toHaveBeenCalledTimes(1);
        expect(render).not.toHaveBeenCalled();
        frame!(0);
        expect(render).toHaveBeenCalledTimes(1);
        wheel(canvas, { deltaY: 1 });
        expect(raf).toHaveBeenCalledTimes(2);
    });

    it('normalizes line scrolling to pixels', () => {
        wheel(canvas, { deltaY: 2, deltaMode: 1 });
        expect(panel.getMapCoordinates().getYCenter()).toBeCloseTo(-40);
    });

    it('responds to small pinches and preserves the point under the cursor', () => {
        const mc = panel.getMapCoordinates();
        wheel(canvas, { deltaY: -10, ctrlKey: true, x: 100, y: 100 });
        expect(mc.getXMagnitude()).toBeGreaterThan(1.04);
        expect((100 - mc.getXCenter()) / mc.getXMagnitude()).toBeCloseTo(100);
        wheel(canvas, { deltaY: 10, ctrlKey: true, x: 100, y: 100 });
        expect(mc.getXMagnitude()).toBeCloseTo(1);
        expect(mc.getXCenter()).toBeCloseTo(0);
    });
});
