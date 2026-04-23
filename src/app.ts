import { CircuitPanel } from './circuit/CircuitPanel.js';
import { ElementsEdtActions } from './circuit/controllers/ElementsEdtActions.js';
import { MenuBar } from './ui/MenuBar.js';
import { GraphicPrimitive } from './primitives/GraphicPrimitive.js';
import { PrimitiveAdvText } from './primitives/PrimitiveAdvText.js';

// Sample FidoCadJ circuit for testing
const SAMPLE_CIRCUIT = `LI 50 100 150 100 0 0 0 0 -1
LI 100 50 100 150 0 0 0 0 -1
RV 75 75 125 125 0 0 1 0 0
EV 60 60 140 140 0 0 0 0
BE 50 50 80 30 120 30 150 50 0 0 0 0 0 0 0 -1
TY 110 95 4 4 0 0 0 * FidoCadTS
`;

class FidoCadTS {
    private circuitPanel!: CircuitPanel;
    private toolbar!: HTMLElement;
    private menuBar!: MenuBar;
    private propertiesSidebar!: HTMLElement;

    constructor() {
        const app = document.getElementById('app');
        if (!app) {
            console.error('Could not find #app element');
            return;
        }

        // Create toolbar (empty, will be populated after CircuitPanel is created)
        this.toolbar = document.createElement('div');
        app.appendChild(this.toolbar);

        // Create canvas area with editor container and properties sidebar
        const canvasArea = document.createElement('div');
        canvasArea.style.cssText = 'display: flex; flex: 1; overflow: hidden;';

        const editorContainer = document.createElement('div');
        editorContainer.style.cssText = 'flex: 1; overflow: hidden;';

        // Properties sidebar (initially hidden)
        this.propertiesSidebar = document.createElement('div');
        this.propertiesSidebar.style.cssText =
            'width: 280px; background: #f5f5f5; border-left: 1px solid #ccc; ' +
            'display: none; flex-direction: column; overflow-y: auto;';
        this.propertiesSidebar.innerHTML = '<div style="padding: 12px; font-weight: bold; border-bottom: 1px solid #ddd;">Properties</div>';

        // Append editor container and sidebar to canvas area BEFORE creating CircuitPanel
        canvasArea.appendChild(editorContainer);
        canvasArea.appendChild(this.propertiesSidebar);
        app.appendChild(canvasArea);

        // Now create CircuitPanel after editorContainer is in the DOM
        this.circuitPanel = new CircuitPanel(editorContainer);

        // Create menu bar after CircuitPanel is ready
        this.menuBar = new MenuBar(this.circuitPanel, () => this.newCircuit());
        app.insertBefore(this.menuBar.getElement(), this.toolbar);

        // Create toolbar buttons
        this.createToolbar();

        // Create status bar below editor
        const statusBar = document.createElement('div');
        statusBar.style.cssText =
            'height: 20px; padding: 2px 8px; background: #f0f0f0; border-top: 1px solid #ccc; ' +
            'font-size: 11px; font-family: monospace; color: #666; display: flex; align-items: center;';
        statusBar.textContent = 'X: 0  Y: 0';
        this.circuitPanel.onCoordinatesChange = (lx, ly) => {
            statusBar.textContent = `X: ${Math.round(lx)}  Y: ${Math.round(ly)}`;
        };
        app.appendChild(statusBar);

        // Wire up properties panel
        this.wirePropertiesPanel();

        // Load sample circuit
        this.circuitPanel.loadCircuit(SAMPLE_CIRCUIT);
        this.circuitPanel.render();

        console.log('FidoCadTS initialized');
    }

