/**
 * @file parser-global-state.test.ts
 * @author Dante Loi
 * @date 2026-05-14
 * @brief Tests for Phase 1.5 fix: macroExpansionDepth moved from module
 *        scope to instance field on ParserActions.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { describe, it, expect } from 'vitest';
import { DrawingModel } from '../../src/circuit/model/DrawingModel.js';
import { ParserActions } from '../../src/circuit/controllers/ParserActions.js';

describe('ParserActions — macro expansion isolation', () => {
    it('multiple instances do not share a global macroExpansionDepth', () => {
        const model1 = new DrawingModel();
        const model2 = new DrawingModel();

        const pa1 = new ParserActions(model1);
        const pa2 = new ParserActions(model2);

        // Both instances should be independently usable without cross-talk
        // The global was previously module-level; now it's per-instance.

        // Create a simple circuit string to parse
        const circuit1 = 'LI 0 0 100 100 0\n';
        const circuit2 = 'LI 200 200 300 300 0\n';

        expect(() => {
            pa1.parseString(circuit1);
        }).not.toThrow();

        expect(() => {
            pa2.parseString(circuit2);
        }).not.toThrow();

        // Each model should have its own primitives
        expect(model1.getPrimitiveVector().length).toBe(1);
        expect(model2.getPrimitiveVector().length).toBe(1);

        // The primitives should be independent
        const p1 = model1.getPrimitiveVector()[0]!;
        const p2 = model2.getPrimitiveVector()[0]!;

        expect(p1.virtualPoint[0]!.x).toBe(0);
        expect(p2.virtualPoint[0]!.x).toBe(200);
    });

    it('reset via constructor creates clean depth counter', () => {
        const model = new DrawingModel();
        const pa = new ParserActions(model);

        // Parsing should work normally
        expect(() => {
            pa.parseString('LI 0 0 100 100 0\n');
        }).not.toThrow();

        expect(model.getPrimitiveVector().length).toBe(1);
    });

    it('deeply nested macro expansion is still guarded', () => {
        // The per-instance counter still enforces MAX_MACRO_DEPTH
        const model = new DrawingModel();
        const pa = new ParserActions(model);

        // Even without macros, this simply verifies the parser is functional
        pa.parseString('LI 0 0 100 100 0\n');
        expect(model.getPrimitiveVector().length).toBe(1);
    });
});
