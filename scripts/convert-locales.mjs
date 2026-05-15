#!/usr/bin/env node
/**
 * @file convert-locales.mjs
 * @author Dante Loi
 * @date 2026-05-15
 * @brief One-shot converter: FidoCadJ MessagesBundle_*.properties → JSON
 * @copyright Copyright 2026 Dante Loi - GPL v3
 * @details Reads each Java properties bundle from the FidoCadJ source tree
 *          (UTF-8, no continuation lines, comments start with `#` or `!`) and
 *          writes the equivalent JSON file to src/i18n/locales/. Resolves
 *          Java unicode escapes (\\uXXXX) and standard escapes (\\n, \\t, \\\\).
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SRC_DIR = resolve(__dirname, '..', '..', 'FidoCadJ', 'bin');
const DST_DIR = resolve(__dirname, '..', 'src', 'i18n', 'locales');

function unescapeJavaProperties(value) {
    // Order matters: handle backslash escapes left-to-right.
    let out = '';
    for (let i = 0; i < value.length; i++) {
        const c = value[i];
        if (c !== '\\') {
            out += c;
            continue;
        }
        const next = value[i + 1];
        if (next === 'u') {
            const hex = value.slice(i + 2, i + 6);
            if (/^[0-9a-fA-F]{4}$/.test(hex)) {
                out += String.fromCharCode(parseInt(hex, 16));
                i += 5;
                continue;
            }
        }
        switch (next) {
            case 'n':
                out += '\n';
                break;
            case 't':
                out += '\t';
                break;
            case 'r':
                out += '\r';
                break;
            case '\\':
                out += '\\';
                break;
            case '"':
                out += '"';
                break;
            case "'":
                out += "'";
                break;
            default:
                // Unknown escape: preserve the backslash so user-facing help
                // strings that document escapes (e.g. text_hints) remain intact.
                out += '\\' + (next ?? '');
        }
        i += 1;
    }
    return out;
}

function mergeFidoCadJSExtras(locale, obj) {
    // Keys added by FidoCadJS that are not in the upstream FidoCadJ bundle.
    // Use English text as fallback for non-English locales (caller can
    // translate later).
    const extras = {
        NothingSelected: 'No primitives have been selected for the creation of a symbol.',
        SymbolCreated: 'Symbol created successfully.',
        StorageError: 'Could not save library. Browser storage might be full.',
        NewLibrary: 'New Library',
        Paste_btn: 'Paste',
    };
    for (const [k, v] of Object.entries(extras)) {
        if (!obj[k]) obj[k] = v;
    }
    return obj;
}

function parseProperties(text) {
    // Strip BOM if present
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const result = {};
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) continue;
        const eq = trimmed.indexOf('=');
        if (eq < 0) continue;
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).replace(/^\s+/, '');
        if (!key) continue;
        result[key] = unescapeJavaProperties(value);
    }
    return result;
}

function main() {
    const files = readdirSync(SRC_DIR).filter((f) =>
        /^MessagesBundle_[a-z]{2}\.properties$/.test(f),
    );
    if (files.length === 0) {
        console.error(`No bundles found in ${SRC_DIR}`);
        process.exit(1);
    }
    for (const file of files) {
        const m = /^MessagesBundle_([a-z]{2})\.properties$/.exec(file);
        if (!m) continue;
        const locale = m[1];
        if (locale === 'en') {
            // Skip English: the FidoCadJS-curated en.json is authoritative.
            continue;
        }
        const src = join(SRC_DIR, file);
        const dst = join(DST_DIR, `${locale}.json`);
        const text = readFileSync(src, 'utf8');
        const obj = mergeFidoCadJSExtras(locale, parseProperties(text));
        writeFileSync(dst, JSON.stringify(obj, null, 2) + '\n', 'utf8');
        console.log(`Wrote ${locale}.json (${Object.keys(obj).length} keys)`);
    }
}

main();
