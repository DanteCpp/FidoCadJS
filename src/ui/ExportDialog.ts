/**
 * @file ExportDialog.ts
 * @author Dante Loi
 * @date 2026-05-09
 * @brief Export dialog — format selection, filename, and options.
 *        Mirrors FidoCadJ's DialogExport.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { CircuitPanel } from '../circuit/CircuitPanel.js';

/** Supported export formats */
export type ExportFormat = 'png' | 'svg' | 'pgf' | 'tikz';

/** User selection returned after the dialog is accepted */
export interface ExportSelection {
    format: ExportFormat;
    filename: string;
}

/**
 * Show the export dialog and return the user's selection, or null if cancelled.
 *
 * Mirrors FidoCadJ's DialogExport which offers a combobox for format
 * (PNG, JPG, SVG, EPS, PGF, PDF, Eagle SCR, gEDA PCB), filename field,
 * and resolution/anti-alias/B&W/split-layers controls.
 *
 * Currently implemented formats: PNG, SVG, PGF, TikZ.
 */
export function showExportDialog(_panel: CircuitPanel): Promise<ExportSelection | null> {
    // Build the dialog
    const overlay = document.createElement('div');
    overlay.style.cssText =
        'position: fixed; inset: 0; background: rgba(0,0,0,0.35); ' +
        'z-index: 10000; display: flex; align-items: center; justify-content: center;';

    const box = document.createElement('div');
    box.style.cssText =
        'background: white; border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.25); ' +
        'padding: 24px; min-width: 420px; max-width: 520px; font-family: sans-serif; font-size: 13px;';

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Export drawing';
    title.style.cssText = 'margin: 0 0 16px 0; font-size: 16px; font-weight: 600;';
    box.appendChild(title);

    // ---- File format ----
    const fmtRow = document.createElement('div');
    fmtRow.style.cssText = 'display: flex; align-items: center; gap: 12px; margin-bottom: 14px;';

    const fmtLabel = document.createElement('span');
    fmtLabel.textContent = 'File format:';
    fmtLabel.style.cssText = 'min-width: 90px; font-weight: 500;';
    fmtRow.appendChild(fmtLabel);

    const fmtSelect = document.createElement('select');
    fmtSelect.style.cssText =
        'flex: 1; padding: 6px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;';

    const formats: Array<{ value: ExportFormat; text: string }> = [
        { value: 'png', text: 'PNG (Bitmap)' },
        { value: 'svg', text: 'SVG (Vector, Scalable Vector Graphic)' },
        { value: 'pgf', text: 'PGF (Vector, PGF packet for LaTeX)' },
        { value: 'tikz', text: 'TikZ (Vector, TikZ picture for LaTeX)' },
    ];
    for (const f of formats) {
        const opt = document.createElement('option');
        opt.value = f.value;
        opt.textContent = f.text;
        fmtSelect.appendChild(opt);
    }
    fmtRow.appendChild(fmtSelect);

    box.appendChild(fmtRow);

    // ---- Filename ----
    const nameRow = document.createElement('div');
    nameRow.style.cssText = 'display: flex; align-items: center; gap: 12px; margin-bottom: 14px;';

    const nameLabel = document.createElement('span');
    nameLabel.textContent = 'File name:';
    nameLabel.style.cssText = 'min-width: 90px; font-weight: 500;';
    nameRow.appendChild(nameLabel);

    const extensionByFormat: Record<ExportFormat, string> = {
        'png': '.png',
        'svg': '.svg',
        'pgf': '.pgf',
        'tikz': '.tex',
    };

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = 'circuit' + extensionByFormat[fmtSelect.value as ExportFormat];
    nameInput.style.cssText =
        'flex: 1; padding: 6px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;';
    nameRow.appendChild(nameInput);
    box.appendChild(nameRow);

    // Auto-update extension when format changes
    fmtSelect.addEventListener('change', () => {
        const fmt = fmtSelect.value as ExportFormat;
        const base = nameInput.value.replace(/\.[^.]+$/, '');
        nameInput.value = base + extensionByFormat[fmt];
    });

    // ---- Buttons ----
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText =
        'padding: 8px 18px; border: 1px solid #ccc; border-radius: 4px; ' +
        'background: #f0f0f0; cursor: pointer; font-size: 13px;';
    btnRow.appendChild(cancelBtn);

    const okBtn = document.createElement('button');
    okBtn.textContent = 'Export';
    okBtn.style.cssText =
        'padding: 8px 18px; border: none; border-radius: 4px; ' +
        'background: #007bff; color: white; cursor: pointer; font-size: 13px; font-weight: 500;';
    btnRow.appendChild(okBtn);

    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Focus the filename input and select all
    requestAnimationFrame(() => {
        nameInput.focus();
        nameInput.select();
    });

    return new Promise((resolve) => {
        const cleanup = () => {
            document.body.removeChild(overlay);
        };

        cancelBtn.addEventListener('click', () => {
            cleanup();
            resolve(null);
        });

        okBtn.addEventListener('click', () => {
            cleanup();
            resolve({
                format: fmtSelect.value as ExportFormat,
                filename: nameInput.value.trim() || 'circuit',
            });
        });

        // Close on Enter in the filename field
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                cleanup();
                resolve({
                    format: fmtSelect.value as ExportFormat,
                    filename: nameInput.value.trim() || 'circuit',
                });
            } else if (e.key === 'Escape') {
                cleanup();
                resolve(null);
            }
        });

        // Close on backdrop click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                cleanup();
                resolve(null);
            }
        });

        // Close on Escape anywhere
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                cleanup();
                resolve(null);
                document.removeEventListener('keydown', onKeyDown);
            }
        };
        document.addEventListener('keydown', onKeyDown);
    });
}

/**
 * Execute the export based on user selection.
 * Creates a Blob, triggers a download, or for PNG renders the canvas.
 */
export function executeExport(panel: CircuitPanel, selection: ExportSelection): void {
    const { format, filename } = selection;

    switch (format) {
        case 'png':
            exportPNG(panel, filename);
            break;
        case 'svg':
            exportSVG(panel, filename);
            break;
        case 'pgf':
            exportPGF(panel, filename);
            break;
        case 'tikz':
            exportTikZ(panel, filename);
            break;
    }
}

function exportSVG(panel: CircuitPanel, filename: string): void {
    const svgText = panel.exportSVG();
    downloadBlob(svgText, 'image/svg+xml', ensureExt(filename, '.svg'));
}

function exportPGF(panel: CircuitPanel, filename: string): void {
    const pgfText = panel.exportPGF();
    downloadBlob(pgfText, 'text/plain', ensureExt(filename, '.pgf'));
}

function exportTikZ(panel: CircuitPanel, filename: string): void {
    const tikzText = panel.exportTikZ();
    downloadBlob(tikzText, 'text/plain', ensureExt(filename, '.tex'));
}

function exportPNG(panel: CircuitPanel, filename: string): void {
    // For PNG, we render the canvas to a blob via toBlob
    const canvas = panel.getCanvasElement();

    canvas.toBlob((blob) => {
        if (!blob) {
            console.error('Failed to create PNG blob');
            return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = ensureExt(filename, '.png');
        a.click();
        URL.revokeObjectURL(url);
    }, 'image/png');
}

function downloadBlob(content: string, mimeType: string, filename: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function ensureExt(filename: string, ext: string): string {
    return filename.endsWith(ext) ? filename : filename + ext;
}