    private createToolbar(): void {
        this.toolbar.style.cssText =
            'display: flex; align-items: center; gap: 4px; padding: 6px 8px; ' +
            'background: #f0f0f0; border-bottom: 1px solid #ccc; font-family: sans-serif; font-size: 12px;';

        // File group
        this.addButton('Open', () => this.importCircuit());
        this.addButton('Save FCD', () => this.exportCircuit());
        this.addButton('Export SVG', () => this.exportSVG());

        // Divider
        this.addDivider();

        // View group
        this.addButton('Zoom In', () => {
            this.circuitPanel.zoomIn();
            this.updateZoomLabel();
        });

        const zoomLabel = document.createElement('span');
        zoomLabel.textContent = '100%';
        zoomLabel.style.cssText =
            'min-width: 40px; text-align: center; padding: 2px 4px; color: #333;';
        this.toolbar.appendChild(zoomLabel);

        this.circuitPanel.onZoomChange = () => this.updateZoomLabel();
        const updateZoomLabel = () => {
            zoomLabel.textContent = this.circuitPanel.getZoomPercent() + '%';
        };
        this.updateZoomLabel = updateZoomLabel;

        this.addButton('Zoom Out', () => {
            this.circuitPanel.zoomOut();
            this.updateZoomLabel();
        });
        this.addButton('Fit', () => {
            this.circuitPanel.zoomToFit();
            this.updateZoomLabel();
        });

        const gridButton = this.addButton('Grid', () => {
            const visible = this.circuitPanel.isGridVisible();
            this.circuitPanel.setGridVisible(!visible);
            gridButton.style.background = this.circuitPanel.isGridVisible() ? '#b0c8e8' : '';
            gridButton.style.border = this.circuitPanel.isGridVisible() ? '1px solid #5a8fc0' : '';
        });
        // Initialize grid button state
        if (this.circuitPanel.isGridVisible()) {
            gridButton.style.background = '#b0c8e8';
            gridButton.style.border = '1px solid #5a8fc0';
        }

        // Divider
        this.addDivider();

        // Tools group
        const toolDefs: Array<[string, number]> = [
            ['Select',   ElementsEdtActions.SELECTION],
            ['Zoom',     ElementsEdtActions.ZOOM],
            ['Hand',     ElementsEdtActions.HAND],
            ['Line',     ElementsEdtActions.LINE],
            ['Bezier',   ElementsEdtActions.BEZIER],
            ['Rect',     ElementsEdtActions.RECTANGLE],
            ['Oval',     ElementsEdtActions.ELLIPSE],
            ['Polygon',  ElementsEdtActions.POLYGON],
            ['Text',     ElementsEdtActions.TEXT],
            ['Conn',     ElementsEdtActions.CONNECTION],
            ['PCB Line', ElementsEdtActions.PCB_LINE],
            ['PCB Pad',  ElementsEdtActions.PCB_PAD],
            ['ComplexCv',ElementsEdtActions.COMPLEXCURVE],
        ];
        const toolButtons = new Map<number, HTMLButtonElement>();
        for (const [label, toolId] of toolDefs) {
            const btn = this.addButton(label, () => {
                this.circuitPanel.setTool(toolId);
            });
            toolButtons.set(toolId, btn);
        }

        // Wire tool change callback to update button styles
        this.circuitPanel.onToolChange = (toolId) => {
            for (const [id, btn] of toolButtons) {
                const active = id === toolId;
                btn.style.background = active ? '#b0c8e8' : '#e8e8e8';
                btn.style.border = active ? '1px solid #5a8fc0' : '1px solid transparent';
            }
        };

        // Add divider before layer selector
        this.addDivider();

        // Add layer selector
        const layerSelect = document.createElement('select');
        layerSelect.style.cssText = 'font-size: 12px; padding: 4px 6px; border-radius: 2px; border: 1px solid #ccc; background: white;';
        const layers = this.circuitPanel.getLayerDescriptions();
        for (let i = 0; i < layers.length; i++) {
            const opt = document.createElement('option');
            opt.value = String(i);
            opt.textContent = `Layer ${i}: ${layers[i]}`;
            layerSelect.appendChild(opt);
        }
        layerSelect.value = String(this.circuitPanel.getCurrentLayer());
        layerSelect.addEventListener('change', () => {
            this.circuitPanel.setCurrentLayer(Number(layerSelect.value));
        });
        this.toolbar.appendChild(layerSelect);

        // Initialize with SELECT tool
        this.circuitPanel.setTool(ElementsEdtActions.SELECTION);

        // Wire undo state change to menu bar updates
        this.circuitPanel.onUndoStateChange = () => this.menuBar.updateState();

        // Enable keyboard listeners
        this.circuitPanel.addKeyboardListeners();
    }

