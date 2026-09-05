/**
 * Renderer half of the Electron integration.
 *
 * Electron's Chromium provides the File System Access API on the app:// origin,
 * so Save, Save As and the linked library folder all work unchanged. The one
 * capability it lacks is the Launch Queue: files the OS hands to the app arrive
 * over IPC as plain text instead of as `FileSystemFileHandle`s. This module
 * wraps such a file in a handle-shaped object so the editor's existing
 * save-in-place path keeps working for circuits opened from the desktop.
 */

/** A circuit the OS asked the app to open. */
export interface DesktopLaunchFile {
    /** Absolute path on disk; the main process authorises writes against it. */
    path: string;
    name: string;
    text: string;
}

interface DesktopApi {
    platform: string;
    consumePendingFile(): Promise<DesktopLaunchFile | null>;
    onOpenFile(callback: (file: DesktopLaunchFile) => void): void;
    showSaveDialog(suggestedName: string): Promise<{ path: string; name: string } | null>;
    readFile(path: string): Promise<string>;
    writeFile(path: string, contents: string): Promise<void>;
}

/** The preload bridge, or null when running as an ordinary web page. */
export function getDesktopApi(): DesktopApi | null {
    return (globalThis as { fidocadDesktop?: DesktopApi }).fidocadDesktop ?? null;
}

export function isDesktop(): boolean {
    return getDesktopApi() !== null;
}

/**
 * Wrap an on-disk path in the subset of `FileSystemFileHandle` the editor
 * actually uses: `name`, `getFile()`, and `createWritable()` → write → close.
 * Writes are funnelled back through IPC to the path the user opened.
 */
function createFileHandle(api: DesktopApi, filePath: string, name: string): FileSystemFileHandle {
    const handle = {
        kind: 'file' as const,
        name,

        async getFile(): Promise<File> {
            const text = await api.readFile(filePath);
            return new File([text], name, { type: 'text/plain' });
        },

        createWritable(): Promise<FileSystemWritableFileStream> {
            // The writable buffers, then commits on close — the same
            // write-then-close contract the real API offers, so a failed write
            // leaves the original file untouched.
            let buffer = '';
            const writable = {
                write(data: unknown): Promise<void> {
                    buffer += typeof data === 'string' ? data : String(data);
                    return Promise.resolve();
                },
                close(): Promise<void> {
                    return api.writeFile(filePath, buffer);
                },
                abort(): Promise<void> {
                    buffer = '';
                    return Promise.resolve();
                },
            };
            return Promise.resolve(writable as unknown as FileSystemWritableFileStream);
        },

        queryPermission(): Promise<PermissionState> {
            return Promise.resolve('granted' as PermissionState);
        },
        requestPermission(): Promise<PermissionState> {
            return Promise.resolve('granted' as PermissionState);
        },
        isSameEntry(other: FileSystemHandle): Promise<boolean> {
            return Promise.resolve(other === (handle as unknown as FileSystemHandle));
        },
    };
    return handle as unknown as FileSystemFileHandle;
}

export interface DesktopIntegrationOptions {
    /** Resolves once libraries are parsed; a circuit opened before that would
     *  silently lose every macro reference. */
    librariesReady: Promise<void>;
    /** Load an OS-opened circuit into the editor. */
    openCircuit(file: DesktopLaunchFile, handle: FileSystemFileHandle): void;
    /** Whether the drawing has unsaved edits — read by the close confirmation. */
    isDirty(): boolean;
}

/**
 * Wire the desktop host to the editor. No-op in a browser.
 */
export function initDesktopIntegration(options: DesktopIntegrationOptions): void {
    const api = getDesktopApi();
    if (!api) return;

    // The main process reads this over executeJavaScript before closing the
    // window, so a quit cannot silently discard unsaved work.
    (globalThis as { __fidocadDesktop__?: { isDirty(): boolean } }).__fidocadDesktop__ = {
        isDirty: () => {
            try {
                return options.isDirty();
            } catch {
                return false;
            }
        },
    };

    const deliver = (file: DesktopLaunchFile): void => {
        void options.librariesReady.then(() => {
            options.openCircuit(file, createFileHandle(api, file.path, file.name));
        });
    };

    // A file passed on the command line at launch, plus any later "Open With"
    // on the already-running instance.
    api.onOpenFile(deliver);
    void api
        .consumePendingFile()
        .then((file) => {
            if (file) deliver(file);
        })
        .catch((err: unknown) => console.error('Failed to read launched file:', err));
}
