/**
 * @file export-pgf.fixtures.test.ts
 * @author Dante Loi
 * @date 2026-05-14
 * @brief Golden-snapshot tests for ExportPGF against the fixture corpus.
 * @copyright Copyright 2026 Dante Loi - GPL v3
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

describe('ExportPGF — fixture corpus', () => {
    for (const name of listFixtures()) {
        it(`${name} matches committed TS snapshot`, () => {
            const out = normalise(loadFixtureFacade(name).exportPGF());

            const existing = readTsSnapshot(name, 'pgf');
            if (existing == null || UPDATE) {
                writeTsSnapshot(name, 'pgf', out);
                if (!UPDATE) {
                    throw new Error(
                        `Snapshot missing for ${name}.pgf — wrote initial snapshot. ` +
                            `Review it, then re-run the test.`,
                    );
                }
                return;
            }

            expect(out).toBe(normalise(existing));
        });
    }
});
