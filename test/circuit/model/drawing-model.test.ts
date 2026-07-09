import { describe, it, expect, beforeEach } from 'vitest';
import { DrawingModel } from '../../../src/circuit/model/DrawingModel.js';
import * as StandardLayers from '../../../src/layers/StandardLayers.js';
import { PrimitiveLine } from '../../../src/primitives/PrimitiveLine.js';

describe('DrawingModel', () => {
    let model: DrawingModel;

    beforeEach(() => {
        model = new DrawingModel();
        model.setLayers(StandardLayers.createStandardLayers());
    });

    it('new model is empty', () => {
        expect(model.getPrimitiveVector()).toHaveLength(0);
    });

    it('addPrimitive appends a primitive to the vector', () => {
        const prim = new PrimitiveLine(0, 0, 10, 10, 0, false, false, 0, 3, 2, 0, '', 4);
        model.addPrimitive(prim, true, null);
        expect(model.getPrimitiveVector()).toHaveLength(1);
        expect(model.getPrimitiveVector()[0]).toBe(prim);
    });

    it('getPrimitiveVector returns mutable internal vector', () => {
        const prim = new PrimitiveLine(0, 0, 10, 10, 0, false, false, 0, 3, 2, 0, '', 4);
        model.getPrimitiveVector().push(prim);
        expect(model.getPrimitiveVector()).toHaveLength(1);
    });

    it('setPrimitiveVector replaces all primitives', () => {
        const prim = new PrimitiveLine(0, 0, 10, 10, 0, false, false, 0, 3, 2, 0, '', 4);
        model.setPrimitiveVector([prim]);
        expect(model.getPrimitiveVector()).toHaveLength(1);
        expect(model.getPrimitiveVector()[0]).toBe(prim);
    });

    it('setChanged / getChanged flag works', () => {
        model.setChanged(false);
        expect(model.getChanged()).toBe(false);
        model.setChanged(true);
        expect(model.getChanged()).toBe(true);
        model.setChanged(false);
        expect(model.getChanged()).toBe(false);
    });

    it('getLayers returns layers set by setLayers', () => {
        const layers = model.getLayers();
        expect(layers.length).toBeGreaterThanOrEqual(2);
    });

    it('setLibrary / getLibrary round-trip', () => {
        const lib = new Map<string, any>();
        lib.set('test.key', { key: 'test.key' } as any);
        model.setLibrary(lib);
        expect(model.getLibrary()).toBe(lib);
        expect(model.getLibrary().get('test.key')).toBeDefined();
    });

    it('resetLibrary creates empty map', () => {
        const lib = new Map<string, any>();
        lib.set('k', {} as any);
        model.setLibrary(lib);
        model.resetLibrary();
        expect(model.getLibrary().size).toBe(0);
    });

    it('stores separate defaults for text and name/value labels', () => {
        model.setDefaultTextStyle('Georgia', 12);
        model.setTextFont('Helvetica', 5);

        expect(model.getDefaultTextFont()).toBe('Georgia');
        expect(model.getDefaultTextFontSize()).toBe(12);
        expect(model.getTextFont()).toBe('Helvetica');
        expect(model.getTextFontSize()).toBe(5);
    });

    it('applies name/value font size changes to existing primitives', () => {
        const prim = new PrimitiveLine(0, 0, 10, 10, 0, false, false, 0, 3, 2, 0, '', 4);
        model.addPrimitive(prim, true, null);

        model.setTextFont('Helvetica', 6);

        expect(prim.getMacroFontSize()).toBe(6);
    });
});
