/**
 * @file LibraryLoader.ts
 * @author Dante Loi
 * @date 2026-04-23
 * @brief Fetches and loads standard FCL component libraries from public/lib/.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import type { ParserActions } from './ParserActions.js';

interface LibraryEntry {
    url: string;
    prefix: string;
}

const BASE = import.meta.env.BASE_URL;

const STANDARD_LIBRARIES: LibraryEntry[] = [
    { url: `${BASE}lib/FCDstdlib_en.fcl`,       prefix: '' },
    { url: `${BASE}lib/elettrotecnica_en.fcl`,  prefix: 'elettrotecnica' },
    { url: `${BASE}lib/EY_Libraries.fcl`,       prefix: 'EY_Libraries' },
    { url: `${BASE}lib/IHRAM_en.fcl`,           prefix: 'IHRAM' },
];

export async function loadStandardLibraries(parserActions: ParserActions): Promise<void> {
    // Fetch all libraries in parallel, then parse sequentially to avoid
    // race conditions on the shared library map.
    const results = await Promise.allSettled(
        STANDARD_LIBRARIES.map(async ({ url, prefix }) => {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return { prefix, text: await response.text() };
        })
    );
    for (const result of results) {
        if (result.status === 'fulfilled') {
            parserActions.readLibraryString(result.value.text, result.value.prefix);
        } else {
            console.warn('Failed to load library:', result.reason);
        }
    }
}
