#!/usr/bin/env node
/**
 * @file add-dialog-i18n-keys.mjs
 * @author Dante Loi
 * @date 2026-05-21
 * @brief One-shot script: insert the i18n keys used by the Symbolize dialog,
 *        the macro picker, and the library import/rename/change-key dialogs
 *        that had no counterpart in the upstream FidoCadJ properties files.
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
    symb_origin_hint: 'Origin (drag crosshair, right-click=toggle grid):',
    macropicker_header: 'Components',
    macropicker_search: 'Search components...',
    lib_overwrite_title: 'Overwrite library',
    lib_overwrite_msg: 'A user library with prefix "{0}" already exists. Overwrite it?',
    name_empty: 'Name must not be empty.',
    key_empty: 'Key must not be empty.',
    key_exists: 'Key already exists.',
};

// Per-locale native translations.
const NATIVE_OVERRIDES = {
    cs: {
        symb_origin_hint: 'Počátek (táhněte zaměřovač, pravé tlačítko = přepnout mřížku):',
        macropicker_header: 'Součástky',
        macropicker_search: 'Hledat součástky...',
        lib_overwrite_title: 'Přepsat knihovnu',
        lib_overwrite_msg: 'Uživatelská knihovna s předponou „{0}“ již existuje. Přepsat ji?',
        name_empty: 'Název nesmí být prázdný.',
        key_empty: 'Klíč nesmí být prázdný.',
        key_exists: 'Klíč již existuje.',
    },
    de: {
        symb_origin_hint: 'Ursprung (Fadenkreuz ziehen, Rechtsklick = Raster umschalten):',
        macropicker_header: 'Bauteile',
        macropicker_search: 'Bauteile suchen...',
        lib_overwrite_title: 'Bibliothek überschreiben',
        lib_overwrite_msg: 'Eine Benutzerbibliothek mit dem Präfix „{0}“ existiert bereits. Überschreiben?',
        name_empty: 'Der Name darf nicht leer sein.',
        key_empty: 'Der Schlüssel darf nicht leer sein.',
        key_exists: 'Schlüssel existiert bereits.',
    },
    el: {
        symb_origin_hint: 'Αρχή (σύρετε το σταυρόνημα, δεξί κλικ = εναλλαγή πλέγματος):',
        macropicker_header: 'Εξαρτήματα',
        macropicker_search: 'Αναζήτηση εξαρτημάτων...',
        lib_overwrite_title: 'Αντικατάσταση βιβλιοθήκης',
        lib_overwrite_msg: 'Υπάρχει ήδη βιβλιοθήκη χρήστη με πρόθεμα «{0}». Να αντικατασταθεί;',
        name_empty: 'Το όνομα δεν πρέπει να είναι κενό.',
        key_empty: 'Το κλειδί δεν πρέπει να είναι κενό.',
        key_exists: 'Το κλειδί υπάρχει ήδη.',
    },
    es: {
        symb_origin_hint: 'Origen (arrastre la cruz, clic derecho = alternar cuadrícula):',
        macropicker_header: 'Componentes',
        macropicker_search: 'Buscar componentes...',
        lib_overwrite_title: 'Sobrescribir biblioteca',
        lib_overwrite_msg: 'Ya existe una biblioteca de usuario con el prefijo «{0}». ¿Sobrescribirla?',
        name_empty: 'El nombre no puede estar vacío.',
        key_empty: 'La clave no puede estar vacía.',
        key_exists: 'La clave ya existe.',
    },
    fr: {
        symb_origin_hint:
            'Origine (déplacez la croix, clic droit = afficher/masquer la grille) :',
        macropicker_header: 'Composants',
        macropicker_search: 'Rechercher des composants...',
        lib_overwrite_title: 'Remplacer la bibliothèque',
        lib_overwrite_msg:
            'Une bibliothèque utilisateur avec le préfixe « {0} » existe déjà. La remplacer ?',
        name_empty: 'Le nom ne doit pas être vide.',
        key_empty: 'La clé ne doit pas être vide.',
        key_exists: 'La clé existe déjà.',
    },
    it: {
        symb_origin_hint: 'Origine (trascina il mirino, clic destro = mostra/nascondi griglia):',
        macropicker_header: 'Componenti',
        macropicker_search: 'Cerca componenti...',
        lib_overwrite_title: 'Sovrascrivi libreria',
        lib_overwrite_msg: 'Esiste già una libreria utente con prefisso "{0}". Sovrascriverla?',
        name_empty: 'Il nome non può essere vuoto.',
        key_empty: 'La chiave non può essere vuota.',
        key_exists: 'La chiave esiste già.',
    },
    ja: {
        symb_origin_hint: '原点（十字をドラッグ、右クリックでグリッド切替）:',
        macropicker_header: '部品',
        macropicker_search: '部品を検索...',
        lib_overwrite_title: 'ライブラリを上書き',
        lib_overwrite_msg: '接頭辞「{0}」のユーザーライブラリは既に存在します。上書きしますか？',
        name_empty: '名前を空にできません。',
        key_empty: 'キーを空にできません。',
        key_exists: 'キーは既に存在します。',
    },
    nl: {
        symb_origin_hint: 'Oorsprong (sleep het draadkruis, rechtsklik = raster wisselen):',
        macropicker_header: 'Componenten',
        macropicker_search: 'Componenten zoeken...',
        lib_overwrite_title: 'Bibliotheek overschrijven',
        lib_overwrite_msg: 'Er bestaat al een gebruikersbibliotheek met voorvoegsel "{0}". Overschrijven?',
        name_empty: 'De naam mag niet leeg zijn.',
        key_empty: 'De sleutel mag niet leeg zijn.',
        key_exists: 'De sleutel bestaat al.',
    },
    ru: {
        symb_origin_hint: 'Начало (перетащите перекрестие, правый клик = переключить сетку):',
        macropicker_header: 'Компоненты',
        macropicker_search: 'Поиск компонентов...',
        lib_overwrite_title: 'Перезаписать библиотеку',
        lib_overwrite_msg: 'Пользовательская библиотека с префиксом «{0}» уже существует. Перезаписать?',
        name_empty: 'Имя не должно быть пустым.',
        key_empty: 'Ключ не должен быть пустым.',
        key_exists: 'Ключ уже существует.',
    },
    zh: {
        symb_origin_hint: '原点（拖动十字准线，右键=切换网格）:',
        macropicker_header: '元件',
        macropicker_search: '搜索元件...',
        lib_overwrite_title: '覆盖库',
        lib_overwrite_msg: '前缀为“{0}”的用户库已存在。是否覆盖？',
        name_empty: '名称不能为空。',
        key_empty: '键不能为空。',
        key_exists: '键已存在。',
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
