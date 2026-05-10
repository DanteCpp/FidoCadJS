/**
 * @file setup.ts
 * @brief Global test setup — stubs for jsdom environment
 */

import { beforeAll } from 'vitest';

beforeAll(() => {
    // ResizeObserver stub
    if (typeof ResizeObserver === 'undefined') {
        (globalThis as any).ResizeObserver = class {
            observe() {}
            unobserve() {}
            disconnect() {}
        };
    }

    // Path2D stub (used by ShapeCanvas for arrow rendering)
    if (typeof Path2D === 'undefined') {
        (globalThis as any).Path2D = class {
            moveTo() {}
            lineTo() {}
            arc() {}
            bezierCurveTo() {}
            closePath() {}
        };
    }

    // Stub 2D canvas context
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        contextId: string,
        ...args: any[]
    ) {
        if (contextId === '2d') {
            return createStub2DContext(this);
        }
        return origGetContext.call(this, contextId, ...args);
    };
});

function createStub2DContext(_canvas: HTMLCanvasElement): any {
    return {
        canvas: _canvas,
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        globalAlpha: 1,
        imageSmoothingEnabled: true,
        save() {},
        restore() {},
        beginPath() {},
        closePath() {},
        moveTo() {},
        lineTo() {},
        arc() {},
        arcTo() {},
        bezierCurveTo() {},
        quadraticCurveTo() {},
        ellipse() {},          // needed by GraphicsCanvas.fillOval
        rect() {},
        fill() {},
        stroke() {},
        clip() {},
        fillRect() {},
        strokeRect() {},
        clearRect() {},
        fillText() {},
        strokeText() {},
        measureText(_text: string) {
            return {
                width: 50,
                actualBoundingBoxAscent: 10,
                actualBoundingBoxDescent: 3,
                fontBoundingBoxAscent: 10,
                fontBoundingBoxDescent: 3,
            };
        },
        setLineDash() {},
        getLineDash() { return []; },
        setTransform() {},
        translate() {},
        scale() {},
        rotate() {},
        createLinearGradient() { return null; },
        createRadialGradient() { return null; },
        drawImage() {},
        getImageData() { return { data: new Uint8ClampedArray() }; },
        putImageData() {},
        createImageData() { return { data: new Uint8ClampedArray() }; },
        isPointInPath() { return false; },
        isPointInStroke() { return false; },
    };
}
