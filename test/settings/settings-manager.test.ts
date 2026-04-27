/**
 * @file settings-manager.test.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief Tests for SettingsManager — persistence and defaults
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SettingsManager } from '../../src/settings/SettingsManager.js';

const STORAGE_KEY = 'fidocadts.settings.v1';

function resetSingleton(): void {
    (SettingsManager as unknown as { instance: SettingsManager | null }).instance = null;
}

function installFakeLocalStorage(): void {
    const store = new Map<string, string>();
    const fake: Storage = {
        get length() { return store.size; },
        clear: () => store.clear(),
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => { store.set(k, String(v)); },
        removeItem: (k: string) => { store.delete(k); },
        key: (i: number) => Array.from(store.keys())[i] ?? null,
    };
    Object.defineProperty(globalThis, 'localStorage', {
        value: fake,
        writable: true,
        configurable: true,
    });
}

describe('SettingsManager', () => {
    let mgr: SettingsManager;

    beforeEach(() => {
        installFakeLocalStorage();
        resetSingleton();
        mgr = SettingsManager.getInstance();
    });

    afterEach(() => {
        localStorage.clear();
        resetSingleton();
    });

    it('getInstance returns singleton', () => {
        const a = SettingsManager.getInstance();
        const b = SettingsManager.getInstance();
        expect(a).toBe(b);
    });

    it('getSettings returns settings with expected properties', () => {
        const settings = mgr.getSettings();
        expect(settings).toHaveProperty('locale');
        expect(settings).toHaveProperty('snapToGrid');
        expect(settings).toHaveProperty('antiAlias');
    });

    it('updateSettings merges patch', () => {
        mgr.updateSettings({ snapToGrid: false });
        const settings = mgr.getSettings();
        expect(settings.snapToGrid).toBe(false);
    });

    it('load reads from localStorage and applies', () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ snapToGrid: false, locale: 'en' }));
        resetSingleton();
        const fresh = SettingsManager.getInstance();
        expect(fresh.getSettings().snapToGrid).toBe(false);
    });

    it('handles corrupt localStorage JSON gracefully', () => {
        localStorage.setItem(STORAGE_KEY, '{corrupt');
        resetSingleton();
        expect(() => SettingsManager.getInstance()).not.toThrow();
    });
});