    private updateZoomLabel: () => void = () => {};

    private newCircuit(): void {
        this.circuitPanel.clearCircuit();
        this.updateZoomLabel();
    }

    private addButton(label: string, onClick: () => void): HTMLButtonElement {
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
        this.toolbar.appendChild(button);
        return button;
    }

    private addDivider(): void {
        const divider = document.createElement('span');
        divider.style.cssText =
            'width: 1px; height: 20px; background: #bbb; margin: 0 4px;';
        this.toolbar.appendChild(divider);
    }

    private exportCircuit(): void {
        const circuitText = this.circuitPanel.getCircuitText();
        const blob = new Blob([circuitText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'circuit.fcd';
        a.click();
        URL.revokeObjectURL(url);
    }

    private exportSVG(): void {
        const svgText = this.circuitPanel.exportSVG();
        const blob = new Blob([svgText], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'circuit.svg';
        a.click();
        URL.revokeObjectURL(url);
    }

    private importCircuit(): void {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.fcd,.txt';
        input.addEventListener('change', (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                this.circuitPanel.loadCircuit(text);
                this.updateZoomLabel();
            };
            reader.readAsText(file);
        });
        input.click();
    }

    private wirePropertiesPanel(): void {
        // Wire up the properties panel callback from CircuitPanel
        this.circuitPanel.onPropertiesRequested = (prim) => {
            this.showPropertiesPanel(prim);
        };

        // Wire up text edit callback
        this.circuitPanel.onTextEditRequested = (prim, sx, sy) => {
            this.circuitPanel.showTextEdit(sx, sy, prim);
        };
    }

    private showPropertiesPanel(prim: GraphicPrimitive): void {
        // Clear existing content (keep header)
        const header = this.propertiesSidebar.firstElementChild;
        this.propertiesSidebar.innerHTML = '';
        this.propertiesSidebar.appendChild(header as HTMLElement);

        // Create form container
        const form = document.createElement('div');
        form.style.cssText = 'padding: 12px; display: flex; flex-direction: column; gap: 12px;';

        // Layer selector (common to all primitives)
        const layerRow = this.createPropertyRow('Layer:');
        const layerSelect = document.createElement('select');
        layerSelect.style.cssText = 'flex: 1; padding: 4px; font-size: 12px;';
        const layers = this.circuitPanel.getLayerDescriptions();
        for (let i = 0; i < layers.length; i++) {
            const opt = document.createElement('option');
            opt.value = String(i);
            opt.textContent = `Layer ${i}: ${layers[i]}`;
            layerSelect.appendChild(opt);
        }
        layerSelect.value = String(prim.getLayer());
        layerSelect.addEventListener('change', () => {
            prim.setLayer(Number(layerSelect.value));
            prim.setChanged(true);
            this.circuitPanel.getModel().setChanged(true);
            this.circuitPanel.render();
        });
        layerRow.appendChild(layerSelect);
        form.appendChild(layerRow);

        // Type-specific fields
        if (prim instanceof PrimitiveAdvText) {
            const textPrim = prim as PrimitiveAdvText;

            // Text content
            const textRow = this.createPropertyRow('Text:');
            const textInput = document.createElement('input');
            textInput.type = 'text';
            textInput.value = textPrim.getString();
            textInput.style.cssText = 'flex: 1; padding: 4px; font-size: 12px;';
            textInput.addEventListener('input', () => {
                textPrim.setString(textInput.value);
                textPrim.setChanged(true);
                this.circuitPanel.getModel().setChanged(true);
                this.circuitPanel.render();
            });
            textRow.appendChild(textInput);
            form.appendChild(textRow);

            // Font size
            const fontSizeRow = this.createPropertyRow('Font size:');
            const fontSizeInput = document.createElement('input');
            fontSizeInput.type = 'number';
            fontSizeInput.value = String(textPrim.getFontDimension());
            fontSizeInput.style.cssText = 'flex: 1; padding: 4px; font-size: 12px;';
            fontSizeInput.addEventListener('input', () => {
                textPrim.setFontDimension(Number(fontSizeInput.value));
                textPrim.setChanged(true);
                this.circuitPanel.getModel().setChanged(true);
                this.circuitPanel.render();
            });
            fontSizeRow.appendChild(fontSizeInput);
            form.appendChild(fontSizeRow);

            // Orientation
            const orientRow = this.createPropertyRow('Orientation:');
            const orientSelect = document.createElement('select');
            orientSelect.style.cssText = 'flex: 1; padding: 4px; font-size: 12px;';
            [0, 90, 180, 270].forEach(angle => {
                const opt = document.createElement('option');
                opt.value = String(angle);
                opt.textContent = `${angle}°`;
                orientSelect.appendChild(opt);
            });
            orientSelect.value = String(textPrim.getOrientation());
            orientSelect.addEventListener('change', () => {
                textPrim.setOrientation(Number(orientSelect.value));
                textPrim.setChanged(true);
                this.circuitPanel.getModel().setChanged(true);
                this.circuitPanel.render();
            });
            orientRow.appendChild(orientSelect);
            form.appendChild(orientRow);

            // Mirror
            const mirrorRow = this.createPropertyRow('Mirror:');
            const mirrorCheck = document.createElement('input');
            mirrorCheck.type = 'checkbox';
            mirrorCheck.checked = textPrim.isMirrored() !== 0;
            mirrorCheck.addEventListener('change', () => {
                textPrim.setMirrored(mirrorCheck.checked ? 1 : 0);
                textPrim.setChanged(true);
                this.circuitPanel.getModel().setChanged(true);
                this.circuitPanel.render();
            });
            mirrorRow.appendChild(mirrorCheck);
            form.appendChild(mirrorRow);

        } else if (prim instanceof (window as any).PrimitiveLine) {
            const linePrim = prim as any;

            // Dash style
            const dashRow = this.createPropertyRow('Dash style:');
            const dashSelect = document.createElement('select');
            dashSelect.style.cssText = 'flex: 1; padding: 4px; font-size: 12px;';
            for (let i = 0; i <= 5; i++) {
                const opt = document.createElement('option');
                opt.value = String(i);
                opt.textContent = String(i);
                dashSelect.appendChild(opt);
            }
            dashSelect.value = String(linePrim.getDashStyle());
            dashSelect.addEventListener('change', () => {
                linePrim.setDashStyle(Number(dashSelect.value));
                linePrim.setChanged(true);
                this.circuitPanel.getModel().setChanged(true);
                this.circuitPanel.render();
            });
            dashRow.appendChild(dashSelect);
            form.appendChild(dashRow);

            // Arrow start
            const arrowStartRow = this.createPropertyRow('Arrow start:');
            const arrowStartCheck = document.createElement('input');
            arrowStartCheck.type = 'checkbox';
            arrowStartCheck.checked = linePrim.getArrowStart() !== 0;
            arrowStartCheck.addEventListener('change', () => {
                linePrim.setArrowStart(arrowStartCheck.checked ? 1 : 0);
                linePrim.setChanged(true);
                this.circuitPanel.getModel().setChanged(true);
                this.circuitPanel.render();
            });
            arrowStartRow.appendChild(arrowStartCheck);
            form.appendChild(arrowStartRow);

            // Arrow end
            const arrowEndRow = this.createPropertyRow('Arrow end:');
            const arrowEndCheck = document.createElement('input');
            arrowEndCheck.type = 'checkbox';
            arrowEndCheck.checked = linePrim.getArrowEnd() !== 0;
            arrowEndCheck.addEventListener('change', () => {
                linePrim.setArrowEnd(arrowEndCheck.checked ? 1 : 0);
                linePrim.setChanged(true);
                this.circuitPanel.getModel().setChanged(true);
                this.circuitPanel.render();
            });
            arrowEndRow.appendChild(arrowEndCheck);
            form.appendChild(arrowEndRow);

        } else if ((prim instanceof (window as any).PrimitiveRectangle) || (prim instanceof (window as any).PrimitiveOval)) {
            const shapePrim = prim as any;

            // Filled checkbox
            const filledRow = this.createPropertyRow('Filled:');
            const filledCheck = document.createElement('input');
            filledCheck.type = 'checkbox';
            filledCheck.checked = shapePrim.getFilled() !== 0;
            filledCheck.addEventListener('change', () => {
                shapePrim.setFilled(filledCheck.checked ? 1 : 0);
                shapePrim.setChanged(true);
                this.circuitPanel.getModel().setChanged(true);
                this.circuitPanel.render();
            });
            filledRow.appendChild(filledCheck);
            form.appendChild(filledRow);

        } else if (prim instanceof (window as any).PrimitivePCBLine) {
            const pcbLinePrim = prim as any;

            // Thickness
            const thicknessRow = this.createPropertyRow('Thickness:');
            const thicknessInput = document.createElement('input');
            thicknessInput.type = 'number';
            thicknessInput.value = String(pcbLinePrim.getThickness());
            thicknessInput.style.cssText = 'flex: 1; padding: 4px; font-size: 12px;';
            thicknessInput.addEventListener('input', () => {
                pcbLinePrim.setThickness(Number(thicknessInput.value));
                pcbLinePrim.setChanged(true);
                this.circuitPanel.getModel().setChanged(true);
                this.circuitPanel.render();
            });
            thicknessRow.appendChild(thicknessInput);
            form.appendChild(thicknessRow);

        } else if (prim instanceof (window as any).PrimitivePCBPad) {
            const pcbPadPrim = prim as any;

            // Size X
            const sizeXRow = this.createPropertyRow('Size X:');
            const sizeXInput = document.createElement('input');
            sizeXInput.type = 'number';
            sizeXInput.value = String(pcbPadPrim.getSizex());
            sizeXInput.style.cssText = 'flex: 1; padding: 4px; font-size: 12px;';
            sizeXInput.addEventListener('input', () => {
                pcbPadPrim.setSizex(Number(sizeXInput.value));
                pcbPadPrim.setChanged(true);
                this.circuitPanel.getModel().setChanged(true);
                this.circuitPanel.render();
            });
            sizeXRow.appendChild(sizeXInput);
            form.appendChild(sizeXRow);

            // Size Y
            const sizeYRow = this.createPropertyRow('Size Y:');
            const sizeYInput = document.createElement('input');
            sizeYInput.type = 'number';
            sizeYInput.value = String(pcbPadPrim.getSizey());
            sizeYInput.style.cssText = 'flex: 1; padding: 4px; font-size: 12px;';
            sizeYInput.addEventListener('input', () => {
                pcbPadPrim.setSizey(Number(sizeYInput.value));
                pcbPadPrim.setChanged(true);
                this.circuitPanel.getModel().setChanged(true);
                this.circuitPanel.render();
            });
            sizeYRow.appendChild(sizeYInput);
            form.appendChild(sizeYRow);

            // Drill
            const drillRow = this.createPropertyRow('Drill:');
            const drillInput = document.createElement('input');
            drillInput.type = 'number';
            drillInput.value = String(pcbPadPrim.getDrill());
            drillInput.style.cssText = 'flex: 1; padding: 4px; font-size: 12px;';
            drillInput.addEventListener('input', () => {
                pcbPadPrim.setDrill(Number(drillInput.value));
                pcbPadPrim.setChanged(true);
                this.circuitPanel.getModel().setChanged(true);
                this.circuitPanel.render();
            });
            drillRow.appendChild(drillInput);
            form.appendChild(drillRow);
        }

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText =
            'padding: 8px 16px; cursor: pointer; border: 1px solid #ccc; ' +
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
            new FidoCadTS();
        } catch (e) {
            console.error('Failed to initialize FidoCadTS:', e);
        }
    });
} else {
    try {
        new FidoCadTS();
    } catch (e) {
        console.error('Failed to initialize FidoCadTS:', e);
    }
}
