import { describe, it, expect, beforeEach } from 'vitest';
import { loadLocale } from '../../src/i18n/i18n.js';
import { showShortcutsDialog } from '../../src/ui/DialogShortcuts.js';

function overlay(): HTMLElement | null {
    return document.querySelector('[data-testid="shortcuts-dialog"]');
}

describe('DialogShortcuts', () => {
    beforeEach(async () => {
        await loadLocale('en');
        document.body.innerHTML = '';
    });

    it('opens a modal listing shortcuts grouped by category', () => {
        showShortcutsDialog();
        const dlg = overlay();
        expect(dlg).not.toBeNull();

        const text = dlg!.textContent ?? '';
        // Section headings and a few representative bindings.
        expect(text).toContain('File');
        expect(text).toContain('Tools');
        expect(text).toContain('Undo');
        expect(text).toContain('Rotate');
        expect(text).toContain('Fit drawing to view');
        // New arrowhead shortcuts.
        expect(text).toContain('Toggle start arrowhead');
        expect(text).toContain('Toggle end arrowhead');

        // Redundant / non-existent entries were removed.
        expect(text).not.toContain('Libraries');
        expect(text).not.toContain('alternate');

        // Keys are rendered as <kbd> caps. (jsdom is treated as non-mac, so the
        // Ctrl label is shown verbatim rather than ⌘.)
        const caps = Array.from(dlg!.querySelectorAll('kbd')).map((k) => k.textContent);
        expect(caps).toContain('Ctrl');
        expect(caps).toContain('L');
        expect(caps).toContain('Esc');
        expect(caps).not.toContain('Home');
    });

    it('closes on the Close button', () => {
        showShortcutsDialog();
        expect(overlay()).not.toBeNull();
        const closeBtn = overlay()!.querySelector('button') as HTMLButtonElement;
        closeBtn.click();
        expect(overlay()).toBeNull();
    });

    it('closes on Escape without leaking the key handler', () => {
        showShortcutsDialog();
        expect(overlay()).not.toBeNull();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(overlay()).toBeNull();
    });
});
