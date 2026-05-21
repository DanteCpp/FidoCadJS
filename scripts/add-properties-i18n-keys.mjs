#!/usr/bin/env node
/**
 * @file add-properties-i18n-keys.mjs
 * @author Dante Loi
 * @date 2026-05-21
 * @brief One-shot script: insert the i18n keys used by the right-click context
 *        menu and the properties sidebar that had no counterpart in the
 *        upstream FidoCadJ properties files.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 * @details Adds keys with English text as the universal fallback plus native
 *          translations per locale. Idempotent: existing values are preserved,
 *          and a value still equal to the English default is upgraded to the
 *          native override when one is available.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const LOCALES_DIR = resolve(__dirname, '..', 'src', 'i18n', 'locales');

// English defaults (universal fallback) for the new keys.
const NEW_KEYS = {
    Properties: 'Properties',
    prop_section_common: 'Common',
    prop_section_arrows: 'Arrows',
    prop_section_component: 'Component',
    prop_content: 'Content:',
    prop_font_size: 'Font size:',
    prop_font_width: 'Font width:',
    prop_orientation: 'Orientation:',
    prop_macro: 'Macro:',
    prop_arrow_empty: 'Empty',
    prop_arrow_limiter: 'Limiter',
    prop_arrow_empty_limiter: 'Empty+Limiter',
    prop_shape_oval: 'Oval',
    prop_shape_rounded: 'Rounded rect.',
    prop_multiple: 'Multiple elements',
};

// Per-locale native translations.
const NATIVE_OVERRIDES = {
    cs: {
        Properties: 'Vlastnosti',
        prop_section_common: 'Obecné',
        prop_section_arrows: 'Šipky',
        prop_section_component: 'Součástka',
        prop_content: 'Obsah:',
        prop_font_size: 'Velikost písma:',
        prop_font_width: 'Šířka písma:',
        prop_orientation: 'Orientace:',
        prop_macro: 'Makro:',
        prop_arrow_empty: 'Prázdná',
        prop_arrow_limiter: 'Omezovač',
        prop_arrow_empty_limiter: 'Prázdná+omezovač',
        prop_shape_oval: 'Ovál',
        prop_shape_rounded: 'Zaobl. obdélník',
        prop_multiple: 'Více prvků',
    },
    de: {
        Properties: 'Eigenschaften',
        prop_section_common: 'Allgemein',
        prop_section_arrows: 'Pfeile',
        prop_section_component: 'Bauteil',
        prop_content: 'Inhalt:',
        prop_font_size: 'Schriftgröße:',
        prop_font_width: 'Schriftbreite:',
        prop_orientation: 'Ausrichtung:',
        prop_macro: 'Makro:',
        prop_arrow_empty: 'Leer',
        prop_arrow_limiter: 'Begrenzer',
        prop_arrow_empty_limiter: 'Leer+Begrenzer',
        prop_shape_oval: 'Oval',
        prop_shape_rounded: 'Abger. Rechteck',
        prop_multiple: 'Mehrere Elemente',
    },
    el: {
        Properties: 'Ιδιότητες',
        prop_section_common: 'Κοινά',
        prop_section_arrows: 'Βέλη',
        prop_section_component: 'Εξάρτημα',
        prop_content: 'Περιεχόμενο:',
        prop_font_size: 'Μέγεθος γραμματοσειράς:',
        prop_font_width: 'Πλάτος γραμματοσειράς:',
        prop_orientation: 'Προσανατολισμός:',
        prop_macro: 'Μακροεντολή:',
        prop_arrow_empty: 'Κενό',
        prop_arrow_limiter: 'Περιοριστής',
        prop_arrow_empty_limiter: 'Κενό+Περιοριστής',
        prop_shape_oval: 'Οβάλ',
        prop_shape_rounded: 'Στρογγ. ορθογώνιο',
        prop_multiple: 'Πολλαπλά στοιχεία',
    },
    es: {
        Properties: 'Propiedades',
        prop_section_common: 'Común',
        prop_section_arrows: 'Flechas',
        prop_section_component: 'Componente',
        prop_content: 'Contenido:',
        prop_font_size: 'Tamaño de fuente:',
        prop_font_width: 'Ancho de fuente:',
        prop_orientation: 'Orientación:',
        prop_macro: 'Macro:',
        prop_arrow_empty: 'Vacía',
        prop_arrow_limiter: 'Limitador',
        prop_arrow_empty_limiter: 'Vacía+Limitador',
        prop_shape_oval: 'Óvalo',
        prop_shape_rounded: 'Rect. redondeado',
        prop_multiple: 'Varios elementos',
    },
    fr: {
        Properties: 'Propriétés',
        prop_section_common: 'Commun',
        prop_section_arrows: 'Flèches',
        prop_section_component: 'Composant',
        prop_content: 'Contenu :',
        prop_font_size: 'Taille de police :',
        prop_font_width: 'Largeur de police :',
        prop_orientation: 'Orientation :',
        prop_macro: 'Macro :',
        prop_arrow_empty: 'Vide',
        prop_arrow_limiter: 'Limiteur',
        prop_arrow_empty_limiter: 'Vide+Limiteur',
        prop_shape_oval: 'Ovale',
        prop_shape_rounded: 'Rect. arrondi',
        prop_multiple: 'Plusieurs éléments',
    },
    it: {
        Properties: 'Proprietà',
        prop_section_common: 'Comune',
        prop_section_arrows: 'Frecce',
        prop_section_component: 'Componente',
        prop_content: 'Contenuto:',
        prop_font_size: 'Dimensione font:',
        prop_font_width: 'Larghezza font:',
        prop_orientation: 'Orientamento:',
        prop_macro: 'Macro:',
        prop_arrow_empty: 'Vuota',
        prop_arrow_limiter: 'Delimitatore',
        prop_arrow_empty_limiter: 'Vuota+Delimitatore',
        prop_shape_oval: 'Ovale',
        prop_shape_rounded: 'Rett. arrotondato',
        prop_multiple: 'Elementi multipli',
    },
    ja: {
        Properties: 'プロパティ',
        prop_section_common: '共通',
        prop_section_arrows: '矢印',
        prop_section_component: '部品',
        prop_content: '内容:',
        prop_font_size: 'フォントサイズ:',
        prop_font_width: 'フォント幅:',
        prop_orientation: '向き:',
        prop_macro: 'マクロ:',
        prop_arrow_empty: '中空',
        prop_arrow_limiter: 'リミッタ',
        prop_arrow_empty_limiter: '中空+リミッタ',
        prop_shape_oval: '楕円',
        prop_shape_rounded: '角丸四角',
        prop_multiple: '複数の要素',
    },
    nl: {
        Properties: 'Eigenschappen',
        prop_section_common: 'Algemeen',
        prop_section_arrows: 'Pijlen',
        prop_section_component: 'Component',
        prop_content: 'Inhoud:',
        prop_font_size: 'Tekengrootte:',
        prop_font_width: 'Tekenbreedte:',
        prop_orientation: 'Oriëntatie:',
        prop_macro: 'Macro:',
        prop_arrow_empty: 'Leeg',
        prop_arrow_limiter: 'Begrenzer',
        prop_arrow_empty_limiter: 'Leeg+Begrenzer',
        prop_shape_oval: 'Ovaal',
        prop_shape_rounded: 'Afger. rechthoek',
        prop_multiple: 'Meerdere elementen',
    },
    ru: {
        Properties: 'Свойства',
        prop_section_common: 'Общие',
        prop_section_arrows: 'Стрелки',
        prop_section_component: 'Компонент',
        prop_content: 'Содержимое:',
        prop_font_size: 'Размер шрифта:',
        prop_font_width: 'Ширина шрифта:',
        prop_orientation: 'Ориентация:',
        prop_macro: 'Макрос:',
        prop_arrow_empty: 'Пустая',
        prop_arrow_limiter: 'Ограничитель',
        prop_arrow_empty_limiter: 'Пустая+Ограничитель',
        prop_shape_oval: 'Овал',
        prop_shape_rounded: 'Скругл. прямоуг.',
        prop_multiple: 'Несколько элементов',
    },
    zh: {
        Properties: '属性',
        prop_section_common: '通用',
        prop_section_arrows: '箭头',
        prop_section_component: '元件',
        prop_content: '内容:',
        prop_font_size: '字体大小:',
        prop_font_width: '字体宽度:',
        prop_orientation: '方向:',
        prop_macro: '宏:',
        prop_arrow_empty: '空心',
        prop_arrow_limiter: '限位',
        prop_arrow_empty_limiter: '空心+限位',
        prop_shape_oval: '椭圆',
        prop_shape_rounded: '圆角矩形',
        prop_multiple: '多个元素',
    },
};

function processLocale(locale, contents) {
    const obj = JSON.parse(contents);
    const overrides = NATIVE_OVERRIDES[locale] ?? {};
    let added = 0;
    for (const [k, def] of Object.entries(NEW_KEYS)) {
        if (obj[k] === undefined) {
            obj[k] = overrides[k] ?? def;
            added++;
        } else if (overrides[k] && obj[k] === def) {
            // Replace placeholder English value with native override.
            obj[k] = overrides[k];
        }
    }
    return { obj, added };
}

function main() {
    const files = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'));
    for (const file of files) {
        const path = join(LOCALES_DIR, file);
        const locale = file.replace(/\.json$/, '');
        const text = readFileSync(path, 'utf8');
        const { obj, added } = processLocale(locale, text);
        writeFileSync(path, JSON.stringify(obj, null, 2) + '\n', 'utf8');
        console.log(`${locale}: +${added} new keys (total ${Object.keys(obj).length})`);
    }
}

main();
