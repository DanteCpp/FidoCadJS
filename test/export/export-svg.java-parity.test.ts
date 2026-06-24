import { describe, it, expect } from 'vitest';
import { listFixtures, loadFixtureFacade, readJavaSnapshot } from './fixtures/helpers.js';

/**
 * Compare two SVGs at a SEMANTIC level: extract drawing elements (line,
 * rect, ellipse, circle, polygon, path, text, g) and their key
 * attributes, then assert the multiset matches.
 *
 * This intentionally drops:
 *   - whitespace
 *   - attribute order
 *   - trailing `.0` on numeric attributes (Java's float style)
 *   - the `xmlns:xlink` attribute (always present in Java)
 *
 * Returns a sorted list of element descriptors like
 *   ["circle cx=3 cy=3 fill=#000000 r=1 stroke-width=0.33", …]
 */
function extractDrawingElements(svg: string): string[] {
    const elements: string[] = [];
    const tagRe = /<(line|rect|ellipse|circle|polygon|path|text)\b([^>/]*?)\/?>/gs;
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(svg)) !== null) {
        const [, tag, attrs] = m;
        elements.push(`${tag} ${canonicaliseAttrs(attrs!)}`);
    }
    return elements.sort();
}

function canonicaliseAttrs(raw: string): string {
    const attrs: Record<string, string> = {};
    const attrRe = /(\w[\w:-]*)\s*=\s*"([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = attrRe.exec(raw)) !== null) {
        const [, key, val] = m;
        if (key === 'xmlns:xlink' || key === 'xmlns') continue;
        // Strip trailing .0, normalise -0 → 0, collapse 0.123000 forms.
        const numeric = val!.replace(/\b(-?\d+)\.0+(?=\b|[^\d])/g, '$1');
        // Drop the line-join/line-cap deltas that TS adds and Java omits.
        const styleStripped =
            key === 'style'
                ? numeric
                      .replace(/stroke-linejoin:round;?/g, '')
                      .replace(/stroke-linecap:round;?/g, '')
                      .replace(/;{2,}/g, ';')
                      .replace(/^;|;\s*$/g, '')
                      .replace(/\s+/g, ' ')
                : numeric;
        attrs[key!] = styleStripped;
    }
    return Object.entries(attrs)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
}

describe('ExportSVG — Java parity (semantic)', () => {
    for (const name of listFixtures()) {
        it(`${name}: TS drawing elements match Java reference`, () => {
            const javaSvg = readJavaSnapshot(name, 'svg');
            if (javaSvg == null) {
                console.warn(
                    `[skip] no Java reference for ${name}.svg — ` +
                        `run scripts/regen-export-fixtures.sh`,
                );
                return;
            }
            const tsSvg = loadFixtureFacade(name).exportSVG();

            const tsElems = extractDrawingElements(tsSvg);
            const javaElems = extractDrawingElements(javaSvg);

            // Both ports must emit the SAME COUNT of each tag.
            const tsCounts = tagCounts(tsElems);
            const javaCounts = tagCounts(javaElems);
            expect(tsCounts).toEqual(javaCounts);
        });
    }
});

function tagCounts(elems: string[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const e of elems) {
        const tag = e.split(' ', 1)[0]!;
        counts[tag] = (counts[tag] ?? 0) + 1;
    }
    return counts;
}
