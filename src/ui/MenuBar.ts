/**
 * @file MenuBar.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief Application menu bar
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import type { EditorFacade } from '../circuit/EditorFacade.js';
import { showOptionsDialog } from './OptionsDialog.js';
import { showExportDialog, executeExport } from './ExportDialog.js';
import { showLayerDialog } from './DialogLayer.js';
import { showAboutDialog } from './DialogAbout.js';
import { getString } from '../i18n/i18n.js';

/** Ensure a filename ends with the `.fcd` circuit extension. */
function ensureFcdExt(name: string): string {
    return /\.fcd$/i.test(name) ? name : `${name}.fcd`;
}

interface MenuItem {
    kind: 'action' | 'separator';
    id?: string;
    label?: string;
    shortcut?: string;
    action?: () => void;
    enabled?: () => boolean;
}

export class MenuBar {
    private readonly el: HTMLElement;
    private readonly panel: EditorFacade;
    private readonly onNewCircuit: () => void;
    private readonly onImportLibrary:
        | ((content: string, fileName: string) => Promise<void>)
        | undefined;
    private readonly onReloadLibraries: (() => void) | undefined;
    private readonly librariesReady: (() => Promise<void>) | undefined;
    private undoMenuItem: HTMLElement | null = null;
    private redoMenuItem: HTMLElement | null = null;

