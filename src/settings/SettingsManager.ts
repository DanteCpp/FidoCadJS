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

const STORAGE_KEY = 'fidocadts.settings.v1';
const SUPPORTED_LOCALES = ['cs', 'de', 'el', 'en', 'es', 'fr', 'it', 'ja', 'nl', 'ru', 'zh'] as const;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function isFiniteNumberInRange(v: unknown, min: number, max: number): v is number {
    return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}

function isValidColor(v: unknown): v is string {
    return typeof v === 'string' && COLOR_RE.test(v);
}

function sanitize(parsed: unknown): Partial<AppSettings> {
    if (parsed === null || typeof parsed !== 'object') return {};
    const p = parsed as Record<string, unknown>;
    const out: Partial<AppSettings> = {};

    if (isFiniteNumberInRange(p.gridSizeX, 1, 1000)) out.gridSizeX = p.gridSizeX;
    if (isFiniteNumberInRange(p.gridSizeY, 1, 1000)) out.gridSizeY = p.gridSizeY;
    if (typeof p.snapToGrid === 'boolean') out.snapToGrid = p.snapToGrid;
    if (typeof p.antiAlias === 'boolean') out.antiAlias = p.antiAlias;
    if (isFiniteNumberInRange(p.strokeSize, 0.01, 100)) out.strokeSize = p.strokeSize;
    if (isFiniteNumberInRange(p.connectionSize, 0.01, 100)) out.connectionSize = p.connectionSize;
    if (isFiniteNumberInRange(p.pcbLineWidth, 0.01, 1000)) out.pcbLineWidth = p.pcbLineWidth;
    if (isFiniteNumberInRange(p.pcbPadWidth, 0.01, 1000)) out.pcbPadWidth = p.pcbPadWidth;
    if (isFiniteNumberInRange(p.pcbPadHeight, 0.01, 1000)) out.pcbPadHeight = p.pcbPadHeight;
    if (isFiniteNumberInRange(p.pcbPadDrill, 0.01, 1000)) out.pcbPadDrill = p.pcbPadDrill;
    if (isValidColor(p.backgroundColor)) out.backgroundColor = p.backgroundColor;
    if (isValidColor(p.gridColor)) out.gridColor = p.gridColor;
    if (isValidColor(p.selectionLTRColor)) out.selectionLTRColor = p.selectionLTRColor;
    if (isValidColor(p.selectionRTLColor)) out.selectionRTLColor = p.selectionRTLColor;
    if (typeof p.locale === 'string'
        && (SUPPORTED_LOCALES as readonly string[]).includes(p.locale)) {
        out.locale = p.locale;
    }
    return out;
}

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
            if (!raw) return;
            const parsed = JSON.parse(raw);
            Object.assign(this.settings, sanitize(parsed));
        } catch (e) {
            console.warn('SettingsManager: failed to load settings, using defaults:', e);
        }
    }

    private save(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        } catch (e) {
            console.warn('SettingsManager: failed to persist settings:', e);
        }
    }
}
