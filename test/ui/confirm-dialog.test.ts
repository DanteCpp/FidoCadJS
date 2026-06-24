import { describe, it, expect, beforeEach } from 'vitest';
import { loadLocale } from '../../src/i18n/i18n.js';
import { ConfirmDialog } from '../../src/ui/ConfirmDialog.js';

function overlay(): HTMLElement | null {
    // The overlay is the body-level ancestor of the dialog's OK button.
    return (document.querySelector('#confirmOk')?.closest('body > div') as HTMLElement) ?? null;
}

function click(id: string): void {
    (document.querySelector(`#${id}`) as HTMLButtonElement).click();
}

describe('ConfirmDialog', () => {
    beforeEach(async () => {
        await loadLocale('en');
        document.body.innerHTML = '';
    });

    it('renders title, message, and both buttons', async () => {
        const promise = ConfirmDialog.show('Delete layer', 'Really delete?', 'Yes', 'No');
        const el = overlay()!;
        expect(el).not.toBeNull();
        expect(el.textContent).toContain('Delete layer');
        expect(el.textContent).toContain('Really delete?');
        expect((el.querySelector('#confirmOk') as HTMLElement).textContent).toBe('Yes');
        expect((el.querySelector('#confirmCancel') as HTMLElement).textContent).toBe('No');
        click('confirmOk');
        await promise;
    });

    it('OK resolves true and removes the overlay', async () => {
        const promise = ConfirmDialog.show('T', 'M');
        click('confirmOk');
        await expect(promise).resolves.toBe(true);
        expect(overlay()).toBeNull();
    });

    it('Cancel resolves false and removes the overlay', async () => {
        const promise = ConfirmDialog.show('T', 'M');
        click('confirmCancel');
        await expect(promise).resolves.toBe(false);
        expect(overlay()).toBeNull();
    });

    it('the ✕ close button resolves false', async () => {
        const promise = ConfirmDialog.show('T', 'M');
        click('confirmClose');
        await expect(promise).resolves.toBe(false);
    });

    it('Escape resolves false, Enter resolves true', async () => {
        const p1 = ConfirmDialog.show('T', 'M');
        overlay()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await expect(p1).resolves.toBe(false);

        const p2 = ConfirmDialog.show('T', 'M');
        overlay()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await expect(p2).resolves.toBe(true);
    });

    it('escapes HTML in title and message (no element injection)', async () => {
        const promise = ConfirmDialog.show('<img src=x>', '<script>boom()</script>');
        const el = overlay()!;
        expect(el.querySelector('img')).toBeNull();
        expect(el.querySelector('script')).toBeNull();
        expect(el.textContent).toContain('<img src=x>');
        expect(el.textContent).toContain('<script>boom()</script>');
        click('confirmOk');
        await promise;
    });
});
