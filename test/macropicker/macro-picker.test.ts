import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadLocale } from '../../src/i18n/i18n.js';
import { MacroPicker } from '../../src/macropicker/MacroPicker.js';
import { DrawingModel } from '../../src/circuit/model/DrawingModel.js';
import { ParserActions } from '../../src/circuit/controllers/ParserActions.js';
import { StandardLayers } from '../../src/layers/StandardLayers.js';
import { LibraryModel } from '../../src/librarymodel/LibraryModel.js';

const TEST_FCL = [
    '[FIDOLIB Test Library]',
    '{Passive}',
    '[RES Resistor]',
    'LI 0 0 10 0 0',
    '[CAP Capacitor]',
    'LI 0 0 0 10 0',
    '{Active}',
    '[DIODE Diode]',
    'LI 0 0 5 5 0',
].join('\n');

function buildPicker(): { picker: MacroPicker; root: HTMLElement } {
    const model = new DrawingModel();
    model.setLayers(StandardLayers.createStandardLayers());
    const parser = new ParserActions(model);
    parser.readLibraryString(TEST_FCL, 'testlib');

    const picker = new MacroPicker();
    document.body.appendChild(picker.element);
    picker.refresh(new LibraryModel(model));
    return { picker, root: picker.element };
}

/** All macro rows ([data-macro-key]) currently not display:none, walking up
 *  through their section ancestors like a real layout would. */
function visibleMacroKeys(root: HTMLElement): string[] {
    return Array.from(root.querySelectorAll<HTMLElement>('[data-macro-key]'))
        .filter((row) => {
            for (let el: HTMLElement | null = row; el && el !== root; el = el.parentElement) {
                if (el.style.display === 'none') return false;
            }
            return true;
        })
        .map((row) => row.dataset.macroKey!);
}

/** Find a tree header (library or category) by its label text. */
function headerByText(root: HTMLElement, label: string): HTMLElement {
    const span = Array.from(root.querySelectorAll('span')).find((s) => s.textContent === label);
    if (!span) throw new Error(`No tree node labelled "${label}"`);
    return span.parentElement as HTMLElement;
}

describe('MacroPicker', () => {
    beforeEach(async () => {
        await loadLocale('en');
        document.body.innerHTML = '';
    });

    it('builds one row per macro, all collapsed initially', () => {
        const { root } = buildPicker();
        const rows = root.querySelectorAll('[data-macro-key]');
        expect(rows).toHaveLength(3);
        expect(visibleMacroKeys(root)).toHaveLength(0);
    });

    it('expanding a library then a category reveals its macros only', () => {
        const { root } = buildPicker();

        headerByText(root, 'Test Library').click();
        // Library open, categories still collapsed.
        expect(visibleMacroKeys(root)).toHaveLength(0);

        headerByText(root, 'Passive').click();
        expect(visibleMacroKeys(root).sort()).toEqual(['testlib.cap', 'testlib.res']);

        // Collapsing the library hides everything again.
        headerByText(root, 'Test Library').click();
        expect(visibleMacroKeys(root)).toHaveLength(0);
    });

    it('clicking a macro row fires onMacroSelected with key and name', () => {
        const { picker, root } = buildPicker();
        const selected = vi.fn();
        picker.onMacroSelected = selected;

        headerByText(root, 'Test Library').click();
        headerByText(root, 'Passive').click();
        (root.querySelector('[data-macro-key="testlib.res"]') as HTMLElement).click();

        expect(selected).toHaveBeenCalledWith('testlib.res', 'Resistor');
    });

    it('setFilter reveals matching macros across collapsed sections', () => {
        const { picker, root } = buildPicker();

        picker.setFilter('resistor');
        expect(picker.isSearchMode()).toBe(true);
        expect(visibleMacroKeys(root)).toEqual(['testlib.res']);

        // Clearing the filter leaves the formerly-matching category expanded
        // (the user keeps their place) but unhides its sibling rows; sections
        // the filter never opened stay collapsed.
        picker.setFilter('');
        expect(picker.isSearchMode()).toBe(false);
        expect(visibleMacroKeys(root).sort()).toEqual(['testlib.cap', 'testlib.res']);
    });

    it('filter matches category and library names too', () => {
        const { picker, root } = buildPicker();
        picker.setFilter('active');
        expect(visibleMacroKeys(root)).toContain('testlib.diode');
    });

    it('refresh rebuilds the tree without duplicating rows', () => {
        const model = new DrawingModel();
        model.setLayers(StandardLayers.createStandardLayers());
        const parser = new ParserActions(model);
        parser.readLibraryString(TEST_FCL, 'testlib');
        const picker = new MacroPicker();
        document.body.appendChild(picker.element);

        const lm = new LibraryModel(model);
        picker.refresh(lm);
        picker.refresh(lm);
        expect(picker.element.querySelectorAll('[data-macro-key]')).toHaveLength(3);
    });
});
