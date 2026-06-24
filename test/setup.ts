import { beforeAll } from 'vitest';

beforeAll(() => {
    // localStorage polyfill — jsdom does not always expose a working impl
    // (e.g. when --localstorage-file is not provided). Tests that exercise
    // persistence rely on a plain in-memory store.
    if (
        typeof localStorage === 'undefined' ||
        typeof (localStorage as Storage | undefined)?.getItem !== 'function'
    ) {
        const store = new Map<string, string>();
        const polyfill: Storage = {
            getItem(key) {
                return store.get(key) ?? null;
            },
            setItem(key, value) {
                store.set(key, String(value));
            },
            removeItem(key) {
                store.delete(key);
            },
            clear() {
                store.clear();
            },
            key(_i) {
                return null;
            },
            get length() {
                return store.size;
            },
        };
        (globalThis as { localStorage?: Storage }).localStorage = polyfill;
    }

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

    // Stub HTMLCanvasElement.toBlob (jsdom does not implement it)
    HTMLCanvasElement.prototype.toBlob = function (
        this: HTMLCanvasElement,
        callback: (blob: Blob | null) => void,
        mimeType?: string,
        _quality?: number,
    ): void {
        // Create a minimal PNG-like blob for test purposes
        const header =
            mimeType === 'image/jpeg'
                ? new Uint8Array([0xff, 0xd8, 0xff])
                : new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
        callback(new Blob([header], { type: mimeType || 'image/png' }));
    };

    // Stub 2D canvas context
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        contextId: string,
        ...args: any[]
    ) {
        if (contextId === '2d') {
            // Memoize per canvas, like real browsers: repeated getContext('2d')
            // calls must return the same object so context state (transforms,
            // imageSmoothingEnabled, …) set by code under test is observable.
            const self = this as HTMLCanvasElement & { __stub2dCtx?: unknown };
            self.__stub2dCtx ??= createStub2DContext(this);
            return self.__stub2dCtx;
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
        ellipse() {}, // needed by GraphicsCanvas.fillOval
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
        getLineDash() {
            return [];
        },
        setTransform() {},
        translate() {},
        scale() {},
        rotate() {},
        createLinearGradient() {
            return null;
        },
        createRadialGradient() {
            return null;
        },
        drawImage() {},
        getImageData(_x: number, _y: number, w: number, h: number) {
            // Return all-white pixels (255,255,255,255)
            const size = w * h * 4;
            const data = new Uint8ClampedArray(size);
            for (let i = 0; i < size; i += 4) {
                data[i] = 255; // R
                data[i + 1] = 255; // G
                data[i + 2] = 255; // B
                data[i + 3] = 255; // A
            }
            return { data, width: w, height: h, colorSpace: 'srgb' };
        },
        // Record calls so tests can assert that post-processing passes ran.
        putImageDataCalls: [] as Array<{ data: Uint8ClampedArray }>,
        putImageData(imageData: { data: Uint8ClampedArray }) {
            this.putImageDataCalls.push(imageData);
        },
        createImageData() {
            return { data: new Uint8ClampedArray() };
        },
        isPointInPath() {
            return false;
        },
        isPointInStroke() {
            return false;
        },
    };
}
