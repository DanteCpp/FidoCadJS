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
