const { contextBridge, ipcRenderer } = require('electron');

/*
 * The only surface the renderer gets. Everything here is a narrow, named
 * operation the main process validates before touching the filesystem — the
 * renderer never receives `fs`, `path`, or a general IPC channel.
 */
contextBridge.exposeInMainWorld('fidocadDesktop', {
    platform: process.platform,

    /** Circuit the OS handed us at launch, if any. Consumed once. */
    consumePendingFile: () => ipcRenderer.invoke('desktop:consume-pending-file'),

    /** Circuits opened later, via "Open With" on an already-running app. */
    onOpenFile: (callback) => {
        ipcRenderer.on('desktop:open-file', (_event, payload) => callback(payload));
    },

    /** Native Save dialog. Resolves to null when the user cancels. */
    showSaveDialog: (suggestedName) => ipcRenderer.invoke('desktop:save-dialog', suggestedName),

    readFile: (filePath) => ipcRenderer.invoke('desktop:read-file', filePath),

    writeFile: (filePath, contents) => ipcRenderer.invoke('desktop:write-file', filePath, contents),
});
