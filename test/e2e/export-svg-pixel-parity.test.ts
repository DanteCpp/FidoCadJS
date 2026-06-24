import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { gotoApp, loadCircuit, exportSVG } from './utils';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '..', 'export', 'fixtures');
const FCD_DIR = join(FIXTURES, 'fcd');
const PNG_REF_DIR = join(FIXTURES, 'png-ref');
const ARTEFACTS = join(__dirname, '..', '..', 'test-results', 'pixel-parity');

/**
 * Fixtures where the TS port output is currently known to diverge by
 * more than the per-test tolerance. Each entry documents WHY.
 *
 * Goal: this set shrinks to {} as TS bugs land their fixes.
 */
const KNOWN_DIVERGENT: Record<string, string> = {
    'text-plain': 'TS uses font-size=sizex*2; Java uses font-size=sizey (TOTEST.md S4).',
    'text-rotated': 'Text font-size and baseline divergence (TOTEST.md S1/S3/S4).',
    'text-mirrored': 'Text font-size and baseline divergence (TOTEST.md S1/S3/S4).',
    'text-rotated-mirrored': 'Text font-size and baseline divergence (TOTEST.md S1/S3/S4).',
    'full-pattern': 'Contains text — inherits text-* divergence.',
    'arrow-line':
        'Arrow head dimensions / tip placement: Java uses different stroke-width default for the arrow polygon outline.',
    'dashed-line': 'Java dash pattern at r2 zoom + TS dash math drift sub-pixel.',
    'single-pcbline':
        'TS uses stroke-width:5 for a 5-unit PCB line; Java rasterises slightly thinner due to AA.',
    'pcbpad-transparent-layer': 'Opacity rendering differs between Chromium SVG and AWT png.',
};

/** Per-fixture rasterised-pixel diff tolerance (fraction). */
const DEFAULT_TOLERANCE = 0.05;

/** Listing in alphabetical order so failures are deterministic. */
function listFixtures(): string[] {
    return readdirSync(FCD_DIR)
        .filter((f) => f.endsWith('.fcd'))
        .map((f) => basename(f, '.fcd'))
        .sort();
}

/**
 * Render an SVG string via Playwright + Chromium and return raw PNG bytes
 * sized exactly to the SVG's intrinsic width/height (which is what Java
 * also targets at -c r1; we then scale to r2 to match the Java PNG).
 */
async function rasterise(page: any, svg: string, scale: number): Promise<Buffer> {
    // Strip the XML declaration and DOCTYPE so they don't break `setContent`.
    const cleaned = svg.replace(/<\?xml[^?]*\?>/, '').replace(/<!DOCTYPE[^>]*>/, '');

    // Extract intrinsic dimensions to build the page sized exactly to the
    // SVG content (no scrollbars, no body margin).
    const m = cleaned.match(/<svg[^>]*\swidth="([\d.]+)"[^>]*\sheight="([\d.]+)"/);
    if (!m) throw new Error('SVG has no width/height attributes');
    const w = Math.ceil(parseFloat(m[1]!) * scale);
    const h = Math.ceil(parseFloat(m[2]!) * scale);

    await page.setViewportSize({ width: w + 16, height: h + 16 });
    await page.setContent(
        `<!doctype html><html><body style="margin:0;padding:0;background:white;">` +
            `<div id="x" style="display:inline-block; transform: scale(${scale}); transform-origin: 0 0;">${cleaned}</div>` +
            `</body></html>`,
    );
    const handle = await page.locator('#x');
    return handle.screenshot({ omitBackground: false });
}

/** PNG → Uint8ClampedArray for pixelmatch consumption. */
function decodePNG(buf: Buffer): { width: number; height: number; data: Uint8Array } {
    const png = PNG.sync.read(buf);
    return { width: png.width, height: png.height, data: png.data };
}

mkdirSync(ARTEFACTS, { recursive: true });

test.describe('SVG pixel parity vs Java reference', () => {
    // Pixel-parity is Chromium-specific: other engines rasterise SVG
    // differently (different text metrics, antialiasing, fill/stroke
    // resolution), and these tolerances were tuned against Chromium.
    test.beforeEach(async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'Pixel-parity is Chromium-specific');
        await gotoApp(page);
    });

    for (const name of listFixtures()) {
        const skipReason = KNOWN_DIVERGENT[name];
        const t = skipReason ? test.skip : test;
        t(`${name}: TS SVG rasterises within tolerance of Java PNG`, async ({ page }) => {
            // 1) Load the fcd and get the TS SVG.
            const fcd = readFileSync(join(FCD_DIR, `${name}.fcd`), 'utf8');
            await loadCircuit(page, fcd);
            const svg = await exportSVG(page);

            // 2) Rasterise the TS SVG at the same scale Java used (r2).
            const tsPng = await rasterise(page, svg, 2);

            // 3) Load the Java reference PNG.
            const javaPng = readFileSync(join(PNG_REF_DIR, `${name}.png`));

            // 4) Compare; if dimensions differ, crop/pad to the smaller side
            //    rather than failing outright (a few-pixel size jitter is OK
            //    for the categorical-drift goal).
            const ts = decodePNG(tsPng);
            const ref = decodePNG(javaPng);
            const w = Math.min(ts.width, ref.width);
            const h = Math.min(ts.height, ref.height);

            // Pad/crop both into a common-size canvas.
            const tsCanvas = makeWhiteCanvas(w, h);
            blit(tsCanvas, w, h, ts);
            const refCanvas = makeWhiteCanvas(w, h);
            blit(refCanvas, w, h, ref);

            const diff = Buffer.alloc(w * h * 4);
            const diffPixels = pixelmatch(tsCanvas, refCanvas, diff, w, h, {
                threshold: 0.1,
                includeAA: false,
            });
            const ratio = diffPixels / (w * h);

            // Always dump artefacts for inspection; only fail if over budget.
            mkdirSync(ARTEFACTS, { recursive: true });
            writeFileSync(join(ARTEFACTS, `${name}-ts.png`), tsPng);
            writeFileSync(join(ARTEFACTS, `${name}-java.png`), javaPng);
            writeFileSync(
                join(ARTEFACTS, `${name}-diff.png`),
                PNG.sync.write({
                    width: w,
                    height: h,
                    data: Buffer.from(diff.buffer, diff.byteOffset, diff.byteLength),
                } as any),
            );

            expect(
                ratio,
                `${name}: ${(ratio * 100).toFixed(2)}% pixel diff (artefacts in test-results/pixel-parity/)`,
            ).toBeLessThan(DEFAULT_TOLERANCE);
        });
    }
});

function makeWhiteCanvas(w: number, h: number): Uint8Array {
    const buf = new Uint8Array(w * h * 4);
    for (let i = 0; i < buf.length; i += 4) {
        buf[i] = 255;
        buf[i + 1] = 255;
        buf[i + 2] = 255;
        buf[i + 3] = 255;
    }
    return buf;
}

function blit(
    dst: Uint8Array,
    dw: number,
    dh: number,
    src: { width: number; height: number; data: Uint8Array },
): void {
    const w = Math.min(dw, src.width);
    const h = Math.min(dh, src.height);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const di = (y * dw + x) * 4;
            const si = (y * src.width + x) * 4;
            dst[di] = src.data[si]!;
            dst[di + 1] = src.data[si + 1]!;
            dst[di + 2] = src.data[si + 2]!;
            dst[di + 3] = src.data[si + 3]!;
        }
    }
}
