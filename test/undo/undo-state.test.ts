/**
 * @file undo-state.test.ts
 * @author Dante Loi
 * @date 2026-06-11
 * @brief Unit tests for UndoState — defaults and the diagnostic toString.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { describe, it, expect } from 'vitest';
import { UndoState } from '../../src/undo/UndoState.js';

describe('UndoState', () => {
    it('starts as an empty, unmodified snapshot', () => {
        const s = new UndoState();
        expect(s.text).toBe('');
        expect(s.isModified).toBe(false);
        expect(s.fileName).toBe('');
        expect(s.libraryOperation).toBe(false);
        expect(s.libraryDir).toBe('');
    });

    it('toString reports text, file name, and library fields', () => {
        const s = new UndoState();
        s.text = '[FIDOCAD]\nLI 0 0 10 10 0';
        s.fileName = 'board.fcd';
        s.libraryOperation = true;
        s.libraryDir = '/libs';
        const out = s.toString();
        expect(out).toContain('text=[FIDOCAD]\nLI 0 0 10 10 0');
        expect(out).toContain('fileName=board.fcd');
        expect(out).toContain('Operation on a library: true');
        expect(out).toContain('libraryDir=/libs');
    });
});
