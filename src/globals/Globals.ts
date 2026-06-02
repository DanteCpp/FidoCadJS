/**
 * @file Globals.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief Global constants and static utility functions
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { AccessResources } from '../i18n/AccessResources.js';

export class Globals {
    /** Global message bundle — mirrors Java's Globals.messages. */
    static messages: AccessResources;

    static readonly lineWidthDefault = 0.5;
    static lineWidth = Globals.lineWidthDefault;

    static readonly lineWidthCirclesDefault = 0.35;
    static lineWidthCircles = Globals.lineWidthCirclesDefault;

    static readonly diameterConnectionDefault = 2.0;
    static diameterConnection = Globals.diameterConnectionDefault;

    static readonly version = '0.24.9 gamma';
    static readonly isBeta = true;

    static readonly DEFAULT_EXTENSION = 'fcd';
    static readonly defaultTextFont = 'Courier New';

    static readonly dashNumber = 5;
    // Dash style patterns: [dash length, gap length, ...]  (0 gap = solid)
    static readonly dash: number[][] = [
        [10, 0],
        [5, 5],
        [2, 2],
        [2, 5],
        [2, 5, 5, 5],
    ];

    static readonly textSizeLimit = 4;
    static readonly maxZoomFactor = 4000;
    static readonly minZoomFactor = 10;

    // Parser safety limits — defend against malformed/hostile .fcd inputs.
    static readonly MAX_VERTICES = 10000;
    static readonly MAX_MACRO_DEPTH = 16;
    // Coordinates are non-negative numbers in the FidoCadJ logical grid. The
    // origin (0,0) is the top-left; negative coordinates are not supported by
    // the editor or the viewport, so parsed values are clamped to [0, MAX].
    // Coordinates may be fractional (floating-point); integer, FidoCadJ-
    // compatible coordinates are obtained simply by drawing with snap-to-grid
    // enabled, which lands every point on integer grid multiples.
    static readonly MAX_COORD = 1_000_000;
    static readonly MIN_COORD = 0;

    /** Validate and clamp a parsed coordinate. Returns null on NaN. */
    static parseCoord(token: string | undefined): number | null {
        if (token === undefined) return null;
        const v = parseFloat(token);
        if (!Number.isFinite(v)) return null;
        if (v > Globals.MAX_COORD) return Globals.MAX_COORD;
        if (v < Globals.MIN_COORD) return Globals.MIN_COORD;
        return v;
    }

    /**
     * Parse a coordinate token, returning 0 for non-numeric input. Convenience
     * wrapper around parseCoord for fixed-argument primitives that do not
     * null-check their coordinate fields.
     */
    static coord(token: string | undefined): number {
        return Globals.parseCoord(token) ?? 0;
    }

    /**
     * Serialize a coordinate for the FCD format: written with up to 3 decimals,
     * trailing zeros (and the decimal point) trimmed, so whole numbers are
     * emitted as plain integers.
     */
    static formatCoord(v: number): string {
        return parseFloat(v.toFixed(3)).toString();
    }

    static prettifyPath(s: string, len: number): string {
        const l = Math.max(len, 10);
        if (s.length < l) return s;
        return s.substring(0, l / 2 - 5) + '...  ' + s.substring(s.length - l / 2);
    }

    static adjustExtension(p: string, ext: string): string {
        const s = p.replace(/"/g, '');
        const dot = s.lastIndexOf('.');
        const sep = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
        if (dot > sep && dot >= 0) {
            return s.substring(0, dot) + '.' + ext;
        }
        return s + '.' + ext;
    }

    static checkExtension(p: string, ext: string): boolean {
        const s = p.replace(/"/g, '');
        const dot = s.lastIndexOf('.');
        const sep = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
        if (dot > sep && dot >= 0) {
            return s.substring(dot + 1) === ext;
        }
        return false;
    }

    static getFileNameOnly(s: string): string {
        const sep = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
        const dot = s.lastIndexOf('.');
        const start = sep >= 0 ? sep + 1 : 0;
        const end = dot >= 0 ? dot : s.length;
        return s.substring(start, end);
    }

    static roundTo(n: number, ch?: number): string {
        if (ch !== undefined) {
            return String(Math.trunc(n * 10 ** ch) / 10 ** ch);
        }
        return String(Math.round(n * 100) / 100);
    }

    static substituteBizarreChars(p: string, bc: Map<string, string>): string {
        const parts: string[] = [];
        for (const ch of p) {
            parts.push(bc.get(ch) ?? ch);
        }
        return parts.join('');
    }

    private constructor() {}
}
