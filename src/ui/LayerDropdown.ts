import { getString } from '../i18n/i18n.js';
import type { LayerDesc } from '../layers/LayerDesc.js';

export class LayerDropdown {
    readonly element: HTMLDivElement;

    private layerDescs: LayerDesc[];
    private layerNames: string[];
    private currentIdx: number;
    private btnSwatch: HTMLSpanElement;
    private btnLabel: HTMLSpanElement;
    private layerList: HTMLDivElement;
    private onLayerChange: (index: number) => void;
    private closeOnOutside: (e: MouseEvent) => void;

    constructor(
        layerDescs: LayerDesc[],
        layerNames: string[],
        initialLayer: number,
        onLayerChange: (index: number) => void,
    ) {
        this.layerDescs = layerDescs;
        this.layerNames = layerNames;
        this.currentIdx = initialLayer;
        this.onLayerChange = onLayerChange;

        // Outer container
        this.element = document.createElement('div');
        this.element.style.cssText = 'position:relative; display:inline-block;';
        this.element.title = getString('tooltip_layerSel');

        // Button (always visible — shows current layer)
        const layerBtn = document.createElement('div');
        layerBtn.style.cssText =
            'display:flex; align-items:center; gap:5px; cursor:pointer;' +
            ' border:1px solid #ccc; border-radius:2px; padding:3px 6px;' +
            ' background:white; font-size:12px; user-select:none; min-width:160px;';

        this.btnSwatch = this.makeSwatch(this.layerColorCSS(initialLayer));
        this.btnLabel = document.createElement('span');
        this.btnLabel.style.cssText = 'flex:1;';
        this.btnLabel.textContent = layerNames[initialLayer] ?? '';
        const btnArrow = document.createElement('span');
        btnArrow.textContent = '▾';
        btnArrow.style.cssText = 'color:#666; font-size:10px;';
        layerBtn.append(this.btnSwatch, this.btnLabel, btnArrow);

        // Dropdown list (hidden by default)
        this.layerList = document.createElement('div');
        this.layerList.style.cssText =
            'display:none; position:absolute; top:100%; left:0; z-index:1000;' +
            ' border:1px solid #ccc; border-radius:2px; background:white;' +
            ' box-shadow:2px 4px 8px rgba(0,0,0,0.18); min-width:100%;' +
            ' max-height:260px; overflow-y:auto;';

        for (let i = 0; i < layerDescs.length; i++) {
            const item = document.createElement('div');
            item.style.cssText =
                'display:flex; align-items:center; gap:5px; padding:4px 8px;' +
                ' cursor:pointer; font-size:12px; white-space:nowrap;';
            item.append(this.makeSwatch(this.layerColorCSS(i)));
            const lbl = document.createElement('span');
            lbl.textContent = layerNames[i] ?? '';
            item.appendChild(lbl);
            item.addEventListener('mouseenter', () => {
                item.style.background = '#e8f0fe';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = '';
            });
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.selectLayer(i);
                this.layerList.style.display = 'none';
            });
            this.layerList.appendChild(item);
        }

        const toggleList = () => {
            this.layerList.style.display =
                this.layerList.style.display === 'none' ? 'block' : 'none';
        };
        layerBtn.addEventListener('click', toggleList);

        const closeOnOutside = (e: MouseEvent) => {
            if (!this.element.contains(e.target as Node)) {
                this.layerList.style.display = 'none';
            }
        };
        this.closeOnOutside = closeOnOutside;
        document.addEventListener('mousedown', closeOnOutside);

        this.element.append(layerBtn, this.layerList);
    }

    /** Remove global listeners. Call when the dropdown is no longer needed. */
    destroy(): void {
        document.removeEventListener('mousedown', this.closeOnOutside);
    }

    /** Programmatically select a layer without firing the callback. */
    updateSelection(index: number): void {
        if (index === this.currentIdx) return;
        this.currentIdx = index;
        this.btnSwatch.style.background = this.layerColorCSS(index);
        this.btnLabel.textContent = this.layerNames[index] ?? '';
    }

    private selectLayer(index: number): void {
        this.currentIdx = index;
        this.btnSwatch.style.background = this.layerColorCSS(index);
        this.btnLabel.textContent = this.layerNames[index] ?? '';
        this.onLayerChange(index);
    }

    private layerColorCSS(idx: number): string {
        const c = this.layerDescs[idx]?.getColor();
        return c ? `rgb(${c.getRed()},${c.getGreen()},${c.getBlue()})` : '#888';
    }

    private makeSwatch(color: string): HTMLSpanElement {
        const sw = document.createElement('span');
        sw.style.cssText =
            `display:inline-block; width:14px; height:14px; min-width:14px;` +
            ` border:1px solid #666; background:${color}; border-radius:2px;`;
        return sw;
    }
}
