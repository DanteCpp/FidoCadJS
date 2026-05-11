/**
 * @file PropertiesPanelController.ts
 * @author Dante Loi
 * @date 2026-05-09
 * @brief Properties sidebar form builder extracted from app.ts
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import type { CircuitPanel } from '../circuit/CircuitPanel.js';
import type { GraphicPrimitive } from '../primitives/GraphicPrimitive.js';
import { PrimitiveAdvText } from '../primitives/PrimitiveAdvText.js';
import { PrimitiveLine } from '../primitives/PrimitiveLine.js';
import { PrimitiveRectangle } from '../primitives/PrimitiveRectangle.js';
import { PrimitiveOval } from '../primitives/PrimitiveOval.js';
import { PrimitiveBezier } from '../primitives/PrimitiveBezier.js';
import { PrimitivePCBLine } from '../primitives/PrimitivePCBLine.js';
import { PrimitivePCBPad } from '../primitives/PrimitivePCBPad.js';
import { PrimitivePolygon } from '../primitives/PrimitivePolygon.js';
import { PrimitiveComplexCurve } from '../primitives/PrimitiveComplexCurve.js';
import { PrimitiveMacro } from '../primitives/PrimitiveMacro.js';
import { LayerDropdown } from './LayerDropdown.js';

export class PropertiesPanelController {
    private sidebar: HTMLElement;
    private circuitPanel: CircuitPanel;
    private fontFamilies: string[] | null = null;
    private fontFamiliesPromise: Promise<string[]> | null = null;
    private currentLayerDropdown: LayerDropdown | null = null;

    /** Callback to load available font families (async, app-level). */
    onGetFontFamilies: (() => Promise<string[]>) | null = null;

    constructor(sidebar: HTMLElement, circuitPanel: CircuitPanel) {
        this.sidebar = sidebar;
        this.circuitPanel = circuitPanel;
    }

    show(prim: GraphicPrimitive): void {
        // Destroy previous layer dropdown listener if any
        if (this.currentLayerDropdown) {
            this.currentLayerDropdown.destroy();
            this.currentLayerDropdown = null;
        }

        const header = this.sidebar.firstElementChild;
        this.sidebar.innerHTML = '';
        this.sidebar.appendChild(header as HTMLElement);

        const form = document.createElement('div');
        form.style.cssText = 'padding: 12px; display: flex; flex-direction: column; gap: 10px;';

        const redraw = () => {
            prim.setChanged(true);
            const model = this.circuitPanel.getModel();
            model.setChanged(true);
            model.sortPrimitiveLayers();
            this.circuitPanel.render();
        };

        // --- Section heading helper ---
        const addSection = (title: string): void => {
            const sec = document.createElement('div');
            sec.textContent = title;
            sec.style.cssText =
                'font-size: 11px; font-weight: bold; color: #666; text-transform: uppercase; ' +
                'letter-spacing: 0.5px; margin-top: 4px; padding-bottom: 2px; border-bottom: 1px solid #ddd;';
            form.appendChild(sec);
        };

        // --- Common helpers ---
        const addText = (label: string, get: () => string, set: (v: string) => void): HTMLInputElement => {
            const row = this.createPropertyRow(label);
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.value = get();
            inp.style.cssText = 'flex: 1; padding: 4px; font-size: 12px;';
            inp.addEventListener('input', () => { set(inp.value); redraw(); });
            row.appendChild(inp);
            form.appendChild(row);
            return inp;
        };

        const addNumber = (label: string, get: () => number, set: (v: number) => void,
                           min?: number, max?: number, step?: number): void => {
            const row = this.createPropertyRow(label);
            const inp = document.createElement('input');
            inp.type = 'number';
            inp.value = String(get());
            inp.style.cssText = 'flex: 1; padding: 4px; font-size: 12px;';
            if (min !== undefined) inp.min = String(min);
            if (max !== undefined) inp.max = String(max);
            if (step !== undefined) inp.step = String(step);
            inp.addEventListener('change', () => { set(Number(inp.value)); redraw(); });
            row.appendChild(inp);
            form.appendChild(row);
        };

        const addCheck = (label: string, get: () => boolean, set: (v: boolean) => void): void => {
            const row = this.createPropertyRow(label);
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = get();
            cb.addEventListener('change', () => { set(cb.checked); redraw(); });
            row.appendChild(cb);
            form.appendChild(row);
        };

        const addSelect = (label: string, options: { value: string; text: string }[],
                           get: () => string, set: (v: string) => void): void => {
            const row = this.createPropertyRow(label);
            const sel = document.createElement('select');
            sel.style.cssText = 'flex: 1; padding: 4px; font-size: 12px;';
            for (const o of options) {
                const opt = document.createElement('option');
                opt.value = o.value;
                opt.textContent = o.text;
                sel.appendChild(opt);
            }
            sel.value = get();
            sel.addEventListener('change', () => { set(sel.value); redraw(); });
            row.appendChild(sel);
            form.appendChild(row);
        };

        const dashOptions = Array.from({ length: 10 }, (_, i) => ({ value: String(i), text: String(i) }));
        const orientOptions = [0, 90, 180, 270].map(a => ({ value: String(a), text: `${a}°` }));

        const addArrowSection = (arrowLabel: string,
                                  getArrowStart: () => boolean, setArrowStart: (v: boolean) => void,
                                  getArrowEnd: () => boolean, setArrowEnd: (v: boolean) => void,
                                  getArrowStyle: () => number, setArrowStyle: (v: number) => void,
                                  getArrowLen: () => number, setArrowLen: (v: number) => void,
                                  getArrowWid: () => number, setArrowWid: (v: number) => void): void => {
            addSection(arrowLabel);
            addCheck('Arrow start:', getArrowStart, setArrowStart);
            addCheck('Arrow end:', getArrowEnd, setArrowEnd);
            addSelect('Style:', [
                { value: '0', text: 'Filled' },
                { value: '2', text: 'Empty' },
                { value: '1', text: 'Limiter' },
                { value: '3', text: 'Empty+Limiter' },
            ], () => String(getArrowStyle()), v => setArrowStyle(Number(v)));
            addNumber('Length:', getArrowLen, setArrowLen, 0, undefined, 1);
            addNumber('Half width:', getArrowWid, setArrowWid, 0, undefined, 1);
        };

        const addLayerSection = (): void => {
            addSection('Common');
            const layerDescs = this.circuitPanel.getLayers();
            const layerNames = this.circuitPanel.getLayerDescriptions();

            const row = this.createPropertyRow('Layer:');
            const dropdown = new LayerDropdown(
                layerDescs,
                layerNames,
                prim.getLayer(),
                (idx) => {
                    prim.setLayer(idx);
                    redraw();
                },
            );
            dropdown.element.style.flex = '1';
            row.appendChild(dropdown.element);
            form.appendChild(row);
            this.currentLayerDropdown = dropdown;
        };

        const addNameValue = (): void => {
            if (prim.getNameVirtualPointNumber() >= 0) {
                addText('Name:', () => prim.getName(), v => prim.setNameStr(v));
                addText('Value:', () => prim.getValue(), v => prim.setValueStr(v));
            }
        };

        // ─── Helper: load font families (cached) ───
        const loadFonts = () => {
            if (!this.fontFamiliesPromise) {
                this.fontFamiliesPromise = (this.onGetFontFamilies?.() ?? Promise.resolve([])).then(families => {
                    this.fontFamilies = families;
                    return families;
                });
            }
            return this.fontFamiliesPromise;
        };

        // ===== TYPE-SPECIFIC SECTIONS =====

        if (prim instanceof PrimitiveAdvText) {
            addSection('Text');
            const contentInput = addText('Content:', () => prim.getString(), v => prim.setString(v));
            requestAnimationFrame(() => {
                contentInput.focus();
                contentInput.select();
            });
            // Font size (height) and font width — custom inputs with LaTeX auto-sync.
            // For LaTeX text ($...$), changing either field auto-updates the other
            // to maintain the default 10:7 aspect ratio.
            {
                const isLatex = () => prim.getString().includes('$');

                const siyRow = this.createPropertyRow('Font size:');
                const siyInp = document.createElement('input');
                siyInp.type = 'number';
                siyInp.value = String(prim.getFontDimension());
                siyInp.min = '1';
                siyInp.max = '2000';
                siyInp.style.cssText = 'flex: 1; padding: 4px; font-size: 12px;';
                siyRow.appendChild(siyInp);
                form.appendChild(siyRow);

                const sixRow = this.createPropertyRow('Font width:');
                const sixInp = document.createElement('input');
                sixInp.type = 'number';
                sixInp.value = String(prim.getFontWidth());
                sixInp.min = '1';
                sixInp.max = '2000';
                sixInp.style.cssText = 'flex: 1; padding: 4px; font-size: 12px;';
                sixRow.appendChild(sixInp);
                form.appendChild(sixRow);

                const handleSiyChange = () => {
                    const v = Number(siyInp.value);
                    prim.setFontDimension(v);
                    if (isLatex()) {
                        const newSix = Math.round(v * 7 / 10);
                        sixInp.value = String(newSix);
                        prim.setFontWidth(newSix);
                    }
                    redraw();
                };
                const handleSixChange = () => {
                    const v = Number(sixInp.value);
                    prim.setFontWidth(v);
                    if (isLatex()) {
                        const newSiy = Math.round(v * 10 / 7);
                        siyInp.value = String(newSiy);
                        prim.setFontDimension(newSiy);
                    }
                    redraw();
                };
                siyInp.addEventListener('change', handleSiyChange);
                sixInp.addEventListener('change', handleSixChange);
            }
            addNumber('Orientation:', () => prim.getOrientation(), v => prim.setOrientation(v), -360, 360, 1);
            addCheck('Mirror:', () => prim.isMirrored() !== 0, v => prim.setMirrored(v ? 1 : 0));
            addCheck('Bold:', () => prim.isBold(), v => prim.setBold(v));
            addCheck('Italic:', () => prim.isItalic(), v => prim.setItalic(v));
            const fontOptions = this.fontFamilies
                ? this.fontFamilies.map(f => ({ value: f, text: f }))
                : [
                    'Arial', 'Calibri', 'Cambria', 'Consolas', 'Courier New',
                    'DejaVu Sans', 'DejaVu Sans Mono', 'DejaVu Serif',
                    'Georgia', 'Helvetica', 'Helvetica Neue', 'Menlo',
                    'Monaco', 'Sans-serif', 'Segoe UI', 'Serif', 'Tahoma',
                    'Times New Roman', 'Verdana',
                  ].map(f => ({ value: f, text: f }));
            addSelect('Font:', fontOptions, () => prim.getFontName(), v => prim.setFontName(v));
            loadFonts().then(families => {
                const sel = form.querySelector('select') as HTMLSelectElement;
                if (sel && families.length > fontOptions.length) {
                    const currentVal = sel.value;
                    sel.innerHTML = '';
                    for (const f of families) {
                        const opt = document.createElement('option');
                        opt.value = f;
                        opt.textContent = f;
                        sel.appendChild(opt);
                    }
                    sel.value = families.includes(currentVal) ? currentVal : families[0]!;
                }
            });
            addLayerSection();

        } else if (prim instanceof PrimitiveLine) {
            const ad = prim.getArrowData();
            addSection('Line');
            addSelect('Dash style:', dashOptions, () => String(prim.getDashStyle()), v => prim.setDashStyle(Number(v)));
            addArrowSection('Arrows',
                () => ad.isArrowStart(), v => { ad.setArrowStart(v); redraw(); },
                () => ad.isArrowEnd(), v => { ad.setArrowEnd(v); redraw(); },
                () => ad.getArrowStyle(), v => { ad.setArrowStyle(v); redraw(); },
                () => ad.getArrowLength(), v => { ad.setArrowLength(v); redraw(); },
                () => ad.getArrowHalfWidth(), v => { ad.setArrowHalfWidth(v); redraw(); });
            addLayerSection();
            addNameValue();

        } else if (prim instanceof PrimitiveRectangle) {
            addSection('Rectangle');
            addCheck('Filled:', () => prim.getFilled(), v => prim.setFilled(v));
            addSelect('Dash style:', dashOptions, () => String(prim.getDashStyle()), v => prim.setDashStyle(Number(v)));
            addLayerSection();
            addNameValue();

        } else if (prim instanceof PrimitiveOval) {
            addSection('Ellipse');
            addCheck('Filled:', () => prim.getFilled(), v => prim.setFilled(v));
            addSelect('Dash style:', dashOptions, () => String(prim.getDashStyle()), v => prim.setDashStyle(Number(v)));
            addLayerSection();
            addNameValue();

        } else if (prim instanceof PrimitiveBezier) {
            const ad = prim.getArrowData();
            addSection('Bézier');
            addSelect('Dash style:', dashOptions, () => String(prim.getDashStyle()), v => prim.setDashStyle(Number(v)));
            addArrowSection('Arrows',
                () => ad.isArrowStart(), v => { ad.setArrowStart(v); redraw(); },
                () => ad.isArrowEnd(), v => { ad.setArrowEnd(v); redraw(); },
                () => ad.getArrowStyle(), v => { ad.setArrowStyle(v); redraw(); },
                () => ad.getArrowLength(), v => { ad.setArrowLength(v); redraw(); },
                () => ad.getArrowHalfWidth(), v => { ad.setArrowHalfWidth(v); redraw(); });
            addLayerSection();
            addNameValue();

        } else if (prim instanceof PrimitivePCBLine) {
            addSection('PCB Line');
            addNumber('Width:', () => prim.getWidth(), v => prim.setWidth(v), 0, undefined, 0.5);
            addLayerSection();
            addNameValue();

        } else if (prim instanceof PrimitivePCBPad) {
            addSection('PCB Pad');
            addNumber('Size X:', () => prim.getRx(), v => prim.setRx(v), 0, undefined, 0.5);
            addNumber('Size Y:', () => prim.getRy(), v => prim.setRy(v), 0, undefined, 0.5);
            addNumber('Drill radius:', () => prim.getRi(), v => prim.setRi(v), 0, undefined, 0.5);
            addSelect('Shape:', [
                { value: '0', text: 'Oval' },
                { value: '1', text: 'Rectangle' },
                { value: '2', text: 'Rounded rect.' },
            ], () => String(prim.getSty()), v => prim.setSty(Number(v)));
            addLayerSection();
            addNameValue();

        } else if (prim instanceof PrimitivePolygon) {
            addSection('Polygon');
            addCheck('Filled:', () => prim.getFilled(), v => prim.setFilled(v));
            addSelect('Dash style:', dashOptions, () => String(prim.getDashStyle()), v => prim.setDashStyle(Number(v)));
            addLayerSection();
            addNameValue();

        } else if (prim instanceof PrimitiveComplexCurve) {
            const ad = prim.getArrowData();
            addSection('Complex curve');
            addCheck('Filled:', () => prim.getFilled(), v => prim.setFilled(v));
            addCheck('Closed:', () => prim.getIsClosed(), v => prim.setIsClosed(v));
            addSelect('Dash style:', dashOptions, () => String(prim.getDashStyle()), v => prim.setDashStyle(Number(v)));
            addArrowSection('Arrows',
                () => ad.isArrowStart(), v => { ad.setArrowStart(v); redraw(); },
                () => ad.isArrowEnd(), v => { ad.setArrowEnd(v); redraw(); },
                () => ad.getArrowStyle(), v => { ad.setArrowStyle(v); redraw(); },
                () => ad.getArrowLength(), v => { ad.setArrowLength(v); redraw(); },
                () => ad.getArrowHalfWidth(), v => { ad.setArrowHalfWidth(v); redraw(); });
            addLayerSection();
            addNameValue();

        } else if (prim instanceof PrimitiveMacro) {
            addSection('Component');
            const nameRow = this.createPropertyRow('Macro:');
            const nameSpan = document.createElement('span');
            nameSpan.textContent = prim.getMacroName();
            nameSpan.style.cssText = 'flex: 1; font-size: 12px; font-family: monospace; color: #555;';
            nameRow.appendChild(nameSpan);
            form.appendChild(nameRow);
            addSelect('Orientation:', orientOptions,
                () => String(prim.getOrientation() * 90),
                v => prim.setOrientation(Math.round(Number(v) / 90)));
            addCheck('Mirror:', () => prim.isMirrored(), v => prim.setMirrored(v));
            addLayerSection();
            addNameValue();

        } else {
            addLayerSection();
            addNameValue();
        }

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText =
            'margin-top: 8px; padding: 8px 16px; cursor: pointer; border: 1px solid #ccc; ' +
            'border-radius: 4px; background: #e0e0e0; font-size: 13px; align-self: flex-end;';
        closeBtn.addEventListener('click', () => {
            this.sidebar.style.display = 'none';
        });
        form.appendChild(closeBtn);

        this.sidebar.appendChild(form);
        this.sidebar.style.display = 'flex';
    }

    private createPropertyRow(label: string): HTMLElement {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; align-items: center; gap: 8px;';
        const lbl = document.createElement('span');
        lbl.textContent = label;
        lbl.style.cssText = 'min-width: 80px; font-size: 12px; color: #333;';
        row.appendChild(lbl);
        return row;
    }
}
