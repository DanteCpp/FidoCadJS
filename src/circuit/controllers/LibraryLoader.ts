/**
 * @file LibraryLoader.ts
 * @author Dante Loi
 * @date 2026-04-23
 * @brief Fetches and loads standard FCL component libraries from public/lib/.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import type { ParserActions } from './ParserActions.js';
import { getCurrentLocale } from '../../i18n/i18n.js';

interface LibraryEntry {
    /** Filename of the English (default) bundle under public/lib/. */
    englishFile: string;
    /** FidoCad prefix attached to every macro key in this library. */
    prefix: string;
    /** Per-locale overrides — filename to use instead of `englishFile` when
     *  the matching locale is active. */
    localized?: Readonly<Record<string, string>>;
}

const BASE = import.meta.env.BASE_URL;

const STANDARD_LIBRARIES: LibraryEntry[] = [
    { englishFile: 'FCDstdlib_en.fcl', prefix: '', localized: { it: 'FCDstdlib.fcl' } },
    {
        englishFile: 'elettrotecnica_en.fcl',
        prefix: 'elettrotecnica',
        localized: { it: 'elettrotecnica.fcl' },
    },
    // EY_Libraries ships in English under the bare name (no `_en` suffix).
    { englishFile: 'EY_Libraries.fcl', prefix: 'EY_Libraries' },
    { englishFile: 'IHRAM_en.fcl', prefix: 'IHRAM' },
    { englishFile: 'PCB_en.fcl', prefix: 'PCB', localized: { it: 'PCB.fcl' } },
];

/** Resolve the URL for a library given the active locale, falling back to the
 *  English bundle for any locale without a translation. */
function resolveLibraryUrl(entry: LibraryEntry, locale: string): string {
    const file = entry.localized?.[locale] ?? entry.englishFile;
    return `${BASE}lib/${file}`;
}

export async function loadStandardLibraries(
    parserActions: ParserActions,
    locale: string = getCurrentLocale(),
): Promise<void> {
    // Fetch all libraries in parallel, then parse sequentially to avoid
    // race conditions on the shared library map.
    const results = await Promise.allSettled(
        STANDARD_LIBRARIES.map(async (entry) => {
            const url = resolveLibraryUrl(entry, locale);
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return { prefix: entry.prefix, text: await response.text() };
        }),
    );
    for (const result of results) {
        if (result.status === 'fulfilled') {
            parserActions.readLibraryString(result.value.text, result.value.prefix);
        } else {
            console.warn('Failed to load library:', result.reason);
        }
    }
}
