const {
    app,
    BrowserWindow,
    Menu,
    dialog,
    ipcMain,
    net,
    protocol,
    session,
    shell,
} = require('electron');
const { existsSync, statSync } = require('node:fs');
const { readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

/*
 * The renderer is served over a custom `app://` scheme rather than `file://`.
 * Registered as standard + secure below, it gives the bundle a stable origin,
 * which `file://` does not: localStorage and IndexedDB (where user libraries
 * and the linked-folder handle live) would otherwise be wiped between runs,
 * `fetch()` of the .fcl libraries would fail on an opaque origin, and the
 * app's own `default-src 'self'` CSP would have nothing to resolve against.
 */
const APP_SCHEME = 'app';
const APP_HOST = 'fidocadjs';
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
const RENDERER_ROOT = path.join(__dirname, '..', 'dist-desktop');

// Set by `npm run desktop:dev` so the window loads from Vite with hot reload
// instead of the built bundle.
const DEV_SERVER_URL = process.env.FIDOCADJS_DEV_SERVER_URL || null;

const OPENABLE = /\.(?:fcd|txt)$/i;

// Determines the Linux WM_CLASS (so the launcher matches the window to its
// .desktop entry and icon), the Windows taskbar identity, and the name of the
// per-user data directory holding localStorage and IndexedDB. Must be set
// before the app is ready.
app.setName('FidoCadJS');
if (process.platform === 'win32') app.setAppUserModelId('net.fidocadjs.app');

/**
 * Paths the user has explicitly opened or picked in a save dialog. The renderer
 * may only write to these: it is our own code, but a compromised renderer
 * should not get arbitrary filesystem write access for free.
 */
const writablePaths = new Set();

/** File the OS asked us to open before the renderer was ready to receive it. */
let pendingFile = null;
let mainWindow = null;
let quitConfirmed = false;

/** Set while a quit (rather than a plain window close) is in flight, so the
 *  confirmation can finish the quit the user actually asked for. */
let quitRequested = false;

protocol.registerSchemesAsPrivileged([
    {
        scheme: APP_SCHEME,
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            stream: true,
            codeCache: true,
        },
    },
]);

/** Serve the built renderer out of dist-desktop over the app:// scheme. */
function registerAppProtocol() {
    protocol.handle(APP_SCHEME, async (request) => {
        const url = new URL(request.url);
        if (url.host !== APP_HOST) {
            return new Response('Not found', { status: 404 });
        }
        const requested = decodeURIComponent(url.pathname);
        // `path.resolve` collapses any `..` before the containment check, so a
        // crafted URL cannot escape the bundle directory.
        const filePath =
            requested === '/'
                ? path.join(RENDERER_ROOT, 'index.html')
                : path.resolve(RENDERER_ROOT, `.${requested}`);
        if (filePath !== RENDERER_ROOT && !filePath.startsWith(RENDERER_ROOT + path.sep)) {
            return new Response('Forbidden', { status: 403 });
        }
        try {
            return await net.fetch(pathToFileURL(filePath).toString());
        } catch {
            return new Response('Not found', { status: 404 });
        }
    });
}

/**
 * Pick the first openable circuit out of a process argv. Electron passes the
 * executable (packaged) or the executable plus the app directory (unpackaged)
 * ahead of the user's arguments.
 */
function circuitPathFromArgv(argv) {
    for (const arg of argv.slice(app.isPackaged ? 1 : 2)) {
        if (arg.startsWith('-') || !OPENABLE.test(arg)) continue;
        const resolved = path.resolve(arg);
        if (existsSync(resolved) && statSync(resolved).isFile()) return resolved;
    }
    return null;
}

/** Read a circuit off disk into the payload shape the renderer consumes. */
async function readCircuit(filePath) {
    const text = await readFile(filePath, 'utf8');
    writablePaths.add(filePath);
    return { path: filePath, name: path.basename(filePath), text };
}

