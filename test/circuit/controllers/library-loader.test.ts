import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { loadStandardLibraries } from '../../../src/circuit/controllers/LibraryLoader.js';
import type { ParserActions } from '../../../src/circuit/controllers/ParserActions.js';

function okResponse(text: string): Response {
    return { ok: true, status: 200, text: async () => text } as unknown as Response;
}

function errorResponse(status: number): Response {
    return { ok: false, status, text: async () => '' } as unknown as Response;
}

describe('loadStandardLibraries', () => {
    let parser: { readLibraryString: ReturnType<typeof vi.fn> };
    let fetchMock: Mock<[string], Promise<Response>>;

    beforeEach(() => {
        parser = { readLibraryString: vi.fn() };
        fetchMock = vi.fn(async (url: string) => okResponse(`content-of ${url}`));
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('fetches all five standard libraries and parses them with their prefixes', async () => {
        await loadStandardLibraries(parser as unknown as ParserActions, 'en');

        expect(fetchMock).toHaveBeenCalledTimes(5);
        const urls = fetchMock.mock.calls.map((c) => c[0] as string);
        expect(urls.some((u) => u.endsWith('lib/FCDstdlib_en.fcl'))).toBe(true);
        expect(urls.some((u) => u.endsWith('lib/elettrotecnica_en.fcl'))).toBe(true);
        expect(urls.some((u) => u.endsWith('lib/EY_Libraries.fcl'))).toBe(true);
        expect(urls.some((u) => u.endsWith('lib/IHRAM_en.fcl'))).toBe(true);
        expect(urls.some((u) => u.endsWith('lib/PCB_en.fcl'))).toBe(true);

        const prefixes = parser.readLibraryString.mock.calls.map((c) => c[1]);
        expect(prefixes).toEqual(
            expect.arrayContaining(['', 'elettrotecnica', 'EY_Libraries', 'IHRAM', 'PCB']),
        );
    });

    it('uses localized bundles when the locale ships one, English otherwise', async () => {
        await loadStandardLibraries(parser as unknown as ParserActions, 'it');

        const urls = fetchMock.mock.calls.map((c) => c[0] as string);
        // Italian overrides exist for these three…
        expect(urls.some((u) => u.endsWith('lib/FCDstdlib.fcl'))).toBe(true);
        expect(urls.some((u) => u.endsWith('lib/elettrotecnica.fcl'))).toBe(true);
        expect(urls.some((u) => u.endsWith('lib/PCB.fcl'))).toBe(true);
        // …while untranslated libraries fall back to the English bundle.
        expect(urls.some((u) => u.endsWith('lib/IHRAM_en.fcl'))).toBe(true);
        expect(urls.some((u) => u.endsWith('lib/EY_Libraries.fcl'))).toBe(true);
    });

    it('passes each library body to readLibraryString', async () => {
        await loadStandardLibraries(parser as unknown as ParserActions, 'en');
        for (const [text, prefix] of parser.readLibraryString.mock.calls) {
            expect(text).toContain('content-of');
            expect(typeof prefix).toBe('string');
        }
    });

    it('a failing library does not prevent the others from loading', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        fetchMock.mockImplementation(async (url: string) => {
            if ((url as string).includes('IHRAM')) throw new Error('network down');
            return okResponse('ok');
        });

        await loadStandardLibraries(parser as unknown as ParserActions, 'en');

        expect(parser.readLibraryString).toHaveBeenCalledTimes(4);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('a non-OK HTTP response is skipped with a warning', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        fetchMock.mockImplementation(async (url: string) => {
            if ((url as string).includes('PCB')) return errorResponse(404);
            return okResponse('ok');
        });

        await loadStandardLibraries(parser as unknown as ParserActions, 'en');

        expect(parser.readLibraryString).toHaveBeenCalledTimes(4);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});
