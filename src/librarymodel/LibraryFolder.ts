/**
 * @file LibraryFolder.ts
 * @author Dante Loi
 * @date 2026-06-02
 * @brief Filesystem-backed storage for user libraries via the File System
 *        Access API, with the chosen directory handle persisted in IndexedDB.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 *
 * @details
 * Lets the user pick a real filesystem folder (e.g. a Dropbox/iCloud/Drive
 * synced folder) where user libraries are written as `<prefix>.fcl` files, so
 * they are portable across browsers and devices. The directory *handle* itself
 * is browser-local (stored in IndexedDB, as handles are structured-cloneable),
 * but the library *files* live in the real filesystem.
 *
 * Only Chromium-based browsers expose `showDirectoryPicker`; elsewhere
 * {@link LibraryFolder.isSupported} returns false and all operations are
 * no-ops, leaving the localStorage backend in charge.
 */

// ── Minimal typings for File System Access API extras not in lib.dom ──────────

type PermissionMode = 'read' | 'readwrite';

interface PermissionCapableHandle {
    queryPermission(desc: { mode: PermissionMode }): Promise<PermissionState>;
    requestPermission(desc: { mode: PermissionMode }): Promise<PermissionState>;
}

interface IterableDirectoryHandle extends FileSystemDirectoryHandle {
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
}

// ── IndexedDB handle store ────────────────────────────────────────────────────

const DB_NAME = 'fidocadts';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'userLibraryDir';

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
    const db = await openDb();
    try {
        return await new Promise<T | undefined>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(key);
            req.onsuccess = () => resolve(req.result as T | undefined);
            req.onerror = () => reject(req.error);
        });
    } finally {
        db.close();
    }
}

async function idbSet(key: string, value: unknown): Promise<void> {
    const db = await openDb();
    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } finally {
        db.close();
    }
}

async function idbDelete(key: string): Promise<void> {
    const db = await openDb();
    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } finally {
        db.close();
    }
}

// ── Permission helpers ────────────────────────────────────────────────────────

async function hasPermission(
    handle: FileSystemHandle,
    mode: PermissionMode,
    requestIfNeeded: boolean,
): Promise<boolean> {
    const perm = handle as unknown as PermissionCapableHandle;
    if (typeof perm.queryPermission !== 'function') return true; // pre-permission impls
    if ((await perm.queryPermission({ mode })) === 'granted') return true;
    if (requestIfNeeded && (await perm.requestPermission({ mode })) === 'granted') return true;
    return false;
}

/** Make a prefix safe to use as a filename (mirrors the localStorage prefix). */
function fileNameFor(prefix: string): string {
    return prefix.replace(/[^a-zA-Z0-9_-]/g, '_') + '.fcl';
}

export class LibraryFolder {
    private constructor() {}

    /** True when the browser exposes the File System Access directory picker. */
    static isSupported(): boolean {
        return (
            typeof (globalThis as { showDirectoryPicker?: unknown }).showDirectoryPicker ===
                'function' && typeof indexedDB !== 'undefined'
        );
    }

    /** Name of the currently linked directory, or null if none is linked. */
    static async getLinkedDirectoryName(): Promise<string | null> {
        if (!LibraryFolder.isSupported()) return null;
        try {
            const handle = await idbGet<FileSystemDirectoryHandle>(HANDLE_KEY);
            return handle?.name ?? null;
        } catch {
            return null;
        }
    }

    /**
     * Prompt the user to pick a directory (requires a user gesture), persist the
     * handle, and return it. Returns null if the user cancels or it fails.
     */
    static async chooseDirectory(): Promise<FileSystemDirectoryHandle | null> {
        if (!LibraryFolder.isSupported()) return null;
        const picker = (
            globalThis as {
                showDirectoryPicker?: (opts?: {
                    mode?: PermissionMode;
                }) => Promise<FileSystemDirectoryHandle>;
            }
        ).showDirectoryPicker;
        if (!picker) return null;
        try {
            const handle = await picker({ mode: 'readwrite' });
            // Ask for read/write up-front, while we still hold the user gesture.
            if (!(await hasPermission(handle, 'readwrite', true))) return null;
            await idbSet(HANDLE_KEY, handle);
            return handle;
        } catch (err) {
            if ((err as DOMException)?.name === 'AbortError') return null;
            console.error('LibraryFolder.chooseDirectory failed:', err);
            return null;
        }
    }

    /** Forget the linked directory (does not touch the files inside it). */
    static async unlink(): Promise<void> {
        if (typeof indexedDB === 'undefined') return;
        try {
            await idbDelete(HANDLE_KEY);
        } catch (err) {
            console.error('LibraryFolder.unlink failed:', err);
        }
    }

    /**
     * Resolve the linked directory handle if one exists and we already hold the
     * given permission. Pass `requestIfNeeded=true` only from a user-gesture
     * context (e.g. a button click), never from background/startup code.
     */
    private static async getHandle(
        mode: PermissionMode,
        requestIfNeeded: boolean,
    ): Promise<FileSystemDirectoryHandle | null> {
        if (!LibraryFolder.isSupported()) return null;
        let handle: FileSystemDirectoryHandle | undefined;
        try {
            handle = await idbGet<FileSystemDirectoryHandle>(HANDLE_KEY);
        } catch {
            return null;
        }
        if (!handle) return null;
        return (await hasPermission(handle, mode, requestIfNeeded)) ? handle : null;
    }

    /**
     * Read every `*.fcl` file in the linked directory as a `prefix → text` map.
     * Returns null when no directory is linked or permission is unavailable.
     */
    static async readAll(requestIfNeeded = false): Promise<Map<string, string> | null> {
        const handle = await LibraryFolder.getHandle('read', requestIfNeeded);
        if (!handle) return null;
        const out = new Map<string, string>();
        try {
            const dir = handle as IterableDirectoryHandle;
            for await (const [name, entry] of dir.entries()) {
                if (entry.kind !== 'file' || !/\.fcl$/i.test(name)) continue;
                const file = await (entry as FileSystemFileHandle).getFile();
                out.set(name.replace(/\.fcl$/i, ''), await file.text());
            }
        } catch (err) {
            console.error('LibraryFolder.readAll failed:', err);
            return null;
        }
        return out;
    }

    /**
     * Write a single library to the linked directory. Silent no-op when no
     * directory is linked or write permission is not currently held — the
     * localStorage copy remains the safety net in that case.
     */
    static async mirrorWrite(prefix: string, fclText: string): Promise<void> {
        const handle = await LibraryFolder.getHandle('readwrite', false);
        if (!handle) return;
        try {
            const fileHandle = await handle.getFileHandle(fileNameFor(prefix), { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(fclText);
            await writable.close();
        } catch (err) {
            console.error(`LibraryFolder.mirrorWrite("${prefix}") failed:`, err);
        }
    }

    /** Delete a single library file from the linked directory (best-effort). */
    static async mirrorDelete(prefix: string): Promise<void> {
        const handle = await LibraryFolder.getHandle('readwrite', false);
        if (!handle) return;
        try {
            await handle.removeEntry(fileNameFor(prefix));
        } catch (err) {
            // Missing file is fine; log anything else.
            if ((err as DOMException)?.name !== 'NotFoundError') {
                console.error(`LibraryFolder.mirrorDelete("${prefix}") failed:`, err);
            }
        }
    }
}
