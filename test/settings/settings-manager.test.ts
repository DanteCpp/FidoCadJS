import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsManager } from '../../src/settings/SettingsManager.js';

// SettingsManager uses localStorage — ensure it's available in the test env.
function ensureLocalStorage(): Storage {
    if (typeof localStorage !== 'undefined' && localStorage !== null) {
        // Check if it's a proper Storage with methods
        if (typeof (localStorage as any).getItem === 'function') return localStorage;
    }
    // Create a simple in-memory polyfill
    const store = new Map<string, string>();
    const polyfill = {
        getItem(key: string): string | null {
            return store.get(key) ?? null;
        },
        setItem(key: string, value: string): void {
            store.set(key, value);
        },
        removeItem(key: string): void {
            store.delete(key);
        },
        clear(): void {
            store.clear();
        },
        get length(): number {
            return store.size;
        },
        key(_index: number): string | null {
            return null;
        },
    };
    vi.stubGlobal('localStorage', polyfill);
    return polyfill as unknown as Storage;
}

describe('SettingsManager', () => {
    beforeEach(() => {
        const ls = ensureLocalStorage();
        ls.clear();
        // Reset the singleton
        (SettingsManager as any).instance = null;
    });

    describe('defaults', () => {
        it('returns sensible defaults when no stored settings', () => {
            const sm = SettingsManager.getInstance();
            const s = sm.getSettings();
            expect(s.gridSizeX).toBe(5);
            expect(s.gridSizeY).toBe(5);
            expect(s.snapToGrid).toBe(true);
            expect(s.antiAlias).toBe(false);
            expect(s.strokeSize).toBe(0.5);
            expect(s.connectionSize).toBe(2.0);
            expect(s.pcbLineWidth).toBe(5);
            expect(s.pcbPadWidth).toBe(5);
            expect(s.pcbPadHeight).toBe(5);
            expect(s.pcbPadDrill).toBe(2);
            expect(s.backgroundColor).toBe('#ffffff');
            expect(s.gridColor).toBe('#6464c8');
            expect(s.selectionLTRColor).toBe('#008000');
            expect(s.selectionRTLColor).toBe('#0000ff');
            expect(s.defaultFont).toBe('Courier New');
            expect(s.defaultFontSize).toBe(4);
            expect(s.nameValueFont).toBe('Courier New');
            expect(s.nameValueFontSize).toBe(3);
            expect(s.renderTeX).toBe(false);
        });

        it('returns a copy, not a reference to internal state', () => {
            const sm = SettingsManager.getInstance();
            const s1 = sm.getSettings();
            const s2 = sm.getSettings();
            expect(s1).not.toBe(s2);
            s1.gridSizeX = 999;
            expect(s2.gridSizeX).toBe(5);
        });
    });

    describe('updateSettings', () => {
        it('merges partial updates', () => {
            const sm = SettingsManager.getInstance();
            sm.updateSettings({ gridSizeX: 20, snapToGrid: false });
            const s = sm.getSettings();
            expect(s.gridSizeX).toBe(20);
            expect(s.snapToGrid).toBe(false);
            expect(s.gridSizeY).toBe(5); // unchanged
        });

        it('persists to localStorage', () => {
            const sm = SettingsManager.getInstance();
            sm.updateSettings({ backgroundColor: '#123456' });

            const raw = localStorage.getItem('fidocadts.settings.v1');
            expect(raw).not.toBeNull();
            const parsed = JSON.parse(raw!);
            expect(parsed.backgroundColor).toBe('#123456');
        });
    });

    describe('storage error handling', () => {
        it('handles corrupted JSON gracefully', () => {
            localStorage.setItem('fidocadts.settings.v1', 'not-json{{{');
            (SettingsManager as any).instance = null;
            const sm = SettingsManager.getInstance();
            expect(sm.getSettings().gridSizeX).toBe(5);
        });

        it('ignores invalid field types', () => {
            localStorage.setItem(
                'fidocadts.settings.v1',
                JSON.stringify({
                    gridSizeX: 'not-a-number',
                    snapToGrid: 42,
                    backgroundColor: 'invalid-color',
                    gridSizeY: -5,
                    defaultFont: '',
                    defaultFontSize: 0,
                    nameValueFont: 42,
                    nameValueFontSize: -1,
                }),
            );
            (SettingsManager as any).instance = null;
            const sm = SettingsManager.getInstance();
            const s = sm.getSettings();
            expect(s.gridSizeX).toBe(5);
            expect(s.snapToGrid).toBe(true);
            expect(s.backgroundColor).toBe('#ffffff');
            expect(s.gridSizeY).toBe(5);
            expect(s.defaultFont).toBe('Courier New');
            expect(s.defaultFontSize).toBe(4);
            expect(s.nameValueFont).toBe('Courier New');
            expect(s.nameValueFontSize).toBe(3);
        });

        it('clamps numeric values to valid ranges', () => {
            localStorage.setItem(
                'fidocadts.settings.v1',
                JSON.stringify({
                    gridSizeX: 2000,
                    gridSizeY: 0,
                    strokeSize: 0.001,
                }),
            );
            (SettingsManager as any).instance = null;
            const sm = SettingsManager.getInstance();
            const s = sm.getSettings();
            expect(s.gridSizeX).toBe(5);
            expect(s.gridSizeY).toBe(5);
            expect(s.strokeSize).toBe(0.5);
        });

        it('accepts valid settings from storage', () => {
            localStorage.setItem(
                'fidocadts.settings.v1',
                JSON.stringify({
                    gridSizeX: 10,
                    gridSizeY: 20,
                    snapToGrid: false,
                    antiAlias: true,
                    strokeSize: 1.0,
                    connectionSize: 3.0,
                    pcbLineWidth: 8,
                    pcbPadWidth: 6,
                    pcbPadHeight: 7,
                    pcbPadDrill: 3,
                    backgroundColor: '#abcdef',
                    gridColor: '#112233',
                    selectionLTRColor: '#445566',
                    selectionRTLColor: '#778899',
                    defaultFont: 'Georgia',
                    defaultFontSize: 12,
                    nameValueFont: 'Helvetica',
                    nameValueFontSize: 5,
                    renderTeX: true,
                }),
            );
            (SettingsManager as any).instance = null;
            const sm = SettingsManager.getInstance();
            const s = sm.getSettings();
            expect(s.gridSizeX).toBe(10);
            expect(s.gridSizeY).toBe(20);
            expect(s.snapToGrid).toBe(false);
            expect(s.antiAlias).toBe(true);
            expect(s.strokeSize).toBe(1.0);
            expect(s.connectionSize).toBe(3.0);
            expect(s.pcbLineWidth).toBe(8);
            expect(s.pcbPadWidth).toBe(6);
            expect(s.pcbPadHeight).toBe(7);
            expect(s.pcbPadDrill).toBe(3);
            expect(s.backgroundColor).toBe('#abcdef');
            expect(s.gridColor).toBe('#112233');
            expect(s.selectionLTRColor).toBe('#445566');
            expect(s.selectionRTLColor).toBe('#778899');
            expect(s.defaultFont).toBe('Georgia');
            expect(s.defaultFontSize).toBe(12);
            expect(s.nameValueFont).toBe('Helvetica');
            expect(s.nameValueFontSize).toBe(5);
            expect(s.renderTeX).toBe(true);
        });
    });

    describe('singleton behavior', () => {
        it('getInstance returns the same instance', () => {
            const a = SettingsManager.getInstance();
            const b = SettingsManager.getInstance();
            expect(a).toBe(b);
        });
    });
});
