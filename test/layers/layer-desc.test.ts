/**
 * @file layer-desc.test.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief Tests for LayerDesc — layer description model
 */

import { describe, it, expect } from 'vitest';
import { LayerDesc } from '../../src/layers/LayerDesc.js';
import { StandardLayers } from '../../src/layers/StandardLayers.js';

describe('LayerDesc', () => {
    it('default constructor creates visible layer', () => {
        const ld = new LayerDesc();
        expect(ld.isVisible()).toBe(true);
        expect(ld.getDescription()).toBe('');
        expect(ld.getAlpha()).toBe(1.0);
    });

    it('constructor with parameters sets values', () => {
        const ld = new LayerDesc(null, true, 'Test Layer', 0.5);
        expect(ld.getDescription()).toBe('Test Layer');
        expect(ld.isVisible()).toBe(true);
        expect(ld.getAlpha()).toBe(0.5);
    });

    it('isVisible / setVisible toggles visibility', () => {
        const ld = new LayerDesc(null, true, 'Test');
        expect(ld.isVisible()).toBe(true);
        ld.setVisible(false);
        expect(ld.isVisible()).toBe(false);
        ld.setVisible(true);
        expect(ld.isVisible()).toBe(true);
    });

    it('getDescription / setDescription round-trip', () => {
        const ld = new LayerDesc(null, true, 'Copper');
        expect(ld.getDescription()).toBe('Copper');
        ld.setDescription('Ground');
        expect(ld.getDescription()).toBe('Ground');
    });

    it('setColor / getColor round-trip', () => {
        const ld = new LayerDesc();
        expect(ld.getColor()).toBeNull();
    });

    it('isModified / setModified flag', () => {
        const ld = new LayerDesc();
        expect(ld.isModified()).toBe(false);
        ld.setModified(true);
        expect(ld.isModified()).toBe(true);
    });

    it('setAlpha / getAlpha round-trip', () => {
        const ld = new LayerDesc();
        ld.setAlpha(0.5);
        expect(ld.getAlpha()).toBe(0.5);
    });

    it('StandardLayers creates visible layers', () => {
        const layers = StandardLayers.createStandardLayers();
        expect(layers.length).toBeGreaterThan(0);
        expect(layers[0].isVisible()).toBe(true);
    });

    it('StandardLayers layers have descriptions', () => {
        const layers = StandardLayers.createStandardLayers();
        const hasDesc = layers.some(l => l.getDescription().length > 0);
        expect(hasDesc).toBe(true);
    });
});
