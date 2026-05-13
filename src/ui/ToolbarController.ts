/**
 * @file ToolbarController.ts
 * @author Dante Loi
 * @date 2026-05-09
 * @brief Toolbar UI builder extracted from app.ts
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { ElementsEdtActions } from '../circuit/controllers/ElementsEdtActions.js';
import type { EditorFacade } from '../circuit/EditorFacade.js';
import { LayerDropdown } from './LayerDropdown.js';

export class ToolbarController {
    private toolbar: HTMLElement;
    private circuitPanel: EditorFacade;
    private toolButtons: Map<number, HTMLButtonElement> = new Map();
    private baseUrl: string;

    /** Optional: element to toggle visibility (library panel). */
    private onLibraryToggle: (() => void) | null = null;

    constructor(
        toolbar: HTMLElement,
        circuitPanel: EditorFacade,
        baseUrl: string,
    ) {
        this.toolbar = toolbar;
        this.circuitPanel = circuitPanel;
        this.baseUrl = baseUrl;
    }

    /** Provide a callback for library panel toggle. */
    setLibraryToggleCallback(fn: () => void): void {
        this.onLibraryToggle = fn;
    }

    build(): void {
        // Main toolbar container with vertical layout (two rows)
        this.toolbar.style.cssText =
            'display: flex; flex-direction: column; padding: 2px 8px; ' +
            'background: #f0f0f0; border-bottom: 1px solid #ccc; font-family: sans-serif; font-size: 12px;';

        this.buildFirstRow();
        this.buildSecondRow();

        // Initialize with SELECT tool
        this.circuitPanel.setTool(ElementsEdtActions.SELECTION);
    }

    private buildFirstRow(): void {
        const firstRow = document.createElement('div');
        firstRow.style.cssText = 'display: flex; align-items: center; gap: 4px; padding: 2px 0;';

        const toolDefs: Array<[string, string, number]> = [
            ['A: Select and move an object. Space: fit to view. Type R to rotate, S to swap.', 'arrow.png',       ElementsEdtActions.SELECTION],
            ['Left click: increase zoom, right click: decrease zoom.',              'magnifier.png',   ElementsEdtActions.ZOOM],
            ['Scroll through a big drawing.',                                       'move.png',        ElementsEdtActions.HAND],
            ['L: Draw a line.',                                                     'line.png',        ElementsEdtActions.LINE],
            ['T: Place a text.',                                                    'text.png',        ElementsEdtActions.TEXT],
            ['B: Draw a four-point Bézier primitive.',                              'bezier.png',      ElementsEdtActions.BEZIER],
            ['P: Place a polygon.',                                                 'polygon.png',     ElementsEdtActions.POLYGON],
            ['O: Open or closed curve.',                                            'complexcurve.png',ElementsEdtActions.COMPLEXCURVE],
            ['E: Place an ellipse (hold Control for a circle).',                    'ellipse.png',     ElementsEdtActions.ELLIPSE],
            ['G: Place a rectangle.',                                               'rectangle.png',   ElementsEdtActions.RECTANGLE],
            ['C: Place an electrical connection.',                                  'connection.png',  ElementsEdtActions.CONNECTION],
            ['I: Place a PCB trace.',                                                 'pcbline.png',      ElementsEdtActions.PCB_LINE],
            ['Z: Place a PCB pad.',                                                   'pcbpad.png',       ElementsEdtActions.PCB_PAD],
        ];

        for (const [tooltip, icon, toolId] of toolDefs) {
            const btn = this.addIconButton(firstRow, `${this.baseUrl}icons/${icon}`, tooltip, () => {
                this.circuitPanel.setTool(toolId);
            });
            this.toolButtons.set(toolId, btn);
        }

        this.circuitPanel.onToolChange = (toolId) => {
            for (const [id, btn] of this.toolButtons) {
                const active = id === toolId;
                btn.style.background = active ? '#b0c8e8' : '#e8e8e8';
                btn.style.border = active ? '1px solid #5a8fc0' : '1px solid transparent';
            }
        };

        this.toolbar.appendChild(firstRow);
    }

    private buildSecondRow(): void {
        const secondRow = document.createElement('div');
        secondRow.style.cssText = 'display: flex; align-items: center; gap: 4px; padding: 2px 0;';

        // Zoom combobox
        const zoomLevels = [25, 50, 75, 100, 150, 200, 300, 400, 600, 800, 1000, 1500, 2000, 3000, 4000];
        const zoomSelect = document.createElement('select');
        zoomSelect.setAttribute('data-testid', 'zoom-select');
        zoomSelect.style.cssText =
            'font-size: 12px; padding: 3px 4px; border-radius: 2px; border: 1px solid #ccc; ' +
            'background: white; width: 72px;';
        zoomSelect.title = 'Zoom level';
        for (const level of zoomLevels) {
            const opt = document.createElement('option');
            opt.value = String(level);
            opt.textContent = `${level}%`;
            zoomSelect.appendChild(opt);
        }
        zoomSelect.value = '100';
        zoomSelect.addEventListener('change', () => {
            const pct = Number(zoomSelect.value);
            this.circuitPanel.setZoom(pct * 20 / 100);
        });

        const syncZoomSelect = () => {
            const current = this.circuitPanel.getZoomPercent();
            let closest = zoomLevels[0];
            let minDist = Math.abs(current - zoomLevels[0]);
            for (const level of zoomLevels) {
                const d = Math.abs(current - level);
                if (d < minDist) { minDist = d; closest = level; }
            }
            zoomSelect.value = String(closest);
        };
        this.circuitPanel.onZoomChange = syncZoomSelect;
        secondRow.appendChild(zoomSelect);

        // Fit button
        this.addTextButton(secondRow, 'Fit', () => {
            this.circuitPanel.zoomToFit();
            syncZoomSelect();
        });

        // Divider
        this.addDivider(secondRow);

        // Show Grid toggle
        const gridBtn = this.addTextButton(secondRow, 'Show Grid', () => {
            const visible = this.circuitPanel.isGridVisible();
            this.circuitPanel.setGridVisible(!visible);
            this.setToggleActive(gridBtn, this.circuitPanel.isGridVisible());
        });
        this.setToggleActive(gridBtn, this.circuitPanel.isGridVisible());

        // Snap toggle
        const snapBtn = this.addTextButton(secondRow, 'Snap', () => {
            const active = this.circuitPanel.isSnapActive();
            this.circuitPanel.setSnap(!active);
            this.setToggleActive(snapBtn, this.circuitPanel.isSnapActive());
        });
        this.setToggleActive(snapBtn, this.circuitPanel.isSnapActive());

        // Library toggle
        const libBtn = this.addTextButton(secondRow, 'Libs', () => {
            if (this.onLibraryToggle) this.onLibraryToggle();
            // Toggle active visual state (host should also toggle visibility)
            const isActive = libBtn.style.background === 'rgb(176, 200, 232)';
            this.setToggleActive(libBtn, !isActive);
        });
        this.setToggleActive(libBtn, true);

        // Divider
        this.addDivider(secondRow);

        // Layer dropdown
        this.buildLayerDropdown(secondRow);

        // Spacer
        const spacer = document.createElement('span');
        spacer.style.cssText = 'flex: 1;';
        secondRow.appendChild(spacer);

        // Coordinates display
        const coordsLabel = document.createElement('span');
        coordsLabel.setAttribute('data-testid', 'coords-display');
        coordsLabel.textContent = 'X: 0  Y: 0';
        coordsLabel.style.cssText =
            'font-family: monospace; font-size: 11px; color: #555; min-width: 120px; text-align: right;';
        secondRow.appendChild(coordsLabel);
        this.circuitPanel.onCoordinatesChange = (lx, ly) => {
            coordsLabel.textContent = `X: ${Math.round(lx)}  Y: ${Math.round(ly)}`;
        };

        this.toolbar.appendChild(secondRow);
    }

    private buildLayerDropdown(row: HTMLElement): void {
        const layerDescs = this.circuitPanel.getLayers();
        const layerNames = this.circuitPanel.getLayerDescriptions();
        const dropdown = new LayerDropdown(
            layerDescs,
            layerNames,
            this.circuitPanel.getCurrentLayer(),
            (idx) => this.circuitPanel.setCurrentLayer(idx),
        );
        row.appendChild(dropdown.element);
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    private setToggleActive(btn: HTMLButtonElement, active: boolean): void {
        btn.style.background = active ? '#b0c8e8' : '#e8e8e8';
        btn.style.border = active ? '1px solid #5a8fc0' : '1px solid transparent';
    }

    private addIconButton(row: HTMLElement, iconSrc: string, tooltip: string, onClick: () => void): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.title = tooltip;
        btn.style.cssText =
            'padding: 3px; cursor: pointer; border: 1px solid transparent; ' +
            'background: #e8e8e8; border-radius: 2px; display: flex; align-items: center; justify-content: center;';
        const img = document.createElement('img');
        img.src = iconSrc;
        img.width = 20;
        img.height = 20;
        img.alt = tooltip;
        img.style.display = 'block';
        btn.appendChild(img);
        btn.addEventListener('click', onClick);
        btn.addEventListener('mouseenter', () => {
            if (btn.style.opacity !== '0.4') btn.style.background = '#ddd';
        });
        btn.addEventListener('mouseleave', () => {
            if (btn.style.opacity !== '0.4' && !btn.style.borderColor) btn.style.background = '#e8e8e8';
        });
        row.appendChild(btn);
        return btn;
    }

    private addTextButton(row: HTMLElement, label: string, onClick: () => void): HTMLButtonElement {
        const button = document.createElement('button');
        button.textContent = label;
        button.style.cssText =
            'padding: 4px 8px; cursor: pointer; border: 1px solid transparent; ' +
            'background: #e8e8e8; border-radius: 2px; font-size: 12px;';
        button.addEventListener('click', onClick);
        button.addEventListener('mouseenter', () => {
            if (button.style.opacity !== '0.4') {
                button.style.background = '#ddd';
            }
        });
        button.addEventListener('mouseleave', () => {
            if (button.style.opacity !== '0.4' && !button.style.borderColor) {
                button.style.background = '#e8e8e8';
            }
        });
        row.appendChild(button);
        return button;
    }

    private addDivider(row: HTMLElement): void {
        const divider = document.createElement('span');
        divider.style.cssText = 'width: 1px; height: 20px; background: #bbb; margin: 0 2px;';
        row.appendChild(divider);
    }
}
