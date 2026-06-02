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
import { LibraryFolder } from './LibraryFolder.js';
import { Toast } from '../ui/Toast.js';
import { getString } from '../i18n/i18n.js';

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
                    Toast.show(getString('Userlib_load_error').replace('{0}', prefix), 'error');
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
            // Mirror to the linked filesystem folder, if any. Fire-and-forget:
            // localStorage is the synchronous source of truth and safety net.
            void LibraryFolder.mirrorWrite(prefix, fclText);
        } catch (e) {
            Toast.show(getString('Userlib_save_error'), 'error');
            console.error('Failed to save user library:', e);
            throw new Error('StorageError');
        }
    }

    /** Delete a user library from localStorage (and the linked folder, if any). */
    static deleteUserLibrary(prefix: string): void {
        localStorage.removeItem(LIB_PREFIX + prefix);
        UserLibraryStorage.removePrefix(prefix);
        void LibraryFolder.mirrorDelete(prefix);
    }

    /**
     * Pull libraries from the linked filesystem folder into localStorage so the
     * in-memory model can load them synchronously. The folder copy wins on
     * conflicting prefixes (it is the portable, cross-browser master). Safe to
     * call at startup: it only uses already-granted permission and is a no-op
     * when no folder is linked.
     */
    static async syncFromFolder(): Promise<void> {
        const folderLibs = await LibraryFolder.readAll(false);
        if (!folderLibs) return;
        for (const [prefix, text] of folderLibs) {
            localStorage.setItem(LIB_PREFIX + prefix, text);
            UserLibraryStorage.addPrefix(prefix);
        }
    }

    /**
     * After the user picks a folder (in a gesture): import any folder-only
     * libraries into localStorage, then push every local library out to the
     * folder so it holds the union (the local copy wins on conflicts). This
     * preserves whatever the user currently sees in the app.
     */
    static async linkFolderAndMerge(): Promise<void> {
        const folderLibs = await LibraryFolder.readAll(true);
        if (folderLibs) {
            for (const [prefix, text] of folderLibs) {
                if (localStorage.getItem(LIB_PREFIX + prefix) === null) {
                    localStorage.setItem(LIB_PREFIX + prefix, text);
                    UserLibraryStorage.addPrefix(prefix);
                }
            }
        }
        for (const prefix of UserLibraryStorage.getUserLibraryPrefixes()) {
            const text = localStorage.getItem(LIB_PREFIX + prefix);
            if (text !== null) await LibraryFolder.mirrorWrite(prefix, text);
        }
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
        const prefixes = UserLibraryStorage.getUserLibraryPrefixes().filter((p) => p !== prefix);
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(prefixes));
    }
}
