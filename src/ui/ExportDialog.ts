/**
 * @file ExportDialog.ts
 * @author Dante Loi
 * @date 2026-05-09
 * @brief Export dialog — format selection, filename, and options.
 *        Mirrors FidoCadJ's DialogExport.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import type { EditorFacade } from '../circuit/EditorFacade.js';
import type { ExportBitmapOptions } from '../export/ExportBitmapOptions.js';
import { defaultBitmapOptions, DPI_PRESETS } from '../export/ExportBitmapOptions.js';
import { getString } from '../i18n/i18n.js';

/** Supported export formats */
export type ExportFormat = 'png' | 'jpg' | 'svg' | 'pgf' | 'tikz';

/** User selection returned after the dialog is accepted */
export interface ExportSelection {
    format: ExportFormat;
    filename: string;
    bitmapOptions: ExportBitmapOptions;
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
export function showExportDialog(_panel: EditorFacade): Promise<ExportSelection | null> {
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
    title.textContent = getString('Circ_exp_t');
    title.style.cssText = 'margin: 0 0 16px 0; font-size: 16px; font-weight: 600;';
    box.appendChild(title);

    // ---- File format ----
    const fmtRow = document.createElement('div');
    fmtRow.style.cssText = 'display: flex; align-items: center; gap: 12px; margin-bottom: 14px;';

    const fmtLabel = document.createElement('span');
    fmtLabel.textContent = getString('File_format');
    fmtLabel.style.cssText = 'min-width: 90px; font-weight: 500;';
    fmtRow.appendChild(fmtLabel);

    const fmtSelect = document.createElement('select');
    fmtSelect.style.cssText =
        'flex: 1; padding: 6px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;';

    const formats: Array<{ value: ExportFormat; text: string }> = [
        { value: 'png', text: 'PNG (Bitmap)' },
        { value: 'jpg', text: 'JPG (Bitmap, lossy)' },
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

    // ---- Bitmap options section (shown only for png/jpg) ----
    const bitmapSection = document.createElement('div');
    bitmapSection.style.cssText = 'margin-bottom: 14px;';

    // DPI / pixel size mode row
    const dpiRow = document.createElement('div');
    dpiRow.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px;';
    const dpiLabel = document.createElement('span');
    dpiLabel.textContent = getString('Resolution');
    dpiLabel.style.cssText = 'min-width: 90px; font-weight: 500;';
    dpiRow.appendChild(dpiLabel);

    const dpiSelect = document.createElement('select');
    dpiSelect.style.cssText =
        'padding: 4px 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px; width: 80px;';
    for (const d of DPI_PRESETS) {
        const o = document.createElement('option');
        o.value = String(d);
        o.textContent = `${d} DPI`;
        if (d === 150) o.selected = true;
        dpiSelect.appendChild(o);
    }
    dpiRow.appendChild(dpiSelect);

    const dpiModeLabel = document.createElement('span');
    dpiModeLabel.textContent = 'DPI';
    dpiModeLabel.style.cssText = 'font-size: 12px; color: #555;';
    dpiRow.appendChild(dpiModeLabel);
    bitmapSection.appendChild(dpiRow);

    // B&W checkbox
    const bwRow = document.createElement('div');
    bwRow.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 6px;';
    bwRow.appendChild(document.createElement('span')); // spacer
    const bwCheck = document.createElement('input');
    bwCheck.type = 'checkbox';
    bwCheck.id = 'exp-bw';
    bwRow.appendChild(bwCheck);
    const bwLabel = document.createElement('label');
    bwLabel.htmlFor = 'exp-bw';
    bwLabel.textContent = getString('B_W');
    bwLabel.style.cssText = 'font-size: 12px;';
    bwRow.appendChild(bwLabel);
    bitmapSection.appendChild(bwRow);

    // Anti-alias checkbox
    const aaRow = document.createElement('div');
    aaRow.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 6px;';
    aaRow.appendChild(document.createElement('span')); // spacer
    const aaCheck = document.createElement('input');
    aaCheck.type = 'checkbox';
    aaCheck.checked = true;
    aaCheck.id = 'exp-aa';
    aaRow.appendChild(aaCheck);
    const aaLabel = document.createElement('label');
    aaLabel.htmlFor = 'exp-aa';
    aaLabel.textContent = getString('Anti_aliasing');
    aaLabel.style.cssText = 'font-size: 12px;';
    aaRow.appendChild(aaLabel);
    bitmapSection.appendChild(aaRow);

    // Split layers checkbox
    const splitRow = document.createElement('div');
    splitRow.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 6px;';
    splitRow.appendChild(document.createElement('span')); // spacer
    const splitCheck = document.createElement('input');
    splitCheck.type = 'checkbox';
    splitCheck.id = 'exp-split';
    splitRow.appendChild(splitCheck);
    const splitLabel = document.createElement('label');
    splitLabel.htmlFor = 'exp-split';
    splitLabel.textContent = getString('Split_layers_multiple_files');
    splitLabel.style.cssText = 'font-size: 12px;';
    splitRow.appendChild(splitLabel);
    bitmapSection.appendChild(splitRow);

    // JPEG quality slider (only visible for jpg)
    const qualityRow = document.createElement('div');
    qualityRow.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 6px;';
    const qualitySpacer = document.createElement('span');
    qualitySpacer.style.cssText = 'min-width: 90px;';
    qualityRow.appendChild(qualitySpacer);
    const qualityLabel = document.createElement('span');
    qualityLabel.textContent = getString('Export_jpeg_quality');
    qualityLabel.style.cssText = 'font-size: 12px; font-weight: 500;';
    qualityRow.appendChild(qualityLabel);
    const qualitySlider = document.createElement('input');
    qualitySlider.type = 'range';
    qualitySlider.min = '10';
    qualitySlider.max = '100';
    qualitySlider.value = '92';
    qualitySlider.style.cssText = 'width: 100px;';
    qualityRow.appendChild(qualitySlider);
    const qualityValue = document.createElement('span');
    qualityValue.textContent = '92%';
    qualityValue.style.cssText = 'font-size: 12px; min-width: 32px;';
    qualityRow.appendChild(qualityValue);
    qualitySlider.addEventListener('input', () => {
        qualityValue.textContent = qualitySlider.value + '%';
    });
    bitmapSection.appendChild(qualityRow);

    box.appendChild(bitmapSection);

    // Show/hide bitmap section based on format
    const updateBitmapVisibility = () => {
        const isBitmap = fmtSelect.value === 'png' || fmtSelect.value === 'jpg';
        bitmapSection.style.display = isBitmap ? '' : 'none';
        qualityRow.style.display = fmtSelect.value === 'jpg' ? '' : 'none';
    };
    fmtSelect.addEventListener('change', updateBitmapVisibility);

    // ---- Filename ----
    const nameRow = document.createElement('div');
    nameRow.style.cssText = 'display: flex; align-items: center; gap: 12px; margin-bottom: 14px;';

    const nameLabel = document.createElement('span');
    nameLabel.textContent = getString('File_name');
    nameLabel.style.cssText = 'min-width: 90px; font-weight: 500;';
    nameRow.appendChild(nameLabel);

    const extensionByFormat: Record<ExportFormat, string> = {
        png: '.png',
        jpg: '.jpg',
        svg: '.svg',
        pgf: '.pgf',
        tikz: '.tex',
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
        updateBitmapVisibility();
    });

    // Initial visibility
    updateBitmapVisibility();

    // ---- Buttons ----
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = getString('Cancel_btn');
    cancelBtn.style.cssText =
        'padding: 8px 18px; border: 1px solid #ccc; border-radius: 4px; ' +
        'background: #f0f0f0; cursor: pointer; font-size: 13px;';
    btnRow.appendChild(cancelBtn);

    const okBtn = document.createElement('button');
    okBtn.textContent = getString('Export');
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

    const dialogAbort = new AbortController();

    return new Promise((resolve) => {
        const cleanup = () => {
            dialogAbort.abort();
            document.body.removeChild(overlay);
        };

        const buildSelection = (): ExportSelection => {
            const opts = defaultBitmapOptions();
            opts.dpi = Number(dpiSelect.value) as (typeof DPI_PRESETS)[number];
            opts.blackAndWhite = bwCheck.checked;
            opts.antiAlias = aaCheck.checked;
            opts.splitLayers = splitCheck.checked;
            opts.jpegQuality = Number(qualitySlider.value) / 100;
            return {
                format: fmtSelect.value as ExportFormat,
                filename: nameInput.value.trim() || 'circuit',
                bitmapOptions: opts,
            };
        };

        cancelBtn.addEventListener(
            'click',
            () => {
                cleanup();
                resolve(null);
            },
            { signal: dialogAbort.signal },
        );

        okBtn.addEventListener(
            'click',
            () => {
                cleanup();
                resolve(buildSelection());
            },
            { signal: dialogAbort.signal },
        );

        // Close on Enter in the filename field
        nameInput.addEventListener(
            'keydown',
            (e) => {
                if (e.key === 'Enter') {
                    cleanup();
                    resolve(buildSelection());
                } else if (e.key === 'Escape') {
                    cleanup();
                    resolve(null);
                }
            },
            { signal: dialogAbort.signal },
        );

        // Close on backdrop click
        overlay.addEventListener(
            'click',
            (e) => {
                if (e.target === overlay) {
                    cleanup();
                    resolve(null);
                }
            },
            { signal: dialogAbort.signal },
        );

        // Close on Escape anywhere
        document.addEventListener(
            'keydown',
            (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(null);
                }
            },
            { signal: dialogAbort.signal },
        );
    });
}

