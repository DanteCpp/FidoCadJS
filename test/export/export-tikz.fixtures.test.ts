/**
 * @file export-tikz.fixtures.test.ts
 * @author Dante Loi
 * @date 2026-05-14
 * @brief Golden-snapshot tests for ExportTikZ against the fixture corpus.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 *
 * NOTE: Java FidoCadJ does not emit TikZ directly (its CLI's "pgf" format
 * outputs the PGF dialect). The Java-parity test is therefore not run for
 * TikZ — only TS-snapshot stability.
 */

import { describe, it, expect } from 'vitest';
import {
    listFixtures,
    loadFixtureFacade,
    readTsSnapshot,
    writeTsSnapshot,
    normalise,
} from './fixtures/helpers.js';

const UPDATE = process.env.UPDATE_SNAPSHOTS === '1';

describe('ExportTikZ — fixture corpus', () => {
    for (const name of listFixtures()) {
        it(`${name} matches committed TS snapshot`, () => {
            const out = normalise(loadFixtureFacade(name).exportTikZ());

            const existing = readTsSnapshot(name, 'tex');
            if (existing == null || UPDATE) {
                writeTsSnapshot(name, 'tex', out);
                if (!UPDATE) {
                    throw new Error(
                        `Snapshot missing for ${name}.tex — wrote initial snapshot. ` +
                            `Review it, then re-run the test.`,
                    );
                }
                return;
            }

            expect(out).toBe(normalise(existing));
        });
    }
});
