import { describe, it, expect } from 'vitest';
import { DrawingModel } from '../../src/circuit/model/DrawingModel.js';
import { ParserActions } from '../../src/circuit/controllers/ParserActions.js';
import * as StandardLayers from '../../src/layers/StandardLayers.js';
import { LibraryModel } from '../../src/librarymodel/LibraryModel.js';

const SAMPLE_FCL = `[FIDOLIB Test Library]
{Passive}
[R001 Resistor]
LI 0 0 10 0 0
LI 10 0 20 0 0
[C001 Capacitor]
LI 0 0 10 0 0
EV 10 0 20 10 0
{Active}
[U001 Inverter]
RV 0 0 20 20 0
`;

function makePopulatedModel(): DrawingModel {
    const m = new DrawingModel();
    m.setLayers(StandardLayers.createStandardLayers());
    const pa = new ParserActions(m);
    pa.readLibraryString(SAMPLE_FCL, 'testlib');
    return m;
}

describe('LibraryModel', () => {
    it('builds Library/Category hierarchy from flat MacroDesc map', () => {
        const model = makePopulatedModel();
        const lm = new LibraryModel(model);

        const libs = lm.getAllLibraries();
        expect(libs.length).toBeGreaterThanOrEqual(1);

        const testLib = libs.find((l) => l.getFilename() === 'testlib');
        expect(testLib).toBeDefined();
    });

    it('getAllMacros returns the same map as drawingModel.getLibrary', () => {
        const model = makePopulatedModel();
        const lm = new LibraryModel(model);
        expect(lm.getAllMacros()).toBe(model.getLibrary());
    });

    it('groups macros into correct categories', () => {
        const model = makePopulatedModel();
        const lm = new LibraryModel(model);

        const libs = lm.getAllLibraries();
        const testLib = libs.find((l) => l.getFilename() === 'testlib')!;
        const categories = testLib.getAllCategories().map((c) => c.getName());
        expect(categories).toContain('Active');
    });

    it('category contains correct macros', () => {
        const model = makePopulatedModel();
        const lm = new LibraryModel(model);
        const testLib = lm.getAllLibraries().find((l) => l.getFilename() === 'testlib')!;

        const allMacros = testLib.getAllCategories().flatMap((c) => c.getAllMacros());
        const keys = allMacros.map((m) => m.key);
        expect(keys.some((k) => k.includes('u001'))).toBe(true);
    });
});

describe('LibraryModel static helpers', () => {
    it('getPlainMacroKey strips library prefix', () => {
        const macro = {
            key: 'testlib.r001',
            name: '',
            description: '',
            category: '',
            library: '',
            filename: '',
            level: 0,
        };
        expect(LibraryModel.getPlainMacroKey(macro)).toBe('r001');
    });

    it('getPlainMacroKey works for unprefixed keys', () => {
        const macro = {
            key: '000',
            name: '',
            description: '',
            category: '',
            library: '',
            filename: '',
            level: 0,
        };
        expect(LibraryModel.getPlainMacroKey(macro)).toBe('000');
    });

    it('createMacroKey produces lowercase prefixed key', () => {
        expect(LibraryModel.createMacroKey('PCB', 'R00')).toBe('pcb.r00');
    });
});

describe('Library', () => {
    it('containsMacroKey finds macro in any category', () => {
        const model = makePopulatedModel();
        const lm = new LibraryModel(model);
        const testLib = lm.getAllLibraries().find((l) => l.getFilename() === 'testlib')!;
        // 'u001' is the plain key for testlib.u001
        expect(testLib.containsMacroKey('u001')).toBe(true);
        expect(testLib.containsMacroKey('doesnotexist')).toBe(false);
    });
});
