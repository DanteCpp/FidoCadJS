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
    { url: `${BASE}lib/FCDstdlib.fcl`,       prefix: '' },
    { url: `${BASE}lib/PCB.fcl`,             prefix: 'PCB' },
    { url: `${BASE}lib/elettrotecnica.fcl`,  prefix: 'elettrotecnica' },
    { url: `${BASE}lib/EY_Libraries.fcl`,    prefix: 'EY_Libraries' },
    { url: `${BASE}lib/IHRAM.fcl`,           prefix: 'IHRAM' },
];

export async function loadStandardLibraries(parserActions: ParserActions): Promise<void> {
    const results = await Promise.allSettled(
        STANDARD_LIBRARIES.map(async ({ url, prefix }) => {
            const response = await fetch(url);
            if (!response.ok) return;
            const text = await response.text();
            parserActions.readLibraryString(text, prefix);
        }),
    );

    for (const result of results) {
        if (result.status === 'rejected') {
            console.warn('Failed to load library:', result.reason);
        }
    }
}
