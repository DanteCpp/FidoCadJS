import { describe, expect, it } from 'vitest';
import { PastePlacement } from '../../src/circuit/PastePlacement.js';

describe('PastePlacement transforms', () => {
    it('keeps a rotated group rigid when moving against the origin', () => {
        const placement = new PastePlacement();
        placement.begin('LI 10 10 30 20 0\nLI 40 30 50 40 1\n', new Map());
        placement.moveTo(100, 100);
        placement.rotate();
        placement.moveTo(0, 0);
        expect(placement.getText()).toContain('LI 30 0 20 20 0');
        expect(placement.getText()).toContain('LI 10 30 0 40 1');
        placement.moveTo(100, 100);
        expect(placement.getText()).toContain('LI 100 100 90 120 0');
        expect(placement.getText()).toContain('LI 80 130 70 140 1');
    });

    it('keeps mirrored groups rigid at the origin and serializes their layers', () => {
        const placement = new PastePlacement();
        placement.begin('FJC L 1 16711680 0.5\nLI 10 10 30 20 1\nLI 40 30 50 40 0\n', new Map());
        placement.moveTo(0, 0);
        placement.mirror();
        expect(placement.getText()).toContain('LI 40 0 20 10 1');
        expect(placement.getText()).toContain('LI 10 20 0 30 0');
        expect(placement.getText()).toContain('FJC L 1 16711680 0.5');
        expect(placement.getText()).not.toContain('65280');
    });

    it('resets transforms for the next paste and round-trips full rotations and mirrors', () => {
        const placement = new PastePlacement();
        const text = 'LI 100 100 120 110 0\n';
        placement.begin(text, new Map());
        const original = placement.getText();
        for (let i = 0; i < 4; i++) placement.rotate();
        placement.mirror();
        placement.mirror();
        expect(placement.getText()).toBe(original);
        placement.rotate();
        placement.end();
        placement.begin(text, new Map());
        expect(placement.getText()).toBe(original);
    });
});
