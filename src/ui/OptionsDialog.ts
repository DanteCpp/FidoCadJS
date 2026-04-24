/**
 * @file OptionsDialog.ts
 * @author Dante Loi
 * @date 2026-04-23
 * @brief Tabbed options/preferences dialog for FidoCadTS
 */

import type { CircuitPanel } from '../circuit/CircuitPanel.js';
import { SettingsManager, type AppSettings } from '../settings/SettingsManager.js';

type TabId = 'drawing' | 'pcb' | 'appearance';

export function showOptionsDialog(panel: CircuitPanel): void {
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
    title.textContent = 'Options';
    title.style.cssText = 'margin: 0; font-size: 14px; font-weight: bold;';
    titleBar.appendChild(title);
    dialog.appendChild(titleBar);

    // ── Tab bar ───────────────────────────────────────────────────────────────
    const tabBar = document.createElement('div');
    tabBar.style.cssText =
        'display: flex; border-bottom: 1px solid #ccc; background: #f0f0f0;';

    const tabs: { id: TabId; label: string }[] = [
        { id: 'drawing', label: 'Drawing' },
        { id: 'pcb', label: 'PCB' },
        { id: 'appearance', label: 'Appearance' },
    ];

    // ── Tab content panels ────────────────────────────────────────────────────
    const contentArea = document.createElement('div');
    contentArea.style.cssText = 'padding: 16px; min-height: 220px;';

    // ── Form state (mirrors in-progress edits) ────────────────────────────────
    let draft: AppSettings = { ...s };

    const panels: Record<TabId, HTMLElement> = {
        drawing: buildDrawingPanel(draft),
        pcb: buildPCBPanel(draft),
        appearance: buildAppearancePanel(draft),
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
    activateTab('drawing');

    // ── Button row ─────────────────────────────────────────────────────────────
    const buttonRow = document.createElement('div');
    buttonRow.style.cssText =
        'display: flex; gap: 8px; padding: 12px 16px; justify-content: flex-end; ' +
        'border-top: 1px solid #ddd; background: #f5f5f5;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText =
        'padding: 6px 16px; background: #6c757d; color: white; border: none; ' +
        'border-radius: 4px; cursor: pointer; font-size: 12px;';
    cancelBtn.addEventListener('click', () => dialog.close());

    const okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    okBtn.style.cssText =
        'padding: 6px 16px; background: #007bff; color: white; border: none; ' +
        'border-radius: 4px; cursor: pointer; font-size: 12px;';
    okBtn.addEventListener('click', () => {
        collectDraft(draft, panels);
        mgr.updateSettings(draft);
        mgr.applyToPanel(panel);
        panel.render();
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
    p.appendChild(numRow('Grid X step', 'gridSizeX', s.gridSizeX, 1, 1));
    p.appendChild(numRow('Grid Y step', 'gridSizeY', s.gridSizeY, 1, 1));
    p.appendChild(checkRow('Snap to grid', 'snapToGrid', s.snapToGrid));
    p.appendChild(checkRow('Anti-aliasing', 'antiAlias', s.antiAlias));
    p.appendChild(numRow('Stroke size', 'strokeSize', s.strokeSize, 0.1, 0.1));
    p.appendChild(numRow('Connection size', 'connectionSize', s.connectionSize, 0.1, 0.1));
    return p;
}

function buildPCBPanel(s: AppSettings): HTMLElement {
    const p = document.createElement('div');
    p.appendChild(numRow('Line width', 'pcbLineWidth', s.pcbLineWidth, 1, 1));
    p.appendChild(numRow('Pad width', 'pcbPadWidth', s.pcbPadWidth, 1, 1));
    p.appendChild(numRow('Pad height', 'pcbPadHeight', s.pcbPadHeight, 1, 1));
    p.appendChild(numRow('Drill diameter', 'pcbPadDrill', s.pcbPadDrill, 1, 1));
    return p;
}

function buildAppearancePanel(s: AppSettings): HTMLElement {
    const p = document.createElement('div');
    p.appendChild(colorRow('Background', 'backgroundColor', s.backgroundColor));
    p.appendChild(colorRow('Grid color', 'gridColor', s.gridColor));
    p.appendChild(colorRow('Selection L→R', 'selectionLTRColor', s.selectionLTRColor));
    p.appendChild(colorRow('Selection R→L', 'selectionRTLColor', s.selectionRTLColor));
    return p;
}

// ── Row helpers ───────────────────────────────────────────────────────────────

function numRow(label: string, name: string, value: number, step: number, min: number): HTMLElement {
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
    input.style.cssText = 'width: 40px; height: 26px; border: 1px solid #ccc; border-radius: 3px; cursor: pointer; padding: 1px;';

    row.appendChild(lbl);
    row.appendChild(input);
    return row;
}

// ── Collect current values from all panels into draft ─────────────────────────

function collectDraft(draft: AppSettings, panels: Record<TabId, HTMLElement>): void {
    const d = draft as unknown as Record<string, unknown>;
    for (const panel of Object.values(panels)) {
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
