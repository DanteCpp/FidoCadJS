/**
 * @file DialogLayer.ts
 * @author Dante Loi
 * @date 2026-05-15
 * @brief Layer edit dialog — edit per-layer color, name, alpha, and visibility.
 *        Mirrors FidoCadJ's DialogLayer.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import type { EditorFacade } from '../circuit/EditorFacade.js';

/**
 * Show the layer edit dialog.
 * Returns a Promise that resolves when the dialog is closed (after changes are committed).
 */
export function showLayerDialog(panel: EditorFacade): Promise<void> {
    const layers = panel.getLayers();

    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText =
            'position: fixed; inset: 0; background: rgba(0,0,0,0.35); ' +
            'z-index: 10000; display: flex; align-items: center; justify-content: center;';

        const box = document.createElement('div');
        box.style.cssText =
            'background: white; border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.25); ' +
            'padding: 24px; min-width: 480px; max-width: 560px; max-height: 80vh; overflow-y: auto; ' +
            'font-family: sans-serif; font-size: 13px;';

        const title = document.createElement('h2');
        title.textContent = 'Layer Options';
        title.style.cssText = 'margin: 0 0 16px 0; font-size: 16px; font-weight: 600;';
        box.appendChild(title);

        // Build one row per layer
        const rows: Array<{
            visCheck: HTMLInputElement;
            colorInput: HTMLInputElement;
            nameInput: HTMLInputElement;
            alphaSlider: HTMLInputElement;
            alphaValue: HTMLSpanElement;
        }> = [];

        for (let i = 0; i < 16; i++) {
            const layer = layers[i]!;
            const color = layer.getColor();
            const rgb = color ? color.getRGB() : 0;
            const hex = '#' + rgb.toString(16).padStart(6, '0');

            const row = document.createElement('div');
            row.style.cssText =
                'display: flex; align-items: center; gap: 8px; margin-bottom: 6px; padding: 4px 0; ' +
                'border-bottom: 1px solid #eee;';

            // Visibility checkbox
            const visCheck = document.createElement('input');
            visCheck.type = 'checkbox';
            visCheck.checked = layer.isVisible();
            visCheck.title = 'Visible';
            row.appendChild(visCheck);

            // Layer index
            const idx = document.createElement('span');
            idx.textContent = String(i);
            idx.style.cssText = 'min-width: 20px; text-align: right; font-size: 11px; color: #888;';
            row.appendChild(idx);

            // Color picker
            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.value = hex;
            colorInput.style.cssText =
                'width: 28px; height: 20px; border: none; padding: 0; cursor: pointer;';
            row.appendChild(colorInput);

            // Name
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = layer.getDescription();
            nameInput.style.cssText =
                'flex: 1; padding: 2px 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px;';
            row.appendChild(nameInput);

            // Alpha slider
            const alphaSlider = document.createElement('input');
            alphaSlider.type = 'range';
            alphaSlider.min = '0';
            alphaSlider.max = '255';
            alphaSlider.value = String(Math.round(layer.getAlpha() * 255));
            alphaSlider.style.cssText = 'width: 80px;';
            row.appendChild(alphaSlider);

            const alphaValue = document.createElement('span');
            alphaValue.textContent = String(Math.round(layer.getAlpha() * 255));
            alphaValue.style.cssText = 'min-width: 24px; font-size: 11px;';
            row.appendChild(alphaValue);

            alphaSlider.addEventListener('input', () => {
                alphaValue.textContent = alphaSlider.value;
            });

            rows.push({ visCheck, colorInput, nameInput, alphaSlider, alphaValue });
            box.appendChild(row);
        }

        // Buttons
        const btnRow = document.createElement('div');
        btnRow.style.cssText =
            'display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText =
            'padding: 8px 18px; border: 1px solid #ccc; border-radius: 4px; ' +
            'background: #f0f0f0; cursor: pointer; font-size: 13px;';
        btnRow.appendChild(cancelBtn);

        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        okBtn.style.cssText =
            'padding: 8px 18px; border: none; border-radius: 4px; ' +
            'background: #007bff; color: white; cursor: pointer; font-size: 13px; font-weight: 500;';
        btnRow.appendChild(okBtn);

        box.appendChild(btnRow);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const dialogAbort = new AbortController();

        const cleanup = () => {
            dialogAbort.abort();
            document.body.removeChild(overlay);
        };

        const applyChanges = () => {
            for (let i = 0; i < 16; i++) {
                const r = rows[i]!;
                const layer = layers[i]!;
                const color = layer.getColor();
                if (color) {
                    const hex = r.colorInput.value.replace('#', '');
                    color.setRGB(parseInt(hex, 16));
                }
                layer.setDescription(r.nameInput.value);
                layer.setAlpha(Number(r.alphaSlider.value) / 255);
                layer.setVisible(r.visCheck.checked);
                layer.setModified(true);
            }
            panel.render();
        };

        cancelBtn.addEventListener(
            'click',
            () => {
                cleanup();
                resolve();
            },
            { signal: dialogAbort.signal },
        );
        okBtn.addEventListener(
            'click',
            () => {
                applyChanges();
                cleanup();
                resolve();
            },
            { signal: dialogAbort.signal },
        );

        // Escape closes
        document.addEventListener(
            'keydown',
            (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    resolve();
                }
            },
            { signal: dialogAbort.signal },
        );

        overlay.addEventListener(
            'click',
            (e) => {
                if (e.target === overlay) {
                    cleanup();
                    resolve();
                }
            },
            { signal: dialogAbort.signal },
        );
    });
}
