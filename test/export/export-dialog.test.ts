import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { executeExport } from '../../src/ui/ExportDialog.js';
import { defaultBitmapOptions } from '../../src/export/ExportBitmapOptions.js';

/** A minimal drawing model stub that exportBitmapBlobs can consume. */
function makeStubModel(): any {
    return {
        getLayers: vi.fn(() => {
            const visible = {
                isVisible: () => true,
                getDescription: () => 'Layer0',
                getColor: () => ({ r: 0, g: 0, b: 0 }),
            };
            const hidden = {
                isVisible: () => false,
                getDescription: () => 'Layer1',
                getColor: () => ({ r: 0, g: 0, b: 0 }),
            };
            return [
                visible,
                visible,
                visible,
                visible,
                visible,
                visible,
                visible,
                visible,
                visible,
                visible,
                visible,
                visible,
                visible,
                visible,
                visible,
                hidden,
            ];
        }),
        getDrawOnlyLayer: vi.fn(() => -1),
        setDrawOnlyLayer: vi.fn(),
        getDrawOnlyPads: vi.fn(() => false),
        getChanged: vi.fn(() => true),
        setChanged: vi.fn(),
        getPrimitiveVector: vi.fn(() => []),
        containsLayer: vi.fn(() => true),
        getImgCanvas: vi.fn(() => ({
            trackExtremePoints: vi.fn(),
            draw: vi.fn(),
            isAttached: () => false,
            getState: () => null,
        })),
    };
}

/**
 * Build a stub EditorFacade exposing only the methods executeExport uses.
 * Each method is a vitest spy so we can assert which path fired.
 */
function makeStubPanel(): any {
    return {
        exportSVG: vi.fn(() => '<?xml version="1.0"?><svg></svg>'),
        exportPGF: vi.fn(() => '\\begin{pgfpicture}\\end{pgfpicture}'),
        exportTikZ: vi.fn(() => '\\begin{tikzpicture}\\end{tikzpicture}'),
        getModel: vi.fn(() => makeStubModel()),
    };
}

/** Default bitmap options for test selections. */
function defOpts() {
    return defaultBitmapOptions();
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
            executeExport(panel, { format: 'svg', filename: 'circuit', bitmapOptions: defOpts() });
            expect(panel.exportSVG).toHaveBeenCalledTimes(1);
            expect(panel.exportPGF).not.toHaveBeenCalled();
            expect(panel.exportTikZ).not.toHaveBeenCalled();
            expect(download.clicks).toHaveLength(1);
            expect(download.clicks[0]!.download).toBe('circuit.svg');
        });

        it('format=pgf calls exportPGF() and downloads .pgf', () => {
            executeExport(panel, { format: 'pgf', filename: 'circuit', bitmapOptions: defOpts() });
            expect(panel.exportPGF).toHaveBeenCalledTimes(1);
            expect(panel.exportSVG).not.toHaveBeenCalled();
            expect(download.clicks[0]!.download).toBe('circuit.pgf');
        });

        it('format=tikz calls exportTikZ() and downloads .tex', () => {
            executeExport(panel, { format: 'tikz', filename: 'circuit', bitmapOptions: defOpts() });
            expect(panel.exportTikZ).toHaveBeenCalledTimes(1);
            expect(download.clicks[0]!.download).toBe('circuit.tex');
        });

        it('format=png calls getModel() and downloads .png (async)', async () => {
            executeExport(panel, { format: 'png', filename: 'circuit', bitmapOptions: defOpts() });
            // PNG export is async — wait for the microtask
            await vi.waitFor(
                () => {
                    expect(panel.getModel).toHaveBeenCalled();
                },
                { timeout: 2000 },
            );
        });

        it('format=jpg calls getModel() and downloads .jpg (async)', async () => {
            executeExport(panel, { format: 'jpg', filename: 'circuit', bitmapOptions: defOpts() });
            await vi.waitFor(
                () => {
                    expect(panel.getModel).toHaveBeenCalled();
                },
                { timeout: 2000 },
            );
        });
    });

    describe('filename extension handling', () => {
        it('appends .svg when missing', () => {
            executeExport(panel, { format: 'svg', filename: 'foo', bitmapOptions: defOpts() });
            expect(download.clicks[0]!.download).toBe('foo.svg');
        });

        it('does not double-append .svg when already present', () => {
            executeExport(panel, { format: 'svg', filename: 'foo.svg', bitmapOptions: defOpts() });
            expect(download.clicks[0]!.download).toBe('foo.svg');
        });

        it('appends .tex (not .tikz) for TikZ', () => {
            executeExport(panel, { format: 'tikz', filename: 'foo', bitmapOptions: defOpts() });
            expect(download.clicks[0]!.download).toBe('foo.tex');
        });
    });

    describe('blob lifecycle', () => {
        it('SVG blob has the right MIME type', () => {
            executeExport(panel, { format: 'svg', filename: 'foo', bitmapOptions: defOpts() });
            const blob = download.getLastBlob();
            expect(blob).not.toBeNull();
            expect(blob!.type).toBe('image/svg+xml');
        });

        it('PGF blob is text/plain', () => {
            executeExport(panel, { format: 'pgf', filename: 'foo', bitmapOptions: defOpts() });
            expect(download.getLastBlob()!.type).toBe('text/plain');
        });

        it('TikZ blob is text/plain', () => {
            executeExport(panel, { format: 'tikz', filename: 'foo', bitmapOptions: defOpts() });
            expect(download.getLastBlob()!.type).toBe('text/plain');
        });

        it('SVG blob size matches the exported string length', () => {
            const svgText = '<?xml version="1.0"?><svg></svg>';
            panel.exportSVG.mockReturnValue(svgText);
            executeExport(panel, { format: 'svg', filename: 'foo', bitmapOptions: defOpts() });
            expect(download.getLastBlob()!.size).toBe(svgText.length);
        });

        it('text-format downloads revoke their object URLs on a delay', () => {
            // Revocation is deferred: Safari resolves blob URLs asynchronously
            // after the click, so revoking immediately aborts the download.
            vi.useFakeTimers();
            try {
                executeExport(panel, { format: 'svg', filename: 'foo', bitmapOptions: defOpts() });
                expect(download.revoked).toEqual([]);
                vi.runAllTimers();
                expect(download.revoked).toEqual(download.created);
            } finally {
                vi.useRealTimers();
            }
        });
    });
});
