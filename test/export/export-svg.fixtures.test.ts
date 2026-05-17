/**
 * @file export-svg.fixtures.test.ts
 * @author Dante Loi
 * @date 2026-05-14
 * @brief Golden-snapshot tests for ExportSVG against the fixture corpus.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 *
 * Strategy:
 *   1. Walk every .fcd under test/export/fixtures/fcd/.
 *   2. Run the TS-port export and compare against test/export/fixtures/ts/<n>.svg.
 *   3. Missing or stale snapshots fail with a clear message instructing the
 *      developer to run `UPDATE_SNAPSHOTS=1 npm run test:run` after review.
 *
 * Java parity is exercised by the separate `export-svg.java-parity.test.ts`,
 * which records the known deltas in expected-deltas.json.
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

describe('ExportSVG — fixture corpus', () => {
    for (const name of listFixtures()) {
        it(`${name} matches committed TS snapshot`, () => {
            const out = normalise(loadFixtureFacade(name).exportSVG());

            const existing = readTsSnapshot(name, 'svg');
            if (existing == null || UPDATE) {
                writeTsSnapshot(name, 'svg', out);
                if (!UPDATE) {
                    throw new Error(
                        `Snapshot missing for ${name}.svg — wrote initial snapshot. ` +
                            `Review it, then re-run the test.`,
                    );
                }
                return;
            }

            expect(out).toBe(normalise(existing));
        });
    }
});
