/*
 * Smoke test for the Electron shell. Boots the real desktop/main.cjs, opens a
 * circuit passed on the command line, and asserts that the parts the desktop
 * build changes actually work: the app:// protocol serves the bundle, the
 * libraries fetch over it, the preload bridge is present, and the OS-opened
 * file lands in the editor with a working save handle.
 *
 * Run headless with `npm run desktop:smoke` (wrap in xvfb-run on a machine
 * with no display).
 */

const { app, BrowserWindow } = require('electron');
const { copyFileSync, mkdtempSync, readFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Work on a throwaway copy so the save round-trip below cannot touch the
// fixture in the repository.
const fixture = process.argv[process.argv.length - 1];
const workFile = path.join(mkdtempSync(path.join(os.tmpdir(), 'fidocadjs-smoke-')), 'smoke.fcd');
copyFileSync(fixture, workFile);
process.argv[process.argv.length - 1] = workFile;

const TIMEOUT_MS = 60_000;
const errors = [];
let done = false;

function finish(code, message) {
    if (done) return;
    done = true;
    console.log(message);
    app.exit(code);
}

app.on('browser-window-created', (_event, win) => {
    win.webContents.on('console-message', (event) => {
        if (event.level === 'error') errors.push(event.message);
    });

    win.webContents.once('did-finish-load', async () => {
        try {
            const result = await win.webContents.executeJavaScript(
                `(async () => {
                    const safe = (fn) => { try { return fn(); } catch (e) { return 'ERR: ' + e; } };
                    const safeAsync = async (fn) => {
                        try { return await fn(); } catch (e) { return 'ERR: ' + e; }
                    };
                    const deadline = Date.now() + 30000;
                    const ready = () => Boolean(window.__FidoCadJS__ && window.__FidoCadJS__.librariesLoaded);
                    while (!ready() && Date.now() < deadline) {
                        await new Promise((r) => setTimeout(r, 100));
                    }
                    // The launched circuit is delivered once libraries resolve.
                    await new Promise((r) => setTimeout(r, 500));
                    const panel = window.__FidoCadJS__ && window.__FidoCadJS__.circuitPanel;
                    return {
                        origin: location.origin,
                        secure: window.isSecureContext,
                        librariesLoaded: ready(),
                        macroCount: safe(() => panel.getModel().getLibrary().size),
                        bridgeExposed: typeof window.fidocadDesktop === 'object',
                        dirtyHookExposed:
                            typeof (window.__fidocadDesktop__ || {}).isDirty === 'function',
                        fileSystemAccess: typeof window.showSaveFilePicker === 'function',
                        directoryPicker: typeof window.showDirectoryPicker === 'function',
                        serviceWorkers: await safeAsync(async () =>
                            (await navigator.serviceWorker.getRegistrations()).length),
                        openedFileName: safe(() => panel.getFileName()),
                        openedHandleName: safe(() => (panel.getFileHandle() || {}).name || null),
                        primitiveCount: safe(() => panel.getModel().getPrimitiveVector().length),
                    };
                })()`,
                true,
            );

            const failures = [];
            const check = (name, ok, detail) => {
                if (!ok) failures.push(`${name}${detail ? ` (${detail})` : ''}`);
            };

            check('app:// origin', result.origin === 'app://fidocadjs', result.origin);
            check('secure context', result.secure === true);
            check('libraries loaded', result.librariesLoaded === true);
            check('macros parsed', result.macroCount > 0, `${result.macroCount} macros`);
            check('preload bridge exposed', result.bridgeExposed === true);
            check('close-guard hook exposed', result.dirtyHookExposed === true);
            check('File System Access API', result.fileSystemAccess === true);
            check('directory picker', result.directoryPicker === true);
            check(
                'no service worker registered',
                result.serviceWorkers === 0 || typeof result.serviceWorkers === 'string',
                String(result.serviceWorkers),
            );
            check(
                'launched file opened',
                result.openedFileName === 'smoke.fcd',
                result.openedFileName,
            );
            check(
                'save handle attached',
                result.openedHandleName === 'smoke.fcd',
                result.openedHandleName,
            );
            check(
                'circuit parsed',
                result.primitiveCount > 0,
                `${result.primitiveCount} primitives`,
            );
            check('no console errors', errors.length === 0, errors.join(' | '));

            // Exercise the synthetic handle end to end: the editor's own save
            // path writes through IPC to the file the OS opened.
            const saved = await win.webContents.executeJavaScript(
                `(async () => {
                    try {
                        const panel = window.__FidoCadJS__.circuitPanel;
                        const handle = panel.getFileHandle();
                        const writable = await handle.createWritable();
                        await writable.write(panel.getCircuitText());
                        await writable.close();
                        return 'ok';
                    } catch (e) {
                        return 'ERR: ' + e;
                    }
                })()`,
                true,
            );
            check('save through handle', saved === 'ok', String(saved));
            // The main process must refuse paths the user never opened or picked.
            const denied = await win.webContents.executeJavaScript(
                `window.fidocadDesktop
                    .writeFile('/tmp/fidocadjs-smoke-unauthorised.fcd', 'nope')
                    .then(() => 'WROTE')
                    .catch(() => 'DENIED')`,
                true,
            );
            check('unapproved write refused', denied === 'DENIED', String(denied));

            const onDisk = readFileSync(workFile, 'utf8');
            check('file written to disk', onDisk.startsWith('[FIDOCAD]'), onDisk.slice(0, 40));
            check('drawing round-tripped', onDisk.includes('LI '), `${onDisk.length} bytes`);

            console.log(
                JSON.stringify({ ...result, saved, denied, bytesOnDisk: onDisk.length }, null, 2),
            );
            if (failures.length > 0) {
                finish(1, `FAIL:\n  - ${failures.join('\n  - ')}`);
            } else {
                finish(0, 'PASS: desktop shell smoke test');
            }
        } catch (err) {
            finish(
                1,
                `FAIL: smoke test threw: ${(err && err.stack) || require('node:util').inspect(err)}`,
            );
        }
    });
});

setTimeout(() => finish(1, 'FAIL: smoke test timed out'), TIMEOUT_MS).unref();

// Boot the real main process. It reads the circuit path off process.argv.
require(path.join(__dirname, '..', 'desktop', 'main.cjs'));
