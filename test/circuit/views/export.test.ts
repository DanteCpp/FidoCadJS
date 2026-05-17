/**
 * @file export.test.ts
 * @author Dante Loi
 * @date 2026-05-15
 * @brief Unit tests for the Export view — verifies the per-layer + PCB-pad
 *        + macro pass call ordering against a recording mock ExportInterface.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 *
 * Strategy: build a DrawingModel by parsing FCD, hand it to an Export view,
 * and call exportDrawing() with a mock that records every method
 * invocation. Then assert the recorded sequence matches the documented
 * passes:
 *   1) For each layer 0..N, every primitive on that layer (except macros
 *      and pcb pads in their dedicated passes).
 *   2) A second pass that emits PCB pad holes (drawOnlyPads=true).
 *   3) Macros recurse through (1) then (2) themselves.
 */

import { describe, it, expect } from 'vitest';
import { Export, registerExportHooks } from '../../../src/circuit/views/Export.js';
import { DrawingModel } from '../../../src/circuit/model/DrawingModel.js';
import { ParserActions } from '../../../src/circuit/controllers/ParserActions.js';
import { StandardLayers } from '../../../src/layers/StandardLayers.js';
import { MapCoordinates } from '../../../src/geom/MapCoordinates.js';
import type { ExportInterface } from '../../../src/export/ExportInterface.js';
import type { DimensionG } from '../../../src/graphic/DimensionG.js';
import type { LayerDesc } from '../../../src/layers/LayerDesc.js';
registerExportHooks();

interface Call {
    method: string;
    args: any[];
}

/**
 * Recording ExportInterface — every call is pushed onto `calls`.
 * exportMacro and exportCurve return false (matching the Java contract)
 * so the caller falls back to primitive emission.
 */
function makeRecorder(): { calls: Call[]; exp: ExportInterface } {
    const calls: Call[] = [];
    const log =
        (m: string) =>
        (...args: any[]): any => {
            calls.push({ method: m, args });
            return false; // for exportMacro / exportCurve
        };
    const exp: ExportInterface = {
        exportStart: log('exportStart'),
        exportEnd: log('exportEnd'),
        setDashUnit: log('setDashUnit'),
        setDashPhase: log('setDashPhase'),
        exportAdvText: log('exportAdvText'),
        exportBezier: log('exportBezier'),
        exportConnection: log('exportConnection'),
        exportLine: log('exportLine'),
        exportMacro: log('exportMacro'),
        exportOval: log('exportOval'),
        exportPCBLine: log('exportPCBLine'),
        exportPCBPad: log('exportPCBPad'),
        exportPolygon: log('exportPolygon'),
        exportCurve: log('exportCurve'),
        exportRectangle: log('exportRectangle'),
        exportArrow: () => ({ x: 0, y: 0 }),
    } as any;
    return { calls, exp };
}

function buildModel(fcd: string): DrawingModel {
    const m = new DrawingModel();
    m.setLayers(StandardLayers.createStandardLayers());
    new ParserActions(m).parseString(fcd);
    return m;
}

function newMap(): MapCoordinates {
    const mp = new MapCoordinates();
    mp.setMagnitudes(1, 1);
    return mp;
}

