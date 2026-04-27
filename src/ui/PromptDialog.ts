/**
 * @file PromptDialog.ts
 * @author Dante Loi
 * @date 2026-04-27
 * @brief Reusable modal text-input dialog for rename and other single-value prompts.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

export class PromptDialog {
    /**
     * Show a modal prompt dialog.
     * @param title Dialog title
     * @param message Prompt message above the input
     * @param defaultValue Initial value of the text input
     * @param validator Optional: returns error string if invalid, or null if valid
     * @returns The entered text, or null if cancelled
     */
    static show(
        title: string,
        message: string,
        defaultValue: string = '',
        validator?: (value: string) => string | null
    ): Promise<string | null> {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText =
                'position:fixed; top:0; left:0; right:0; bottom:0; z-index:10001; ' +
                'background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; ' +
                'font-family:sans-serif; font-size:12px;';

            const dialog = document.createElement('div');
            dialog.style.cssText =
                'background:white; border-radius:6px; box-shadow:0 4px 24px rgba(0,0,0,0.3); ' +
                'min-width:340px; max-width:480px; display:flex; flex-direction:column;';

            dialog.innerHTML =
                `<div style="padding:10px 16px; background:#f0f0f0; border-bottom:1px solid #ddd; ` +
                `display:flex; align-items:center; justify-content:space-between;">` +
                `<span style="font-weight:bold; font-size:13px;">${title}</span>` +
                `<button id="promptClose" style="border:none; background:none; cursor:pointer; font-size:14px; color:#888;">✕</button>` +
                `</div>` +
                `<div style="padding:16px;">` +
                `<div style="margin-bottom:8px;">${message}</div>` +
                `<input id="promptInput" type="text" value="${defaultValue.replace(/"/g, '&quot;')}" ` +
                `style="width:100%; padding:5px 8px; font-size:12px; border:1px solid #ccc; border-radius:3px; box-sizing:border-box;">` +
                `<div id="promptError" style="color:#d00; font-size:11px; margin-top:4px; min-height:16px;"></div>` +
                `</div>` +
                `<div style="padding:12px 16px; border-top:1px solid #ddd; display:flex; justify-content:flex-end; gap:8px;">` +
                `<button id="promptCancel" style="padding:6px 16px; border:1px solid #ccc; border-radius:3px; ` +
                `background:#f5f5f5; cursor:pointer; font-size:12px;">Cancel</button>` +
                `<button id="promptOk" style="padding:6px 16px; border:1px solid #5a8fc0; border-radius:3px; ` +
                `background:#5a8fc0; color:white; cursor:pointer; font-size:12px;">OK</button>` +
                `</div>`;

            overlay.appendChild(dialog);

            const input = dialog.querySelector('#promptInput') as HTMLInputElement;
            const okBtn = dialog.querySelector('#promptOk') as HTMLButtonElement;
            const cancelBtn = dialog.querySelector('#promptCancel') as HTMLButtonElement;
            const closeBtn = dialog.querySelector('#promptClose') as HTMLButtonElement;
            const errorEl = dialog.querySelector('#promptError') as HTMLElement;

            const runValidation = (): boolean => {
                if (!validator) { okBtn.disabled = false; return true; }
                const err = validator(input.value);
                if (err) {
                    errorEl.textContent = err;
                    okBtn.disabled = true;
                    return false;
                }
                errorEl.textContent = '';
                okBtn.disabled = false;
                return true;
            };

            const cleanup = (): void => { overlay.remove(); };
            const confirm = (): void => {
                if (runValidation()) { cleanup(); resolve(input.value); }
            };

            input.addEventListener('input', runValidation);
            okBtn.addEventListener('click', confirm);
            cancelBtn.addEventListener('click', () => { cleanup(); resolve(null); });
            closeBtn.addEventListener('click', () => { cleanup(); resolve(null); });

            overlay.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Escape') { cleanup(); resolve(null); }
                if (e.key === 'Enter' && !okBtn.disabled) confirm();
            });

            document.body.appendChild(overlay);
            input.focus();
            input.select();
            runValidation();
        });
    }
}
