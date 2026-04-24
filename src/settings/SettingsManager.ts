/**
 * @file SettingsManager.ts
 * @author Dante Loi
 * @date 2026-04-23
 * @brief Persistent app settings with localStorage backing
 */

import type { CircuitPanel } from '../circuit/CircuitPanel.js';
import { Globals } from '../globals/Globals.js';

export interface AppSettings {
    // Drawing
    gridSizeX: number;
    gridSizeY: number;
    snapToGrid: boolean;
    antiAlias: boolean;
    strokeSize: number;
    connectionSize: number;

    // PCB
    pcbLineWidth: number;
    pcbPadWidth: number;
    pcbPadHeight: number;
    pcbPadDrill: number;

    // Appearance
    backgroundColor: string;
    gridColor: string;
    selectionLTRColor: string;
    selectionRTLColor: string;

    // Locale
    locale: string;
}

function getDefaultLocale(): string {
    const nav = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : 'en';
    const lang = nav.split('-')[0].toLowerCase();
    const supported = ['cs', 'de', 'el', 'en', 'es', 'fr', 'it', 'ja', 'nl', 'ru', 'zh'];
    return supported.includes(lang) ? lang : 'en';
}

const DEFAULTS: AppSettings = {
    gridSizeX: 5,
    gridSizeY: 5,
    snapToGrid: true,
    antiAlias: false,
    strokeSize: 0.5,
    connectionSize: 2.0,
    pcbLineWidth: 5,
    pcbPadWidth: 5,
    pcbPadHeight: 5,
    pcbPadDrill: 2,
    backgroundColor: '#ffffff',
    gridColor: '#6464c8',
    selectionLTRColor: '#008000',
    selectionRTLColor: '#0000ff',
    locale: getDefaultLocale(),
};

const STORAGE_KEY = 'fidocadts.settings';

export class SettingsManager {
    private static instance: SettingsManager | null = null;
    private settings: AppSettings;

    private constructor() {
        this.settings = { ...DEFAULTS };
        this.load();
    }

    static getInstance(): SettingsManager {
        if (!SettingsManager.instance) {
            SettingsManager.instance = new SettingsManager();
        }
        return SettingsManager.instance;
    }

    getSettings(): AppSettings {
        return { ...this.settings };
    }

    updateSettings(patch: Partial<AppSettings>): void {
        Object.assign(this.settings, patch);
        this.save();
    }

    applyToPanel(panel: CircuitPanel): void {
        const s = this.settings;
        const mc = panel.getMapCoordinates();
        mc.setXGridStep(s.gridSizeX);
        mc.setYGridStep(s.gridSizeY);
        mc.setSnap(s.snapToGrid);
        panel.setAntiAlias(s.antiAlias);
        Globals.lineWidth = s.strokeSize;
        Globals.diameterConnection = s.connectionSize;

        const ae = panel.getAddElements();
        ae.setPcbThickness(s.pcbLineWidth);
        ae.setPcbPadSizeX(s.pcbPadWidth);
        ae.setPcbPadSizeY(s.pcbPadHeight);
        ae.setPcbPadDrill(s.pcbPadDrill);

        panel.setBackgroundColor(s.backgroundColor);
        panel.setGridColor(s.gridColor);
        panel.setSelectionLTRColor(s.selectionLTRColor);
        panel.setSelectionRTLColor(s.selectionRTLColor);
    }

    private load(): void {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as Partial<AppSettings>;
                Object.assign(this.settings, parsed);
                // Validate locale: if not in supported set, reset to default
                const supported = ['cs', 'de', 'el', 'en', 'es', 'fr', 'it', 'ja', 'nl', 'ru', 'zh'];
                if (!supported.includes(this.settings.locale)) {
                    this.settings.locale = getDefaultLocale();
                }
            }
        } catch {
            // ignore parse errors — keep defaults
        }
    }

    private save(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        } catch {
            // ignore quota errors
        }
    }
}
