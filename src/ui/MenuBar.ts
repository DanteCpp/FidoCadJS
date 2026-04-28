import { CircuitPanel } from '../circuit/CircuitPanel.js';
import { showOptionsDialog } from './OptionsDialog.js';

interface MenuItem {
    kind: 'action' | 'separator';
    label?: string;
    shortcut?: string;
    action?: () => void;
    enabled?: () => boolean;
}

export class MenuBar {
    private readonly el: HTMLElement;
    private readonly panel: CircuitPanel;
    private readonly onNewCircuit: () => void;
    private readonly onImportLibrary: ((content: string, fileName: string) => void) | undefined;
    private undoMenuItem: HTMLElement | null = null;
    private redoMenuItem: HTMLElement | null = null;

    constructor(panel: CircuitPanel, onNewCircuit: () => void,
                onImportLibrary: ((content: string, fileName: string) => void) | undefined) {
        this.panel = panel;
        this.onNewCircuit = onNewCircuit;
        this.onImportLibrary = onImportLibrary;

        this.el = document.createElement('div');
        this.el.style.cssText =
            'display: flex; gap: 4px; padding: 4px 8px; background: #f0f0f0; ' +
            'border-bottom: 1px solid #ccc; font-family: sans-serif; font-size: 12px;';

        this.el.appendChild(this.createMenu('File', this.buildFileMenu()));
        this.el.appendChild(this.createMenu('Edit', this.buildEditMenu()));
        this.el.appendChild(this.createMenu('View', this.buildViewMenu()));
        this.el.appendChild(this.createMenu('Circuit', this.buildCircuitMenu()));
    }

    getElement(): HTMLElement {
        return this.el;
    }

    private createMenu(label: string, items: MenuItem[]): HTMLElement {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.style.cssText =
            'padding: 4px 8px; cursor: pointer; border: none; background: transparent; ' +
            'font-size: 12px; font-family: sans-serif; padding: 4px 6px;';

        const dropdown = document.createElement('div');
        dropdown.style.cssText =
            'position: absolute; top: 100%; left: 0; background: white; border: 1px solid #ccc; ' +
            'box-shadow: 0 2px 4px rgba(0,0,0,0.1); min-width: 200px; z-index: 1000; ' +
            'display: none; flex-direction: column;';

        for (const item of items) {
            if (item.kind === 'separator') {
                const sep = document.createElement('div');
                sep.style.cssText = 'height: 1px; background: #ddd; margin: 2px 0;';
                dropdown.appendChild(sep);
            } else if (item.kind === 'action') {
                const menuItem = document.createElement('div');
                menuItem.style.cssText =
                    'padding: 6px 12px; cursor: pointer; display: flex; justify-content: space-between; ' +
                    'align-items: center; white-space: nowrap; font-size: 12px;';

                const label = document.createElement('span');
                label.textContent = item.label || '';

                menuItem.appendChild(label);

                if (item.shortcut) {
                    const shortcutSpan = document.createElement('span');
                    shortcutSpan.textContent = item.shortcut;
                    shortcutSpan.style.cssText = 'margin-left: 16px; color: #999; font-size: 11px;';
                    menuItem.appendChild(shortcutSpan);
                }

                const isEnabled = () => !item.enabled || item.enabled();

                menuItem.addEventListener('mouseenter', () => {
                    if (isEnabled()) {
                        menuItem.style.background = '#e8e8e8';
                    }
                });
                menuItem.addEventListener('mouseleave', () => {
                    menuItem.style.background = '';
                });

                menuItem.addEventListener('click', () => {
                    if (isEnabled() && item.action) {
                        item.action();
                        dropdown.style.display = 'none';
                    }
                });

                dropdown.appendChild(menuItem);

                // Store references to Undo/Redo items for state updates
                if (item.label === 'Undo') {
                    this.undoMenuItem = menuItem;
                } else if (item.label === 'Redo') {
                    this.redoMenuItem = menuItem;
                }
            }
        }

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position: relative;';
        wrapper.appendChild(btn);
        wrapper.appendChild(dropdown);

        btn.addEventListener('mouseenter', () => {
            dropdown.style.display = 'flex';
        });

        wrapper.addEventListener('mouseleave', () => {
            dropdown.style.display = 'none';
        });

        return wrapper;
    }

