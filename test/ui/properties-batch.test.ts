import { describe, it, expect, beforeEach } from 'vitest';
import { loadLocale } from '../../src/i18n/i18n.js';
import { PropertiesPanelController } from '../../src/ui/PropertiesPanelController.js';
import { DrawingModel } from '../../src/circuit/model/DrawingModel.js';
import { StandardLayers } from '../../src/layers/StandardLayers.js';
import { PrimitiveLine } from '../../src/primitives/PrimitiveLine.js';
import type { EditorFacade } from '../../src/circuit/EditorFacade.js';

function makeLine(layer: number): PrimitiveLine {
    return new PrimitiveLine(0, 0, 10, 10, layer, false, false, 0, 3, 2, 0, '', 4);
}

/** Click the Nth entry of the rendered LayerDropdown to fire its change callback. */
function selectDropdownLayer(controller: PropertiesPanelController, index: number): void {
    const dropdown = (controller as any).currentLayerDropdown;
    const list = dropdown.element.children[1] as HTMLElement; // [button, list]
    const item = list.children[index] as HTMLElement;
    item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
}

describe('Batch layer editing', () => {
    let sidebar: HTMLElement;
    let model: DrawingModel;
    let facade: EditorFacade;

    beforeEach(async () => {
        // The panel routes labels through getString(); load the English bundle
        // so lookups resolve to text instead of returning the raw key.
        await loadLocale('en');
        model = new DrawingModel();
        model.setLayers(StandardLayers.createStandardLayers());

        sidebar = document.createElement('div');
        // showBatch preserves the sidebar's first child as the header.
        sidebar.appendChild(document.createElement('div'));
        document.body.appendChild(sidebar);

        facade = {
            getModel: () => model,
            getLayers: () => model.getLayers(),
            getLayerDescriptions: () => model.getLayers().map((_l, i) => `Layer ${i}`),
            render: () => {},
        } as unknown as EditorFacade;
    });

    it('applies a layer change to every selected primitive', () => {
        const a = makeLine(0);
        const b = makeLine(1);
        const c = makeLine(2);
        for (const p of [a, b, c]) {
            p.setSelected(true);
            model.getPrimitiveVector().push(p);
        }

        const controller = new PropertiesPanelController(sidebar, facade);
        controller.showBatch([a, b, c]);

        selectDropdownLayer(controller, 3);

        expect(a.getLayer()).toBe(3);
        expect(b.getLayer()).toBe(3);
        expect(c.getLayer()).toBe(3);
    });

    it('shows the multi-selection header with the element count', () => {
        const a = makeLine(0);
        const b = makeLine(0);
        const controller = new PropertiesPanelController(sidebar, facade);
        controller.showBatch([a, b]);

        expect(sidebar.textContent).toContain('Multiple elements (2)');
    });

    it('falls back to the single-element panel when only one is passed', () => {
        const a = makeLine(0);
        a.setSelected(true);
        model.getPrimitiveVector().push(a);

        const controller = new PropertiesPanelController(sidebar, facade);
        controller.showBatch([a]);

        // Single-element panel still exposes a layer dropdown, and changing it
        // edits that one element.
        selectDropdownLayer(controller, 4);
        expect(a.getLayer()).toBe(4);
    });
});
