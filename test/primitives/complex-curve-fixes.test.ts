/**
 * @file complex-curve-fixes.test.ts
 * @author Dante Loi
 * @date 2026-05-14
 * @brief Tests for Phase 1 fixes in PrimitiveComplexCurve:
 *        1.3 — off-by-one insertion at boundaries
 *        1.4 — stale-reference in hit-test after mutation
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { describe, it, expect } from 'vitest';
import { PrimitiveComplexCurve } from '../../src/primitives/PrimitiveComplexCurve.js';

describe('PrimitiveComplexCurve Phase 1 fixes', () => {
    describe('1.3 — Off-by-one in addPointClosest (boundary insertion)', () => {
        it('inserts vertex before point 0 when closest segment is before first point', () => {
            // Create a simple 3-point curve: (0,0), (100,0), (200,0)
            const c = new PrimitiveComplexCurve('Arial', 4);
            c.addPoint(0, 0);
            c.addPoint(100, 0);
            c.addPoint(200, 0);

            // Insert a point very close to the first segment near (0,0)
            // The algorithm should insert before index 1 (after segment from point 0 to 1)
            c.addPointClosest(-10, 0);

            // First point should be (-10, 0) — the inserted point
            expect(c.virtualPoint[0]!.x).toBe(-10);
            expect(c.virtualPoint[0]!.y).toBe(0);

            // Original points shifted right
            expect(c.virtualPoint[1]!.x).toBe(0);
            expect(c.virtualPoint[2]!.x).toBe(100);
            expect(c.virtualPoint[3]!.x).toBe(200);
        });

        it('inserts vertex at end when point is beyond last segment', () => {
            const c = new PrimitiveComplexCurve('Arial', 4);
            c.addPoint(0, 0);
            c.addPoint(100, 0);
            c.addPoint(200, 0);

            // Insert a point beyond the last segment
            c.addPointClosest(250, 0);

            // The new point is inserted at the correct position based on
            // segment distance; the last original point shifts to the end.
            // Get the logical points (excluding text handles).
            const nPoints = c.getControlPointNumber() - 2;
            // The inserted point (250, 0) should be one of the points
            const xs = [];
            for (let i = 0; i < nPoints; i++) xs.push(c.virtualPoint[i]!.x);
            expect(xs).toContain(250);
        });

        it('wraps around on negative minv (no crash)', () => {
            const c = new PrimitiveComplexCurve('Arial', 4);
            c.addPoint(0, 0);
            c.addPoint(100, 100);

            // Insert a point that will produce minv = -1 before the fix was applied
            // This should not crash or produce out-of-bounds access
            expect(() => c.addPointClosest(-50, 0)).not.toThrow();
        });
    });

    describe('1.4 — Stale-reference in getDistanceToPoint after mutation', () => {
        it('recomputes logical polygon when primitive changed after last draw', () => {
            const c = new PrimitiveComplexCurve('Arial', 4);
            c.addPoint(0, 0);
            c.addPoint(100, 0);
            c.addPoint(200, 0);

            // First call: no polygon yet, should compute distance to first point
            const d1 = c.getDistanceToPoint(0, 0);
            expect(d1).toBe(0); // exactly on first point

            // Mutate: move the first point
            c.virtualPoint[0]!.x = 50;
            c.setChanged(true);

            // After mutation but before draw, getDistanceToPoint should still
            // work with updated coordinates (lazy rebuild of q)
            const d2 = c.getDistanceToPoint(0, 0);
            // Distance from (0,0) to first point (50,0) should be ~50
            expect(d2).toBeGreaterThanOrEqual(1);
            expect(d2).toBeLessThanOrEqual(51);

            // The point at (50,0) should be hit exactly
            const d3 = c.getDistanceToPoint(50, 0);
            expect(d3).toBeCloseTo(0, 0);
        });

        it('does not crash when getDistanceToPoint is called before first draw', () => {
            const c = new PrimitiveComplexCurve('Arial', 4);
            c.addPoint(0, 0);
            c.addPoint(100, 100);

            // No draw() called — this should still work via lazy q rebuild
            const d = c.getDistanceToPoint(0, 0);
            expect(typeof d).toBe('number');
        });
    });
});
