/**
 * @file helpers.ts
 * @author Dante Loi
 * @date 2026-05-14
 * @brief Shared helpers for fixture-based exporter tests.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 *
 * Each helper centralises one job:
 *   - listing the .fcd fixtures,
 *   - parsing a fixture into a DrawingModel,
 *   - exporting via ExportFacade,
 *   - reading committed Java/TS snapshots,
 *   - normalising whitespace and version banners for diff stability.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DrawingModel } from '../../../src/circuit/model/DrawingModel.js';
import { ParserActions } from '../../../src/circuit/controllers/ParserActions.js';
import { ExportFacade } from '../../../src/export/ExportFacade.js';
import { StandardLayers } from '../../../src/layers/StandardLayers.js';
import { registerExportHooks } from '../../../src/circuit/views/Export.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = __dirname;
const FCD_DIR = join(FIXTURES_DIR, 'fcd');
const JAVA_DIR = join(FIXTURES_DIR, 'java');
const TS_DIR = join(FIXTURES_DIR, 'ts');

/** Returns every fixture name (no extension) sorted deterministically. */
export function listFixtures(): string[] {
    return readdirSync(FCD_DIR)
        .filter((f) => f.endsWith('.fcd'))
        .map((f) => basename(f, '.fcd'))
        .sort();
}

/** Reads the raw .fcd input for a fixture. */
export function readFcd(name: string): string {
    return readFileSync(join(FCD_DIR, `${name}.fcd`), 'utf8');
}

/** Reads a committed Java reference snapshot. Returns null if absent. */
export function readJavaSnapshot(name: string, ext: 'svg' | 'pgf'): string | null {
    const p = join(JAVA_DIR, `${name}.${ext}`);
    return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

/** Reads a committed TS snapshot. Returns null if absent. */
export function readTsSnapshot(name: string, ext: 'svg' | 'pgf' | 'tex'): string | null {
    const p = join(TS_DIR, `${name}.${ext}`);
    return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

/** Writes a TS snapshot (used by the snapshot-update mode). */
export function writeTsSnapshot(name: string, ext: 'svg' | 'pgf' | 'tex', content: string): void {
    writeFileSync(join(TS_DIR, `${name}.${ext}`), content);
}

let hooksRegistered = false;

/** Lazily registers PrimitiveMacro export hooks (idempotent). */
function ensureExportHooks(): void {
    if (!hooksRegistered) {
        registerExportHooks();
        hooksRegistered = true;
    }
}

/** Builds an ExportFacade with a fixture's circuit loaded. */
export function loadFixtureFacade(name: string): ExportFacade {
    ensureExportHooks();
    const model = new DrawingModel();
    model.setLayers(StandardLayers.createStandardLayers());
    const pa = new ParserActions(model);
    pa.parseString(readFcd(name));
    return new ExportFacade(model);
}

/**
 * Normalise an SVG / PGF / TikZ string for stable diffing.
 *
 * Strips:
 *   - the "Created by FidoCad(J|TS)" banner — version-dependent.
 *   - trailing whitespace on each line.
 *   - trailing empty lines.
 * Preserves everything else — leading whitespace is part of the contract
 * (e.g. SVG attributes' formatting matters for visual parity).
 */
export function normalise(s: string): string {
    return s
        .replace(/<!-- Created by [^>]*-->/g, '<!-- Created by ELIDED -->')
        .replace(/, export filter[^*\n]*\*?\/?/g, '')
        .split('\n')
        .map((line) => line.replace(/\s+$/, ''))
        .join('\n')
        .replace(/\n+$/, '\n');
}

export { FIXTURES_DIR, FCD_DIR, JAVA_DIR, TS_DIR };
