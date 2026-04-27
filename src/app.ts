import { CircuitPanel } from './circuit/CircuitPanel.js';
import { ElementsEdtActions } from './circuit/controllers/ElementsEdtActions.js';
import { loadStandardLibraries } from './circuit/controllers/LibraryLoader.js';
import { LibraryModel } from './librarymodel/LibraryModel.js';
import { MacroPicker } from './macropicker/MacroPicker.js';
import { MenuBar } from './ui/MenuBar.js';
import { GraphicPrimitive } from './primitives/GraphicPrimitive.js';
import { PrimitiveAdvText } from './primitives/PrimitiveAdvText.js';
import { PrimitiveLine } from './primitives/PrimitiveLine.js';
import { PrimitiveRectangle } from './primitives/PrimitiveRectangle.js';
import { PrimitiveOval } from './primitives/PrimitiveOval.js';
import { PrimitiveBezier } from './primitives/PrimitiveBezier.js';
import { PrimitivePCBLine } from './primitives/PrimitivePCBLine.js';
import { PrimitivePCBPad } from './primitives/PrimitivePCBPad.js';
import { PrimitivePolygon } from './primitives/PrimitivePolygon.js';
import { PrimitiveComplexCurve } from './primitives/PrimitiveComplexCurve.js';
import { PrimitiveMacro } from './primitives/PrimitiveMacro.js';
import { loadLocale } from './i18n/i18n.js';
import { AccessResources } from './i18n/AccessResources.js';
import { SettingsManager } from './settings/SettingsManager.js';
import { Globals } from './globals/Globals.js';
// import { getString } from './i18n/i18n.js'; // currently unused

class FidoCadJS {
    private circuitPanel!: CircuitPanel;
    private toolbar!: HTMLElement;
    private menuBar!: MenuBar;
    private propertiesSidebar!: HTMLElement;
    private libraryPanel!: HTMLElement;
    private macroPicker!: MacroPicker;
    private fontFamilies: string[] | null = null;
    private libraryModel!: LibraryModel;

    constructor() {
        // Load the English locale bundle before any UI is built
        Globals.messages = new AccessResources();
        loadLocale('en').then(() => {
            this.initUI();
        }).catch((e) => {
            console.error('Failed to load locale:', e);
            this.initUI();
        });
    }

    private initUI(): void {
        const app = document.getElementById('app');
        if (!app) {
            console.error('Could not find #app element');
            return;
        }

        // Create toolbar (empty, will be populated after CircuitPanel is created)
        this.toolbar = document.createElement('div');
        this.toolbar.setAttribute('data-testid', 'toolbar');
        app.appendChild(this.toolbar);

        // Create main workspace row: editor + properties sidebar + library panel (right)
        const workspaceRow = document.createElement('div');
        workspaceRow.style.cssText = 'display: flex; flex: 1; overflow: hidden;';

        // Center editor container
        const editorContainer = document.createElement('div');
        editorContainer.setAttribute('data-testid', 'editor-container');
        editorContainer.style.cssText = 'flex: 1; overflow: hidden;';

        // Properties sidebar (initially hidden, left of library panel)
        this.propertiesSidebar = document.createElement('div');
        this.propertiesSidebar.setAttribute('data-testid', 'properties-sidebar');
        this.propertiesSidebar.style.cssText =
            'width: 280px; background: #f5f5f5; border-right: 1px solid #ccc; ' +
            'display: none; flex-direction: column; overflow-y: auto;';
        this.propertiesSidebar.innerHTML = '<div style="padding: 12px; font-weight: bold; border-bottom: 1px solid #ddd;">Properties</div>';

        // Right library panel
        this.libraryPanel = document.createElement('div');
        this.libraryPanel.setAttribute('data-testid', 'library-panel');
        this.libraryPanel.style.cssText =
            'width: 240px; flex-shrink: 0; display: flex; flex-direction: column; overflow: hidden;';

        this.macroPicker = new MacroPicker();
        this.macroPicker.element.style.flex = '1';
        this.libraryPanel.appendChild(this.macroPicker.element);

        workspaceRow.appendChild(editorContainer);
        workspaceRow.appendChild(this.propertiesSidebar);
        workspaceRow.appendChild(this.libraryPanel);
        app.appendChild(workspaceRow);

        // Now create CircuitPanel after editorContainer is in the DOM
        this.circuitPanel = new CircuitPanel(editorContainer);
        SettingsManager.getInstance().applyToPanel(this.circuitPanel);

        // Create menu bar after CircuitPanel is ready
        this.menuBar = new MenuBar(this.circuitPanel, () => this.newCircuit());
        this.circuitPanel.setMenuBar(this.menuBar);
        app.insertBefore(this.menuBar.getElement(), this.toolbar);

        // Create toolbar buttons
        this.createToolbar();

        // Thin status bar (coordinates moved to toolbar)
        const statusBar = document.createElement('div');
        statusBar.style.cssText =
            'height: 4px; background: #e0e0e0; border-top: 1px solid #ccc;';
        app.appendChild(statusBar);

        // Wire up properties panel
        this.wirePropertiesPanel();

        // Load standard FCL libraries asynchronously
        this.initLibraries();

        console.log('FidoCadJS initialized');
    }

