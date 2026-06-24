import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImageAsCanvas } from '../../src/circuit/ImageAsCanvas.js';
import { DrawingModel } from '../../src/circuit/model/DrawingModel.js';
import { ParserActions } from '../../src/circuit/controllers/ParserActions.js';
import * as StandardLayers from '../../src/layers/StandardLayers.js';

/**
 * Stub the global Image constructor so image loading works synchronously
 * in jsdom (which doesn't load network resources).
 */
function installImageStub() {
    const OrigImage = (globalThis as any).Image;
    (globalThis as any).Image = class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src: string = '';
        naturalWidth: number = 0;
        naturalHeight: number = 0;
        constructor() {
            // Fire onload asynchronously (next microtask) with fake dimensions.
            // Arrow function preserves the constructed instance without aliasing `this`.
            Promise.resolve().then(() => {
                this.naturalWidth = 1;
                this.naturalHeight = 1;
                this.onload?.();
            });
        }
    };
    return () => {
        (globalThis as any).Image = OrigImage;
    };
}

describe('ImageAsCanvas', () => {
    let restoreImage: () => void;

    beforeEach(() => {
        restoreImage = installImageStub();
    });

    afterEach(() => {
        restoreImage();
    });
    describe('initial state', () => {
        it('starts with no image attached', () => {
            const ic = new ImageAsCanvas();
            expect(ic.isAttached()).toBe(false);
            expect(ic.getImage()).toBeNull();
            expect(ic.getState()).toBeNull();
        });

        it('has default position and alpha', () => {
            const ic = new ImageAsCanvas();
            expect(ic.getX()).toBe(0);
            expect(ic.getY()).toBe(0);
            expect(ic.getScale()).toBe(1.0);
            expect(ic.getAlpha()).toBe(0.5);
        });
    });

    describe('position / scale / alpha', () => {
        it('setX and getX work', () => {
            const ic = new ImageAsCanvas();
            ic.setX(42);
            expect(ic.getX()).toBe(42);
        });

        it('setY and getY work', () => {
            const ic = new ImageAsCanvas();
            ic.setY(-10);
            expect(ic.getY()).toBe(-10);
        });

        it('setScale clamps to [0.01, 100]', () => {
            const ic = new ImageAsCanvas();
            ic.setScale(5);
            expect(ic.getScale()).toBe(5);
            ic.setScale(0);
            expect(ic.getScale()).toBe(0.01);
            ic.setScale(200);
            expect(ic.getScale()).toBe(100);
        });

        it('setAlpha clamps to [0, 1]', () => {
            const ic = new ImageAsCanvas();
            ic.setAlpha(0.75);
            expect(ic.getAlpha()).toBe(0.75);
            ic.setAlpha(-0.5);
            expect(ic.getAlpha()).toBe(0);
            ic.setAlpha(1.5);
            expect(ic.getAlpha()).toBe(1);
        });
    });

    describe('attachImage', () => {
        it('attaches a data URL and sets natural dimensions', async () => {
            const ic = new ImageAsCanvas();
            // Create a minimal 1x1 PNG data URL
            const png =
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            await ic.attachImage(png);
            expect(ic.isAttached()).toBe(true);
            expect(ic.getNaturalWidth()).toBe(1);
            expect(ic.getNaturalHeight()).toBe(1);
        });

        it('getState returns the current state when image is attached', async () => {
            const ic = new ImageAsCanvas();
            const png =
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            await ic.attachImage(png);
            ic.setX(10);
            ic.setY(20);
            ic.setScale(2);
            ic.setAlpha(0.3);

            const state = ic.getState();
            expect(state).not.toBeNull();
            expect(state!.x).toBe(10);
            expect(state!.y).toBe(20);
            expect(state!.scale).toBe(2);
            expect(state!.alpha).toBe(0.3);
            expect(state!.naturalWidth).toBe(1);
            expect(state!.naturalHeight).toBe(1);
        });
    });

    describe('detach', () => {
        it('removes the image and resets state', async () => {
            const ic = new ImageAsCanvas();
            const png =
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            await ic.attachImage(png);
            ic.setX(10);
            ic.setY(20);

            ic.detach();
            expect(ic.isAttached()).toBe(false);
            expect(ic.getImage()).toBeNull();
            expect(ic.getX()).toBe(0);
            expect(ic.getY()).toBe(0);
            expect(ic.getScale()).toBe(1.0);
            expect(ic.getAlpha()).toBe(0.5);
        });
    });

    describe('restoreState', () => {
        it('restores image and position from state', async () => {
            const ic = new ImageAsCanvas();
            const png =
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

            await ic.restoreState({
                dataUrl: png,
                x: 5,
                y: 15,
                scale: 3,
                alpha: 0.8,
                naturalWidth: 1,
                naturalHeight: 1,
            });

            expect(ic.isAttached()).toBe(true);
            expect(ic.getX()).toBe(5);
            expect(ic.getY()).toBe(15);
            expect(ic.getScale()).toBe(3);
            expect(ic.getAlpha()).toBe(0.8);
        });

        it('serializes only the image geometry into FCD, not the bytes', async () => {
            const png =
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            const sourceModel = new DrawingModel();
            sourceModel.setLayers(StandardLayers.createStandardLayers());
            const sourceParser = new ParserActions(sourceModel);
            await sourceModel.getImgCanvas().restoreState({
                dataUrl: png,
                x: 12,
                y: 34,
                scale: 2,
                alpha: 0.4,
                naturalWidth: 1,
                naturalHeight: 1,
            });

            // The .fcd stays pure text: geometry only, no embedded data URL.
            const text = sourceParser.getText(true);
            expect(text).toContain('FJC IMG 12 34 2 0.4');
            expect(text).not.toContain(png);
            expect(text).not.toContain('data:image');
        });

        it('restores image geometry on parse and flags a pending restore for the UI', () => {
            const restoredModel = new DrawingModel();
            restoredModel.setLayers(StandardLayers.createStandardLayers());
            const restoredParser = new ParserActions(restoredModel);
            restoredParser.parseString('[FIDOCAD]\nFJC IMG 12 34 2 0.4\n');

            const ic = restoredModel.getImgCanvas();
            // The parser sets geometry but cannot load bytes (kept locally), so
            // no image is attached yet — the UI re-attaches from localStorage.
            expect(ic.isAttached()).toBe(false);
            expect(ic.getX()).toBe(12);
            expect(ic.getY()).toBe(34);
            expect(ic.getScale()).toBe(2);
            expect(ic.getAlpha()).toBe(0.4);
            expect(ic.takePendingRestore()).toBe(true);
            // The flag is consumed once.
            expect(ic.takePendingRestore()).toBe(false);
        });
    });

    describe('trackExtremePoints', () => {
        it('tracks nothing when no image is attached', () => {
            const ic = new ImageAsCanvas();
            const cs = {
                trackPoint: vi.fn(),
            };
            ic.trackExtremePoints(cs as any);
            expect(cs.trackPoint).not.toHaveBeenCalled();
        });

        it('tracks image bounds when attached', async () => {
            const ic = new ImageAsCanvas();
            const png =
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            await ic.attachImage(png);
            ic.setX(10);
            ic.setY(20);
            ic.setScale(2);

            const cs = {
                trackPoint: vi.fn(),
            };
            ic.trackExtremePoints(cs as any);
            expect(cs.trackPoint).toHaveBeenCalledTimes(2);
            expect(cs.trackPoint).toHaveBeenCalledWith(10, 20);
            // At scale 2, natural width/height is 1, so bottom-right = 10+2, 20+2
            expect(cs.trackPoint).toHaveBeenCalledWith(12, 22);
        });
    });
});
