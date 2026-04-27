/**
 * @file undo-manager.test.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief Tests for the generic UndoManager stack
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UndoManager } from '../../src/undo/UndoManager.js';
import { UndoState } from '../../src/undo/UndoState.js';

function makeState(text: string, libraryOp = false): UndoState {
    const s = new UndoState();
    s.text = text;
    s.libraryOperation = libraryOp;
    return s;
}

describe('UndoManager', () => {
    let mgr: UndoManager;

    beforeEach(() => {
        mgr = new UndoManager(100);
    });

    it('new manager cannot undo or redo', () => {
        expect(mgr.canUndo()).toBe(false);
        expect(mgr.canRedo()).toBe(false);
    });

    it('undoPush followed by undoPop returns state', () => {
        mgr.undoPush(makeState('state1'));
        mgr.undoPush(makeState('state2'));
        expect(mgr.canUndo()).toBe(true);
        const result = mgr.undoPop();
        expect(result.text).toBe('state1');
    });

    it('undoRedo after undoPop re-applies state', () => {
        mgr.undoPush(makeState('state1'));
        mgr.undoPush(makeState('state2'));
        const popped = mgr.undoPop(); // goes back to state1
        expect(popped.text).toBe('state1');
        const redone = mgr.undoRedo(); // goes forward to state2
        expect(redone.text).toBe('state2');
    });

    it('undoReset clears everything', () => {
        mgr.undoPush(makeState('state1'));
        mgr.undoPush(makeState('state2'));
        mgr.undoReset();
        expect(mgr.canUndo()).toBe(false);
        expect(mgr.canRedo()).toBe(false);
    });

    it('undoPop at bottom returns same state (pointer clamped to 1)', () => {
        mgr.undoPush(makeState('state1'));
        const r1 = mgr.undoPop();
        expect(r1.text).toBe('state1');
        expect(mgr.canUndo()).toBe(false);
        // Second pop at bottom still returns first state (pointer clamped)
        const r2 = mgr.undoPop();
        expect(r2.text).toBe('state1');
    });

    it('buffer max size evicts oldest entries', () => {
        const small = new UndoManager(3);
        small.undoPush(makeState('a'));
        small.undoPush(makeState('b'));
        small.undoPush(makeState('c'));
        small.undoPush(makeState('d')); // should evict 'a'
        const popped = small.undoPop();
        expect(popped.text).toBe('c');
    });

    it('isNextOperationOnALibrary detects library operation', () => {
        mgr.undoPush(makeState('normal'));
        mgr.undoPush(makeState('lib', true));
        mgr.undoPop();
        expect(mgr.isNextOperationOnALibrary()).toBe(true);
    });

    it('undoRedo throws when nothing to redo', () => {
        expect(() => mgr.undoRedo()).toThrow();
    });
});
