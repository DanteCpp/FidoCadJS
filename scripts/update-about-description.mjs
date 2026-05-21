#!/usr/bin/env node
/**
 * @file update-about-description.mjs
 * @author Dante Loi
 * @date 2026-05-21
 * @brief One-shot script: set the About-dialog description (programDescription1)
 *        to the new tagline in every locale bundle, with native translations.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 * @details Unlike the add-*-keys scripts, this overwrites the existing value of
 *          programDescription1 in each locale.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const LOCALES_DIR = resolve(__dirname, '..', 'src', 'i18n', 'locales');

const KEY = 'programDescription1';

const VALUES = {
    en: 'A browser-based electronic schematic editor fully compatible with FidoCad format.',
    cs: 'Editor elektronických schémat v prohlížeči, plně kompatibilní s formátem FidoCad.',
    de: 'Ein browserbasierter Editor für elektronische Schaltpläne, vollständig kompatibel mit dem FidoCad-Format.',
    el: 'Ένας επεξεργαστής ηλεκτρονικών σχηματικών στο πρόγραμμα περιήγησης, πλήρως συμβατός με τη μορφή FidoCad.',
    es: 'Un editor de esquemas electrónicos basado en navegador, totalmente compatible con el formato FidoCad.',
    fr: 'Un éditeur de schémas électroniques dans le navigateur, entièrement compatible avec le format FidoCad.',
    it: 'Un editor di schemi elettronici basato su browser, pienamente compatibile con il formato FidoCad.',
    ja: 'FidoCad形式に完全対応した、ブラウザベースの電子回路図エディタ。',
    nl: "Een browsergebaseerde editor voor elektronische schema's, volledig compatibel met het FidoCad-formaat.",
    ru: 'Браузерный редактор электронных схем, полностью совместимый с форматом FidoCad.',
    zh: '基于浏览器的电子原理图编辑器，完全兼容 FidoCad 格式。',
};

function main() {
    const files = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'));
    for (const file of files) {
        const path = join(LOCALES_DIR, file);
        const locale = file.replace(/\.json$/, '');
        const obj = JSON.parse(readFileSync(path, 'utf8'));
        const value = VALUES[locale] ?? VALUES.en;
        obj[KEY] = value;
        writeFileSync(path, JSON.stringify(obj, null, 2) + '\n', 'utf8');
        console.log(`${locale}: ${KEY} updated`);
    }
}

main();
