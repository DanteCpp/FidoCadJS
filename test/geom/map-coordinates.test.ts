/**
 * @file map-coordinates.test.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief Tests for MapCoordinates — mapping, snapping, zoom, orientation, push/pop
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MapCoordinates } from '../../src/geom/MapCoordinates.js';

describe('MapCoordinates', () => {
    let mc: MapCoordinates;

    beforeEach(() => {
        mc = new MapCoordinates();
    });

    it('default construction has zero center, magnitude 1, orientation 0, snap active', () => {
        expect(mc.getXCenter()).toBe(0);
        expect(mc.getYCenter()).toBe(0);
        expect(mc.getXMagnitude()).toBe(1);
        expect(mc.getYMagnitude()).toBe(1);
        expect(mc.getOrientation()).toBe(0);
        expect(mc.getSnap()).toBe(true);
    });

    it('mapX / unmapXnosnap round-trips correctly', () => {
        mc.setXCenter(100);
        mc.setXMagnitudeNoCheck(20);
        mc.setOrientation(0);
        const screenX = mc.mapX(50, 0);
        const logicalX = mc.unmapXnosnap(screenX);
        expect(logicalX).toBeCloseTo(50, 5);
    });

    it('mapY / unmapYnosnap round-trips correctly', () => {
        mc.setYCenter(100);
        mc.setYMagnitudeNoCheck(20);
        mc.setOrientation(0);
        const screenY = mc.mapY(0, 50);
        const logicalY = mc.unmapYnosnap(screenY);
        expect(logicalY).toBeCloseTo(50, 5);
    });

    it('mapX / mapY with non-zero center offsets', () => {
        mc.setXCenter(200);
        mc.setYCenter(200);
        mc.setXMagnitudeNoCheck(20);
        mc.setYMagnitudeNoCheck(20);
        const sx = mc.mapX(0, 0);
        const sy = mc.mapY(0, 0);
        expect(sx).toBe(200);
        expect(sy).toBe(200);
    });

    it('orientation affects mapping when isMacro=true', () => {
        mc.isMacro = true;
        mc.setOrientation(1);
        // mapXr with macro: orientation 1, no mirror → vx = -yc * magnitude + center
        // For xc=10, yc=0: vx = -0*1 + 0 = 0
        // mapYr with macro: orientation 1 → vy = xc * magnitude + center
        // For xc=10, yc=0: vy = 10*1 + 0 = 10
        const sx = mc.mapXr(110, 100); // macro offsets: xc-100=10, yc-100=0
        const sy = mc.mapYr(110, 100);
        // orientation 1, no mirror: vx = -yc * magnitude = 0, vy = xc * magnitude = 10
        expect(sx).toBeCloseTo(0, 5);
        expect(sy).toBeCloseTo(10, 5);
    });

    it('mirror in macro mode flips X mapping', () => {
        mc.isMacro = true;
        mc.mirror = true;
        // mirror + orientation 0: vx = -xc * magnitude + center = -10 * 1 + 0 = -10
        // mirror + orientation 0: vy = yc * magnitude + center = 0 * 1 + 0 = 0
        const sx = mc.mapXr(110, 100);
        expect(sx).toBeCloseTo(-10, 5);
    });

    it('snap mode rounds to grid step when active', () => {
        mc.setSnap(true);
        mc.setXCenter(0);
        mc.setYCenter(0);
        mc.setXMagnitudeNoCheck(20);
        mc.setYMagnitudeNoCheck(20);
        mc.setXGridStep(10);
        mc.setYGridStep(10);
        const sx = mc.mapX(17, 0);
        const logical = mc.unmapXsnap(sx);
        expect(logical % 10).toBe(0);
    });

    it('inactive snap returns raw value', () => {
        mc.setSnap(false);
        mc.setXCenter(0);
        mc.setYCenter(0);
        mc.setXMagnitudeNoCheck(20);
        const sx = mc.mapX(17, 0);
        const logical = mc.unmapXsnap(sx);
        expect(logical).toBeCloseTo(17, 5);
    });

    it('setXMagnitude clamps to MIN_MAGNITUDE', () => {
        mc.setXMagnitude(0.001);
        expect(mc.getXMagnitude()).toBeCloseTo(MapCoordinates.MIN_MAGNITUDE, 10);
    });

    it('setXMagnitude clamps to MAX_MAGNITUDE', () => {
        mc.setXMagnitude(1e6);
        expect(mc.getXMagnitude()).toBeCloseTo(MapCoordinates.MAX_MAGNITUDE, 0);
    });

    it('setOrientation accepts values 0-3', () => {
        mc.setOrientation(0);
        expect(mc.getOrientation()).toBe(0);
        mc.setOrientation(3);
        expect(mc.getOrientation()).toBe(3);
    });

    it('setOrientation clamps out of range values', () => {
        mc.setOrientation(5);
        expect(mc.getOrientation()).toBe(3);
        mc.setOrientation(-1);
        expect(mc.getOrientation()).toBe(0);
    });

    it('setXCenter / setYCenter accepts negative values', () => {
        mc.setXCenter(-500);
        mc.setYCenter(-300);
        expect(mc.getXCenter()).toBe(-500);
        expect(mc.getYCenter()).toBe(-300);
    });

    it('getXGridStep returns default of 5', () => {
        expect(mc.getXGridStep()).toBe(5);
    });

    it('setXGridStep updates grid step', () => {
        mc.setXGridStep(10);
        expect(mc.getXGridStep()).toBe(10);
    });

    it('setMagnitudes sets both X and Y magnitudes (clamped)', () => {
        mc.setMagnitudes(15, 25);
        expect(mc.getXMagnitude()).toBe(15);
        expect(mc.getYMagnitude()).toBe(25);
    });

    it('push / pop saves and restores full state', () => {
        mc.setXCenter(100);
        mc.setYCenter(200);
        mc.setXMagnitudeNoCheck(5);
        mc.setYMagnitudeNoCheck(10);
        mc.setOrientation(2);
        mc.setSnap(false);
        mc.push();

        mc.setXCenter(0);
        mc.setYCenter(0);
        mc.setXMagnitudeNoCheck(1);
        mc.setYMagnitudeNoCheck(1);
        mc.setOrientation(0);
        mc.setSnap(true);

        mc.pop();
        expect(mc.getXCenter()).toBe(100);
        expect(mc.getYCenter()).toBe(200);
        expect(mc.getXMagnitude()).toBe(5);
        expect(mc.getYMagnitude()).toBe(10);
        expect(mc.getOrientation()).toBe(2);
        expect(mc.getSnap()).toBe(false);
    });

    it('pop from empty stack does not throw', () => {
        expect(() => mc.pop()).not.toThrow();
    });

    it('trackPoint extends min/max bounds', () => {
        mc.trackPoint(-50, -50);
        mc.trackPoint(100, 200);
        expect(mc.getXMin()).toBeLessThanOrEqual(-50);
        expect(mc.getYMin()).toBeLessThanOrEqual(-50);
        expect(mc.getXMax()).toBeGreaterThanOrEqual(100);
        expect(mc.getYMax()).toBeGreaterThanOrEqual(200);
    });

    it('resetMinMax resets to extremes', () => {
        mc.trackPoint(100, 100);
        mc.resetMinMax();
        expect(mc.getXMin()).toBe(Number.MAX_SAFE_INTEGER);
        expect(mc.getYMin()).toBe(Number.MAX_SAFE_INTEGER);
        expect(mc.getXMax()).toBe(Number.MIN_SAFE_INTEGER);
        expect(mc.getYMax()).toBe(Number.MIN_SAFE_INTEGER);
    });

    it('unmapXsnap with active snap rounds to grid step', () => {
        mc.setXCenter(0);
        mc.setXMagnitudeNoCheck(20);
        mc.setXGridStep(10);
        mc.setSnap(true);
        // mapX(13, 0) = round(13*20+0) = 260, unmapXsnap(260) = round(round(260/20)/10)*10 = round(13/10)*10 = 10
        const sx = mc.mapX(13, 0);
        const logical = mc.unmapXsnap(sx);
        expect(logical % 10).toBe(0);
    });

    it('toString describes the state', () => {
        const str = mc.toString();
        expect(str).toContain('xCenter');
        expect(str).toContain('yMagnitude');
        expect(str).toContain('orientation');
    });

    it('setMagnitudesNoCheck sets without clamping', () => {
        mc.setMagnitudesNoCheck(200, 300);
        expect(mc.getXMagnitude()).toBe(200);
        expect(mc.getYMagnitude()).toBe(300);
    });

    it('mirror and isMacro flags toggle correctly', () => {
        expect(mc.getMirror()).toBe(false);
        mc.mirror = true;
        expect(mc.getMirror()).toBe(true);
        mc.isMacro = true;
        expect(mc.isMacro).toBe(true);
    });
});
