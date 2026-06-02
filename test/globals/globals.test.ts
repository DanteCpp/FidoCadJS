/**
 * @file globals.test.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief Tests for Globals static utility functions
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { describe, it, expect, afterEach } from 'vitest';
import { Globals } from '../../src/globals/Globals.js';

describe('Globals', () => {
    it('DEFAULT_EXTENSION is fcd', () => {
        expect(Globals.DEFAULT_EXTENSION).toBe('fcd');
    });

    it('prettifyPath truncates long path with ellipsis', () => {
        const longPath = '/a/very/long/path/that/should/be/truncated/file.fcd';
        const result = Globals.prettifyPath(longPath, 50);
        expect(result.length).toBeLessThan(longPath.length);
        expect(result).toContain('...');
    });

    it('prettifyPath leaves short paths unchanged', () => {
        const short = 'file.fcd';
        expect(Globals.prettifyPath(short, 50)).toBe(short);
    });

    it('adjustExtension replaces existing extension', () => {
        const result = Globals.adjustExtension('test.txt', 'svg');
        expect(result).toBe('test.svg');
    });

    it('adjustExtension appends extension when none exists', () => {
        const result = Globals.adjustExtension('test', 'fcd');
        expect(result).toBe('test.fcd');
    });

    it('checkExtension returns true for matching extension', () => {
        expect(Globals.checkExtension('file.fcd', 'fcd')).toBe(true);
    });

    it('checkExtension returns false for different extension', () => {
        expect(Globals.checkExtension('file.svg', 'fcd')).toBe(false);
    });

    it('roundTo rounds to specified decimal places using trunc', () => {
        const result = Globals.roundTo(3.14159, 2);
        expect(Number(result)).toBeCloseTo(3.14, 2);
    });

    it('roundTo without ch rounds to 2 decimal places using round', () => {
        const result = Globals.roundTo(3.14159);
        expect(Number(result)).toBeCloseTo(3.14, 2);
    });

    it('getFileNameOnly strips path and extension', () => {
        expect(Globals.getFileNameOnly('/path/to/file.fcd')).toBe('file');
    });

    it('getFileNameOnly works with just a filename', () => {
        expect(Globals.getFileNameOnly('file.fcd')).toBe('file');
    });

    it('getFileNameOnly works without extension', () => {
        expect(Globals.getFileNameOnly('/path/to/file')).toBe('file');
    });

    it('adjustExtension handles quoted paths', () => {
        const result = Globals.adjustExtension('"test.txt"', 'svg');
        expect(result).toBe('test.svg');
    });

    it('parseCoord returns the value for valid non-negative integers', () => {
        expect(Globals.parseCoord('0')).toBe(0);
        expect(Globals.parseCoord('1500')).toBe(1500);
    });

    it('parseCoord clamps negative coordinates to 0', () => {
        expect(Globals.MIN_COORD).toBe(0);
        expect(Globals.parseCoord('-5')).toBe(0);
        expect(Globals.parseCoord('-1000000')).toBe(0);
    });

    it('parseCoord clamps values above MAX_COORD', () => {
        expect(Globals.MAX_COORD).toBe(1_000_000);
        expect(Globals.parseCoord('1000000')).toBe(1_000_000);
        expect(Globals.parseCoord('5000000')).toBe(Globals.MAX_COORD);
    });

    it('parseCoord returns null for non-numeric tokens', () => {
        expect(Globals.parseCoord('abc')).toBeNull();
        expect(Globals.parseCoord(undefined)).toBeNull();
    });

    it('parseCoord rounds fractional input in strict (integer) mode', () => {
        expect(Globals.floatCoords).toBe(false);
        expect(Globals.parseCoord('12.7')).toBe(13);
        expect(Globals.parseCoord('12.2')).toBe(12);
    });

    it('coord returns 0 for non-numeric tokens', () => {
        expect(Globals.coord('abc')).toBe(0);
        expect(Globals.coord(undefined)).toBe(0);
        expect(Globals.coord('42')).toBe(42);
    });

    it('formatCoord rounds to an integer in strict mode', () => {
        expect(Globals.formatCoord(12.7)).toBe('13');
        expect(Globals.formatCoord(13)).toBe('13');
    });
});

describe('Globals — floating-point coordinate mode', () => {
    afterEach(() => {
        Globals.floatCoords = false;
    });

    it('parseCoord preserves fractional input when floatCoords is on', () => {
        Globals.floatCoords = true;
        expect(Globals.parseCoord('12.7')).toBe(12.7);
        expect(Globals.parseCoord('12.125')).toBe(12.125);
    });

    it('parseCoord still clamps negatives to 0 in float mode', () => {
        Globals.floatCoords = true;
        expect(Globals.parseCoord('-0.5')).toBe(0);
        expect(Globals.parseCoord('-50')).toBe(0);
    });

    it('formatCoord writes up to 3 decimals, trimming trailing zeros', () => {
        Globals.floatCoords = true;
        expect(Globals.formatCoord(12.5)).toBe('12.5');
        expect(Globals.formatCoord(12.125)).toBe('12.125');
        expect(Globals.formatCoord(13)).toBe('13');
        expect(Globals.formatCoord(12.10004)).toBe('12.1');
    });

    it('round-trips a fractional coordinate through parse and format', () => {
        Globals.floatCoords = true;
        const token = '37.25';
        expect(Globals.formatCoord(Globals.parseCoord(token)!)).toBe(token);
    });
});
