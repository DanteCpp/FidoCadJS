import { describe, it, expect } from 'vitest';
import { GeometricDistances } from '../../src/geom/GeometricDistances.js';

describe('GeometricDistances.pointToSegment', () => {
    it('returns 0 for a point on the segment', () => {
        const d = GeometricDistances.pointToSegment(0, 0, 100, 0, 50, 0);
        expect(d).toBe(0);
    });

    it('returns the perpendicular distance for a point off the segment', () => {
        const d = GeometricDistances.pointToSegment(0, 0, 100, 0, 50, 30);
        expect(d).toBeCloseTo(30, 5);
    });

    it('returns distance to endpoint when the projection falls outside', () => {
        const d = GeometricDistances.pointToSegment(0, 0, 10, 0, -10, 0);
        // far-clamping kicks in once x is more than MIN_DISTANCE (100) outside
        // the bounding box of the segment.
        expect(d).toBe(10);
    });

    it('handles zero-length segments (point-to-point fallback)', () => {
        const d = GeometricDistances.pointToSegment(50, 50, 50, 50, 50, 53);
        expect(d).toBeCloseTo(3, 5);
    });

    it('handles vertical segments', () => {
        const d = GeometricDistances.pointToSegment(50, 0, 50, 100, 53, 50);
        expect(d).toBeCloseTo(3, 5);
    });

    it('returns MIN_DISTANCE for a point far away', () => {
        const d = GeometricDistances.pointToSegment(0, 0, 10, 0, 1000, 1000);
        expect(d).toBe(GeometricDistances.MIN_DISTANCE);
    });
});

describe('GeometricDistances.pointInPolygon', () => {
    const triX = [0, 100, 50];
    const triY = [0, 0, 100];

    it('returns true for a point clearly inside a triangle', () => {
        expect(GeometricDistances.pointInPolygon(triX, triY, 3, 50, 25)).toBe(true);
    });

    it('returns false for a point clearly outside a triangle', () => {
        expect(GeometricDistances.pointInPolygon(triX, triY, 3, 200, 200)).toBe(false);
    });

    it('handles a square', () => {
        const sqx = [0, 10, 10, 0];
        const sqy = [0, 0, 10, 10];
        expect(GeometricDistances.pointInPolygon(sqx, sqy, 4, 5, 5)).toBe(true);
        expect(GeometricDistances.pointInPolygon(sqx, sqy, 4, 50, 50)).toBe(false);
    });
});

describe('GeometricDistances.pointInEllipse', () => {
    it('returns true for the centre of the bounding box', () => {
        expect(GeometricDistances.pointInEllipse(0, 0, 100, 50, 50, 25)).toBe(true);
    });

    it('returns false for a point just outside the bounding box', () => {
        expect(GeometricDistances.pointInEllipse(0, 0, 100, 50, 200, 200)).toBe(false);
    });

    it('returns false for a corner of the bounding box (outside the ellipse)', () => {
        // Bounding box corner (0, 0) lies outside the ellipse for an
        // axis-aligned ellipse fitting that box.
        expect(GeometricDistances.pointInEllipse(0, 0, 100, 50, 0, 0)).toBe(false);
    });
});

describe('GeometricDistances.pointInRectangle', () => {
    it('returns true for points strictly inside', () => {
        expect(GeometricDistances.pointInRectangle(0, 0, 100, 50, 50, 25)).toBe(true);
    });

    it('returns true on the boundary', () => {
        expect(GeometricDistances.pointInRectangle(0, 0, 100, 50, 0, 0)).toBe(true);
        expect(GeometricDistances.pointInRectangle(0, 0, 100, 50, 100, 50)).toBe(true);
    });

    it('returns false outside', () => {
        expect(GeometricDistances.pointInRectangle(0, 0, 100, 50, 101, 0)).toBe(false);
        expect(GeometricDistances.pointInRectangle(0, 0, 100, 50, -1, 0)).toBe(false);
    });
});

describe('GeometricDistances.pointToRectangle', () => {
    it('returns 0 for a point on the rectangle edge', () => {
        // The point (50, 0) lies on the top edge.
        const d = GeometricDistances.pointToRectangle(0, 0, 100, 50, 50, 0);
        expect(d).toBe(0);
    });

    it('returns the distance to the nearest edge', () => {
        const d = GeometricDistances.pointToRectangle(0, 0, 100, 50, 50, -7);
        expect(d).toBeCloseTo(7, 5);
    });
});

describe('GeometricDistances.pointToBezier', () => {
    it('returns 0 for a point on a flat horizontal bezier', () => {
        const d = GeometricDistances.pointToBezier(0, 0, 33, 0, 66, 0, 100, 0, 50, 0);
        // 10-segment approximation; a point exactly on the line should be
        // within sub-pixel of one of the sample points.
        expect(d).toBeLessThan(1);
    });

    it('returns a moderate distance for a point off the curve', () => {
        const d = GeometricDistances.pointToBezier(0, 0, 33, 0, 66, 0, 100, 0, 50, 50);
        expect(d).toBeGreaterThan(40);
        expect(d).toBeLessThan(60);
    });
});

describe('GeometricDistances.pointToPoint', () => {
    it('returns the Euclidean distance for nearby points', () => {
        const d = GeometricDistances.pointToPoint(0, 0, 3, 4);
        expect(d).toBeCloseTo(5, 5);
    });

    it('returns MIN_DISTANCE for far-apart points', () => {
        // Both deltas exceed MIN_DISTANCE → bail.
        const d = GeometricDistances.pointToPoint(0, 0, 1000, 1000);
        expect(d).toBe(GeometricDistances.MIN_DISTANCE);
    });
});
