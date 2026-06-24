import { Globals } from '../globals/Globals.js';

export class DashStyleDropdown {
    readonly element: HTMLDivElement;

    private currentIdx: number;
    private btnPreview: HTMLSpanElement;
    private list: HTMLDivElement;
    private onChange: (index: number) => void;
    private closeOnOutside: (e: MouseEvent) => void;

    constructor(initialStyle: number, onChange: (index: number) => void) {
        this.currentIdx = Math.max(0, Math.min(Globals.dashNumber - 1, initialStyle));
        this.onChange = onChange;

        this.element = document.createElement('div');
        this.element.style.cssText = 'position:relative; display:inline-block;';

        const btn = document.createElement('div');
        btn.style.cssText =
            'display:flex; align-items:center; gap:6px; cursor:pointer;' +
            ' border:1px solid #ccc; border-radius:2px; padding:3px 6px;' +
            ' background:white; font-size:12px; user-select:none; min-width:120px;';

        this.btnPreview = this.makePreview(this.currentIdx);
        const arrow = document.createElement('span');
        arrow.textContent = '▾';
        arrow.style.cssText = 'color:#666; font-size:10px; margin-left:auto;';
        btn.append(this.btnPreview, arrow);

        this.list = document.createElement('div');
        this.list.style.cssText =
            'display:none; position:absolute; top:100%; left:0; z-index:1000;' +
            ' border:1px solid #ccc; border-radius:2px; background:white;' +
            ' box-shadow:2px 4px 8px rgba(0,0,0,0.18); min-width:100%;' +
            ' max-height:260px; overflow-y:auto;';

        for (let i = 0; i < Globals.dashNumber; i++) {
            const item = document.createElement('div');
            item.style.cssText =
                'display:flex; align-items:center; gap:6px; padding:4px 8px;' +
                ' cursor:pointer; font-size:12px; white-space:nowrap;';
            item.append(this.makePreview(i));
            item.addEventListener('mouseenter', () => {
                item.style.background = '#e8f0fe';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = '';
            });
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.select(i);
                this.list.style.display = 'none';
            });
            this.list.appendChild(item);
        }

        btn.addEventListener('click', () => {
            this.list.style.display = this.list.style.display === 'none' ? 'block' : 'none';
        });

        this.closeOnOutside = (e: MouseEvent) => {
            if (!this.element.contains(e.target as Node)) {
                this.list.style.display = 'none';
            }
        };
        document.addEventListener('mousedown', this.closeOnOutside);

        this.element.append(btn, this.list);
    }

    destroy(): void {
        document.removeEventListener('mousedown', this.closeOnOutside);
    }

    private select(index: number): void {
        this.currentIdx = index;
        const newPreview = this.makePreview(index);
        this.btnPreview.replaceWith(newPreview);
        this.btnPreview = newPreview;
        this.onChange(index);
    }

    private makePreview(style: number): HTMLSpanElement {
        const wrap = document.createElement('span');
        wrap.style.cssText =
            'display:inline-flex; align-items:center; flex:1; pointer-events:none;';
        const dashAttr = this.svgDashArray(style);
        const dashStr = dashAttr ? ` stroke-dasharray="${dashAttr}"` : '';
        wrap.innerHTML =
            `<svg width="110" height="14" viewBox="0 0 110 14" style="pointer-events:none">` +
            `<line x1="2" y1="7" x2="108" y2="7" stroke="#222" stroke-width="1.5"${dashStr}/>` +
            `</svg>`;
        return wrap;
    }

    /** Translate FidoCadJ dash style index to an SVG stroke-dasharray.
     *  Mirrors Globals.dash, scaled ×2 so the preview reads well at 14 px tall.
     *  Returns null for solid (gap == 0). */
    private svgDashArray(style: number): string | null {
        const pattern = Globals.dash[style];
        if (!pattern || pattern[1] === 0) return null;
        return pattern.map((n) => n * 2).join(' ');
    }
}
