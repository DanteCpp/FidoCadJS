import { getString } from '../i18n/i18n.js';
import type { EditorFacade } from '../circuit/EditorFacade.js';
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
import { DashStyleDropdown } from './DashStyleDropdown.js';

export class PropertiesPanelController {
    private sidebar: HTMLElement;
    private circuitPanel: EditorFacade;
    private fontFamilies: string[] | null = null;
    private fontFamiliesPromise: Promise<string[]> | null = null;
    private currentLayerDropdown: LayerDropdown | null = null;
    private currentDashDropdowns: DashStyleDropdown[] = [];

    /** Callback to load available font families (async, app-level). */
    onGetFontFamilies: (() => Promise<string[]>) | null = null;

    constructor(sidebar: HTMLElement, circuitPanel: EditorFacade) {
        this.sidebar = sidebar;
        this.circuitPanel = circuitPanel;
    }

    show(prim: GraphicPrimitive): void {
        // Destroy previous layer dropdown listener if any
        if (this.currentLayerDropdown) {
            this.currentLayerDropdown.destroy();
            this.currentLayerDropdown = null;
        }
        for (const d of this.currentDashDropdowns) d.destroy();
        this.currentDashDropdowns = [];

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
        const addText = (
            label: string,
            get: () => string,
            set: (v: string) => void,
        ): HTMLInputElement => {
            const row = this.createPropertyRow(label);
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.value = get();
            inp.style.cssText = 'flex: 1; padding: 4px; font-size: 12px;';
            inp.addEventListener('input', () => {
                set(inp.value);
                redraw();
            });
            row.appendChild(inp);
            form.appendChild(row);
            return inp;
        };

        const addNumber = (
            label: string,
            get: () => number,
            set: (v: number) => void,
            min?: number,
            max?: number,
            step?: number,
        ): void => {
            const row = this.createPropertyRow(label);
            const inp = document.createElement('input');
            inp.type = 'number';
            inp.value = String(get());
            inp.style.cssText = 'flex: 1; padding: 4px; font-size: 12px;';
            if (min !== undefined) inp.min = String(min);
            if (max !== undefined) inp.max = String(max);
            if (step !== undefined) inp.step = String(step);
            inp.addEventListener('change', () => {
                set(Number(inp.value));
                redraw();
            });
            row.appendChild(inp);
            form.appendChild(row);
        };

        const addCheck = (label: string, get: () => boolean, set: (v: boolean) => void): void => {
            const row = this.createPropertyRow(label);
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = get();
            cb.addEventListener('change', () => {
                set(cb.checked);
                redraw();
            });
            row.appendChild(cb);
            form.appendChild(row);
        };

        const addSelect = (
            label: string,
            options: { value: string; text: string }[],
            get: () => string,
            set: (v: string) => void,
        ): void => {
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
            sel.addEventListener('change', () => {
                set(sel.value);
                redraw();
            });
            row.appendChild(sel);
            form.appendChild(row);
        };

        const orientOptions = [0, 90, 180, 270].map((a) => ({ value: String(a), text: `${a}°` }));

        const addDashStyle = (get: () => number, set: (v: number) => void): void => {
            const row = this.createPropertyRow(getString('ctrl_dash_style'));
            const dd = new DashStyleDropdown(get(), (idx) => {
                set(idx);
                redraw();
            });
            dd.element.style.flex = '1';
            row.appendChild(dd.element);
            form.appendChild(row);
            this.currentDashDropdowns.push(dd);
        };

        const addArrowSection = (
            arrowLabel: string,
            getArrowStart: () => boolean,
            setArrowStart: (v: boolean) => void,
            getArrowEnd: () => boolean,
            setArrowEnd: (v: boolean) => void,
            getArrowStyle: () => number,
            setArrowStyle: (v: number) => void,
            getArrowLen: () => number,
            setArrowLen: (v: number) => void,
            getArrowWid: () => number,
            setArrowWid: (v: number) => void,
        ): void => {
            addSection(arrowLabel);
            addCheck(getString('ctrl_arrow_start'), getArrowStart, setArrowStart);
            addCheck(getString('ctrl_arrow_end'), getArrowEnd, setArrowEnd);
            addSelect(
                getString('ctrl_arrow_style'),
                [
                    { value: '0', text: getString('ctrl_filled') },
                    { value: '2', text: getString('prop_arrow_empty') },
                    { value: '1', text: getString('prop_arrow_limiter') },
                    { value: '3', text: getString('prop_arrow_empty_limiter') },
                ],
                () => String(getArrowStyle()),
                (v) => setArrowStyle(Number(v)),
            );
            addNumber(getString('length'), getArrowLen, setArrowLen, 0, undefined, 1);
            addNumber(
                getString('ctrl_arrow_half_width'),
                getArrowWid,
                setArrowWid,
                0,
                undefined,
                1,
            );
        };

        const addLayerSection = (): void => {
            addSection(getString('prop_section_common'));
            const layerDescs = this.circuitPanel.getLayers();
            const layerNames = this.circuitPanel.getLayerDescriptions();

            const row = this.createPropertyRow(getString('ctrl_layer'));
            const dropdown = new LayerDropdown(layerDescs, layerNames, prim.getLayer(), (idx) => {
                prim.setLayer(idx);
                redraw();
            });
            dropdown.element.style.flex = '1';
            row.appendChild(dropdown.element);
            form.appendChild(row);
            this.currentLayerDropdown = dropdown;
        };

        const addNameValue = (): void => {
            if (prim.getNameVirtualPointNumber() >= 0) {
                addText(
                    getString('ctrl_name'),
                    () => prim.getName(),
                    (v) => prim.setNameStr(v),
                );
                addText(
                    getString('ctrl_value'),
                    () => prim.getValue(),
                    (v) => prim.setValueStr(v),
                );
            }
        };

        // ─── Helper: load font families (cached) ───
        const loadFonts = () => {
            if (!this.fontFamiliesPromise) {
                this.fontFamiliesPromise = (this.onGetFontFamilies?.() ?? Promise.resolve([])).then(
                    (families) => {
                        this.fontFamilies = families;
                        return families;
                    },
                );
            }
            return this.fontFamiliesPromise;
        };

        // ===== TYPE-SPECIFIC SECTIONS =====

        if (prim instanceof PrimitiveAdvText) {
            addSection(getString('Text'));
            // Textarea (not addText's single-line <input>) so users can type
            // real newlines directly; PrimitiveAdvText renders "\n" as stacked
            // lines and escapes it as "\n" when saving to the FidoCad format.
            const contentRow = this.createPropertyRow(getString('prop_content'));
            const contentInput = document.createElement('textarea');
            contentInput.value = prim.getString();
            contentInput.rows = 3;
            contentInput.style.cssText =
                'flex: 1; padding: 4px; font-size: 12px; resize: vertical; font-family: inherit;';
            contentInput.addEventListener('input', () => {
                prim.setString(contentInput.value);
                redraw();
            });
            contentRow.appendChild(contentInput);
            form.appendChild(contentRow);
            requestAnimationFrame(() => {
                contentInput.focus();
                contentInput.select();
            });
            // Height controls the default 10:7 aspect ratio. Width remains
            // independently editable so users can deliberately stretch text.
            {
                const siyRow = this.createPropertyRow(getString('prop_font_size'));
                const siyInp = document.createElement('input');
                siyInp.type = 'number';
                siyInp.value = String(prim.getFontDimension());
                siyInp.min = '1';
                siyInp.max = '2000';
                siyInp.style.cssText = 'flex: 1; padding: 4px; font-size: 12px;';
                siyRow.appendChild(siyInp);
                form.appendChild(siyRow);

                const sixRow = this.createPropertyRow(getString('prop_font_width'));
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
                    const newSix = Math.max(1, Math.round((v * 7) / 10));
                    sixInp.value = String(newSix);
                    prim.setFontWidth(newSix);
                    redraw();
                };
                const handleSixChange = () => {
                    const v = Number(sixInp.value);
                    prim.setFontWidth(v);
                    redraw();
                };
                siyInp.addEventListener('change', handleSiyChange);
                sixInp.addEventListener('change', handleSixChange);
            }
            addNumber(
                getString('prop_orientation'),
                () => prim.getOrientation(),
                (v) => prim.setOrientation(v),
                -360,
                360,
                1,
            );
            addCheck(
                getString('ctrl_mirror'),
                () => prim.isMirrored() !== 0,
                (v) => prim.setMirrored(v ? 1 : 0),
            );
            addCheck(
                getString('ctrl_boldface'),
                () => prim.isBold(),
                (v) => prim.setBold(v),
            );
            addCheck(
                getString('ctrl_italic'),
                () => prim.isItalic(),
                (v) => prim.setItalic(v),
            );
            const fontOptions = this.fontFamilies
                ? this.fontFamilies.map((f) => ({ value: f, text: f }))
                : [
                      'Arial',
                      'Calibri',
                      'Cambria',
                      'Consolas',
                      'Courier New',
                      'DejaVu Sans',
                      'DejaVu Sans Mono',
                      'DejaVu Serif',
                      'Georgia',
                      'Helvetica',
                      'Helvetica Neue',
                      'Menlo',
                      'Monaco',
                      'Sans-serif',
                      'Segoe UI',
                      'Serif',
                      'Tahoma',
                      'Times New Roman',
                      'Verdana',
                  ].map((f) => ({ value: f, text: f }));
            addSelect(
                getString('ctrl_font'),
                fontOptions,
                () => prim.getFontName(),
                (v) => prim.setFontName(v),
            );
            loadFonts().then((families) => {
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
            addSection(getString('Line'));
            addDashStyle(
                () => prim.getDashStyle(),
                (v) => prim.setDashStyle(v),
            );
            addArrowSection(
                getString('prop_section_arrows'),
                () => ad.isArrowStart(),
                (v) => {
                    ad.setArrowStart(v);
                    redraw();
                },
                () => ad.isArrowEnd(),
                (v) => {
                    ad.setArrowEnd(v);
                    redraw();
                },
                () => ad.getArrowStyle(),
                (v) => {
                    ad.setArrowStyle(v);
                    redraw();
                },
                () => ad.getArrowLength(),
                (v) => {
                    ad.setArrowLength(v);
                    redraw();
                },
                () => ad.getArrowHalfWidth(),
                (v) => {
                    ad.setArrowHalfWidth(v);
                    redraw();
                },
            );
            addLayerSection();
            addNameValue();
        } else if (prim instanceof PrimitiveRectangle) {
            addSection(getString('Rectangle'));
            addCheck(
                getString('ctrl_filled'),
                () => prim.getFilled(),
                (v) => prim.setFilled(v),
            );
            addDashStyle(
                () => prim.getDashStyle(),
                (v) => prim.setDashStyle(v),
            );
            addLayerSection();
            addNameValue();
        } else if (prim instanceof PrimitiveOval) {
            addSection(getString('Ellipse'));
            addCheck(
                getString('ctrl_filled'),
                () => prim.getFilled(),
                (v) => prim.setFilled(v),
            );
            addDashStyle(
                () => prim.getDashStyle(),
                (v) => prim.setDashStyle(v),
            );
            addLayerSection();
            addNameValue();
        } else if (prim instanceof PrimitiveBezier) {
            const ad = prim.getArrowData();
            addSection(getString('Bezier'));
            addDashStyle(
                () => prim.getDashStyle(),
                (v) => prim.setDashStyle(v),
            );
            addArrowSection(
                getString('prop_section_arrows'),
                () => ad.isArrowStart(),
                (v) => {
                    ad.setArrowStart(v);
                    redraw();
                },
                () => ad.isArrowEnd(),
                (v) => {
                    ad.setArrowEnd(v);
                    redraw();
                },
                () => ad.getArrowStyle(),
                (v) => {
                    ad.setArrowStyle(v);
                    redraw();
                },
                () => ad.getArrowLength(),
                (v) => {
                    ad.setArrowLength(v);
                    redraw();
                },
                () => ad.getArrowHalfWidth(),
                (v) => {
                    ad.setArrowHalfWidth(v);
                    redraw();
                },
            );
            addLayerSection();
            addNameValue();
        } else if (prim instanceof PrimitivePCBLine) {
            addSection(getString('PCBline'));
            addNumber(
                getString('ctrl_width'),
                () => prim.getWidth(),
                (v) => prim.setWidth(v),
                0,
                undefined,
                0.5,
            );
            addLayerSection();
            addNameValue();
        } else if (prim instanceof PrimitivePCBPad) {
            addSection(getString('PCBpad'));
            addNumber(
                getString('ctrl_x_radius'),
                () => prim.getRx(),
                (v) => prim.setRx(v),
                0,
                undefined,
                0.5,
            );
            addNumber(
                getString('ctrl_y_radius'),
                () => prim.getRy(),
                (v) => prim.setRy(v),
                0,
                undefined,
                0.5,
            );
            addNumber(
                getString('ctrl_internal_radius'),
                () => prim.getRi(),
                (v) => prim.setRi(v),
                0,
                undefined,
                0.5,
            );
            addSelect(
                getString('ctrl_pad_style'),
                [
                    { value: '0', text: getString('prop_shape_oval') },
                    { value: '1', text: getString('Rectangle') },
                    { value: '2', text: getString('prop_shape_rounded') },
                ],
                () => String(prim.getSty()),
                (v) => prim.setSty(Number(v)),
            );
            addLayerSection();
            addNameValue();
        } else if (prim instanceof PrimitivePolygon) {
            addSection(getString('Polygon'));
            addCheck(
                getString('ctrl_filled'),
                () => prim.getFilled(),
                (v) => prim.setFilled(v),
            );
            addDashStyle(
                () => prim.getDashStyle(),
                (v) => prim.setDashStyle(v),
            );
            addLayerSection();
            addNameValue();
        } else if (prim instanceof PrimitiveComplexCurve) {
            const ad = prim.getArrowData();
            addSection(getString('Complexcurve'));
            addCheck(
                getString('ctrl_filled'),
                () => prim.getFilled(),
                (v) => prim.setFilled(v),
            );
            addCheck(
                getString('ctrl_closed_curve'),
                () => prim.getIsClosed(),
                (v) => prim.setIsClosed(v),
            );
            addDashStyle(
                () => prim.getDashStyle(),
                (v) => prim.setDashStyle(v),
            );
            addArrowSection(
                getString('prop_section_arrows'),
                () => ad.isArrowStart(),
                (v) => {
                    ad.setArrowStart(v);
                    redraw();
                },
                () => ad.isArrowEnd(),
                (v) => {
                    ad.setArrowEnd(v);
                    redraw();
                },
                () => ad.getArrowStyle(),
                (v) => {
                    ad.setArrowStyle(v);
                    redraw();
                },
                () => ad.getArrowLength(),
                (v) => {
                    ad.setArrowLength(v);
                    redraw();
                },
                () => ad.getArrowHalfWidth(),
                (v) => {
                    ad.setArrowHalfWidth(v);
                    redraw();
                },
            );
            addLayerSection();
            addNameValue();
        } else if (prim instanceof PrimitiveMacro) {
            addSection(getString('prop_section_component'));
            const nameRow = this.createPropertyRow(getString('prop_macro'));
            const nameSpan = document.createElement('span');
            nameSpan.textContent = prim.getMacroName();
            nameSpan.style.cssText =
                'flex: 1; font-size: 12px; font-family: monospace; color: #555;';
            nameRow.appendChild(nameSpan);
            form.appendChild(nameRow);
            addSelect(
                getString('prop_orientation'),
                orientOptions,
                () => String(prim.getOrientation() * 90),
                (v) => prim.setOrientation(Math.round(Number(v) / 90)),
            );
            addCheck(
                getString('ctrl_mirror'),
                () => prim.isMirrored(),
                (v) => prim.setMirrored(v),
            );
            addLayerSection();
            addNameValue();
        } else {
            addLayerSection();
            addNameValue();
        }

        const closeBtn = document.createElement('button');
        closeBtn.textContent = getString('Close');
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

    /**
     * Batch-edit panel for a multi-element selection. Shows only the properties
     * that are common to every selected primitive (currently the layer) and
     * applies changes to all of them at once.
     */
    showBatch(prims: GraphicPrimitive[]): void {
        if (prims.length <= 1) {
            if (prims[0]) this.show(prims[0]);
            return;
        }

        if (this.currentLayerDropdown) {
            this.currentLayerDropdown.destroy();
            this.currentLayerDropdown = null;
        }
        for (const d of this.currentDashDropdowns) d.destroy();
        this.currentDashDropdowns = [];

        const header = this.sidebar.firstElementChild;
        this.sidebar.innerHTML = '';
        this.sidebar.appendChild(header as HTMLElement);

        const form = document.createElement('div');
        form.style.cssText = 'padding: 12px; display: flex; flex-direction: column; gap: 10px;';

        const redraw = () => {
            const model = this.circuitPanel.getModel();
            for (const p of prims) p.setChanged(true);
            model.setChanged(true);
            model.sortPrimitiveLayers();
            this.circuitPanel.render();
        };

        const sec = document.createElement('div');
        sec.textContent = `${getString('prop_multiple')} (${prims.length})`;
        sec.style.cssText =
            'font-size: 11px; font-weight: bold; color: #666; text-transform: uppercase; ' +
            'letter-spacing: 0.5px; margin-top: 4px; padding-bottom: 2px; border-bottom: 1px solid #ddd;';
        form.appendChild(sec);

        // Layer (shared) — initial value is the common layer when all agree,
        // otherwise the first element's layer.
        const layerDescs = this.circuitPanel.getLayers();
        const layerNames = this.circuitPanel.getLayerDescriptions();
        const initialLayer = prims[0]!.getLayer();

        const row = this.createPropertyRow(getString('ctrl_layer'));
        const dropdown = new LayerDropdown(layerDescs, layerNames, initialLayer, (idx) => {
            for (const p of prims) p.setLayer(idx);
            redraw();
        });
        dropdown.element.style.flex = '1';
        row.appendChild(dropdown.element);
        form.appendChild(row);
        this.currentLayerDropdown = dropdown;

        const closeBtn = document.createElement('button');
        closeBtn.textContent = getString('Close');
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
