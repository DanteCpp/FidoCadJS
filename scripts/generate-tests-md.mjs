/**
 * @file generate-tests-md.mjs
 * @author Dante Loi
 * @brief Regenerate test/TESTS.md from test discovery.
 *
 * Scans every *.test.ts file under test/, extracts the describe()/it()/test()
 * structure, and writes a fresh TESTS.md. Run it whenever tests are added or
 * removed so the index can never drift from reality:
 *
 *     npm run docs:tests
 *
 * Notes:
 *  - Titles are taken verbatim from the source. Parametrized tests created in
 *    loops (template-literal titles) are listed once with their `${...}`
 *    placeholders and counted once, so runtime counts can be slightly higher.
 *  - Nesting is inferred from indentation, which holds for Prettier-formatted
 *    sources like this repo's.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const TEST_ROOT = new URL('../test/', import.meta.url).pathname;
const OUTPUT = join(TEST_ROOT, 'TESTS.md');

/** Recursively collect *.test.ts files, sorted for stable output. */
function collectTestFiles(dir) {
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === 'report') continue;
            out.push(...collectTestFiles(full));
        } else if (entry.name.endsWith('.test.ts')) {
            out.push(full);
        }
    }
    return out.sort();
}

/** Extract describe/it/test entries with their indentation level. */
function extractCases(source) {
    const entries = [];
    // Matches: describe('title', | it("title", | test(`title`, including
    // .skip/.only/.each variants and async callbacks.
    const re = /^(\s*)(describe|it|test)(?:\.\w+(?:\([^)]*\))?)?\(\s*(['"`])((?:\\.|(?!\3).)*)\3/;
    for (const line of source.split('\n')) {
        const m = line.match(re);
        if (!m) continue;
        entries.push({
            indent: m[1].length,
            kind: m[2] === 'describe' ? 'describe' : 'case',
            title: m[4].replace(/\\(['"`])/g, '$1'),
        });
    }
    return entries;
}

const files = collectTestFiles(TEST_ROOT);
const unitFiles = [];
const e2eFiles = [];

for (const file of files) {
    const rel = relative(TEST_ROOT, file).split(sep).join('/');
    const entries = extractCases(readFileSync(file, 'utf8'));
    const cases = entries.filter((e) => e.kind === 'case').length;
    const record = { rel, entries, cases };
    (rel.startsWith('e2e/') ? e2eFiles : unitFiles).push(record);
}

const unitTotal = unitFiles.reduce((n, f) => n + f.cases, 0);
const e2eTotal = e2eFiles.reduce((n, f) => n + f.cases, 0);

function table(records) {
    const rows = records.map((f) => `| \`${f.rel}\` | ${f.cases} |`);
    return ['| File | Cases |', '|------|-------|', ...rows].join('\n');
}

function fileSection(f) {
    const lines = [`## \`${f.rel}\``, ''];
    for (const e of f.entries) {
        const depth = Math.max(0, Math.round(e.indent / 4));
        const pad = '  '.repeat(depth);
        lines.push(e.kind === 'describe' ? `${pad}- **${e.title}**` : `${pad}- ${e.title}`);
    }
    lines.push('');
    return lines.join('\n');
}

const now = new Date().toISOString().slice(0, 10);
const md = `<!--
File: TESTS.md
Description: Index of the FidoCadJS test suite, GENERATED from test discovery.
             Do NOT edit by hand — run \`npm run docs:tests\` to regenerate.
Generated: ${now}
-->

# FidoCadJS — Test Suite Reference

This document indexes every statically discoverable test case in
\`FidoCadJS/test/\`: **${unitTotal} unit cases** ([Vitest](https://vitest.dev) + jsdom)
across ${unitFiles.length} files and **${e2eTotal} E2E cases**
([Playwright](https://playwright.dev), run on Chromium, Firefox, and WebKit)
across ${e2eFiles.length} files. Parametrized tests are counted once, so
runtime totals can be higher.

## How to run

| Command | What it does |
|---------|--------------|
| \`npm run test\` | Vitest in watch mode |
| \`npm run test:run\` | Run unit tests once (used by CI) |
| \`npm run test:coverage\` | Unit tests + coverage gate |
| \`npm run test:e2e\` | Playwright E2E tests against the existing \`dist/\` build |
| \`npm run test:e2e:prod\` | Build first, then run Playwright E2E tests |
| \`npm run test:e2e:ui\` | Playwright E2E tests (interactive UI) |
| \`npm run docs:tests\` | Regenerate this file |

## Unit suite at a glance

${table(unitFiles)}
| **Total** | **${unitTotal}** |

## E2E suite at a glance

${table(e2eFiles)}
| **Total** | **${e2eTotal}** |

---

${unitFiles.map(fileSection).join('\n')}
---

${e2eFiles.map(fileSection).join('\n')}`;

writeFileSync(OUTPUT, md);
console.log(
    `TESTS.md regenerated: ${unitFiles.length + e2eFiles.length} files, ` +
        `${unitTotal} unit + ${e2eTotal} e2e cases.`,
);
