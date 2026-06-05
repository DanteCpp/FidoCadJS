/**
 * @file copy-all-as-primitives.test.ts
 * @author Dante Loi
 * @date 2026-06-05
 * @brief Tests for MacroVectorizer.vectorizeAllToString — the payload behind the
 *        "Copy all as primitives" Edit-menu action. Verifies the whole drawing is
 *        flattened (no MC macro references remain, including nested macros) while
 *        the live model is left untouched.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { describe, it, expect } from 'vitest';
import { DrawingModel } from '../../src/circuit/model/DrawingModel.js';
import { ParserActions } from '../../src/circuit/controllers/ParserActions.js';
import { StandardLayers } from '../../src/layers/StandardLayers.js';
import { registerDrawingHooks } from '../../src/circuit/views/Drawing.js';
import { MacroDesc } from '../../src/primitives/MacroDesc.js';
import { MacroVectorizer } from '../../src/circuit/MacroVectorizer.js';
import { PrimitiveMacro } from '../../src/primitives/PrimitiveMacro.js';
import type { SelectionActions } from '../../src/circuit/controllers/SelectionActions.js';
import type { UndoActions } from '../../src/circuit/controllers/UndoActions.js';

function makeVectorizer(model: DrawingModel): MacroVectorizer {
    // vectorizeAllToString only touches the model; selection/undo are unused here.
    return new MacroVectorizer(model, {} as SelectionActions, {} as UndoActions, () => {});
}

/** Count macro (MC) references in a FidoCadJ document. */
function macroLines(text: string): number {
    return text.split(/\r?\n/).filter((l) => l.startsWith('MC ')).length;
}

describe('MacroVectorizer.vectorizeAllToString', () => {
    it('flattens a flat macro and keeps plain primitives', () => {
        registerDrawingHooks();
        const model = new DrawingModel();
        model.setLayers(StandardLayers.createStandardLayers());
        model
            .getLibrary()
            .set(
                'test.t',
                new MacroDesc(
                    'test.t',
                    'T',
                    'LI 100 100 140 105 0\nLI 140 105 110 130 0\nLI 110 130 100 100 0',
                    'g',
                    't',
                    't',
                ),
            );
        const pa = new ParserActions(model);
        pa.parseString('LI 0 0 10 10 0\nMC 100 100 0 0 test.t');

        const out = makeVectorizer(model).vectorizeAllToString();

        // No macro references survive; the macro's three lines plus the standalone
        // line are all present as LI primitives.
        expect(macroLines(out)).toBe(0);
        expect(out.split(/\r?\n/).filter((l) => l.startsWith('LI ')).length).toBe(4);

        // The live model is untouched: still a line + a macro.
        expect(model.getPrimitiveVector().length).toBe(2);
        expect(model.getPrimitiveVector().some((p) => p instanceof PrimitiveMacro)).toBe(true);
    });

    it('recursively flattens nested macros', () => {
        registerDrawingHooks();
        const model = new DrawingModel();
        model.setLayers(StandardLayers.createStandardLayers());
        model
            .getLibrary()
            .set(
                'test.inner',
                new MacroDesc('test.inner', 'I', 'LI 100 100 140 105 0', 'g', 't', 't'),
            );
        model
            .getLibrary()
            .set(
                'test.outer',
                new MacroDesc(
                    'test.outer',
                    'O',
                    'MC 110 110 0 0 test.inner\nLI 100 100 130 100 0',
                    'g',
                    't',
                    't',
                ),
            );
        const pa = new ParserActions(model);
        pa.parseString('MC 100 100 0 0 test.outer');

        const out = makeVectorizer(model).vectorizeAllToString();

        expect(macroLines(out)).toBe(0);
        // Outer's own line + inner's line = 2 LI after full expansion.
        expect(out.split(/\r?\n/).filter((l) => l.startsWith('LI ')).length).toBe(2);
    });

    it('round-trips a macro-free drawing unchanged in primitive count', () => {
        registerDrawingHooks();
        const model = new DrawingModel();
        model.setLayers(StandardLayers.createStandardLayers());
        const pa = new ParserActions(model);
        pa.parseString('LI 0 0 10 10 0\nRP 20 20 40 40 1');

        const out = makeVectorizer(model).vectorizeAllToString();

        // Re-parse the output and confirm it still holds two primitives.
        const check = new DrawingModel();
        check.setLayers(StandardLayers.createStandardLayers());
        new ParserActions(check).parseString(out);
        expect(check.getPrimitiveVector().length).toBe(2);
    });
});
