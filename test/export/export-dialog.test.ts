/**
 * @file export-dialog.test.ts
 * @author Dante Loi
 * @date 2026-05-14
 * @brief Unit tests for ExportDialog.executeExport — verify that each
 *        format selection routes to the correct exporter and the resulting
 *        download is wired up properly.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 *
 * The dialog UI itself is exercised by E2E. Here we drive the dispatcher
 * directly with a stub EditorFacade so we can pin the contract without
 * involving the browser.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { executeExport } from '../../src/ui/ExportDialog.js';

/**
 * Build a stub EditorFacade exposing only the methods executeExport uses.
 * Each method is a vitest spy so we can assert which path fired.
 */
function makeStubPanel(): any {
    return {
        exportSVG: vi.fn(() => '<?xml version="1.0"?><svg></svg>'),
        exportPGF: vi.fn(() => '\\begin{pgfpicture}\\end{pgfpicture}'),
        exportTikZ: vi.fn(() => '\\begin{tikzpicture}\\end{tikzpicture}'),
        getCanvasElement: vi.fn(() => {
            const canvas = document.createElement('canvas');
            // jsdom Canvas#toBlob does not invoke its callback; stub it.
            (canvas as any).toBlob = (cb: (b: Blob | null) => void) =>
                cb(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }));
            return canvas;
        }),
    };
}

/** Captures URL.createObjectURL / revokeObjectURL + anchor download. */
function spyDownload() {
    const created: string[] = [];
    const revoked: string[] = [];
    const clicks: { href: string; download: string }[] = [];

    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    const origCreateElement = document.createElement.bind(document);

    URL.createObjectURL = vi.fn((blob: Blob) => {
        const url = `blob:test/${created.length}`;
        created.push(url);
        // Stash the blob so tests can fish it back out via the URL.
        (URL.createObjectURL as any).lastBlob = blob;
        return url;
    }) as any;
    URL.revokeObjectURL = vi.fn((u: string) => {
        revoked.push(u);
    }) as any;

    (document as any).createElement = (tag: string) => {
        const el = origCreateElement(tag);
        if (tag === 'a') {
            el.click = () => {
                clicks.push({
                    href: (el as HTMLAnchorElement).href,
                    download: (el as HTMLAnchorElement).download,
                });
            };
        }
        return el;
    };

    return {
        created,
        revoked,
        clicks,
        getLastBlob(): Blob | null {
            return (URL.createObjectURL as any).lastBlob ?? null;
        },
        restore() {
            URL.createObjectURL = origCreate;
            URL.revokeObjectURL = origRevoke;
            (document as any).createElement = origCreateElement;
        },
    };
}

describe('ExportDialog.executeExport', () => {
    let panel: any;
    let download: ReturnType<typeof spyDownload>;

    beforeEach(() => {
        panel = makeStubPanel();
        download = spyDownload();
    });

    afterEach(() => {
        download.restore();
    });

    describe('format dispatch', () => {
        it('format=svg calls exportSVG() and downloads .svg', () => {
            executeExport(panel, { format: 'svg', filename: 'circuit' });
            expect(panel.exportSVG).toHaveBeenCalledTimes(1);
            expect(panel.exportPGF).not.toHaveBeenCalled();
            expect(panel.exportTikZ).not.toHaveBeenCalled();
            expect(panel.getCanvasElement).not.toHaveBeenCalled();
            expect(download.clicks).toHaveLength(1);
            expect(download.clicks[0]!.download).toBe('circuit.svg');
        });

        it('format=pgf calls exportPGF() and downloads .pgf', () => {
            executeExport(panel, { format: 'pgf', filename: 'circuit' });
            expect(panel.exportPGF).toHaveBeenCalledTimes(1);
            expect(panel.exportSVG).not.toHaveBeenCalled();
            expect(download.clicks[0]!.download).toBe('circuit.pgf');
        });

        it('format=tikz calls exportTikZ() and downloads .tex', () => {
            executeExport(panel, { format: 'tikz', filename: 'circuit' });
            expect(panel.exportTikZ).toHaveBeenCalledTimes(1);
            expect(download.clicks[0]!.download).toBe('circuit.tex');
        });

        it('format=png reads canvas via toBlob and downloads .png', () => {
            executeExport(panel, { format: 'png', filename: 'circuit' });
            expect(panel.getCanvasElement).toHaveBeenCalledTimes(1);
            expect(panel.exportSVG).not.toHaveBeenCalled();
            expect(download.clicks).toHaveLength(1);
            expect(download.clicks[0]!.download).toBe('circuit.png');
        });
    });

    describe('filename extension handling', () => {
        it('appends .svg when missing', () => {
            executeExport(panel, { format: 'svg', filename: 'foo' });
            expect(download.clicks[0]!.download).toBe('foo.svg');
        });

        it('does not double-append .svg when already present', () => {
            executeExport(panel, { format: 'svg', filename: 'foo.svg' });
            expect(download.clicks[0]!.download).toBe('foo.svg');
        });

        it('appends .png when missing', () => {
            executeExport(panel, { format: 'png', filename: 'foo' });
            expect(download.clicks[0]!.download).toBe('foo.png');
        });

        it('appends .tex (not .tikz) for TikZ', () => {
            executeExport(panel, { format: 'tikz', filename: 'foo' });
            expect(download.clicks[0]!.download).toBe('foo.tex');
        });
    });

    describe('blob lifecycle', () => {
        it('SVG blob has the right MIME type', () => {
            executeExport(panel, { format: 'svg', filename: 'foo' });
            const blob = download.getLastBlob();
            expect(blob).not.toBeNull();
            expect(blob!.type).toBe('image/svg+xml');
        });

        it('PGF blob is text/plain', () => {
            executeExport(panel, { format: 'pgf', filename: 'foo' });
            expect(download.getLastBlob()!.type).toBe('text/plain');
        });

        it('TikZ blob is text/plain', () => {
            executeExport(panel, { format: 'tikz', filename: 'foo' });
            expect(download.getLastBlob()!.type).toBe('text/plain');
        });

        it('SVG blob size matches the exported string length', () => {
            const svgText = '<?xml version="1.0"?><svg></svg>';
            panel.exportSVG.mockReturnValue(svgText);
            executeExport(panel, { format: 'svg', filename: 'foo' });
            expect(download.getLastBlob()!.size).toBe(svgText.length);
        });

        it('text-format downloads revoke their object URLs immediately', () => {
            // SVG/PGF/TikZ use the synchronous downloadBlob path which
            // revokes the URL right after the click. PNG uses toBlob's
            // async callback which also revokes.
            executeExport(panel, { format: 'svg', filename: 'foo' });
            expect(download.revoked).toEqual(download.created);
        });
    });

    describe('PNG path quirks', () => {
        it('failed toBlob (returns null) does not throw', () => {
            panel.getCanvasElement = vi.fn(() => {
                const c = document.createElement('canvas');
                (c as any).toBlob = (cb: (b: Blob | null) => void) => cb(null);
                return c;
            });
            // Silence the console.error so the failure path stays quiet
            // in CI output.
            const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            expect(() => executeExport(panel, { format: 'png', filename: 'foo' })).not.toThrow();
            expect(errSpy).toHaveBeenCalled();
            errSpy.mockRestore();
        });
    });
});