    constructor(
        panel: EditorFacade,
        onNewCircuit: () => void,
        onImportLibrary: ((content: string, fileName: string) => Promise<void>) | undefined,
        onReloadLibraries?: () => void,
        librariesReady?: () => Promise<void>,
    ) {
        this.panel = panel;
        this.onNewCircuit = onNewCircuit;
        this.onImportLibrary = onImportLibrary;
        this.onReloadLibraries = onReloadLibraries;
        this.librariesReady = librariesReady;

        this.el = document.createElement('div');
        this.el.style.cssText =
            'display: flex; gap: 4px; padding: 4px 8px; background: #f0f0f0; ' +
            'border-bottom: 1px solid #ccc; font-family: sans-serif; font-size: 12px;';

        this.el.appendChild(this.createMenu(getString('File'), this.buildFileMenu()));
        this.el.appendChild(this.createMenu(getString('Edit_menu'), this.buildEditMenu()));
        this.el.appendChild(this.createMenu(getString('View'), this.buildViewMenu()));
        this.el.appendChild(this.createMenu(getString('Circuit'), this.buildCircuitMenu()));
        this.el.appendChild(this.createMenu(getString('Help_menu'), this.buildHelpMenu()));
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
                if (item.id === 'undo') {
                    this.undoMenuItem = menuItem;
                } else if (item.id === 'redo') {
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
                label: getString('New'),
                shortcut: 'Ctrl+N',
                action: () => this.onNewCircuit(),
            },
            {
                kind: 'action',
                label: getString('Open'),
                shortcut: 'Ctrl+O',
                action: () => this.importCircuit(),
            },
            { kind: 'separator' },
            {
                kind: 'action',
                label: getString('Save'),
                shortcut: 'Ctrl+S',
                action: () => void this.saveCircuit(),
            },
            {
                kind: 'action',
                label: getString('SaveName'),
                shortcut: 'Ctrl+Shift+S',
                action: () => void this.saveCircuitAs(),
            },
            {
                kind: 'action',
                label: `${getString('Export')}...`,
                shortcut: 'Ctrl+E',
                action: () => this.exportFile(),
            },
        ];
    }

    private buildEditMenu(): MenuItem[] {
        const hasSel = () =>
            this.panel
                .getModel()
                .getPrimitiveVector()
                .some((p) => p.isSelected());
        return [
            {
                kind: 'action',
                id: 'undo',
                label: getString('Undo'),
                shortcut: 'Ctrl+Z',
                action: () => this.panel.undo(),
                enabled: () => this.panel.canUndo(),
            },
            {
                kind: 'action',
                id: 'redo',
                label: getString('Redo'),
                shortcut: 'Ctrl+Y',
                action: () => this.panel.redo(),
                enabled: () => this.panel.canRedo(),
            },
            { kind: 'separator' },
            {
                kind: 'action',
                label: getString('Cut'),
                shortcut: 'Ctrl+X',
                action: () => this.panel.cutSelected(),
                enabled: hasSel,
            },
            {
                kind: 'action',
                label: getString('Copy'),
                shortcut: 'Ctrl+C',
                action: () => this.panel.copySelected(),
                enabled: hasSel,
            },
            {
                kind: 'action',
                label: getString('Paste_btn'),
                shortcut: 'Ctrl+V',
                action: () => void this.panel.paste(),
                enabled: () => this.panel.canPaste(),
            },
            {
                kind: 'action',
                label: getString('Duplicate'),
                shortcut: 'Ctrl+D',
                action: () => this.panel.duplicateSelected(),
                enabled: hasSel,
            },
            {
                kind: 'action',
                label: getString('Copy_as_image'),
                shortcut: 'Ctrl+I',
                action: () => void this.panel.copyAsImage(),
            },
            { kind: 'separator' },
            {
                kind: 'action',
                label: getString('SelectAll'),
                shortcut: 'Ctrl+A',
                action: () => this.panel.selectAll(),
            },
            {
                kind: 'action',
                label: getString('Delete'),
                shortcut: 'Del',
                action: () => this.panel.deleteSelected(),
            },
            { kind: 'separator' },
            {
                kind: 'action',
                label: getString('Rotate'),
                shortcut: 'R',
                action: () => this.panel.rotateSelected(),
            },
            {
                kind: 'action',
                label: getString('Mirror_E'),
                shortcut: 'S',
                action: () => this.panel.mirrorSelected(),
            },
            { kind: 'separator' },
            {
                kind: 'action',
                label: getString('alignLeftSelected'),
                action: () => this.panel.alignLeftSelected(),
            },
            {
                kind: 'action',
                label: getString('alignRightSelected'),
                action: () => this.panel.alignRightSelected(),
            },
            {
                kind: 'action',
                label: getString('alignTopSelected'),
                action: () => this.panel.alignTopSelected(),
            },
            {
                kind: 'action',
                label: getString('alignBottomSelected'),
                action: () => this.panel.alignBottomSelected(),
            },
            {
                kind: 'action',
                label: getString('alignHorizontalCenterSelected'),
                action: () => this.panel.alignHorizontalCenterSelected(),
            },
            {
                kind: 'action',
                label: getString('alignVerticalCenterSelected'),
                action: () => this.panel.alignVerticalCenterSelected(),
            },
            { kind: 'separator' },
            {
                kind: 'action',
                label: getString('distributeHorizontallySelected'),
                action: () => this.panel.distributeHorizontallySelected(),
            },
            {
                kind: 'action',
                label: getString('distributeVerticallySelected'),
                action: () => this.panel.distributeVerticallySelected(),
            },
        ];
    }

    private buildViewMenu(): MenuItem[] {
        return [
            {
                kind: 'action',
                label: `${getString('ShowGrid')}${this.panel.isGridVisible() ? ' ✓' : ''}`,
                action: () => {
                    this.panel.setGridVisible(!this.panel.isGridVisible());
                    this.updateState();
                },
            },
            {
                kind: 'action',
                label: getString('ZoomIn'),
                shortcut: '+',
                action: () => this.panel.zoomIn(),
            },
            {
                kind: 'action',
                label: getString('ZoomOut'),
                shortcut: '-',
                action: () => this.panel.zoomOut(),
            },
            {
                kind: 'action',
                label: getString('Zoom_fit'),
                shortcut: 'Home',
                action: () => this.panel.zoomToFit(),
            },
            { kind: 'separator' },
            {
                kind: 'action',
                label: `${getString('Attach_image_menu')}...`,
                action: () => this.attachImageFile(),
            },
            {
                kind: 'action',
                label: getString('Detach_image_menu'),
                action: () => {
                    this.panel.detachImage();
                    this.updateState();
                },
                enabled: () => this.panel.isImageAttached(),
            },
            { kind: 'separator' },
            {
                kind: 'action',
                label: `${getString('Layer_options')}...`,
                shortcut: 'Ctrl+L',
                action: () => showLayerDialog(this.panel),
            },
            {
                kind: 'action',
                label: `${getString('Circ_opt')}...`,
                shortcut: 'Ctrl+,',
                action: () => showOptionsDialog(this.panel, this.onReloadLibraries),
            },
        ];
    }

    /** Open a file picker for the user to select a background image. */
    private attachImageFile(): void {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            try {
                await this.panel.attachImage(file);
                // Store the data URL in localStorage for FCD round-trip
                const imgCanvas = this.panel.getModel().getImgCanvas();
                const state = imgCanvas.getState();
                if (state) {
                    try {
                        localStorage.setItem('fidocadjs_bg_image', state.dataUrl);
                    } catch {
                        // localStorage may be full — ignore
                    }
                }
            } catch (err) {
                console.error('Failed to attach image:', err);
            }
        });
        input.click();
    }

    private buildCircuitMenu(): MenuItem[] {
        return [
            {
                kind: 'action',
                label: getString('Define'),
                shortcut: 'Ctrl+G',
                action: () => this.showDefineDialog(),
            },
            {
                kind: 'action',
                label: `${getString('ImportLibrary_menu')}...`,
                action: () => this.importLibraryFile(),
            },
        ];
    }

    private buildHelpMenu(): MenuItem[] {
        return [
            {
                kind: 'action',
                label: getString('About_menu'),
                action: () => showAboutDialog(),
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
                // Wait for libraries so the circuit's macro references resolve
                // at parse time. Macros are expanded once, when parsed; if the
                // file is opened before the libraries finish loading, every
                // macro is silently dropped and never recovers.
                void Promise.resolve(this.librariesReady?.()).then(() => {
                    this.panel.loadCircuit(text);
                    // Remember the opened file's name for a later Save; the picker
                    // handle (if any) no longer matches this content.
                    this.panel.setFileName(file.name);
                    this.panel.setFileHandle(null);
                });
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
                this.onImportLibrary!(text, file.name).catch((err) =>
                    console.error('Import failed:', err),
                );
            };
            reader.readAsText(file);
        });
        input.click();
    }

    /**
     * Save to the file previously chosen via "Save As". If none exists yet
     * (no stored file handle), fall back to "Save As" so the user is prompted.
     */
    private async saveCircuit(): Promise<void> {
        const handle = this.panel.getFileHandle();
        if (handle) {
            try {
                await this.writeToHandle(handle);
                this.panel.markAsSaved();
                return;
            } catch (err) {
                // Handle may be stale (e.g. permission lost); re-prompt.
                console.warn('Save to existing file failed, prompting again:', err);
            }
        }
        await this.saveCircuitAs();
    }

    /**
     * Prompt the user for a destination and save the circuit there.
     * Uses the File System Access API (native picker) when available, and
     * falls back to a filename prompt + anchor download otherwise.
     */
    private async saveCircuitAs(): Promise<void> {
        const suggestedName = ensureFcdExt(this.panel.getFileName());

        const picker = (
            window as unknown as {
                showSaveFilePicker?: (opts: {
                    suggestedName?: string;
                    types?: {
                        description?: string;
                        accept: Record<string, string[]>;
                    }[];
                }) => Promise<FileSystemFileHandle>;
            }
        ).showSaveFilePicker;

        if (typeof picker === 'function') {
            try {
                const handle = await picker({
                    suggestedName,
                    types: [
                        {
                            description: 'FidoCadJ circuit',
                            accept: { 'text/plain': ['.fcd'] },
                        },
                    ],
                });
                await this.writeToHandle(handle);
                this.panel.setFileHandle(handle);
                this.panel.setFileName(handle.name || suggestedName);
                this.panel.markAsSaved();
            } catch (err) {
                // User cancelled the picker — do nothing.
                if ((err as DOMException)?.name === 'AbortError') return;
                console.error('Save As failed:', err);
            }
            return;
        }

        // Fallback: prompt for a filename, then download via an anchor.
        const chosen = await this.promptFileName(suggestedName);
        if (chosen === null) return;
        const fileName = ensureFcdExt(chosen.trim() || suggestedName);
        this.downloadText(this.panel.getCircuitText(), fileName);
        this.panel.setFileName(fileName);
        this.panel.markAsSaved();
    }

    /** Write the current circuit text to a File System Access API handle. */
    private async writeToHandle(handle: FileSystemFileHandle): Promise<void> {
        const writable = await handle.createWritable();
        await writable.write(this.panel.getCircuitText());
        await writable.close();
    }

    /** Trigger a browser download of the given text with the given filename. */
    private downloadText(text: string, fileName: string): void {
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Show a small modal asking for a filename. Resolves to the entered name,
     * or null if the user cancels.
     */
    private promptFileName(defaultName: string): Promise<string | null> {
        return new Promise((resolve) => {
            const dialog = document.createElement('dialog');
            dialog.style.cssText =
                'padding: 16px; border: 1px solid #ccc; border-radius: 4px; ' +
                'box-shadow: 0 4px 8px rgba(0,0,0,0.2); min-width: 320px; font-family: sans-serif;';

            const title = document.createElement('h3');
            title.textContent = getString('SaveName');
            title.style.cssText = 'margin-top: 0; font-size: 14px;';
            dialog.appendChild(title);

            const input = document.createElement('input');
            input.type = 'text';
            input.value = defaultName;
            input.style.cssText =
                'width: 100%; padding: 6px 8px; border: 1px solid #ccc; ' +
                'border-radius: 4px; font-size: 13px; box-sizing: border-box;';
            dialog.appendChild(input);

            const buttonRow = document.createElement('div');
            buttonRow.style.cssText =
                'display: flex; gap: 8px; margin-top: 12px; justify-content: flex-end;';

            let settled = false;
            const finish = (value: string | null) => {
                if (settled) return;
                settled = true;
                dialog.close();
                resolve(value);
            };

            const okBtn = document.createElement('button');
            okBtn.textContent = getString('Ok_btn');
            okBtn.style.cssText =
                'padding: 6px 16px; background: #007bff; color: white; border: none; ' +
                'border-radius: 4px; cursor: pointer; font-size: 12px;';
            okBtn.addEventListener('click', () => finish(input.value));
            buttonRow.appendChild(okBtn);

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = getString('Cancel_btn');
            cancelBtn.style.cssText =
                'padding: 6px 16px; background: #6c757d; color: white; border: none; ' +
                'border-radius: 4px; cursor: pointer; font-size: 12px;';
            cancelBtn.addEventListener('click', () => finish(null));
            buttonRow.appendChild(cancelBtn);

            dialog.appendChild(buttonRow);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') finish(input.value);
            });

            document.body.appendChild(dialog);
            dialog.addEventListener('close', () => {
                finish(null);
                document.body.removeChild(dialog);
            });
            dialog.showModal();
            input.focus();
            input.select();
        });
    }

    private showDefineDialog(): void {
        const dialog = document.createElement('dialog');
        dialog.style.cssText =
            'padding: 16px; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 4px 8px rgba(0,0,0,0.2); ' +
            'min-width: 400px; font-family: monospace;';

        const title = document.createElement('h3');
        title.textContent = getString('Enter_code');
        title.style.cssText = 'margin-top: 0;';
        dialog.appendChild(title);

        const textarea = document.createElement('textarea');
        textarea.value = this.panel.getCircuitText();
        textarea.style.cssText =
            'width: 100%; height: 300px; padding: 8px; border: 1px solid #ccc; ' +
            'border-radius: 4px; font-family: monospace; font-size: 11px; resize: none;';
        dialog.appendChild(textarea);

        const buttonRow = document.createElement('div');
        buttonRow.style.cssText =
            'display: flex; gap: 8px; margin-top: 12px; justify-content: flex-end;';

        const okBtn = document.createElement('button');
        okBtn.textContent = getString('Ok_btn');
        okBtn.style.cssText =
            'padding: 6px 16px; background: #007bff; color: white; border: none; ' +
            'border-radius: 4px; cursor: pointer; font-size: 12px;';
        okBtn.addEventListener('click', () => {
            this.panel.loadCircuit(textarea.value);
            dialog.close();
        });
        buttonRow.appendChild(okBtn);

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = getString('Cancel_btn');
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
        void this.saveCircuit();
    }

    saveFileAs(): void {
        void this.saveCircuitAs();
    }

    async exportFile(): Promise<void> {
        const selection = await showExportDialog(this.panel);
        if (selection) {
            executeExport(this.panel, selection);
        }
    }

    printFile(): void {
        // TODO: Implement print functionality
        console.log('Print not yet implemented');
    }
}