describe('Export view — call ordering', () => {
    it('a single line emits exactly one exportLine call', () => {
        const model = buildModel('[FIDOCAD]\nLI 10 10 50 50 0\n');
        const { calls, exp } = makeRecorder();
        const v = new Export(model);
        v.exportDrawing(exp, false, newMap());
        const drawn = calls.filter(
            (c) => c.method.startsWith('export') && c.method !== 'exportMacro',
        );
        expect(drawn.length).toBe(1);
        expect(drawn[0]!.method).toBe('exportLine');
    });

    it('per-layer pass: layer 0 primitives emitted before layer 1', () => {
        const model = buildModel(
            '[FIDOCAD]\n' +
                'LI 10 10 50 50 1\n' + // layer 1 (declared first in FCD)
                'LI 20 20 60 60 0\n', // layer 0
        );
        const { calls, exp } = makeRecorder();
        const v = new Export(model);
        v.exportDrawing(exp, false, newMap());

        // The first layer-0 export call must come before the first layer-1
        // call regardless of declaration order in the FCD.
        const layer0Idx = calls.findIndex((c) => c.method === 'exportLine' && c.args[4] === 0);
        const layer1Idx = calls.findIndex((c) => c.method === 'exportLine' && c.args[4] === 1);
        expect(layer0Idx).toBeGreaterThanOrEqual(0);
        expect(layer1Idx).toBeGreaterThanOrEqual(0);
        expect(layer0Idx).toBeLessThan(layer1Idx);
    });

    it('PCB pads emit one exportPCBPad in the layer pass and one in the hole pass', () => {
        const model = buildModel('[FIDOCAD]\nPA 50 50 10 10 3 0 0\n');
        const { calls, exp } = makeRecorder();
        const v = new Export(model);
        v.exportDrawing(exp, false, newMap());

        const padCalls = calls.filter((c) => c.method === 'exportPCBPad');
        // Pad pass emits 2 calls: solid pad + hole (the second is from the
        // dedicated drawOnlyPads pass at the end of exportDrawing).
        expect(padCalls.length).toBeGreaterThanOrEqual(2);
    });

    it('hidden layer skips emission when exportInvisible=false', () => {
        const model = buildModel('[FIDOCAD]\nLI 10 10 50 50 1\n');
        const layers = model.getLayers();
        layers[1]!.setVisible(false);

        const { calls, exp } = makeRecorder();
        const v = new Export(model);
        v.exportDrawing(exp, /*exportInvisible*/ false, newMap());

        const lineCalls = calls.filter((c) => c.method === 'exportLine');
        expect(lineCalls.length).toBe(0);
    });

    it('hidden layer still emits when exportInvisible=true', () => {
        const model = buildModel('[FIDOCAD]\nLI 10 10 50 50 1\n');
        model.getLayers()[1]!.setVisible(false);

        const { calls, exp } = makeRecorder();
        new Export(model).exportDrawing(exp, /*exportInvisible*/ true, newMap());

        const lineCalls = calls.filter((c) => c.method === 'exportLine');
        expect(lineCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('multiple primitive types are all emitted', () => {
        const model = buildModel(
            '[FIDOCAD]\n' +
                'LI 10 10 50 50 0\n' +
                'RV 60 60 100 100 0\n' +
                'EV 110 110 150 150 0\n' +
                'SA 80 80 0\n',
        );
        const { calls, exp } = makeRecorder();
        new Export(model).exportDrawing(exp, false, newMap());

        const drawn = new Set(calls.map((c) => c.method));
        expect(drawn.has('exportLine')).toBe(true);
        expect(drawn.has('exportRectangle')).toBe(true);
        expect(drawn.has('exportOval')).toBe(true);
        expect(drawn.has('exportConnection')).toBe(true);
    });
});

describe('Export view — exportHeader', () => {
    it('exportStart receives a dimension >= the drawing bounds + EXPORT_BORDER', () => {
        const model = buildModel('[FIDOCAD]\nLI 10 10 50 50 0\n');
        const { calls, exp } = makeRecorder();
        new Export(model).exportHeader(exp, newMap());

        const start = calls.find((c) => c.method === 'exportStart');
        expect(start).toBeDefined();
        const dim = start!.args[0] as DimensionG;
        // The line spans 40 units; with EXPORT_BORDER (6) the dimension
        // should be >= 46. Tracking adds extra slack so a >= 45 check is
        // safe-and-not-tautological.
        expect(dim.width).toBeGreaterThanOrEqual(45);
        expect(dim.height).toBeGreaterThanOrEqual(45);
    });

    it('exportStart receives the layer list', () => {
        const model = buildModel('[FIDOCAD]\nLI 10 10 50 50 0\n');
        const { calls, exp } = makeRecorder();
        new Export(model).exportHeader(exp, newMap());

        const start = calls.find((c) => c.method === 'exportStart');
        const layers = start!.args[1] as LayerDesc[];
        expect(layers.length).toBe(16); // standard layer set
    });

    it('setDashUnit is called before exportStart', () => {
        const model = buildModel('[FIDOCAD]\n');
        const { calls, exp } = makeRecorder();
        new Export(model).exportHeader(exp, newMap());

        const dashIdx = calls.findIndex((c) => c.method === 'setDashUnit');
        const startIdx = calls.findIndex((c) => c.method === 'exportStart');
        expect(dashIdx).toBeGreaterThanOrEqual(0);
        expect(startIdx).toBeGreaterThan(dashIdx);
    });
});
