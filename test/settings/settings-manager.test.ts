/**
 * @file settings-manager.test.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief Tests for SettingsManager — persistence and defaults
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SettingsManager } from '../../src/settings/SettingsManager.js';

describe('SettingsManager', () => {
    let mgr: SettingsManager;

    beforeEach(() => {
        // Clear localStorage before each test
        if (typeof localStorage !== 'undefined') {
            localStorage.clear();
        }
        // Get fresh singleton for each test (same instance but cleared storage)
        mgr = SettingsManager.getInstance();
    });

    afterEach(() => {
        if (typeof localStorage !== 'undefined') {
            localStorage.clear();
        }
    });

    it('getInstance returns singleton', () => {
        const a = SettingsManager.getInstance();
        const b = SettingsManager.getInstance();
        expect(a).toBe(b);
    });

    it('getSettings returns settings with expected properties', () => {
        const settings = mgr.getSettings();
        expect(settings).toHaveProperty('locale');
        expect(settings).toHaveProperty('gridVisible');
        expect(settings).toHaveProperty('antiAlias');
    });

    it('updateSettings merges patch', () => {
        mgr.updateSettings({ gridVisible: false });
        const settings = mgr.getSettings();
        expect(settings.gridVisible).toBe(false);
    });

    it('load reads from localStorage and applies', () => {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('fidocadjs_settings', JSON.stringify({ gridVisible: false, locale: 'en' }));
        }
        mgr.load();
        const settings = mgr.getSettings();
        expect(settings.gridVisible).toBe(false);
    });

    it('handles corrupt localStorage JSON gracefully', () => {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('fidocadjs_settings', '{corrupt');
        }
        expect(() => mgr.load()).not.toThrow();
    });
});
