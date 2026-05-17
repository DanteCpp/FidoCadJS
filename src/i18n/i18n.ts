/**
 * @file i18n.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief Internationalization module — locale loading, string lookup,
 *        change notification, and localStorage persistence.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

type Bundle = Record<string, string>;

/** All locales whose bundles ship with FidoCadJS. */
export const SUPPORTED_LOCALES = [
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
] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** Human-readable, autonym (native-language) label for each locale. */
export const LOCALE_LABELS: Record<SupportedLocale, string> = {
    cs: 'Čeština',
    de: 'Deutsch',
    el: 'Ελληνικά',
    en: 'English',
    es: 'Español',
    fr: 'Français',
    it: 'Italiano',
    ja: '日本語',
    nl: 'Nederlands',
    ru: 'Русский',
    zh: '中文',
};

const STORAGE_KEY = 'fidocadjs_locale';
const bundles: Record<string, Bundle> = {};
let currentLocale: SupportedLocale = 'en';

type LocaleChangeListener = (locale: SupportedLocale) => void;
const listeners = new Set<LocaleChangeListener>();

export function isSupportedLocale(loc: string): loc is SupportedLocale {
    return (SUPPORTED_LOCALES as readonly string[]).includes(loc);
}

/** Read the saved locale from localStorage, or fall back to the browser
 *  language, or English. */
export function getPreferredLocale(): SupportedLocale {
    try {
        const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
        if (saved && isSupportedLocale(saved)) return saved;
    } catch {
        /* localStorage unavailable; fall through */
    }
    const navLang = (globalThis as { navigator?: { language?: string } }).navigator?.language;
    if (navLang) {
        const short = navLang.slice(0, 2).toLowerCase();
        if (isSupportedLocale(short)) return short;
    }
    return 'en';
}

export async function loadLocale(locale: string): Promise<void> {
    const next: SupportedLocale = isSupportedLocale(locale) ? locale : 'en';
    if (!bundles[next]) {
        const mod = await import(`./locales/${next}.json`);
        bundles[next] = mod.default as Bundle;
    }
    // English is the universal fallback — ensure it is loaded so getString()
    // can fall through to it for keys missing in the active bundle.
    if (next !== 'en' && !bundles['en']) {
        const mod = await import('./locales/en.json');
        bundles['en'] = mod.default as Bundle;
    }
    currentLocale = next;
}

/** Switch the active locale and notify subscribers. Persists the choice in
 *  localStorage when available. */
export async function setLocale(locale: string): Promise<void> {
    const previous = currentLocale;
    await loadLocale(locale);
    try {
        globalThis.localStorage?.setItem(STORAGE_KEY, currentLocale);
    } catch {
        /* ignore quota / disabled storage */
    }
    if (currentLocale !== previous) {
        for (const fn of listeners) {
            try {
                fn(currentLocale);
            } catch (e) {
                console.error('locale change listener threw:', e);
            }
        }
    }
}

export function getString(key: string): string {
    return bundles[currentLocale]?.[key] ?? bundles['en']?.[key] ?? key;
}

export function getCurrentLocale(): SupportedLocale {
    return currentLocale;
}

/** Subscribe to locale changes. Returns an unsubscribe function. */
export function onLocaleChange(listener: LocaleChangeListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
