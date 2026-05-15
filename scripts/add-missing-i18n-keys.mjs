#!/usr/bin/env node
/**
 * @file add-missing-i18n-keys.mjs
 * @author Dante Loi
 * @date 2026-05-15
 * @brief One-shot script: insert FidoCadJS-specific keys (not present in the
 *        upstream FidoCadJ properties files) into every locale JSON bundle.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 * @details Adds keys with English text as the default; native-language
 *          translations can be filled in later. Idempotent: existing values
 *          are preserved.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const LOCALES_DIR = resolve(__dirname, '..', 'src', 'i18n', 'locales');

// Keys added by FidoCadJS UI that have no counterpart in FidoCadJ. Provide
// English values as the universal fallback; native translations live in the
// per-locale overrides below.
const FIDOCADJS_KEYS = {
    Help_menu: 'Help',
    ZoomIn: 'Zoom In',
    ZoomOut: 'Zoom Out',
    Detach_image_menu: 'Detach background image',
    ImportLibrary_menu: 'Import library',
    Languages: 'Language',
    Languages_tab: 'Language',
    Language_select_label: 'Display language:',
    Language_restart_info: 'Some labels may not update until you reload the page.',
    Layer_options_dlg: 'Layer options',
    Layer_color: 'Color:',
    Layer_visible: 'Visible',
    Layer_alpha: 'Opacity:',
    Layer_name: 'Name:',
    Export_dlg_title: 'Export',
    Export_format: 'File format:',
    Export_filename: 'File name:',
    Export_size: 'Size',
    Export_dpi: 'Resolution (DPI):',
    Export_jpeg_quality: 'JPEG quality:',
    Print_not_implemented: 'Print is not yet implemented.',
    About_title: 'About FidoCadJS',
    Circuit_definition: 'Circuit definition',
};

// Per-locale overrides for keys where we can supply a real translation.
const NATIVE_OVERRIDES = {
    cs: {
        Help_menu: 'Nápověda',
        ZoomIn: 'Přiblížit',
        ZoomOut: 'Oddálit',
        Detach_image_menu: 'Odpojit obrázek na pozadí',
        ImportLibrary_menu: 'Importovat knihovnu',
        Languages: 'Jazyk',
        Languages_tab: 'Jazyk',
        Language_select_label: 'Jazyk rozhraní:',
        Language_restart_info: 'Některé popisky se aktualizují až po obnovení stránky.',
    },
    de: {
        Help_menu: 'Hilfe',
        ZoomIn: 'Vergrößern',
        ZoomOut: 'Verkleinern',
        Detach_image_menu: 'Hintergrundbild lösen',
        ImportLibrary_menu: 'Bibliothek importieren',
        Languages: 'Sprache',
        Languages_tab: 'Sprache',
        Language_select_label: 'Anzeigesprache:',
        Language_restart_info: 'Einige Bezeichnungen werden erst nach dem Neuladen aktualisiert.',
    },
    el: {
        Help_menu: 'Βοήθεια',
        ZoomIn: 'Μεγέθυνση',
        ZoomOut: 'Σμίκρυνση',
        Detach_image_menu: 'Αποσύνδεση εικόνας φόντου',
        ImportLibrary_menu: 'Εισαγωγή βιβλιοθήκης',
        Languages: 'Γλώσσα',
        Languages_tab: 'Γλώσσα',
        Language_select_label: 'Γλώσσα εμφάνισης:',
        Language_restart_info: 'Ορισμένες ετικέτες θα ενημερωθούν με την επαναφόρτωση.',
    },
    es: {
        Help_menu: 'Ayuda',
        ZoomIn: 'Acercar',
        ZoomOut: 'Alejar',
        Detach_image_menu: 'Desvincular imagen de fondo',
        ImportLibrary_menu: 'Importar biblioteca',
        Languages: 'Idioma',
        Languages_tab: 'Idioma',
        Language_select_label: 'Idioma de la interfaz:',
        Language_restart_info: 'Algunas etiquetas no se actualizarán hasta recargar la página.',
    },
    fr: {
        Help_menu: 'Aide',
        ZoomIn: 'Zoom avant',
        ZoomOut: 'Zoom arrière',
        Detach_image_menu: "Détacher l'image de fond",
        ImportLibrary_menu: 'Importer une bibliothèque',
        Languages: 'Langue',
        Languages_tab: 'Langue',
        Language_select_label: "Langue de l'interface :",
        Language_restart_info: "Certains libellés ne seront mis à jour qu'au rechargement.",
    },
    it: {
        Help_menu: 'Aiuto',
        ZoomIn: 'Zoom avanti',
        ZoomOut: 'Zoom indietro',
        Detach_image_menu: 'Rimuovi immagine di sfondo',
        ImportLibrary_menu: 'Importa libreria',
        Languages: 'Lingua',
        Languages_tab: 'Lingua',
        Language_select_label: "Lingua dell'interfaccia:",
        Language_restart_info: 'Alcune etichette si aggiorneranno solo dopo aver ricaricato la pagina.',
    },
    ja: {
        Help_menu: 'ヘルプ',
        ZoomIn: '拡大',
        ZoomOut: '縮小',
        Detach_image_menu: '背景画像を切り離す',
        ImportLibrary_menu: 'ライブラリを取り込む',
        Languages: '言語',
        Languages_tab: '言語',
        Language_select_label: '表示言語:',
        Language_restart_info: '一部のラベルはページの再読み込み後に更新されます。',
    },
    nl: {
        Help_menu: 'Help',
        ZoomIn: 'Inzoomen',
        ZoomOut: 'Uitzoomen',
        Detach_image_menu: 'Achtergrondafbeelding loskoppelen',
        ImportLibrary_menu: 'Bibliotheek importeren',
        Languages: 'Taal',
        Languages_tab: 'Taal',
        Language_select_label: 'Interfacetaal:',
        Language_restart_info: 'Sommige labels worden pas bijgewerkt na het herladen.',
    },
    ru: {
        Help_menu: 'Справка',
        ZoomIn: 'Увеличить',
        ZoomOut: 'Уменьшить',
        Detach_image_menu: 'Открепить фоновое изображение',
        ImportLibrary_menu: 'Импортировать библиотеку',
        Languages: 'Язык',
        Languages_tab: 'Язык',
        Language_select_label: 'Язык интерфейса:',
        Language_restart_info: 'Некоторые надписи обновятся только после перезагрузки страницы.',
    },
    zh: {
        Help_menu: '帮助',
        ZoomIn: '放大',
        ZoomOut: '缩小',
        Detach_image_menu: '分离背景图像',
        ImportLibrary_menu: '导入库',
        Languages: '语言',
        Languages_tab: '语言',
        Language_select_label: '界面语言：',
        Language_restart_info: '部分标签需要重新加载页面后才会更新。',
    },
};

function processLocale(locale, contents) {
    const obj = JSON.parse(contents);
    const overrides = NATIVE_OVERRIDES[locale] ?? {};
    let added = 0;
    for (const [k, def] of Object.entries(FIDOCADJS_KEYS)) {
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