/** Hand a circuit to the renderer, holding it back until the renderer is up. */
async function openCircuit(filePath) {
    let payload;
    try {
        payload = await readCircuit(filePath);
    } catch (err) {
        dialog.showErrorBox('FidoCadJS', `Could not open ${filePath}:\n${err.message}`);
        return;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('desktop:open-file', payload);
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    } else {
        pendingFile = payload;
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 860,
        minWidth: 900,
        minHeight: 600,
        show: false,
        backgroundColor: '#ffffff',
        icon: path.join(__dirname, '..', 'public', 'icons', 'icon-512.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            spellcheck: false,
        },
    });

    mainWindow.once('ready-to-show', () => mainWindow.show());

    // The editor draws its own menu bar in the DOM; a second native one would
    // just be an empty duplicate. macOS keeps a native menu because the
    // standard clipboard and quit accelerators come from it.
    if (process.platform !== 'darwin') {
        Menu.setApplicationMenu(null);
    } else {
        Menu.setApplicationMenu(Menu.buildFromTemplate(macMenuTemplate()));
    }

    // Anything that would navigate the window away from the app itself is a
    // link, not navigation: send it to the user's real browser.
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:$/.test(new URL(url).protocol)) void shell.openExternal(url);
        return { action: 'deny' };
    });
    mainWindow.webContents.on('will-navigate', (event, url) => {
        const target = new URL(url);
        const allowed = DEV_SERVER_URL ? new URL(DEV_SERVER_URL).origin : APP_ORIGIN;
        if (target.origin !== allowed) {
            event.preventDefault();
            if (/^https?:$/.test(target.protocol)) void shell.openExternal(url);
        }
    });

    mainWindow.on('close', (event) => {
        if (quitConfirmed) return;
        event.preventDefault();
        void confirmClose();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    if (DEV_SERVER_URL) {
        void mainWindow.loadURL(DEV_SERVER_URL);
    } else {
        void mainWindow.loadURL(`${APP_ORIGIN}/index.html`);
    }
}

/**
 * Ask the renderer whether the drawing has unsaved edits and, if so, confirm
 * before closing. Unlike a browser tab there is no other copy of the work, so
 * quitting silently would lose it.
 */
async function confirmClose() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    let dirty = false;
    try {
        dirty = await mainWindow.webContents.executeJavaScript(
            'Boolean(window.__fidocadDesktop__ && window.__fidocadDesktop__.isDirty())',
            true,
        );
    } catch {
        // Renderer is gone or unresponsive — nothing to protect.
    }
    if (dirty) {
        const { response } = await dialog.showMessageBox(mainWindow, {
            type: 'warning',
            buttons: ['Cancel', 'Discard changes'],
            defaultId: 0,
            cancelId: 0,
            message: 'This drawing has unsaved changes.',
            detail: 'Closing now discards them.',
        });
        if (response === 0) {
            quitRequested = false;
            return;
        }
    }
    quitConfirmed = true;
    mainWindow.close();
    // On macOS closing the last window does not quit, so a cancelled-then-
    // confirmed Cmd+Q has to be finished by hand.
    if (quitRequested) app.quit();
}

function macMenuTemplate() {
    return [
        { role: 'appMenu' },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' },
            ],
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' },
            ],
        },
        { role: 'windowMenu' },
    ];
}

function registerIpc() {
    // Called once the renderer has booted; delivers a file the OS handed us
    // before the window existed.
    ipcMain.handle('desktop:consume-pending-file', () => {
        const payload = pendingFile;
        pendingFile = null;
        return payload;
    });

    ipcMain.handle('desktop:save-dialog', async (_event, suggestedName) => {
        if (!mainWindow || mainWindow.isDestroyed()) return null;
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
            defaultPath: typeof suggestedName === 'string' ? suggestedName : 'circuit.fcd',
            filters: [
                { name: 'FidoCadJ circuit', extensions: ['fcd'] },
                { name: 'All files', extensions: ['*'] },
            ],
        });
        if (canceled || !filePath) return null;
        writablePaths.add(filePath);
        return { path: filePath, name: path.basename(filePath) };
    });

    ipcMain.handle('desktop:write-file', async (_event, filePath, contents) => {
        if (typeof filePath !== 'string' || !writablePaths.has(filePath)) {
            throw new Error('Refusing to write to a path the user has not chosen');
        }
        await writeFile(filePath, String(contents), 'utf8');
    });

    ipcMain.handle('desktop:read-file', async (_event, filePath) => {
        if (typeof filePath !== 'string' || !writablePaths.has(filePath)) {
            throw new Error('Refusing to read a path the user has not chosen');
        }
        return readFile(filePath, 'utf8');
    });
}

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    // A quit request reaches the window as a `close`; remember it so the
    // confirmation can complete the quit rather than only closing the window.
    app.on('before-quit', () => {
        quitRequested = true;
    });

    app.on('second-instance', (_event, argv) => {
        const filePath = circuitPathFromArgv(argv);
        if (filePath) {
            void openCircuit(filePath);
        } else if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    // macOS delivers "Open With" through this event, often before `ready`.
    app.on('open-file', (event, filePath) => {
        event.preventDefault();
        void openCircuit(filePath);
    });

    void app.whenReady().then(async () => {
        registerAppProtocol();
        registerIpc();

        // Exports and the Save-As fallback both go through anchor downloads;
        // suggest the filename the renderer asked for rather than silently
        // dropping the file into ~/Downloads.
        session.defaultSession.on('will-download', (_event, item) => {
            item.setSaveDialogOptions({ defaultPath: item.getFilename() });
        });

        const startupFile = circuitPathFromArgv(process.argv);
        if (startupFile) {
            try {
                pendingFile = await readCircuit(startupFile);
            } catch {
                pendingFile = null;
            }
        }

        createWindow();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit();
    });
}
