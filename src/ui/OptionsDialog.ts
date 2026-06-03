/**
 * @file OptionsDialog.ts
 * @author Dante Loi
 * @date 2026-04-23
 * @brief Tabbed options/preferences dialog for FidoCadTS
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import type { EditorFacade } from '../circuit/EditorFacade.js';
import { SettingsManager, type AppSettings } from '../settings/SettingsManager.js';
import { LibraryFolder } from '../librarymodel/LibraryFolder.js';
import { UserLibraryStorage } from '../librarymodel/UserLibraryStorage.js';
import { Toast } from './Toast.js';
import {
    getString,
    getCurrentLocale,
    setLocale,
    SUPPORTED_LOCALES,
    LOCALE_LABELS,
} from '../i18n/i18n.js';

type TabId = 'drawing' | 'pcb' | 'appearance' | 'libraries' | 'language';

export function showOptionsDialog(
    panel: EditorFacade,
    onLibrariesChanged?: () => void,
    initialTab: TabId = 'drawing',
): void {
    const mgr = SettingsManager.getInstance();
    const s = mgr.getSettings();

    const dialog = document.createElement('dialog');
    dialog.style.cssText =
        'padding: 0; border: 1px solid #ccc; border-radius: 4px; ' +
        'box-shadow: 0 4px 8px rgba(0,0,0,0.2); min-width: 420px; ' +
        'font-family: sans-serif; font-size: 12px; overflow: hidden;';

    // ── Title bar ─────────────────────────────────────────────────────────────
    const titleBar = document.createElement('div');
    titleBar.style.cssText =
        'padding: 12px 16px 8px; border-bottom: 1px solid #ddd; background: #f5f5f5;';
    const title = document.createElement('h3');
    title.textContent = getString('Cir_opt_t');
    title.style.cssText = 'margin: 0; font-size: 14px; font-weight: bold;';
    titleBar.appendChild(title);
    dialog.appendChild(titleBar);

    // ── Tab bar ───────────────────────────────────────────────────────────────
    const tabBar = document.createElement('div');
    tabBar.style.cssText = 'display: flex; border-bottom: 1px solid #ccc; background: #f0f0f0;';

    const tabs: { id: TabId; label: string }[] = [
        { id: 'drawing', label: getString('Drawing') },
        { id: 'pcb', label: 'PCB' },
        { id: 'appearance', label: getString('Theme_management') },
        { id: 'libraries', label: getString('Libraries_tab') },
        { id: 'language', label: getString('Languages_tab') },
    ];

    // ── Tab content panels ────────────────────────────────────────────────────
    const contentArea = document.createElement('div');
    contentArea.style.cssText = 'padding: 16px; min-height: 220px;';

    // ── Form state (mirrors in-progress edits) ────────────────────────────────
    const draft: AppSettings = { ...s };

    const panels: Record<TabId, HTMLElement> = {
        drawing: buildDrawingPanel(draft),
        pcb: buildPCBPanel(draft),
        appearance: buildAppearancePanel(draft),
        libraries: buildLibrariesPanel(onLibrariesChanged),
        language: buildLanguagePanel(),
    };

    for (const p of Object.values(panels)) {
        p.style.display = 'none';
        contentArea.appendChild(p);
    }

    let activeTab: TabId = 'drawing';
    const tabBtns: Partial<Record<TabId, HTMLElement>> = {};

    function activateTab(id: TabId): void {
        activeTab = id;
        for (const t of tabs) {
            const btn = tabBtns[t.id]!;
            const isActive = t.id === id;
            btn.style.background = isActive ? '#ffffff' : '#f0f0f0';
            btn.style.fontWeight = isActive ? 'bold' : 'normal';
            btn.style.borderBottom = isActive ? '2px solid #007bff' : '2px solid transparent';
            panels[t.id].style.display = isActive ? 'block' : 'none';
        }
    }

    for (const t of tabs) {
        const btn = document.createElement('button');
        btn.textContent = t.label;
        btn.style.cssText =
            'padding: 8px 16px; border: none; background: #f0f0f0; cursor: pointer; ' +
            'font-size: 12px; font-family: sans-serif; border-bottom: 2px solid transparent;';
        btn.addEventListener('click', () => activateTab(t.id));
        btn.addEventListener('mouseenter', () => {
            if (activeTab !== t.id) btn.style.background = '#e8e8e8';
        });
        btn.addEventListener('mouseleave', () => {
            if (activeTab !== t.id) btn.style.background = '#f0f0f0';
        });
        tabBar.appendChild(btn);
        tabBtns[t.id] = btn;
    }

    dialog.appendChild(tabBar);
    dialog.appendChild(contentArea);
    activateTab(initialTab);

    // ── Button row ─────────────────────────────────────────────────────────────
    const buttonRow = document.createElement('div');
    buttonRow.style.cssText =
        'display: flex; gap: 8px; padding: 12px 16px; justify-content: flex-end; ' +
        'border-top: 1px solid #ddd; background: #f5f5f5;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = getString('Cancel_btn');
    cancelBtn.style.cssText =
        'padding: 6px 16px; background: #6c757d; color: white; border: none; ' +
        'border-radius: 4px; cursor: pointer; font-size: 12px;';
    cancelBtn.addEventListener('click', () => dialog.close());

    const okBtn = document.createElement('button');
    okBtn.textContent = getString('Ok_btn');
    okBtn.style.cssText =
        'padding: 6px 16px; background: #007bff; color: white; border: none; ' +
        'border-radius: 4px; cursor: pointer; font-size: 12px;';
    okBtn.addEventListener('click', () => {
        collectDraft(draft, panels);
        mgr.updateSettings(draft);
        mgr.applyToPanel(panel);
        panel.render();
        // Apply locale change if user picked a different one in the language tab.
        const select = panels.language.querySelector<HTMLSelectElement>('select[name="locale"]');
        if (select && select.value !== getCurrentLocale()) {
            void setLocale(select.value);
        }
        dialog.close();
    });

    buttonRow.appendChild(cancelBtn);
    buttonRow.appendChild(okBtn);
    dialog.appendChild(buttonRow);

    document.body.appendChild(dialog);
    dialog.showModal();
    dialog.addEventListener('close', () => document.body.removeChild(dialog));
}

// ── Panel builders ────────────────────────────────────────────────────────────

function buildDrawingPanel(s: AppSettings): HTMLElement {
    const p = document.createElement('div');
    p.appendChild(numRow(getString('Grid_x_step'), 'gridSizeX', s.gridSizeX, 1, 1));
    p.appendChild(numRow(getString('Grid_y_step'), 'gridSizeY', s.gridSizeY, 1, 1));
    p.appendChild(checkRow(getString('SnapToGrid'), 'snapToGrid', s.snapToGrid));
    p.appendChild(checkRow(getString('Anti_aliasing'), 'antiAlias', s.antiAlias));
    p.appendChild(numRow(getString('stroke_size_straight'), 'strokeSize', s.strokeSize, 0.1, 0.1));
    p.appendChild(
        numRow(getString('connection_size'), 'connectionSize', s.connectionSize, 0.1, 0.1),
    );
    return p;
}

function buildPCBPanel(s: AppSettings): HTMLElement {
    const p = document.createElement('div');
    p.appendChild(numRow(getString('pcbline_width'), 'pcbLineWidth', s.pcbLineWidth, 1, 1));
    p.appendChild(numRow(getString('pcbpad_width'), 'pcbPadWidth', s.pcbPadWidth, 1, 1));
    p.appendChild(numRow(getString('pcbpad_height'), 'pcbPadHeight', s.pcbPadHeight, 1, 1));
    p.appendChild(numRow(getString('pcbpad_intw'), 'pcbPadDrill', s.pcbPadDrill, 1, 1));
    return p;
}

function buildAppearancePanel(s: AppSettings): HTMLElement {
    const p = document.createElement('div');
    p.appendChild(colorRow(getString('Circuit_backgroud'), 'backgroundColor', s.backgroundColor));
    p.appendChild(colorRow(getString('Grid_dots_color'), 'gridColor', s.gridColor));
    p.appendChild(colorRow(getString('Select_LR_color'), 'selectionLTRColor', s.selectionLTRColor));
    p.appendChild(colorRow(getString('Select_RL_color'), 'selectionRTLColor', s.selectionRTLColor));
    p.appendChild(document.createElement('hr'));
    p.appendChild(checkRow(getString('Render_tex'), 'renderTeX', s.renderTeX));
    return p;
}

function buildLibrariesPanel(onLibrariesChanged?: () => void): HTMLElement {
    const p = document.createElement('div');

    const info = document.createElement('p');
    info.textContent = getString('Lib_folder_info');
    info.style.cssText = 'margin: 0 0 14px 0; font-size: 11px; color: #666; line-height: 1.45;';
    p.appendChild(info);

    // Browsers without the File System Access API keep the localStorage backend.
    if (!LibraryFolder.isSupported()) {
        const warn = document.createElement('p');
        warn.textContent = getString('Lib_folder_unsupported');
        warn.style.cssText = 'margin: 0; font-size: 12px; color: #a00;';
        p.appendChild(warn);
        return p;
    }

    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; margin-bottom: 14px; gap: 8px;';

    const lbl = document.createElement('label');
    lbl.textContent = getString('Lib_storage_location');
    lbl.style.cssText = 'flex: 0 0 auto; color: #333;';

    const valueEl = document.createElement('span');
    valueEl.style.cssText =
        'flex: 1; min-width: 0; color: #111; font-weight: bold; ' +
        'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
    valueEl.textContent = getString('Lib_storage_browser');

    row.appendChild(lbl);
    row.appendChild(valueEl);
    p.appendChild(row);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 8px;';

    const chooseBtn = document.createElement('button');
    chooseBtn.textContent = getString('Lib_choose_folder');
    chooseBtn.style.cssText =
        'padding: 6px 14px; background: #007bff; color: white; border: none; ' +
        'border-radius: 4px; cursor: pointer; font-size: 12px;';

    const useBrowserBtn = document.createElement('button');
    useBrowserBtn.textContent = getString('Lib_use_browser');
    useBrowserBtn.style.cssText =
        'padding: 6px 14px; background: #6c757d; color: white; border: none; ' +
        'border-radius: 4px; cursor: pointer; font-size: 12px; display: none;';

    const showLinked = (name: string | null): void => {
        valueEl.textContent = name ? name : getString('Lib_storage_browser');
        useBrowserBtn.style.display = name ? 'inline-block' : 'none';
    };

    chooseBtn.addEventListener('click', () => {
        void (async () => {
            chooseBtn.disabled = true;
            try {
                const handle = await LibraryFolder.chooseDirectory();
                if (!handle) return;
                await UserLibraryStorage.linkFolderAndMerge();
                showLinked(handle.name);
                onLibrariesChanged?.();
                Toast.show(getString('Lib_folder_linked').replace('{0}', handle.name), 'info');
            } catch (e) {
                console.error('Choosing library folder failed:', e);
                Toast.show(getString('Lib_folder_error'), 'error');
            } finally {
                chooseBtn.disabled = false;
            }
        })();
    });

    useBrowserBtn.addEventListener('click', () => {
        void (async () => {
            await LibraryFolder.unlink();
            showLinked(null);
            Toast.show(getString('Lib_use_browser_done'), 'info');
        })();
    });

    btnRow.appendChild(chooseBtn);
    btnRow.appendChild(useBrowserBtn);
    p.appendChild(btnRow);

    // Reflect the currently linked folder (if any) once IndexedDB responds.
    void LibraryFolder.getLinkedDirectoryName().then(showLinked);

    return p;
}

function buildLanguagePanel(): HTMLElement {
    const p = document.createElement('div');

    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; margin-bottom: 10px; gap: 8px;';

    const lbl = document.createElement('label');
    lbl.textContent = getString('Language_select_label');
    lbl.style.cssText = 'flex: 1; color: #333;';
    lbl.htmlFor = 'opt-locale';

    const select = document.createElement('select');
    select.id = 'opt-locale';
    select.name = 'locale';
    select.style.cssText =
        'padding: 4px 6px; border: 1px solid #ccc; border-radius: 3px; ' +
        'font-size: 12px; min-width: 160px;';
    const current = getCurrentLocale();
    for (const loc of SUPPORTED_LOCALES) {
        const opt = document.createElement('option');
        opt.value = loc;
        opt.textContent = `${LOCALE_LABELS[loc]} (${loc})`;
        if (loc === current) opt.selected = true;
        select.appendChild(opt);
    }

    row.appendChild(lbl);
    row.appendChild(select);
    p.appendChild(row);

    const info = document.createElement('p');
    info.textContent = getString('Language_restart_info');
    info.style.cssText = 'margin: 12px 0 0 0; font-size: 11px; color: #666;';
    p.appendChild(info);

    return p;
}

// ── Row helpers ───────────────────────────────────────────────────────────────

function numRow(
    label: string,
    name: string,
    value: number,
    step: number,
    min: number,
): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; margin-bottom: 10px; gap: 8px;';

    const lbl = document.createElement('label');
    lbl.textContent = label;
    lbl.style.cssText = 'flex: 1; color: #333;';
    lbl.htmlFor = `opt-${name}`;

    const input = document.createElement('input');
    input.type = 'number';
    input.id = `opt-${name}`;
    input.name = name;
    input.value = String(value);
    input.step = String(step);
    input.min = String(min);
    input.style.cssText =
        'width: 80px; padding: 4px 6px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px;';

    row.appendChild(lbl);
    row.appendChild(input);
    return row;
}

function checkRow(label: string, name: string, value: boolean): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; margin-bottom: 10px; gap: 8px;';

    const lbl = document.createElement('label');
    lbl.textContent = label;
    lbl.style.cssText = 'flex: 1; color: #333; cursor: pointer;';
    lbl.htmlFor = `opt-${name}`;

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = `opt-${name}`;
    input.name = name;
    input.checked = value;
    input.style.cssText = 'width: 14px; height: 14px; cursor: pointer;';

    row.appendChild(lbl);
    row.appendChild(input);
    return row;
}

function colorRow(label: string, name: string, value: string): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; margin-bottom: 10px; gap: 8px;';

    const lbl = document.createElement('label');
    lbl.textContent = label;
    lbl.style.cssText = 'flex: 1; color: #333; cursor: pointer;';
    lbl.htmlFor = `opt-${name}`;

    const input = document.createElement('input');
    input.type = 'color';
    input.id = `opt-${name}`;
    input.name = name;
    input.value = value;
    input.style.cssText =
        'width: 40px; height: 26px; border: 1px solid #ccc; border-radius: 3px; cursor: pointer; padding: 1px;';

    row.appendChild(lbl);
    row.appendChild(input);
    return row;
}

// ── Collect current values from all panels into draft ─────────────────────────

function collectDraft(draft: AppSettings, panels: Record<TabId, HTMLElement>): void {
    const d = draft as unknown as Record<string, unknown>;
    // Skip the language panel — its <select> is applied separately by the
    // dialog's OK handler.
    for (const [tabId, panel] of Object.entries(panels)) {
        if (tabId === 'language') continue;
        for (const input of panel.querySelectorAll<HTMLInputElement>('input')) {
            const key = input.name;
            if (input.type === 'checkbox') {
                d[key] = input.checked;
            } else if (input.type === 'color') {
                d[key] = input.value;
            } else {
                const n = parseFloat(input.value);
                if (!isNaN(n)) d[key] = n;
            }
        }
    }
}
