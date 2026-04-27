/**
 * @file ConfirmDialog.ts
 * @author Dante Loi
 * @date 2026-04-27
 * @brief Reusable modal confirmation dialog for yes/no decisions.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

export class ConfirmDialog {
    static show(title: string, message: string, okLabel: string = 'OK', cancelLabel: string = 'Cancel'): Promise<boolean> {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText =
                'position:fixed; top:0; left:0; right:0; bottom:0; z-index:10001; ' +
                'background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; ' +
                'font-family:sans-serif; font-size:12px;';

            const dialog = document.createElement('div');
            dialog.style.cssText =
                'background:white; border-radius:6px; box-shadow:0 4px 24px rgba(0,0,0,0.3); ' +
                'min-width:320px; max-width:480px; display:flex; flex-direction:column;';

            dialog.innerHTML =
                `<div style="padding:10px 16px; background:#f0f0f0; border-bottom:1px solid #ddd; ` +
                `display:flex; align-items:center; justify-content:space-between;">` +
                `<span style="font-weight:bold; font-size:13px;">${title}</span>` +
                `<button id="confirmClose" style="border:none; background:none; cursor:pointer; font-size:14px; color:#888;">✕</button>` +
                `</div>` +
                `<div style="padding:20px 16px; line-height:1.5;">${message}</div>` +
                `<div style="padding:12px 16px; border-top:1px solid #ddd; display:flex; justify-content:flex-end; gap:8px;">` +
                `<button id="confirmCancel" style="padding:6px 16px; border:1px solid #ccc; border-radius:3px; ` +
                `background:#f5f5f5; cursor:pointer; font-size:12px;">${cancelLabel}</button>` +
                `<button id="confirmOk" style="padding:6px 16px; border:1px solid #5a8fc0; border-radius:3px; ` +
                `background:#5a8fc0; color:white; cursor:pointer; font-size:12px;">${okLabel}</button>` +
                `</div>`;

            overlay.appendChild(dialog);

            const cleanup = (): void => { overlay.remove(); };

            const okBtn = dialog.querySelector('#confirmOk') as HTMLButtonElement;
            const cancelBtn = dialog.querySelector('#confirmCancel') as HTMLButtonElement;
            const closeBtn = dialog.querySelector('#confirmClose') as HTMLButtonElement;

            okBtn.addEventListener('click', () => { cleanup(); resolve(true); });
            cancelBtn.addEventListener('click', () => { cleanup(); resolve(false); });
            closeBtn.addEventListener('click', () => { cleanup(); resolve(false); });

            overlay.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Escape') { cleanup(); resolve(false); }
                if (e.key === 'Enter') { cleanup(); resolve(true); }
            });

            document.body.appendChild(overlay);
            okBtn.focus();
        });
    }
}