    private buildFileMenu(): MenuItem[] {
        return [
            {
                kind: 'action',
                label: 'New',
                shortcut: 'Ctrl+N',
                action: () => this.onNewCircuit(),
            },
            {
                kind: 'action',
                label: 'Open',
                shortcut: 'Ctrl+O',
                action: () => this.importCircuit(),
            },
            {
                kind: 'action',
                label: 'Save FCD',
                shortcut: 'Ctrl+S',
                action: () => this.exportCircuit(),
            },
            {
                kind: 'action',
                label: 'Export SVG',
                shortcut: 'Ctrl+E',
                action: () => this.exportSVG(),
            },
            {
                kind: 'action',
                label: 'Import Library...',
                action: () => this.importLibraryFile(),
            },
            { kind: 'separator' },
            {
                kind: 'action',
                label: 'Options...',
                shortcut: 'Ctrl+,',
                action: () => showOptionsDialog(this.panel),
            },
        ];
    }

    private buildEditMenu(): MenuItem[] {
        return [
            {
                kind: 'action',
                label: 'Undo',
                shortcut: 'Ctrl+Z',
                action: () => this.panel.undo(),
                enabled: () => this.panel.canUndo(),
            },
            {
                kind: 'action',
                label: 'Redo',
                shortcut: 'Ctrl+Y',
                action: () => this.panel.redo(),
                enabled: () => this.panel.canRedo(),
            },
            { kind: 'separator' },
            {
                kind: 'action',
                label: 'Cut',
                shortcut: 'Ctrl+X',
                action: () => this.panel.cutSelected(),
                enabled: () => this.panel.getModel().getPrimitiveVector().some(p => p.isSelected()),
            },
            {
                kind: 'action',
                label: 'Copy',
                shortcut: 'Ctrl+C',
                action: () => this.panel.copySelected(),
                enabled: () => this.panel.getModel().getPrimitiveVector().some(p => p.isSelected()),
            },
            {
                kind: 'action',
                label: 'Paste',
                shortcut: 'Ctrl+V',
                action: () => void this.panel.paste(),
                enabled: () => this.panel.canPaste(),
            },
            {
                kind: 'action',
                label: 'Duplicate',
                shortcut: 'Ctrl+D',
                action: () => this.panel.duplicateSelected(),
                enabled: () => this.panel.getModel().getPrimitiveVector().some(p => p.isSelected()),
            },
            { kind: 'separator' },
            {
                kind: 'action',
                label: 'Select All',
                shortcut: 'Ctrl+A',
                action: () => this.panel.selectAll(),
            },
            {
                kind: 'action',
                label: 'Delete',
                shortcut: 'Del',
                action: () => this.panel.deleteSelected(),
            },
            { kind: 'separator' },
            {
                kind: 'action',
                label: 'Rotate',
                shortcut: 'R',
                action: () => this.panel.rotateSelected(),
            },
            {
                kind: 'action',
                label: 'Mirror',
                shortcut: 'S',
                action: () => this.panel.mirrorSelected(),
            },
        ];
    }

    private buildViewMenu(): MenuItem[] {
        return [
            {
                kind: 'action',
                label: `Grid${this.panel.isGridVisible() ? ' ✓' : ''}`,
                action: () => {
                    this.panel.setGridVisible(!this.panel.isGridVisible());
                    this.updateState();
                },
            },
            {
                kind: 'action',
                label: 'Zoom In',
                shortcut: '+',
                action: () => this.panel.zoomIn(),
            },
            {
                kind: 'action',
                label: 'Zoom Out',
                shortcut: '-',
                action: () => this.panel.zoomOut(),
            },
            {
                kind: 'action',
                label: 'Zoom Fit',
                shortcut: 'Home',
                action: () => this.panel.zoomToFit(),
            },
        ];
    }

