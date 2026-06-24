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
            createImageData: () => ({ data: new Uint8ClampedArray(), width: 0, height: 0 }),
            getImageData: () => ({ data: new Uint8ClampedArray(), width: 0, height: 0 }),
        } as any,
        {
            get(target, prop) {
                if (prop in target) return (target as any)[prop];
                // Any other property is either a drawing method (return noop)
                // or a writable style field (return undefined; sets are allowed).
                return noop;
            },
            set() {
                return true;
            },
        },
    );
}

/** Dispatch a mouse event in device-pixel space (jsdom: rect=0, dpr=1). */
function mouse(canvas: HTMLCanvasElement, type: string, x: number, y: number, button = 0): void {
    canvas.dispatchEvent(
        new MouseEvent(type, {
            clientX: x,
            clientY: y,
            button,
            buttons: type === 'mousemove' ? (button === 2 ? 2 : 1) : button === 2 ? 2 : 1,
            bubbles: true,
            cancelable: true,
        }),
    );
}

describe('ZOOM tool — rubber-band zoom to region', () => {
    let container: HTMLDivElement;
    let panel: CircuitPanel;
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        panel = new CircuitPanel(container);
        canvas = container.querySelector('canvas')!;
        // jsdom has no layout, so force a known device-pixel viewport size.
        canvas.width = 800;
        canvas.height = 600;

        const mc = panel.getMapCoordinates();
        mc.setMagnitudesNoCheck(1, 1);
        mc.setXCenter(0);
        mc.setYCenter(0);
        panel.setTool(Tool.ZOOM);
    });

    it('dragging a region zooms so the region fills the viewport', () => {
        const mc = panel.getMapCoordinates();
        // Drag a 200×200 region from (100,100) to (300,300).
        mouse(canvas, 'mousedown', 100, 100);
        mouse(canvas, 'mousemove', 300, 300);
        mouse(canvas, 'mouseup', 300, 300);

        // fit = oldMag * min(800/200, 600/200) = 1 * min(4, 3) = 3.
        expect(mc.getXMagnitude()).toBeCloseTo(3, 6);
        expect(mc.getYMagnitude()).toBeCloseTo(3, 6);

        // The region's midpoint (screen 200,200 → doc 200,200) re-anchors to the
        // viewport midpoint: center = viewHalf - docMid * newMag.
        expect(mc.getXCenter()).toBeCloseTo(800 / 2 - 200 * 3, 6); // -200
        expect(mc.getYCenter()).toBeCloseTo(600 / 2 - 200 * 3, 6); // -300
    });

    it('a plain click (no drag) zooms in centred on the point', () => {
        const mc = panel.getMapCoordinates();
        mouse(canvas, 'mousedown', 100, 100);
        mouse(canvas, 'mouseup', 100, 100);
        expect(mc.getXMagnitude()).toBeCloseTo(1.3, 6);
    });

    it('right-click zooms out', () => {
        const mc = panel.getMapCoordinates();
        mouse(canvas, 'mousedown', 100, 100, 2);
        mouse(canvas, 'mouseup', 100, 100, 2);
        expect(mc.getXMagnitude()).toBeLessThan(1);
    });

    it('a zero-size region does not change the zoom', () => {
        const mc = panel.getMapCoordinates();
        // Move beyond the click threshold in X only, leaving zero height.
        mouse(canvas, 'mousedown', 100, 100);
        mouse(canvas, 'mousemove', 300, 100);
        mouse(canvas, 'mouseup', 300, 100);
        expect(mc.getXMagnitude()).toBe(1);
    });
});
