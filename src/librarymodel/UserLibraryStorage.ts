/**
 * @file UserLibraryStorage.ts
 * @author Dante Loi
 * @date 2026-04-27
 * @brief localStorage persistence layer for user-created component libraries.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 *
 * Browser port of the file-based library persistence in fidocadj.globals.LibUtils.
 * User libraries are stored as FCL-formatted strings keyed by library filename prefix.
 */

import type { ParserActions } from '../circuit/controllers/ParserActions.js';
import { MacroDesc } from '../primitives/MacroDesc.js';
import { LibUtils } from './LibUtils.js';

const REGISTRY_KEY = 'fidocadts.libs.v1';
const LIB_PREFIX = 'fidocadts.lib.v1.';

export class UserLibraryStorage {

    private constructor() {}

    /** Load all user libraries from localStorage into the parser's model. */
    static loadUserLibraries(parserActions: ParserActions): void {
        const prefixes = UserLibraryStorage.getUserLibraryPrefixes();
        for (const prefix of prefixes) {
            const fclText = localStorage.getItem(LIB_PREFIX + prefix);
            if (fclText) {
                try {
                    parserActions.readLibraryString(fclText, prefix);
                } catch (e) {
                    console.error(`Failed to load user library "${prefix}":`, e);
                }
            }
        }
    }

    /** Save a user library to localStorage. */
    static saveUserLibrary(prefix: string, macros: Map<string, MacroDesc>, libName: string): void {
        try {
            const filtered = LibUtils.getLibrary(macros, prefix);
            const fclText = LibUtils.prepareText(filtered, libName);
            localStorage.setItem(LIB_PREFIX + prefix, fclText);
            UserLibraryStorage.addPrefix(prefix);
        } catch (e) {
            console.error('Failed to save user library:', e);
            throw new Error('StorageError');
        }
    }

    /** Delete a user library from localStorage. */
    static deleteUserLibrary(prefix: string): void {
        localStorage.removeItem(LIB_PREFIX + prefix);
        UserLibraryStorage.removePrefix(prefix);
    }

    /** Read the list of user library prefixes from localStorage. */
    static getUserLibraryPrefixes(): string[] {
        try {
            const raw = localStorage.getItem(REGISTRY_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    /** Add a prefix to the registry if not already present. */
    private static addPrefix(prefix: string): void {
        const prefixes = UserLibraryStorage.getUserLibraryPrefixes();
        if (!prefixes.includes(prefix)) {
            prefixes.push(prefix);
            localStorage.setItem(REGISTRY_KEY, JSON.stringify(prefixes));
        }
    }

    /** Remove a prefix from the registry. */
    private static removePrefix(prefix: string): void {
        const prefixes = UserLibraryStorage.getUserLibraryPrefixes().filter(p => p !== prefix);
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(prefixes));
    }
}