    private buildCircuitMenu(): MenuItem[] {
        return [
            {
                kind: 'action',
                label: 'View code',
                shortcut: 'Ctrl+G',
                action: () => this.showDefineDialog(),
            },
        ];
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
                this.panel.loadCircuit(text);
            };
            reader.readAsText(file);
        });
        input.click();
    }

    private importLibraryFile(): void {
        if (!this.onImportLibrary) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.fcl,.txt';
        input.addEventListener('change', (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                this.onImportLibrary!(text, file.name);
            };
            reader.readAsText(file);
        });
        input.click();
    }

    private exportCircuit(): void {
        const circuitText = this.panel.getCircuitText();
        const blob = new Blob([circuitText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'circuit.fcd';
        a.click();
        URL.revokeObjectURL(url);
    }

    private exportSVG(): void {
        const svgText = this.panel.exportSVG();
        const blob = new Blob([svgText], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'circuit.svg';
        a.click();
        URL.revokeObjectURL(url);
    }

    private showDefineDialog(): void {
        const dialog = document.createElement('dialog');
        dialog.style.cssText =
            'padding: 16px; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 4px 8px rgba(0,0,0,0.2); ' +
            'min-width: 400px; font-family: monospace;';

        const title = document.createElement('h3');
        title.textContent = 'Circuit Definition';
        title.style.cssText = 'margin-top: 0;';
        dialog.appendChild(title);

        const textarea = document.createElement('textarea');
        textarea.value = this.panel.getCircuitText();
        textarea.style.cssText =
            'width: 100%; height: 300px; padding: 8px; border: 1px solid #ccc; ' +
            'border-radius: 4px; font-family: monospace; font-size: 11px; resize: none;';
        dialog.appendChild(textarea);

        const buttonRow = document.createElement('div');
        buttonRow.style.cssText = 'display: flex; gap: 8px; margin-top: 12px; justify-content: flex-end;';

        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        okBtn.style.cssText =
            'padding: 6px 16px; background: #007bff; color: white; border: none; ' +
            'border-radius: 4px; cursor: pointer; font-size: 12px;';
        okBtn.addEventListener('click', () => {
            this.panel.loadCircuit(textarea.value);
            dialog.close();
        });
        buttonRow.appendChild(okBtn);

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText =
            'padding: 6px 16px; background: #6c757d; color: white; border: none; ' +
            'border-radius: 4px; cursor: pointer; font-size: 12px;';
        cancelBtn.addEventListener('click', () => {
            dialog.close();
        });
        buttonRow.appendChild(cancelBtn);

        dialog.appendChild(buttonRow);
        document.body.appendChild(dialog);
        dialog.showModal();

        dialog.addEventListener('close', () => {
            document.body.removeChild(dialog);
        });
    }

    updateState(): void {
        if (this.undoMenuItem) {
            const canUndo = this.panel.canUndo();
            this.undoMenuItem.style.opacity = canUndo ? '1' : '0.5';
            this.undoMenuItem.style.cursor = canUndo ? 'pointer' : 'default';
        }
        if (this.redoMenuItem) {
            const canRedo = this.panel.canRedo();
            this.redoMenuItem.style.opacity = canRedo ? '1' : '0.5';
            this.redoMenuItem.style.cursor = canRedo ? 'pointer' : 'default';
        }
    }

    // Public methods for keyboard shortcuts
    newFile(): void {
        this.onNewCircuit();
    }

    openFile(): void {
        this.importCircuit();
    }

    saveFile(): void {
        this.exportCircuit();
    }

    saveFileAs(): void {
        // For now, same as save - could add filename prompt later
        this.exportCircuit();
    }

    exportFile(): void {
        this.exportSVG();
    }

    printFile(): void {
        // TODO: Implement print functionality
        console.log('Print not yet implemented');
    }

    closeFile(): void {
        // TODO: Implement close with dirty check
        if (this.panel.getModel().getChanged()) {
            if (!confirm('You have unsaved changes. Close anyway?')) {
                return;
            }
        }
        this.onNewCircuit();
    }
}
