# Desktop App (Electron)

**Author:** Dante Loi
**Date:** 2026-09-05

## Overview

FidoCadJS ships an optional desktop build: the same renderer, wrapped in
Electron, packaged as a standalone application that needs no browser and no
network. The editor source is shared verbatim with the web build — the desktop
layer adds a main process, a preload bridge, and a separate Vite config.

Electron bundles its own Chromium, so every web platform API the editor already
relies on keeps working: the File System Access API (Save, Save As, and the
linked library folder), `ClipboardItem` image copy, Canvas 2D, and IndexedDB.
Nothing in `src/` had to be rewritten to run on the desktop.

## Layout

| Path                     | Role                                                      |
| ------------------------ | --------------------------------------------------------- |
| `desktop/main.cjs`       | Main process: window, `app://` protocol, file open, IPC.   |
| `desktop/preload.cjs`    | The renderer's only privileged surface (`contextBridge`).  |
| `src/desktop/desktopBridge.ts` | Renderer half: OS-opened files, close guard.         |
| `vite.config.desktop.ts` | Renderer build → `dist-desktop/`.                          |
| `electron-builder.yml`   | Packaging targets and desktop integration metadata.        |
| `scripts/desktop-smoke.cjs` | Headless end-to-end check of the shell.                 |

## The `app://` protocol

The renderer is **not** loaded over `file://`. It is served from a custom
`app://fidocadjs` scheme, registered as `standard` and `secure`. That choice is
load-bearing rather than cosmetic:

- **Storage persists.** `localStorage` and IndexedDB are keyed by origin.
  `file://` has an opaque origin, so user libraries, saved settings, and the
  linked-folder handle would be discarded between runs.
- **The libraries load at all.** `LibraryLoader` fetches the bundled `.fcl`
  files with `fetch()`. On an opaque origin those requests fail outright.
- **The app's own CSP resolves.** `index.html` ships
  `default-src 'self'`; `'self'` needs a real origin to mean anything.
- **It is a secure context**, which the File System Access API requires.

`vite.config.desktop.ts` therefore builds with `base: './'` so the bundle
addresses its assets relatively, and the main process maps request paths onto
`dist-desktop/`, rejecting anything that resolves outside it.

## Opening files from the OS

The web build uses the Launch Queue (`window.launchQueue`) for its
installed-PWA file handler. Electron has no Launch Queue: a path arrives on
`process.argv` (Linux, Windows), through the `open-file` event (macOS), or via
`second-instance` when the app is already running.

The main process reads the file and hands the renderer `{path, name, text}`.
`src/desktop/desktopBridge.ts` then wraps that path in an object exposing the
slice of `FileSystemFileHandle` the editor actually uses — `name`, `getFile()`,
and `createWritable()` → `write()` → `close()` — with writes routed back over
IPC. The editor's existing save path is unchanged, so **Save** on a circuit
opened from the file manager writes straight back to that file instead of
re-prompting.

Writes are authorised against a set of paths the user actually opened or picked
in a save dialog; the main process refuses anything else.

## Differences from the web build

- **No service worker.** The desktop app already ships every asset locally, and
  a worker cannot be registered on the `app://` scheme. `sw.js` is stripped from
  `dist-desktop/` and registration is skipped at runtime (`isDesktop()`).
- **Close confirmation.** A browser tab is not the only copy of the drawing, but
  a desktop window is. Closing with unsaved edits asks first.
- **Native menu.** The editor draws its own menu bar, so the native one is
  removed on Linux and Windows. macOS keeps a minimal menu because the standard
  clipboard and quit accelerators come from it.

## Development

```bash
npm run desktop:build     # build the renderer into dist-desktop/
npm run desktop:start     # build, then launch the app
npm run desktop:smoke     # headless end-to-end check of the shell
```

For hot reload, run the renderer and the shell in two terminals:

```bash
npm run desktop:dev       # terminal 1 — Vite dev server on :5173
npm run desktop:shell     # terminal 2 — Electron pointed at it
```

`desktop:shell` sets `FIDOCADJS_DEV_SERVER_URL`; without it the shell always
loads the built bundle over `app://`.

## Packaging

```bash
npm run desktop:pack      # unpacked directory in release/ (fast, for testing)
npm run desktop:dist      # installers for the host platform
```

Targets are AppImage + deb (Linux), NSIS (Windows), and dmg (macOS). Each build
produces a self-contained ~130 MB application: Chromium is the bulk of it.
electron-builder cross-compiles poorly, so build each platform on that platform
(or in CI).

### Host prerequisites

electron-builder shells out to tools that are not part of the npm install:

- **`.deb`** needs `libcrypt.so.1` for its bundled `fpm`. On Arch this comes
  from `libxcrypt-compat`; Debian and Ubuntu already have it.
- **Running** a built `.AppImage` needs FUSE 2 (`fuse2` on Arch). Without it the
  image still builds, and `--appimage-extract` runs it.

Neither affects the app itself — only the machine building or launching it.

## Known trade-offs

- The Linux `WM_CLASS` is `fidocadts`, taken from the `name` field in
  `package.json` before `main.cjs` runs, so `app.setName()` cannot change it.
  `electron-builder.yml` sets `StartupWMClass` to match; renaming the npm
  package would let both read `fidocadjs`.
- `desktop:shell` sets its environment variable with shell syntax that does not
  work in Windows `cmd`. Use `set FIDOCADJS_DEV_SERVER_URL=...` there, or
  PowerShell's `$env:` form.
