/**
 * @file i18n.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief Internationalization module — locale loading and string lookup
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

type Bundle = Record<string, string>;

const bundles: Record<string, Bundle> = {};
let currentLocale = 'en';

export async function loadLocale(locale: string): Promise<void> {
    if (bundles[locale]) { currentLocale = locale; return; }
    const mod = await import(`./locales/${locale}.json`);
    bundles[locale] = mod.default as Bundle;
    currentLocale = locale;
}

export function getString(key: string): string {
    return bundles[currentLocale]?.[key] ?? bundles['en']?.[key] ?? key;
}

export function getCurrentLocale(): string { return currentLocale; }
