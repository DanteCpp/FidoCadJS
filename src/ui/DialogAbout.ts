/**
 * @file DialogAbout.ts
 * @author Dante Loi
 * @date 2026-05-15
 * @brief About dialog — version, license, credits.
 *        Mirrors FidoCadJ's DialogAbout.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { getString } from '../i18n/i18n.js';

/**
 * Show the About dialog as a modal overlay.
 */
export function showAboutDialog(): void {
    const overlay = document.createElement('div');
    overlay.style.cssText =
        'position: fixed; inset: 0; background: rgba(0,0,0,0.35); ' +
        'z-index: 10000; display: flex; align-items: center; justify-content: center;';

    const box = document.createElement('div');
    box.style.cssText =
        'background: white; border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.25); ' +
        'padding: 32px; min-width: 380px; max-width: 480px; text-align: center; ' +
        'font-family: sans-serif; font-size: 13px;';

    const escape = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const desc1 = escape(getString('programDescription1'));
    const desc2 = escape(getString('programDescription2'));
    const license = escape(getString('About_license'));
    box.innerHTML = `
        <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 700;">FidoCadJS</h2>
        <p style="margin: 0 0 8px; font-size: 14px; color: #555;">Version 0.99.0-beta</p>
        <p style="margin: 0 0 16px; font-size: 12px; color: #777;">${desc1}</p>
        <p style="margin: 0 0 16px; font-size: 11px; color: #999; line-height: 1.5;">${desc2}</p>
        <p style="margin: 0 0 20px; font-size: 11px;">
            <a href="https://github.com/DanteCpp/FidoCadJS" target="_blank"
               style="color: #007bff; text-decoration: none;">
                github.com/DanteCpp/FidoCadJS
            </a>
        </p>
        <p style="margin: 0 0 20px; font-size: 10px; color: #aaa;">
            ${license}
        </p>
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = getString('Close');
    closeBtn.style.cssText =
        'padding: 8px 24px; border: 1px solid #ccc; border-radius: 4px; ' +
        'background: #f0f0f0; cursor: pointer; font-size: 13px;';
    box.appendChild(closeBtn);

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const cleanup = () => document.body.removeChild(overlay);

    closeBtn.addEventListener('click', cleanup);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup();
    });
    document.addEventListener(
        'keydown',
        (e) => {
            if (e.key === 'Escape') cleanup();
        },
        { once: true },
    );
}