/**
 * Execute the export based on user selection.
 * Creates a Blob, triggers a download, or for PNG renders the canvas.
 */
export function executeExport(panel: EditorFacade, selection: ExportSelection): void {
    const { format, filename, bitmapOptions } = selection;

    switch (format) {
        case 'png':
            exportPNG(panel, filename, bitmapOptions);
            break;
        case 'jpg':
            exportJPG(panel, filename, bitmapOptions);
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

function exportSVG(panel: EditorFacade, filename: string): void {
    const svgText = panel.exportSVG();
    downloadBlob(svgText, 'image/svg+xml', ensureExt(filename, '.svg'));
}

function exportPGF(panel: EditorFacade, filename: string): void {
    const pgfText = panel.exportPGF();
    downloadBlob(pgfText, 'text/plain', ensureExt(filename, '.pgf'));
}

function exportTikZ(panel: EditorFacade, filename: string): void {
    const tikzText = panel.exportTikZ();
    downloadBlob(tikzText, 'text/plain', ensureExt(filename, '.tex'));
}

async function exportPNG(
    panel: EditorFacade,
    filename: string,
    opts: ExportBitmapOptions,
): Promise<void> {
    const { exportBitmapBlobs } = await import('../export/ExportBitmap.js');
    const results = await exportBitmapBlobs(panel.getModel(), opts, 'png');
    downloadBlobs(results, filename, '.png');
}

async function exportJPG(
    panel: EditorFacade,
    filename: string,
    opts: ExportBitmapOptions,
): Promise<void> {
    const { exportBitmapBlobs } = await import('../export/ExportBitmap.js');
    const results = await exportBitmapBlobs(panel.getModel(), opts, 'jpg');
    downloadBlobs(results, filename, '.jpg');
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

import type { BitmapLayerResult } from '../export/ExportBitmap.js';

/**
 * Download one or more blob results.
 * For split-layers export, each layer gets a suffixed filename.
 */
function downloadBlobs(results: BitmapLayerResult[], baseFilename: string, ext: string): void {
    for (const r of results) {
        let fname: string;
        if (results.length > 1 && r.layerIndex >= 0) {
            // Split-layers: suffix with layer name
            const safeName = r.layerName.replace(/[^a-zA-Z0-9_-]/g, '_');
            fname = ensureExt(
                baseFilename.replace(new RegExp(ext.replace('.', '\\.') + '$'), '') +
                    '_' +
                    safeName,
                ext,
            );
        } else {
            fname = ensureExt(baseFilename, ext);
        }
        const url = URL.createObjectURL(r.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fname;
        a.click();
        URL.revokeObjectURL(url);
    }
}

function ensureExt(filename: string, ext: string): string {
    return filename.endsWith(ext) ? filename : filename + ext;
}
