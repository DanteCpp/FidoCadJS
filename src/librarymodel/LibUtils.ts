/**
 * @file LibUtils.ts
 * @author Dante Loi
 * @date 2026-04-27
 * @brief Static utility functions for library text processing and key validation.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 *
 * Browser port of fidocadj.globals.LibUtils (phylum2, Davide Bucci, 2012-2023).
 */

import { MacroDesc } from '../primitives/MacroDesc.js';

const STD_FILENAMES = new Set(['', 'FCDstdlib', 'PCB', 'elettrotecnica', 'EY_Libraries', 'IHRAM']);

export class LibUtils {

    private constructor() {}

    /** Serialize macros to FCL format text. */
    static prepareText(macros: Map<string, MacroDesc>, name: string): string {
        const byCategory = new Map<string, MacroDesc[]>();

        for (const md of macros.values()) {
            const cat = md.category.trim();
            let list = byCategory.get(cat);
            if (!list) {
                list = [];
                byCategory.set(cat, list);
            }
            list.push(md);
        }

        let sb = `[FIDOLIB ${name}]\n`;
        for (const [cat, list] of byCategory) {
            sb += `{${cat}}\n`;
            for (const md of list) {
                const plainKey = md.key.includes('.')
                    ? md.key.substring(md.key.lastIndexOf('.') + 1)
                    : md.key;
                sb += `[${plainKey.toUpperCase()} ${md.name.trim()}]\n`;
                let desc = md.description;
                if (desc.startsWith('\n')) desc = desc.substring(1);
                sb += desc + '\n';
            }
        }
        return sb;
    }

    /** Returns true if the key already exists or contains ']'. */
    static checkKey(libref: Map<string, MacroDesc>, tlib: string, key: string): boolean {
        for (const md of libref.values()) {
            if (md.filename.toLowerCase() === tlib.toLowerCase() &&
                md.key.toLowerCase() === key.trim().toLowerCase()) {
                return true;
            }
        }
        return key.includes(']');
    }

    /** Returns true if the key is a duplicate in the library. */
    static checkKeyDuplicate(libref: Map<string, MacroDesc>, tlib: string, fullKey: string): boolean {
        for (const md of libref.values()) {
            if (md.filename.toLowerCase() === tlib.toLowerCase() &&
                md.key.toLowerCase() === fullKey.trim().toLowerCase()) {
                return true;
            }
        }
        return false;
    }

    /** Returns true if the key contains invalid characters (space, dot, ]). */
    static checkKeyInvalidChars(key: string): boolean {
        return key.includes(' ') || key.includes('.') || key.includes(']');
    }

    /** Returns unique category names for a given library prefix. */
    static enumGroups(libref: Map<string, MacroDesc>, prefix: string): string[] {
        const groups: string[] = [];
        for (const md of libref.values()) {
            if (md.filename.trim().toLowerCase() === prefix.trim().toLowerCase() &&
                !groups.includes(md.category)) {
                groups.push(md.category);
            }
        }
        return groups;
    }

    /** Returns the library display name for a given prefix. */
    static getLibName(libref: Map<string, MacroDesc>, prefix: string): string | null {
        for (const md of libref.values()) {
            if (md.filename.trim().toLowerCase() === prefix.trim().toLowerCase()) {
                return md.library;
            }
        }
        return null;
    }

    /** Determines whether a macro belongs to a standard library. */
    static isStdLib(macro: MacroDesc): boolean {
        if (!macro.key.includes('.')) return true;
        const library = macro.key.substring(0, macro.key.indexOf('.')).toLowerCase();
        return STD_FILENAMES.has(library) || STD_FILENAMES.has(macro.filename);
    }

    /** Returns the set of standard library filename prefixes. */
    static getStdFilenames(): Set<string> {
        return STD_FILENAMES;
    }
}
