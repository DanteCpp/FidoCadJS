import { beforeEach, describe, expect, it } from 'vitest';
import { loadLocale } from '../../src/i18n/i18n.js';
import { PropertiesPanelController } from '../../src/ui/PropertiesPanelController.js';
import { DrawingModel } from '../../src/circuit/model/DrawingModel.js';
import { PrimitiveAdvText } from '../../src/primitives/PrimitiveAdvText.js';
import type { EditorFacade } from '../../src/circuit/EditorFacade.js';

describe('Text properties', () => {
    let sidebar: HTMLElement;
    let text: PrimitiveAdvText;

    beforeEach(async () => {
        await loadLocale('en');
        const model = new DrawingModel();
        sidebar = document.createElement('div');
        sidebar.appendChild(document.createElement('div'));
        document.body.appendChild(sidebar);

        const facade = {
            getModel: () => model,
            getLayers: () => model.getLayers(),
            getLayerDescriptions: () => [],
            render: () => {},
        } as unknown as EditorFacade;

        text = new PrimitiveAdvText(10, 10, 3, 4, 'Courier New', 0, 0, '$x$', 0);
        model.getPrimitiveVector().push(text);
        const controller = new PropertiesPanelController(sidebar, facade);
        controller.onGetFontFamilies = async () => [];
        controller.show(text);
    });

    function inputAfter(label: string): HTMLInputElement {
        const labelElement = Array.from(sidebar.querySelectorAll('span')).find(
            (span) => span.textContent === label,
        );
        return labelElement!.parentElement!.querySelector('input')!;
    }

    it('updates width when font size changes', () => {
        const size = inputAfter('Font size:');
        const width = inputAfter('Font width:');

        size.value = '20';
        size.dispatchEvent(new Event('change'));

        expect(text.getFontDimension()).toBe(20);
        expect(text.getFontWidth()).toBe(14);
        expect(width.value).toBe('14');
    });

    it('does not update font size when width is overridden', () => {
        const size = inputAfter('Font size:');
        const width = inputAfter('Font width:');

        width.value = '9';
        width.dispatchEvent(new Event('change'));

        expect(text.getFontWidth()).toBe(9);
        expect(text.getFontDimension()).toBe(4);
        expect(size.value).toBe('4');
    });
});
