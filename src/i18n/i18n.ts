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
