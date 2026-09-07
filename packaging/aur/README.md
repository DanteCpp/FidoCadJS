# Arch Linux packaging

Two AUR packages, both building the [desktop app](../../docs/desktop.md) and
installing the same files:

| Package        | Source                        | Use                          |
| -------------- | ----------------------------- | ---------------------------- |
| `fidocadjs`    | release tarball (`v$pkgver`)  | the normal package           |
| `fidocadjs-git`| `main` branch                 | tracks development           |

They `provide`/`conflict` with each other, so only one can be installed.

## Why the system Electron

Both link against Arch's `electron43` package instead of bundling their own
Chromium, as the [Electron package
guidelines](https://wiki.archlinux.org/title/Electron_package_guidelines) ask.
The result is a **1.2 MB package** rather than the ~130 MB of a self-contained
AppImage, and Electron security updates arrive through the distro rather than
waiting on a FidoCadJS release.

The cost is a version to keep an eye on. `_electronversion` at the top of each
PKGBUILD pins the runtime; Arch keeps several versioned `electron` packages in
parallel, so a new Electron major does not break the app until the pin moves.
**Test before bumping it** — run `npm run desktop:smoke` against the intended
runtime:

```bash
electron43 scripts/desktop-smoke.cjs test/export/fixtures/fcd/full-pattern.fcd
```

The app is verified on Electron 43. It is built against 44 in `package.json`
(what `npm run desktop:*` and `electron-builder` use); the two are independent
and may legitimately differ.

## Building locally

```bash
cd packaging/aur/fidocadjs-git
makepkg -si
```

`makepkg` needs `npm`, `nodejs>=22` and `asar` installed as system packages. A
Node managed by nvm, mise or asdf will not satisfy the `makedepends` check —
either install the Arch packages or pass `--nodeps` and rely on `PATH`.

`prepare()` runs `npm ci`, which reaches the network. That departs from the
usual rule that only `source=()` may be fetched, but it is unavoidable for an
npm project and is what other Node packages in the AUR do. The Electron binary
download is skipped (`ELECTRON_SKIP_BINARY_DOWNLOAD=1`) since the system
runtime is used instead.

## Publishing to the AUR

The `fidocadjs` package needs a release to exist first:

1. Merge the desktop app to `main` and tag it — the PKGBUILD fetches
   `refs/tags/v$pkgver`, so `v0.1.0` for `pkgver=0.1.0`.
2. Replace the placeholder checksum: `updpkgsums` in `packaging/aur/fidocadjs`.
   It is `SKIP` in-tree only because the tag does not exist yet; do not publish
   a release package with verification disabled.
3. Rebuild `.SRCINFO`: `makepkg --printsrcinfo > .SRCINFO`.
4. Push to the AUR:

```bash
git clone ssh://aur@aur.archlinux.org/fidocadjs.git aur-fidocadjs
cp packaging/aur/fidocadjs/{PKGBUILD,.SRCINFO} aur-fidocadjs/
cd aur-fidocadjs && git commit -am 'Initial import' && git push
```

`fidocadjs-git` can be published as-is — a VCS package keeps `sha256sums=SKIP`
and carries a placeholder `pkgver` that `pkgver()` replaces at build time.

Both packages keep their own AUR repository, so each holds a full copy of its
PKGBUILD; edits worth having in both must be applied twice.

## What gets installed

```
/usr/bin/fidocadjs                                  launcher (execs electron43)
/usr/lib/fidocadjs/app.asar                         the application
/usr/share/applications/fidocadjs.desktop           launcher entry
/usr/share/mime/packages/fidocadjs.xml              application/x-fidocad (*.fcd)
/usr/share/icons/hicolor/512x512/apps/fidocadjs.png
/usr/share/licenses/<pkgname>/LICENSE
```

`StartupWMClass` in the desktop entry is `fidocadts`, not `fidocadjs`. Electron
takes the window's `WM_CLASS` from the `name` field of the packaged
`package.json` before any application code runs, so the two names genuinely
differ; changing it would only break icon matching in the launcher.
