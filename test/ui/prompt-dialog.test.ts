import { describe, it, expect, beforeEach } from 'vitest';
import { loadLocale } from '../../src/i18n/i18n.js';
import { PromptDialog } from '../../src/ui/PromptDialog.js';

function overlay(): HTMLElement | null {
    // The overlay is the body-level ancestor of the dialog's input field.
    return (document.querySelector('#promptInput')?.closest('body > div') as HTMLElement) ?? null;
}

function input(): HTMLInputElement {
    return document.querySelector('#promptInput') as HTMLInputElement;
}

function okBtn(): HTMLButtonElement {
    return document.querySelector('#promptOk') as HTMLButtonElement;
}

function setValue(value: string): void {
    const el = input();
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('PromptDialog', () => {
    beforeEach(async () => {
        await loadLocale('en');
        document.body.innerHTML = '';
    });

    it('prefills the default value and resolves the edited text on OK', async () => {
        const promise = PromptDialog.show('Rename', 'New name:', 'old-name');
        expect(input().value).toBe('old-name');
        setValue('new-name');
        okBtn().click();
        await expect(promise).resolves.toBe('new-name');
        expect(overlay()).toBeNull();
    });

    it('Cancel and ✕ resolve null', async () => {
        const p1 = PromptDialog.show('T', 'M', 'v');
        (document.querySelector('#promptCancel') as HTMLButtonElement).click();
        await expect(p1).resolves.toBeNull();

        const p2 = PromptDialog.show('T', 'M', 'v');
        (document.querySelector('#promptClose') as HTMLButtonElement).click();
        await expect(p2).resolves.toBeNull();
    });

    it('Escape resolves null, Enter resolves the current value', async () => {
        const p1 = PromptDialog.show('T', 'M', 'v');
        overlay()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await expect(p1).resolves.toBeNull();

        const p2 = PromptDialog.show('T', 'M', 'hello');
        overlay()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await expect(p2).resolves.toBe('hello');
    });

    it('validator failure shows the error, disables OK, and blocks Enter', async () => {
        const promise = PromptDialog.show('T', 'M', 'bad', (v) =>
            v === 'bad' ? 'name is taken' : null,
        );
        // Initial validation runs against the default value.
        expect(okBtn().disabled).toBe(true);
        expect(document.querySelector('#promptError')!.textContent).toBe('name is taken');

        // Enter must not confirm while invalid.
        overlay()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(overlay()).not.toBeNull();

        // Fixing the value re-enables OK and clears the error.
        setValue('good');
        expect(okBtn().disabled).toBe(false);
        expect(document.querySelector('#promptError')!.textContent).toBe('');

        okBtn().click();
        await expect(promise).resolves.toBe('good');
    });

    it('escapes HTML in the default value', async () => {
        const promise = PromptDialog.show('T', 'M', '"><img src=x>');
        expect(overlay()!.querySelector('img')).toBeNull();
        expect(input().value).toBe('"><img src=x>');
        okBtn().click();
        await promise;
    });
});
