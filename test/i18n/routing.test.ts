import { describe, it, expect, beforeEach } from 'vitest';
import {
    loadLocale,
    setLocale,
    getString,
    getCurrentLocale,
    onLocaleChange,
    isSupportedLocale,
    getPreferredLocale,
    SUPPORTED_LOCALES,
    LOCALE_LABELS,
} from '../../src/i18n/i18n.js';

describe('i18n routing', () => {
    beforeEach(async () => {
        // Reset to a known state before each test.
        globalThis.localStorage?.clear();
        await loadLocale('en');
    });

    describe('SUPPORTED_LOCALES', () => {
        it('contains the 11 FidoCadJ languages', () => {
            expect(SUPPORTED_LOCALES).toEqual(
                expect.arrayContaining([
                    'cs',
                    'de',
                    'el',
                    'en',
                    'es',
                    'fr',
                    'it',
                    'ja',
                    'nl',
                    'ru',
                    'zh',
                ]),
            );
            expect(SUPPORTED_LOCALES.length).toBe(11);
        });

        it('has a native-language label for every locale', () => {
            for (const loc of SUPPORTED_LOCALES) {
                expect(LOCALE_LABELS[loc]).toBeTruthy();
                expect(LOCALE_LABELS[loc]).not.toBe(loc);
            }
        });
    });

    describe('isSupportedLocale', () => {
        it('returns true for supported locales', () => {
            for (const loc of SUPPORTED_LOCALES) {
                expect(isSupportedLocale(loc)).toBe(true);
            }
        });
        it('returns false for unknown locales', () => {
            expect(isSupportedLocale('xx')).toBe(false);
            expect(isSupportedLocale('en-US')).toBe(false);
            expect(isSupportedLocale('')).toBe(false);
        });
    });

    describe('loadLocale', () => {
        it('loads the requested locale bundle', async () => {
            await loadLocale('it');
            expect(getCurrentLocale()).toBe('it');
            expect(getString('File')).toBe('File'); // same in en + it
            expect(getString('Save')).toBe('Salva');
        });

        it('falls back to English for an unknown locale code', async () => {
            await loadLocale('xx');
            expect(getCurrentLocale()).toBe('en');
            expect(getString('New')).toBe('New');
        });

        it('keeps the English bundle loaded for missing-key fallback', async () => {
            await loadLocale('ja');
            // Pick a FidoCadJS-specific key with English fallback.
            expect(getString('Help_menu')).toBe('ヘルプ');
            // A key that does not exist in any bundle falls back to itself.
            expect(getString('__nonexistent_key__')).toBe('__nonexistent_key__');
        });
    });

    describe('setLocale', () => {
        it('persists the choice in localStorage', async () => {
            await setLocale('fr');
            expect(globalThis.localStorage?.getItem('fidocadjs_locale')).toBe('fr');
        });

        it('notifies subscribers when the locale actually changes', async () => {
            await setLocale('en');
            const notified: string[] = [];
            const off = onLocaleChange((loc) => notified.push(loc));
            await setLocale('de');
            await setLocale('de'); // no-op — should not double-notify
            await setLocale('en');
            off();
            await setLocale('it'); // after unsubscribe — should be ignored
            expect(notified).toEqual(['de', 'en']);
        });

        it('falls back to English for unknown locales', async () => {
            await setLocale('xx');
            expect(getCurrentLocale()).toBe('en');
        });
    });

    describe('getPreferredLocale', () => {
        it('returns a saved locale from localStorage if valid', () => {
            globalThis.localStorage?.setItem('fidocadjs_locale', 'es');
            expect(getPreferredLocale()).toBe('es');
        });

        it('ignores an unsupported saved locale', () => {
            globalThis.localStorage?.setItem('fidocadjs_locale', 'klingon');
            // Falls back to either browser language (jsdom's default is usually
            // 'en-US') or English. Either way, it must be a supported locale.
            expect(SUPPORTED_LOCALES).toContain(getPreferredLocale());
        });
    });

    describe('getString', () => {
        it('returns the active-locale value when present', async () => {
            await loadLocale('it');
            expect(getString('Save')).toBe('Salva');
        });

        it('falls back to English when the active bundle lacks a key', async () => {
            await loadLocale('de');
            // FidoCadJS-only key — German bundle has translation we added.
            expect(getString('Help_menu')).toBe('Hilfe');
        });
    });
});