    private async initLibraries(): Promise<void> {
        await loadStandardLibraries(this.circuitPanel.getParserActions());
        this.libraryModel = new LibraryModel(this.circuitPanel.getModel());
        this.macroPicker.refresh(this.libraryModel);
        this.macroPicker.onMacroSelected = (key) => {
            this.circuitPanel.setMacroTool(key);
        };
        console.log(`Libraries loaded: ${this.libraryModel.getAllLibraries().length} libraries, ` +
            `${this.libraryModel.getAllMacros().size} macros`);
    }

    private createToolbar(): void {
        // Main toolbar container with vertical layout (two rows)
        this.toolbar.style.cssText =
            'display: flex; flex-direction: column; padding: 2px 8px; ' +
            'background: #f0f0f0; border-bottom: 1px solid #ccc; font-family: sans-serif; font-size: 12px;';

        // ===== FIRST ROW: Drawing tools =====
        const firstRow = document.createElement('div');
        firstRow.style.cssText = 'display: flex; align-items: center; gap: 4px; padding: 2px 0;';

        // Tool group — icon buttons in original FidoCadJ order
        const toolDefs: Array<[string, string, number]> = [
            ['A or space: Select and move an object. Type R to rotate, S to swap.', 'arrow.png',       ElementsEdtActions.SELECTION],
            ['Left click: increase zoom, right click: decrease zoom.',              'magnifier.png',   ElementsEdtActions.ZOOM],
            ['Scroll through a big drawing.',                                       'move.png',        ElementsEdtActions.HAND],
            ['L: Draw a line.',                                                     'line.png',        ElementsEdtActions.LINE],
            ['T: Place a text.',                                                    'text.png',        ElementsEdtActions.TEXT],
            ['B: Draw a four-point Bézier primitive.',                              'bezier.png',      ElementsEdtActions.BEZIER],
            ['P: Place a polygon.',                                                 'polygon.png',     ElementsEdtActions.POLYGON],
            ['V: Open or closed curve.',                                            'complexcurve.png',ElementsEdtActions.COMPLEXCURVE],
            ['E: Place an ellipse (hold Control for a circle).',                    'ellipse.png',     ElementsEdtActions.ELLIPSE],
            ['R: Place a rectangle.',                                               'rectangle.png',   ElementsEdtActions.RECTANGLE],
            ['C: Place an electrical connection.',                                  'connection.png',  ElementsEdtActions.CONNECTION],
            ['I: Place a Printed Circuit Board line.',                              'pcbline.png',     ElementsEdtActions.PCB_LINE],
            ['Z: Place a Printed Circuit Board pad.',                               'pcbpad.png',      ElementsEdtActions.PCB_PAD],
        ];

        const toolButtons = new Map<number, HTMLButtonElement>();
        for (const [tooltip, icon, toolId] of toolDefs) {
            const btn = this.addIconButtonToRow(firstRow, `${import.meta.env.BASE_URL}icons/${icon}`, tooltip, () => {
                this.circuitPanel.setTool(toolId);
            });
            toolButtons.set(toolId, btn);
        }

        // Macro tool button (no icon — activated by library selection)
        const macroBtn = this.addButtonToRow(firstRow, 'Macro', () => {});
        macroBtn.title = 'Select a component from the Library panel to activate';
        toolButtons.set(ElementsEdtActions.MACRO, macroBtn);

        this.circuitPanel.onToolChange = (toolId) => {
            for (const [id, btn] of toolButtons) {
                const active = id === toolId;
                btn.style.background = active ? '#b0c8e8' : '#e8e8e8';
                btn.style.border = active ? '1px solid #5a8fc0' : '1px solid transparent';
            }
        };

        this.toolbar.appendChild(firstRow);

        // ===== SECOND ROW: Navigation, zoom, layer controls =====
        const secondRow = document.createElement('div');
        secondRow.style.cssText = 'display: flex; align-items: center; gap: 4px; padding: 2px 0;';

        // Zoom combobox with exact FidoCadJ levels
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
        this.addButtonToRow(secondRow, 'Fit', () => {
            this.circuitPanel.zoomToFit();
            syncZoomSelect();
        });

        // Small divider
        const divider1 = document.createElement('span');
        divider1.style.cssText = 'width: 1px; height: 20px; background: #bbb; margin: 0 2px;';
        secondRow.appendChild(divider1);

        // Show Grid toggle
        const gridBtn = this.addButtonToRow(secondRow, 'Show Grid', () => {
            const visible = this.circuitPanel.isGridVisible();
            this.circuitPanel.setGridVisible(!visible);
            this.setToggleActive(gridBtn, this.circuitPanel.isGridVisible());
        });
        this.setToggleActive(gridBtn, this.circuitPanel.isGridVisible());

        // Snap to Grid toggle
        const snapBtn = this.addButtonToRow(secondRow, 'Snap', () => {
            const active = this.circuitPanel.isSnapActive();
            this.circuitPanel.setSnap(!active);
            this.setToggleActive(snapBtn, this.circuitPanel.isSnapActive());
        });
        this.setToggleActive(snapBtn, this.circuitPanel.isSnapActive());

        // Library toggle
        const libBtn = this.addButtonToRow(secondRow, 'Libs', () => {
            const visible = this.libraryPanel.style.display !== 'none';
            this.libraryPanel.style.display = visible ? 'none' : 'flex';
            this.setToggleActive(libBtn, !visible);
        });
        this.setToggleActive(libBtn, true);

        // Small divider
        const divider2 = document.createElement('span');
        divider2.style.cssText = 'width: 1px; height: 20px; background: #bbb; margin: 0 2px;';
        secondRow.appendChild(divider2);

        // Layer selector (custom dropdown with color swatches)
        const layerDescs = this.circuitPanel.getLayers();
        const layerColorCSS = (idx: number): string => {
            const c = layerDescs[idx].getColor();
            return c ? `rgb(${c.getRed()},${c.getGreen()},${c.getBlue()})` : '#888';
        };
        const makeSwatchEl = (color: string): HTMLSpanElement => {
            const sw = document.createElement('span');
            sw.style.cssText =
                `display:inline-block; width:14px; height:14px; min-width:14px;` +
                ` border:1px solid #666; background:${color}; border-radius:2px;`;
            return sw;
        };

        const layerDropdown = document.createElement('div');
        layerDropdown.style.cssText = 'position:relative; display:inline-block;';
        layerDropdown.title = 'Active layer';

        // Button (always visible — shows current layer)
        const layerBtn = document.createElement('div');
        layerBtn.style.cssText =
            'display:flex; align-items:center; gap:5px; cursor:pointer;' +
            ' border:1px solid #ccc; border-radius:2px; padding:3px 6px;' +
            ' background:white; font-size:12px; user-select:none; min-width:160px;';

        const btnSwatch = makeSwatchEl(layerColorCSS(this.circuitPanel.getCurrentLayer()));
        const btnLabel = document.createElement('span');
        btnLabel.style.cssText = 'flex:1;';
        const currentIdx = this.circuitPanel.getCurrentLayer();
        btnLabel.textContent = `${layerDescs[currentIdx].getDescription()}`;
        const btnArrow = document.createElement('span');
        btnArrow.textContent = '▾';
        btnArrow.style.cssText = 'color:#666; font-size:10px;';
        layerBtn.append(btnSwatch, btnLabel, btnArrow);

        // Dropdown list (hidden by default)
        const layerList = document.createElement('div');
        layerList.style.cssText =
            'display:none; position:absolute; top:100%; left:0; z-index:1000;' +
            ' border:1px solid #ccc; border-radius:2px; background:white;' +
            ' box-shadow:2px 4px 8px rgba(0,0,0,0.18); min-width:100%;' +
            ' max-height:260px; overflow-y:auto;';

        const updateBtn = (idx: number) => {
            btnSwatch.style.background = layerColorCSS(idx);
            btnLabel.textContent = `${layerDescs[idx].getDescription()}`;
        };

        for (let i = 0; i < layerDescs.length; i++) {
            const item = document.createElement('div');
            item.style.cssText =
                'display:flex; align-items:center; gap:5px; padding:4px 8px;' +
                ' cursor:pointer; font-size:12px; white-space:nowrap;';
            item.append(makeSwatchEl(layerColorCSS(i)));
            const lbl = document.createElement('span');
            lbl.textContent = `${layerDescs[i].getDescription()}`;
            item.appendChild(lbl);
            item.addEventListener('mouseenter', () => { item.style.background = '#e8f0fe'; });
            item.addEventListener('mouseleave', () => { item.style.background = ''; });
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.circuitPanel.setCurrentLayer(i);
                updateBtn(i);
                layerList.style.display = 'none';
            });
            layerList.appendChild(item);
        }

        const toggleList = () => {
            layerList.style.display = layerList.style.display === 'none' ? 'block' : 'none';
        };
        layerBtn.addEventListener('click', toggleList);

        const closeOnOutside = (e: MouseEvent) => {
            if (!layerDropdown.contains(e.target as Node)) {
                layerList.style.display = 'none';
            }
        };
        document.addEventListener('mousedown', closeOnOutside);

        layerDropdown.append(layerBtn, layerList);
        secondRow.appendChild(layerDropdown);

        // Spacer
        const spacer = document.createElement('span');
        spacer.style.cssText = 'flex: 1;';
        secondRow.appendChild(spacer);

        // Coordinates display (right side, like ToolbarZoom)
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

        // Initialize with SELECT tool
        this.circuitPanel.setTool(ElementsEdtActions.SELECTION);

        // Wire undo state change to menu bar updates
        this.circuitPanel.onUndoStateChange = () => this.menuBar.updateState();

        // Enable keyboard listeners
        this.circuitPanel.addKeyboardListeners();
    }

    private newCircuit(): void {
        this.circuitPanel.clearCircuit();
    }

    private setToggleActive(btn: HTMLButtonElement, active: boolean): void {
        btn.style.background = active ? '#b0c8e8' : '#e8e8e8';
        btn.style.border = active ? '1px solid #5a8fc0' : '1px solid transparent';
    }

    private addIconButtonToRow(row: HTMLElement, iconSrc: string, tooltip: string, onClick: () => void): HTMLButtonElement {
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

    private addButtonToRow(row: HTMLElement, label: string, onClick: () => void): HTMLButtonElement {
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

    private wirePropertiesPanel(): void {
        // Wire up the properties panel callback from CircuitPanel
        this.circuitPanel.onPropertiesRequested = (prim) => {
            this.showPropertiesPanel(prim);
        };

        this.circuitPanel.onTextEditRequested = (prim, _sx, _sy) => {
            this.showPropertiesPanel(prim);
        };

        this.circuitPanel.onExistingTextEditRequested = (prim) => {
            this.showPropertiesPanel(prim);
        };
    }

    private async getAvailableFontFamilies(): Promise<string[]> {
        if (this.fontFamilies) return this.fontFamilies;

        const fallbackFonts = [
            'Arial', 'Arial Black', 'Arial Narrow',
            'Calibri', 'Cambria', 'Candara', 'Century Gothic',
            'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel',
            'Courier New', 'DejaVu Sans', 'DejaVu Sans Mono',
            'DejaVu Serif', 'Franklin Gothic Medium', 'Garamond',
            'Georgia', 'Helvetica', 'Helvetica Neue', 'Impact',
            'Lucida Console', 'Lucida Sans Unicode', 'Menlo',
            'Microsoft Sans Serif', 'Monaco', 'Monospace',
            'Palatino Linotype', 'Sans-serif', 'Segoe UI',
            'Segoe UI Mono', 'Serif', 'Tahoma', 'Times New Roman',
            'Trebuchet MS', 'Verdana', 'Webdings', 'Wingdings',
        ];

        try {
            if ('queryLocalFonts' in navigator) {
                const fontData = await (navigator as any).queryLocalFonts();
                const families = new Set<string>();
                for (const fd of fontData) {
                    families.add(fd.family);
                }
                // Merge with fallback to ensure common fonts are always present
                for (const f of fallbackFonts) families.add(f);
                const sorted = [...families].sort((a, b) =>
                    a.toLowerCase().localeCompare(b.toLowerCase()));
                this.fontFamilies = sorted;
                return sorted;
            }
        } catch {
            // Permission denied or API not supported — fall through to fallback
        }

        this.fontFamilies = fallbackFonts;
        return fallbackFonts;
    }

    private showPropertiesPanel(prim: GraphicPrimitive): void {
        const header = this.propertiesSidebar.firstElementChild;
        this.propertiesSidebar.innerHTML = '';
        this.propertiesSidebar.appendChild(header as HTMLElement);

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
        const addText = (label: string, get: () => string, set: (v: string) => void): void => {
            const row = this.createPropertyRow(label);
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.value = get();
            inp.style.cssText = 'flex: 1; padding: 4px; font-size: 12px;';
            inp.addEventListener('input', () => { set(inp.value); redraw(); });
            row.appendChild(inp);
            form.appendChild(row);
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
            const layerColorCSS = (idx: number): string => {
                const c = layerDescs[idx]?.getColor();
                return c ? `rgb(${c.getRed()},${c.getGreen()},${c.getBlue()})` : '#888';
            };
            const makeSwatchEl = (color: string): HTMLSpanElement => {
                const sw = document.createElement('span');
                sw.style.cssText =
                    `display:inline-block; width:14px; height:14px; min-width:14px;` +
                    ` border:1px solid #666; background:${color}; border-radius:2px;`;
                return sw;
            };

            const row = this.createPropertyRow('Layer:');

            const layerDropdown = document.createElement('div');
            layerDropdown.style.cssText = 'position:relative; display:inline-block; flex:1;';

            // Button showing current layer
            const layerBtn = document.createElement('div');
            layerBtn.style.cssText =
                'display:flex; align-items:center; gap:5px; cursor:pointer;' +
                ' border:1px solid #ccc; border-radius:2px; padding:3px 6px;' +
                ' background:white; font-size:12px; user-select:none;';

            const currentIdx = prim.getLayer();
            const btnSwatch = makeSwatchEl(layerColorCSS(currentIdx));
            const btnLabel = document.createElement('span');
            btnLabel.style.cssText = 'flex:1;';
            btnLabel.textContent = `${layerNames[currentIdx] ?? ''}`;
            const btnArrow = document.createElement('span');
            btnArrow.textContent = '▾';
            btnArrow.style.cssText = 'color:#666; font-size:10px;';
            layerBtn.append(btnSwatch, btnLabel, btnArrow);

            // Dropdown list (hidden by default)
            const layerList = document.createElement('div');
            layerList.style.cssText =
                'display:none; position:absolute; top:100%; left:0; z-index:1000;' +
                ' border:1px solid #ccc; border-radius:2px; background:white;' +
                ' box-shadow:2px 4px 8px rgba(0,0,0,0.18); min-width:100%;' +
                ' max-height:260px; overflow-y:auto;';

            const updateBtn = (idx: number) => {
                btnSwatch.style.background = layerColorCSS(idx);
                btnLabel.textContent = `${layerNames[idx] ?? ''}`;
            };

            for (let i = 0; i < layerDescs.length; i++) {
                const item = document.createElement('div');
                item.style.cssText =
                    'display:flex; align-items:center; gap:5px; padding:4px 8px;' +
                    ' cursor:pointer; font-size:12px; white-space:nowrap;';
                item.append(makeSwatchEl(layerColorCSS(i)));
                const lbl = document.createElement('span');
                lbl.textContent = `${layerNames[i] ?? ''}`;
                item.appendChild(lbl);
                item.addEventListener('mouseenter', () => { item.style.background = '#e8f0fe'; });
                item.addEventListener('mouseleave', () => { item.style.background = ''; });
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    prim.setLayer(i);
                    updateBtn(i);
                    layerList.style.display = 'none';
                    redraw();
                });
                layerList.appendChild(item);
            }

            const toggleList = () => {
                layerList.style.display = layerList.style.display === 'none' ? 'block' : 'none';
            };
            layerBtn.addEventListener('click', toggleList);

            const closeOnOutside = (e: MouseEvent) => {
                if (!layerDropdown.contains(e.target as Node)) {
                    layerList.style.display = 'none';
                }
            };
            document.addEventListener('mousedown', closeOnOutside);

            layerDropdown.append(layerBtn, layerList);
            row.appendChild(layerDropdown);
            form.appendChild(row);
        };

        const addNameValue = (): void => {
            if (prim.getNameVirtualPointNumber() >= 0) {
                addText('Name:', () => prim.getName(), v => prim.setNameStr(v));
                addText('Value:', () => prim.getValue(), v => prim.setValueStr(v));
            }
        };

        // ===== TYPE-SPECIFIC SECTIONS =====

        if (prim instanceof PrimitiveAdvText) {
            addSection('Text');
            addText('Content:', () => prim.getString(), v => prim.setString(v));
            addNumber('Font size:', () => prim.getFontDimension(), v => prim.setFontDimension(v), 1, 2000);
            addNumber('Font width:', () => prim.getFontWidth(), v => prim.setFontWidth(v), 1, 2000);
            addNumber('Orientation:', () => prim.getOrientation(), v => prim.setOrientation(v), -360, 360, 1);
            addCheck('Mirror:', () => prim.isMirrored() !== 0, v => prim.setMirrored(v ? 1 : 0));
            addCheck('Bold:', () => prim.isBold(), v => prim.setBold(v));
            addCheck('Italic:', () => prim.isItalic(), v => prim.setItalic(v));
            // Font dropdown — populated with fallback list immediately,
            // then upgraded to system fonts via Font Access API if available.
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
            // Try to load full system fonts in the background
            this.getAvailableFontFamilies().then(families => {
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
            // Fallback: just show layer for unknown types
            addLayerSection();
            addNameValue();
        }

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText =
            'margin-top: 8px; padding: 8px 16px; cursor: pointer; border: 1px solid #ccc; ' +
            'border-radius: 4px; background: #e0e0e0; font-size: 13px; align-self: flex-end;';
        closeBtn.addEventListener('click', () => {
            this.propertiesSidebar.style.display = 'none';
        });
        form.appendChild(closeBtn);

        this.propertiesSidebar.appendChild(form);
        this.propertiesSidebar.style.display = 'flex';
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

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        try {
            new FidoCadJS();
        } catch (e) {
            console.error('Failed to initialize FidoCadJS:', e);
        }
    });
} else {
    try {
        new FidoCadJS();
    } catch (e) {
        console.error('Failed to initialize FidoCadJS:', e);
    }
}
