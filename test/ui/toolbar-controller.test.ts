import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadLocale } from '../../src/i18n/i18n.js';
import { ToolbarController } from '../../src/ui/ToolbarController.js';
import { ElementsEdtActions } from '../../src/circuit/controllers/ElementsEdtActions.js';
import { StandardLayers } from '../../src/layers/StandardLayers.js';
import type { EditorFacade } from '../../src/circuit/EditorFacade.js';

/** Minimal stateful EditorFacade fake covering what the toolbar touches. */
function makeFacade() {
    const state = {
        tool: -1,
        zoomPercent: 100,
        grid: true,
        snap: true,
        currentLayer: 0,
    };
    const facade = {
        state,
        onToolChange: null as ((toolId: number) => void) | null,
        onZoomChange: null as (() => void) | null,
        onCoordinatesChange: null as ((x: number, y: number) => void) | null,
        setTool: vi.fn((id: number) => {
            state.tool = id;
            facade.onToolChange?.(id);
        }),
        setZoom: vi.fn((magnitude: number) => {
            state.zoomPercent = (magnitude / 20) * 100;
        }),
        getZoomPercent: () => state.zoomPercent,
        zoomToFit: vi.fn(() => {
            state.zoomPercent = 42;
        }),
        isGridVisible: () => state.grid,
        setGridVisible: vi.fn((v: boolean) => {
            state.grid = v;
        }),
        isSnapActive: () => state.snap,
        setSnap: vi.fn((v: boolean) => {
            state.snap = v;
        }),
        getLayers: () => StandardLayers.createStandardLayers(),
        getLayerDescriptions: () =>
            StandardLayers.createStandardLayers().map((l) => l.getDescription()),
        getCurrentLayer: () => state.currentLayer,
        setCurrentLayer: vi.fn((idx: number) => {
            state.currentLayer = idx;
        }),
    };
    return facade;
}

describe('ToolbarController', () => {
    let toolbar: HTMLElement;
    let facade: ReturnType<typeof makeFacade>;
    let controller: ToolbarController;

    beforeEach(async () => {
        await loadLocale('en');
        document.body.innerHTML = '';
        toolbar = document.createElement('div');
        document.body.appendChild(toolbar);
        facade = makeFacade();
        controller = new ToolbarController(toolbar, facade as unknown as EditorFacade, '/');
        controller.build();
    });

    it('builds 13 tool buttons and arms the Selection tool', () => {
        const iconButtons = toolbar.querySelectorAll('button img');
        expect(iconButtons).toHaveLength(13);
        expect(facade.state.tool).toBe(ElementsEdtActions.SELECTION);
    });

    it('clicking a tool button selects that tool and highlights only it', () => {
        const lineBtn = Array.from(toolbar.querySelectorAll('button')).find((b) =>
            (b as HTMLButtonElement).title.startsWith('L:'),
        ) as HTMLButtonElement;
        expect(lineBtn).toBeDefined();

        lineBtn.click();

        expect(facade.state.tool).toBe(ElementsEdtActions.LINE);
        // onToolChange highlight: the clicked button is active, others not.
        expect(lineBtn.style.background).toBe('rgb(176, 200, 232)');
        const selBtn = Array.from(toolbar.querySelectorAll('button')).find((b) =>
            (b as HTMLButtonElement).title.startsWith('A / Space:'),
        ) as HTMLButtonElement;
        expect(selBtn.style.background).not.toBe('rgb(176, 200, 232)');
    });

    it('tool tooltips lead with the canonical shortcut letter', () => {
        const titles = Array.from(toolbar.querySelectorAll('button'))
            .map((b) => (b as HTMLButtonElement).title)
            .filter(Boolean);
        for (const prefix of ['L:', 'T:', 'B:', 'P:', 'O:', 'E:', 'G:', 'C:', 'I:', 'Z:']) {
            expect(titles.some((t) => t.startsWith(prefix))).toBe(true);
        }
    });

    it('changing the zoom dropdown sets the panel zoom', () => {
        const select = toolbar.querySelector('[data-testid="zoom-select"]') as HTMLSelectElement;
        select.value = '200';
        select.dispatchEvent(new Event('change'));
        // 200 % → magnitude 40 (100 % = 20).
        expect(facade.setZoom).toHaveBeenCalledWith(40);
    });

    it('onZoomChange snaps the dropdown to the preset nearest the real zoom', () => {
        // Regression guard: zoomIn/zoomOut/setZoom on the panel must notify
        // onZoomChange so the dropdown follows keyboard zoom, not only wheel.
        const select = toolbar.querySelector('[data-testid="zoom-select"]') as HTMLSelectElement;
        expect(select.value).toBe('100');

        facade.state.zoomPercent = 144; // two 1.2× keyboard zoom-ins
        facade.onZoomChange?.();
        expect(select.value).toBe('150');

        facade.state.zoomPercent = 90;
        facade.onZoomChange?.();
        expect(select.value).toBe('100');
    });

    it('the Fit button fits the view and re-syncs the dropdown', () => {
        const fitBtn = Array.from(toolbar.querySelectorAll('button')).find(
            (b) => b.textContent === 'Fit',
        ) as HTMLButtonElement;
        fitBtn.click();
        expect(facade.zoomToFit).toHaveBeenCalledOnce();
        const select = toolbar.querySelector('[data-testid="zoom-select"]') as HTMLSelectElement;
        expect(select.value).toBe('50'); // nearest preset to the fake's 42 %
    });

    it('grid and snap buttons toggle panel state on each click', () => {
        const gridBtn = Array.from(toolbar.querySelectorAll('button')).find((b) =>
            b.textContent?.includes('grid'),
        ) as HTMLButtonElement;
        gridBtn.click();
        expect(facade.state.grid).toBe(false);
        gridBtn.click();
        expect(facade.state.grid).toBe(true);

        const snapBtn = Array.from(toolbar.querySelectorAll('button')).find((b) =>
            b.textContent?.toLowerCase().includes('snap'),
        ) as HTMLButtonElement;
        snapBtn.click();
        expect(facade.state.snap).toBe(false);
        snapBtn.click();
        expect(facade.state.snap).toBe(true);
    });

    it('the Libs button invokes the library toggle callback', () => {
        const onToggle = vi.fn();
        controller.setLibraryToggleCallback(onToggle);
        const libBtn = Array.from(toolbar.querySelectorAll('button')).find(
            (b) => b.textContent === 'Libs',
        ) as HTMLButtonElement;
        libBtn.click();
        expect(onToggle).toHaveBeenCalledOnce();
    });

    it('updates the coordinates display through onCoordinatesChange', () => {
        const coords = toolbar.querySelector('[data-testid="coords-display"]') as HTMLElement;
        expect(coords.textContent).toBe('X: 0  Y: 0');
        facade.onCoordinatesChange?.(12.6, 7.2);
        expect(coords.textContent).toBe('X: 13  Y: 7');
    });
});
