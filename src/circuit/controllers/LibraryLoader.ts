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
    { url: `${BASE}lib/PCB_en.fcl`,             prefix: 'PCB' },
];

export async function loadStandardLibraries(parserActions: ParserActions): Promise<void> {
    for (const { url, prefix } of STANDARD_LIBRARIES) {
        try {
            const response = await fetch(url);
            if (!response.ok) continue;
            const text = await response.text();
            parserActions.readLibraryString(text, prefix);
        } catch (e) {
            console.warn('Failed to load library:', url, e);
        }
    }
}
