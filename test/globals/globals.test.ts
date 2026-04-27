/**
 * @file globals.test.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief Tests for Globals static utility functions
 */

import { describe, it, expect } from 'vitest';
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
});
