/**
 * @file app.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief Application entry point & UI bootstrap
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { CircuitPanel } from './circuit/CircuitPanel.js';
import { loadStandardLibraries } from './circuit/controllers/LibraryLoader.js';
import { LibraryModel } from './librarymodel/LibraryModel.js';
import { MacroPicker } from './macropicker/MacroPicker.js';
import { MenuBar } from './ui/MenuBar.js';
import { ToolbarController } from './ui/ToolbarController.js';
import { PropertiesPanelController } from './ui/PropertiesPanelController.js';
import { loadLocale, getPreferredLocale, onLocaleChange, getString } from './i18n/i18n.js';
import { AccessResources } from './i18n/AccessResources.js';
import { SettingsManager } from './settings/SettingsManager.js';
import { Globals } from './globals/Globals.js';
import { UserLibraryStorage } from './librarymodel/UserLibraryStorage.js';
import { ConfirmDialog } from './ui/ConfirmDialog.js';
import { DialogSymbolize } from './ui/DialogSymbolize.js';
import { PromptDialog } from './ui/PromptDialog.js';
import { LibUtils } from './librarymodel/LibUtils.js';
import { Library } from './librarymodel/Library.js';
import { Category } from './librarymodel/Category.js';
import { MacroDesc } from './primitives/MacroDesc.js';
import type { ContextMenuAction } from './macropicker/MacroPicker.js';

class FidoCadJS {
    private circuitPanel!: CircuitPanel;
    private toolbarEl!: HTMLElement;
    private menuBar!: MenuBar;
    private propertiesSidebar!: HTMLElement;
    private libraryPanel!: HTMLElement;
    private macroPicker!: MacroPicker;
    private libraryModel!: LibraryModel;

    private toolbarController!: ToolbarController;
    private propertiesController!: PropertiesPanelController;

    constructor() {
        // Load the user's preferred locale (saved → browser → English) before
        // any UI is built.
        Globals.messages = new AccessResources();
        loadLocale(getPreferredLocale())
            .then(() => {
                this.initUI();
                // Rebuild the menu bar and toolbar when the user changes language.
                onLocaleChange(() => this.rebuildLocalizedUI());
            })
            .catch((e) => {
                console.error('Failed to load locale:', e);
                this.initUI();
            });
    }

    private rebuildLocalizedUI(): void {
        // Rebuild menu bar, toolbar and macro-picker labels to pick up new
        // translations. Listeners attached by these components are re-bound by
        // their constructors / build() methods.
        try {
            const newMenu = new MenuBar(
                this.circuitPanel,
                () => this.newCircuit(),
                (content, fileName) => this.importLibrary(content, fileName),
            );
            this.menuBar.getElement().replaceWith(newMenu.getElement());
            this.menuBar = newMenu;
            this.circuitPanel.setMenuBar(this.menuBar);
            this.circuitPanel.onUndoStateChange = () => this.menuBar.updateState();
            // Rebuild the toolbar in place.
            this.toolbarEl.innerHTML = '';
            this.toolbarController.build();
            // Reload standard libraries in the new locale (Italian bundles
            // ship alongside the English defaults; other locales fall back to
            // English). Errors are non-fatal — the UI just keeps the old
            // library contents.
            this.reloadStandardLibrariesForLocale().catch((e) =>
                console.error('Library reload failed:', e),
            );
        } catch (e) {
            console.error('Locale-driven UI rebuild failed:', e);
        }
    }

    private async reloadStandardLibrariesForLocale(): Promise<void> {
        // Clear out the existing standard-library macros and re-fetch them.
        // User libraries persist in localStorage and are reloaded afterwards.
        const parser = this.circuitPanel.getParserActions();
        this.circuitPanel.getModel().getLibrary().clear();
        await loadStandardLibraries(parser);
        UserLibraryStorage.loadUserLibraries(parser);
        this.libraryModel.forceUpdate();
        this.macroPicker.refresh(this.libraryModel);
    }

    private initUI(): void {
        const app = document.getElementById('app');
        if (!app) {
            console.error('Could not find #app element');
            return;
        }

        // Create toolbar container
        this.toolbarEl = document.createElement('div');
        this.toolbarEl.setAttribute('data-testid', 'toolbar');
        app.appendChild(this.toolbarEl);

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
        this.propertiesSidebar.innerHTML =
            '<div style="padding: 12px; font-weight: bold; border-bottom: 1px solid #ddd;">' +
            getString('Properties') +
            '</div>';

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

        // Create CircuitPanel
        this.circuitPanel = new CircuitPanel(editorContainer);
        SettingsManager.getInstance().applyToPanel(this.circuitPanel);

        // Expose stable test API for E2E tests (replaces canvas.__circuitPanel hack)
        (window as any).__FidoCadJS__ = { circuitPanel: this.circuitPanel };

        // Create menu bar
        this.menuBar = new MenuBar(
            this.circuitPanel,
            () => this.newCircuit(),
            (content, fileName) => this.importLibrary(content, fileName),
        );
        this.circuitPanel.setMenuBar(this.menuBar);
        app.insertBefore(this.menuBar.getElement(), this.toolbarEl);

        // Build toolbar via controller
        this.toolbarController = new ToolbarController(
            this.toolbarEl,
            this.circuitPanel,
            import.meta.env.BASE_URL,
        );
        this.toolbarController.setLibraryToggleCallback(() => {
            const visible = this.libraryPanel.style.display !== 'none';
            this.libraryPanel.style.display = visible ? 'none' : 'flex';
        });
        this.toolbarController.build();

        // Wire undo state change to menu bar updates
        this.circuitPanel.onUndoStateChange = () => this.menuBar.updateState();

        // Build properties panel controller
        this.propertiesController = new PropertiesPanelController(
            this.propertiesSidebar,
            this.circuitPanel,
        );
        this.propertiesController.onGetFontFamilies = () => this.getAvailableFontFamilies();

        // Wire properties panel callbacks
        this.wirePropertiesPanel();

        // Thin status bar
        const statusBar = document.createElement('div');
        statusBar.style.cssText = 'height: 4px; background: #e0e0e0; border-top: 1px solid #ccc;';
        app.appendChild(statusBar);

        // Load standard FCL libraries asynchronously
        this.initLibraries();

        // Enable keyboard listeners
        this.circuitPanel.addKeyboardListeners();

        console.log('FidoCadJS initialized');
    }

    private async initLibraries(): Promise<void> {
        await loadStandardLibraries(this.circuitPanel.getParserActions());
        UserLibraryStorage.loadUserLibraries(this.circuitPanel.getParserActions());
        this.libraryModel = new LibraryModel(this.circuitPanel.getModel());
        this.macroPicker.refresh(this.libraryModel);
        this.macroPicker.onMacroSelected = (key) => {
            this.circuitPanel.setMacroTool(key);
        };
        this.macroPicker.onContextMenuAction = (action, node) => {
            this.handleMacroPickerContextAction(action, node);
        };
        this.circuitPanel.onSymbolizeRequested = () => {
            const dlg = new DialogSymbolize(
                this.circuitPanel,
                this.circuitPanel.getModel(),
                this.libraryModel,
                () => this.macroPicker.refresh(this.libraryModel),
            );
            dlg.show();
        };
        console.log(
            `Libraries loaded: ${this.libraryModel.getAllLibraries().length} libraries, ` +
                `${this.libraryModel.getAllMacros().size} macros`,
        );
    }

    private newCircuit(): void {
        this.circuitPanel.clearCircuit();
    }

    private async importLibrary(content: string, fileName: string): Promise<void> {
        let prefix = fileName.replace(/\.(?:fcl|txt)$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
        if (!prefix) prefix = 'imported_lib';

        const stdNames = LibUtils.getStdFilenames();
        const originalPrefix = prefix;
        let attempt = 0;
        while (stdNames.has(prefix) && attempt < 100) {
            attempt++;
            prefix = originalPrefix + '_' + attempt;
        }

        const existingPrefixes = UserLibraryStorage.getUserLibraryPrefixes();
        if (existingPrefixes.includes(prefix)) {
            const ok = await ConfirmDialog.show(
                getString('lib_overwrite_title'),
                getString('lib_overwrite_msg').replace('{0}', prefix),
            );
            if (!ok) return;
        }

        this.circuitPanel.loadLibraryString(content, prefix);
        this.libraryModel.forceUpdate();

        const libName = LibUtils.getLibName(this.libraryModel.getAllMacros(), prefix) ?? prefix;

        try {
            UserLibraryStorage.saveUserLibrary(prefix, this.libraryModel.getAllMacros(), libName);
        } catch (e) {
            alert(getString('StorageError'));
            console.error(e);
            return;
        }

        this.macroPicker.refresh(this.libraryModel);
        console.log(`Imported library "${libName}" (prefix: ${prefix}) from ${fileName}`);
    }

    private async handleMacroPickerContextAction(
        action: ContextMenuAction,
        node: Library | Category | MacroDesc,
    ): Promise<void> {
        switch (action) {
            case 'rename': {
                const name =
                    node instanceof MacroDesc
                        ? node.name
                        : node instanceof Category
                          ? node.getName()
                          : node.getName();
                const newName = await PromptDialog.show(
                    getString('Rename'),
                    node instanceof MacroDesc
                        ? getString('new_macro_name')
                        : node instanceof Category
                          ? getString('new_category_name')
                          : getString('new_library_name'),
                    name,
                    (v) => (v.trim().length === 0 ? getString('name_empty') : null),
                );
                if (newName !== null && newName !== name) {
                    try {
                        this.libraryModel.rename(node, newName);
                        this.macroPicker.refresh(this.libraryModel);
                    } catch (ex: any) {
                        alert(ex.message);
                    }
                }
                break;
            }
            case 'remove': {
                let confirmMsg: string;
                if (node instanceof MacroDesc)
                    confirmMsg = `${getString('remove_macro_confirm')} ${node.name}?`;
                else if (node instanceof Category)
                    confirmMsg = `${getString('remove_category_confirm')} ${node.getName()}?`;
                else confirmMsg = `${getString('remove_library_confirm')} ${node.getName()}?`;
                const ok = await ConfirmDialog.show(getString('Delete'), confirmMsg);
                if (ok) {
                    try {
                        this.libraryModel.remove(node);
                        this.macroPicker.refresh(this.libraryModel);
                    } catch (ex: any) {
                        alert(ex.message);
                    }
                }
                break;
            }
            case 'changeKey': {
                if (!(node instanceof MacroDesc)) return;
                const oldKey = LibraryModel.getPlainMacroKey(node);
                const ok = await ConfirmDialog.show(
                    getString('RenKey'),
                    getString('ChangeKeyWarning'),
                );
                if (!ok) return;
                const newKey = await PromptDialog.show(
                    getString('RenKey'),
                    getString('Key'),
                    oldKey,
                    (v) => {
                        if (v.trim().length === 0) return getString('key_empty');
                        if (LibUtils.checkKeyInvalidChars(v)) return getString('SpaceKey');
                        const fullKey = `${node.filename}.${v}`.toLowerCase();
                        if (
                            LibUtils.checkKeyDuplicate(
                                this.libraryModel.getAllMacros(),
                                node.filename,
                                fullKey,
                            )
                        )
                            return getString('key_exists');
                        return null;
                    },
                );
                if (newKey !== null && newKey !== oldKey) {
                    try {
                        this.libraryModel.changeKey(node, newKey);
                        this.macroPicker.refresh(this.libraryModel);
                    } catch (ex: any) {
                        alert(ex.message);
                    }
                }
                break;
            }
            case 'copy': {
                this.macroPicker.copyTarget = node;
                break;
            }
            case 'paste': {
                if (!this.macroPicker.copyTarget) return;
                const dest = node;
                const src = this.macroPicker.copyTarget;
                if (src instanceof MacroDesc && dest instanceof Category) {
                    this.libraryModel.copy(src, dest);
                    this.macroPicker.refresh(this.libraryModel);
                } else if (src instanceof Category && dest instanceof Library) {
                    this.libraryModel.copy(src, dest);
                    this.macroPicker.refresh(this.libraryModel);
                }
                this.macroPicker.copyTarget = null;
                break;
            }
        }
    }

    private wirePropertiesPanel(): void {
        this.circuitPanel.onPropertiesRequested = (prim) => {
            this.propertiesController.show(prim);
        };

        this.circuitPanel.onBatchPropertiesRequested = (prims) => {
            this.propertiesController.showBatch(prims);
        };

        this.circuitPanel.onTextEditRequested = (prim, _sx, _sy) => {
            this.propertiesController.show(prim);
        };

        this.circuitPanel.onExistingTextEditRequested = (prim) => {
            this.propertiesController.show(prim);
        };

        this.circuitPanel.onCancelTextEdit = () => {
            this.propertiesSidebar.style.display = 'none';
        };

        this.circuitPanel.onSelectionCleared = () => {
            this.propertiesSidebar.style.display = 'none';
        };
    }

    // ─── Font discovery (used by PropertiesPanelController) ───────────────────

    private async getAvailableFontFamilies(): Promise<string[]> {
        const fallbackFonts = [
            'Arial',
            'Arial Black',
            'Arial Narrow',
            'Calibri',
            'Cambria',
            'Candara',
            'Century Gothic',
            'Comic Sans MS',
            'Consolas',
            'Constantia',
            'Corbel',
            'Courier New',
            'DejaVu Sans',
            'DejaVu Sans Mono',
            'DejaVu Serif',
            'Franklin Gothic Medium',
            'Garamond',
            'Georgia',
            'Helvetica',
            'Helvetica Neue',
            'Impact',
            'Lucida Console',
            'Lucida Sans Unicode',
            'Menlo',
            'Microsoft Sans Serif',
            'Monaco',
            'Monospace',
            'Palatino Linotype',
            'Sans-serif',
            'Segoe UI',
            'Segoe UI Mono',
            'Serif',
            'Tahoma',
            'Times New Roman',
            'Trebuchet MS',
            'Verdana',
            'Webdings',
            'Wingdings',
        ];

        try {
            // Font Access API is experimental (https://developer.mozilla.org/en-US/docs/Web/API/Local_Font_Access_API)
            if ('queryLocalFonts' in navigator) {
                const fontData = await (navigator as any).queryLocalFonts();
                const families = new Set<string>();
                for (const fd of fontData) families.add(fd.family);
                for (const f of fallbackFonts) families.add(f);
                return [...families].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
            }
        } catch {
            /* permission denied — fall through */
        }

        return fallbackFonts;
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
