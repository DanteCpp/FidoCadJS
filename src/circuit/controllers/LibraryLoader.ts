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
    /** Library file basename, without the `_<locale>` suffix or the .fcl
     *  extension. The loader picks the matching localized variant when
     *  available, otherwise falls back to the English (`_en.fcl`) bundle. */
    basename: string;
    prefix: string;
    /** Locale codes for which a translated `.fcl` ships under public/lib/.
     *  English (`_en.fcl`) is the universal fallback. */
    localizedLocales?: readonly string[];
}

const BASE = import.meta.env.BASE_URL;

const STANDARD_LIBRARIES: LibraryEntry[] = [
    { basename: 'FCDstdlib', prefix: '', localizedLocales: ['it'] },
    { basename: 'elettrotecnica', prefix: 'elettrotecnica', localizedLocales: ['it'] },
    { basename: 'EY_Libraries', prefix: 'EY_Libraries' },
    { basename: 'IHRAM', prefix: 'IHRAM' },
    { basename: 'PCB', prefix: 'PCB', localizedLocales: ['it'] },
];

/** Resolve the URL for a library given the active locale. Italian (`it`) uses
 *  the bare `.fcl`; every other locale falls back to `_en.fcl`. */
function resolveLibraryUrl(entry: LibraryEntry, locale: string): string {
    if (locale === 'it' && entry.localizedLocales?.includes('it')) {
        return `${BASE}lib/${entry.basename}.fcl`;
    }
    return `${BASE}lib/${entry.basename}_en.fcl`;
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
