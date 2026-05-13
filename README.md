# FidoCadJS

<div align="center">

![Version](https://img.shields.io/badge/version-0.99.0--beta-blue.svg)
![License](https://img.shields.io/badge/license-GPL%20v3-green.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.4-blue.svg)
![Platform](https://img.shields.io/badge/platform-browser-lightgrey.svg)
![Tests](https://img.shields.io/badge/tests-17%20unit%20%7C%2013%20e2e-brightgreen.svg)

**A browser-based electronic schematic editor fully compatible with the FidoCad (fdc) format.**

[🌐 FidoCadJS](https://dantecpp.github.io/FidoCadJS/) • [📖 Source](https://github.com/DanteCpp/FidoCadJS) • [🐛 Report Bug](https://github.com/DanteCpp/FidoCadJS/issues) • [📺 FidoCadJ](https://fidocadj.github.io/FidoCadJ/index.html)

</div>

---

## Table of Contents

- [Getting Started](#getting-started)
  - [Quick Start](#quick-start)
  - [Keyboard Shortcuts](#keyboard-shortcuts)
  - [Example](#example)
- [About FidoCadJS](#about-fidocadjs)
  - [What is FidoCadJS?](#what-is-fidocadjs)
  - [A Bit of History](#a-bit-of-history)
  - [Community Libraries](#community-libraries)
  - [Supported Platforms](#supported-platforms)
  - [Differences from FidoCadJ (Java)](#differences-from-fidocadj-java)
  - [Roadmap](#roadmap)
- [For Developers](#for-developers)
  - [Repository Structure](#repository-structure)
  - [Development Server](#development-server)
  - [Project Architecture](#project-architecture)
  - [Building from Source](#building-from-source)
  - [Scripts Reference](#scripts-reference)
  - [Testing](#testing)
  - [Coding Conventions](#coding-conventions)
- [Contributing](#contributing)
- [Support](#support)
- [Acknowledgments](#acknowledgments)
- [License](#license)

---

## Getting Started

### Quick Start

1. Open [FidoCadJS](https://dantecpp.github.io/FidoCadJS/)
2. Select a component from the library panel on the right
3. Click on the canvas to place it
4. Draw connections with the Line tool (shortcut: `L`)
5. Save your schematic as an `.fcd` file

### Keyboard Shortcuts

| Key | Action | Key | Action |
|-----|--------|-----|--------|
| `A` | Select tool | `Space` | Fit to view |
| `L` | Line tool | `T` | Text tool |
| `B` | Bezier tool | `P` | Polygon tool |
| `E` | Ellipse tool | `G` | Rectangle tool |
| `C` | Connection dot | `I` | PCB line |
| `Z` | PCB pad | `R` | Rotate selected |
| `S` | Mirror selected | `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo | `Ctrl+C/V/X` | Clipboard |
| `Delete` | Delete selected | `Escape` | Deselect / exit tool |
| `Alt+arrows` | Nudge 1px | `+`/`-` | Zoom in/out |

### Example

A CMOS inverter drawn with FidoCadJS. Copy the `fcd` code below, paste it into the FidoCadJS canvas, and start editing!

```
[FIDOCAD]
LI 55 45 60 45 0
LI 45 40 45 50 0
LI 55 35 55 30 0
LI 52 30 58 30 0
LI 40 45 45 45 0
LI 71 45 84 45 2
FCJ 2 0 3 2 0 0
TY 52 27 4 2 0 1 0 * VDD
TY 33 41 4 2 0 1 0 * A
TY 64 41 4 2 0 1 0 * B
TY 89 41 4 2 0 1 0 * A
TY 119 41 4 2 0 1 0 * B
TY 68 23 4 2 0 1 2 * CMOS Inverter
MC 95 45 0 0 680
MC 55 55 0 0 040
MC 115 45 0 0 ey_libraries.refpnt2
MC 90 45 0 0 ey_libraries.refpnt3
MC 50 40 0 0 ey_libraries.trnmos2
MC 50 50 0 0 ey_libraries.trnmos3
MC 35 45 0 0 ey_libraries.refpnt3
MC 60 45 0 0 ey_libraries.refpnt2
```

![cmos_inverter](public/img/cmos_inverter.png)

---

## About FidoCadJS

### What is FidoCadJS?

FidoCadJS is a **TypeScript browser port** of [FidoCadJ](https://github.com/FidoCadJ/FidoCadJ), the multiplatform electronic schematic and PCB layout editor. It runs entirely in your web browser with no installation, no Java runtime, and no downloads.

It supports the full FidoCad/FidoCadJ file format (`.fcd`). Schematics you already have work immediately. FidoCadJS saves and loads files using the compact text format that made FidoCad popular on Italian Usenet and forums.

**Zero runtime dependencies.** The application is built on browser APIs: Canvas 2D, localStorage, the Fetch API, and the Clipboard API. There is no server. Your drawings never leave your machine.

### A Bit of History

The story begins in the late 1990s, in the Italian newsgroup **it.hobby.elettronica**. Lorenzo Lutti created **FidoCad per Windows**, a small vector drawing program using a compact text-based file format. A schematic could be represented as printable ASCII text, small enough to paste into a Usenet message. This made it practical for sharing circuit designs in discussion groups.

FidoCad for Windows was widely adopted in the Italian electronics community. The program was last updated in 2001, but the format lived on.

In 2007, **Davide Bucci** ([DarwinNE](https://github.com/DarwinNE)) reverse-engineered the FidoCad format to use it on macOS and Linux. He first wrote **FidoReadJ**, a Java applet for viewing FidoCad drawings in a web page. In 2008 he completed **FidoCadJ**, a full-featured editor written in Java. FidoCadJ brought anti-aliased graphics, internationalization (10+ languages), advanced export (PDF, EPS, SVG, PGF for LaTeX, PNG, JPG), more community libraries, and active development. It was ported to Android and runs on Windows, macOS, Linux, and Android.

For a deeper dive into the project's history, see Davide Bucci's article (in italian) at [ElectroYou](https://www.electroyou.it/darwinne/wiki/fidocadj).

### Community Libraries

FidoCadJS bundles the standard FidoCadJ libraries under `public/lib/`:

| Library | File | Description |
|---------|------|----------|
| Standard library | `FCDstdlib_en.fcl` | Original FidoCad standard symbols (resistors, capacitors, ICs, ...) |
| Electrical symbols | `elettrotecnica_en.fcl` | Power and electrotechnical symbols |
| EY Libraries | `EY_Libraries.fcl` | ElectroYou community symbols |
| IHRAM 3.1 | `IHRAM_en.fcl` | it.hobby.radioamatori.moderato community library |
| PCB Footprints | `PCB_en.fcl` | Board outlines, through-hole footprints, SMD pads | 

Users can also load additional `.fcl` files into the User Library from the macro picker; these persist across reloads in `localStorage`.

### Supported Platforms

FidoCadJS runs in any modern browser with Canvas 2D and ES2022 support. There is no installation, no Java runtime, and no OS-specific build; the same static bundle works on every platform.

| Browser | Minimum version |
|---------|-----------------|
| Chrome  | 105 |
| Firefox | 102 |
| Safari | 15.4 |

It works on desktop, tablet, and mobile; pointer events are handled uniformly so touch and mouse input behave the same.

### Differences from FidoCadJ (Java)

FidoCadJS targets feature parity with FidoCadJ for editing and `.fcd` interoperability, but a few things from the Java upstream are not (yet) ported:

- **Export formats**: PNG, SVG, PGF/TikZ (LaTeX), and FCD. PDF, EPS, and JPG export from FidoCadJ are not yet implemented.
- **Locales**: the i18n framework is in place but only the English bundle ships. FidoCadJ has 10+ translations.
- **Platform integrations**: there is no Android-specific build. The browser version covers mobile via touch events.
- **Print**: the native print dialog is delegated to the browser's built-in print.
- **PCB**: PCB trace and pad tools plus the PCB Footprints library are available. The app supports schematic capture and single-layer PCB layout side by side, same as FidoCadJ. 

If you need any of the missing pieces, FidoCadJ remains fully supported and can read/write the same `.fcd` files.

### Roadmap

The project is currently at a **beta** release. Editing, parsing, and SVG export are stable and covered by tests; the FCL round-trip is validated for all 11 primitive types. Work in progress includes additional export formats, more locale bundles, and broader feature coverage versus FidoCadJ. Bug reports and pull requests are welcome (see [Contributing](#contributing)).

---

## For Developers

### Repository Structure

```
FidoCadJS/
    ├── index.html           # Entry HTML
    ├── vite.config.ts       # Vite build configuration
    ├── tsconfig.json        # Strict TypeScript configuration
    ├── package.json         # Dependencies and scripts
    ├── src/
    │   ├── app.ts           # Application entry point & UI bootstrap
    │   ├── circuit/         # Editor core (MVC)
    │   │   ├── model/       #   DrawingModel, layers
    │   │   ├── controllers/ #   Parser, Editor, Selection, AddElements
    │   │   └── views/       #   Drawing, Export
    │   ├── primitives/      # 11 graphic primitive types
    │   ├── librarymodel/    # Component library system
    │   ├── export/          # SVG export
    │   ├── graphic/         # Canvas graphics abstraction layer
    │   ├── geom/            # Coordinate mapping, geometry
    │   ├── layers/          # Layer definitions
    │   ├── macropicker/     # Library tree browser
    │   ├── ui/              # Dialogs, menus, context menu, toolbar, properties panel
    │   ├── undo/            # Undo/redo managers
    │   ├── settings/        # Persisted settings
    │   ├── i18n/            # Internationalization
    │   └── globals/         # Constants and utilities
    ├── test/                # Vitest test suite
    └── public/
        ├── lib/             # Standard FCL libraries
        ├── icons/           # Toolbar and app icons
        └── img/             # Screenshots
```

### Development Server

```bash
git clone https://github.com/DanteCpp/FidoCadJS.git
cd FidoCadJS
npm install
npm run dev
```

Open `http://localhost:5173/FidoCadJS/` in your browser.

### Project Architecture

FidoCadJS follows a clean MVC architecture:

- **Model**: `DrawingModel` holds primitives, layers, and macro library state
- **View**: HTML Canvas rendering via the `GraphicsInterface` abstraction. `Drawing` handles per-layer rendering
- **Controller**: `CircuitPanel` coordinates mouse/keyboard input, `ElementsEdtActions` dispatches tool-specific handlers, `UndoManager` tracks full-state snapshots

The FCL parser (`ParserActions`) handles the text-based `.fcd` format with safety limits and macro expansion (max depth 16).

### Building from Source

#### Prerequisites

- Node.js 22+
- npm

#### Production Build

Output goes to `dist/`. The build target is ES2022, with full sourcemaps.

```bash
npm run build
```

### Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with Hot Module Replacement |
| `npm run build` | `tsc` + Vite production build |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run Vitest in watch mode |
| `npm run test:run` | Run Vitest once |
| `npm run test:e2e` | Run Playwright E2E tests (headless) |
| `npm run test:e2e:ui` | Run Playwright E2E tests (interactive UI) |
| `npm run typecheck` | TypeScript type checking (`tsc --noEmit`) |

### Testing

FidoCadJS has two test suites:

**Unit tests** use [Vitest](https://vitest.dev) with [jsdom](https://github.com/jsdom/jsdom) for browser-like DOM.

```bash
npm run test:run        # Run once (CI)
npm test                # Watch mode
```

**E2E tests** use [Playwright](https://playwright.dev) driving headless Chromium for real browser interaction (canvas clicks, keyboard input, export verification).

```bash
npm run test:e2e        # Run all E2E tests (headless)
npm run test:e2e:ui     # Interactive UI mode with time-travel
```

**Current test suites:**

| Suite | Type | What it validates |
|-------|------|-------------------|
| `test/parser/primitive-round-trip.test.ts` | Unit | FCL format: all 11 primitive types survive parse→serialize→parse with identical output |
| `test/circuit/model/drawing-model.test.ts` | Unit | DrawingModel construction, primitive manipulation, dirty flag |
| `test/circuit/controllers/add-elements.test.ts` | Unit | Creating all primitive types via tool handlers |
| `test/circuit/controllers/selection-actions.test.ts` | Unit | Selection queries, multi-select, get-text |
| `test/circuit/keyboard-shortcuts.test.ts` | Unit | All keyboard shortcuts: tools, transforms, zoom, clipboard, nudge, input blocking |
| `test/export/export-svg.test.ts` | Unit | SVG export produces correct XML for all primitive types |
| `test/export/export-pgf.test.ts` | Unit | PGF export for LaTeX: state tracking, arrows, dashes, layers, all primitives |
| `test/export/export-tikz.test.ts` | Unit | TikZ export for LaTeX: all primitives, dash patterns, arrows |
| `test/graphic/tex-renderer.test.ts` | Unit | KaTeX math rendering: inline, display, mixed, edge cases |
| `test/geom/map-coordinates.test.ts` | Unit | Coordinate system mapping, zoom, orientation, snap |
| `test/primitives/primitive-edge-cases.test.ts` | Unit | Per-primitive toString/parseTokens edge cases, negative coords, multi-word text |
| `test/settings/settings-manager.test.ts` | Unit | SettingsManager validation, defaults, localStorage persistence, error handling |
| `test/undo/undo-actions.test.ts` | Unit | UndoActions correctness: add, move, delete, rotate, mirror undo |
| `test/globals/globals.test.ts` | Unit | Path/extension utilities, coordinate parsing |
| `test/layers/layer-desc.test.ts` | Unit | Layer model, StandardLayers |
| `test/librarymodel/library-model.test.ts` | Unit | Library hierarchy, CRUD, events |
| `test/e2e/app-loads.test.ts` | E2E | App initialisation, canvas, toolbar, libraries |
| `test/e2e/drawing-tools.test.ts` | E2E | Drawing all 11 primitives via keyboard + mouse clicks |
| `test/e2e/selection-and-transform.test.ts` | E2E | Click-select, rubber-band, rotate, mirror, nudge, delete, move |
| `test/e2e/undo-redo.test.ts` | E2E | Undo/redo state tracking and keyboard shortcuts |
| `test/e2e/clipboard.test.ts` | E2E | Copy, cut, duplicate via API + internal clipboard |
| `test/e2e/zoom-pan.test.ts` | E2E | Zoom in/out, wheel, fit-to-view, pan |
| `test/e2e/grid-snap.test.ts` | E2E | Grid visibility and snap-to-grid toggles |
| `test/e2e/file-operations.test.ts` | E2E | New (Ctrl+N), load, save, view code |
| `test/e2e/export.test.ts` | E2E | SVG, PGF, TikZ export + determinism |
| `test/e2e/menu-bar.test.ts` | E2E | Menu bar dropdowns and keyboard file operations |
| `test/e2e/keyboard-e2e.test.ts` | E2E | Keyboard shortcuts through full browser stack |
| `test/e2e/macro-library.test.ts` | E2E | Library panel, macro placement via API |
| `test/e2e/edge-cases.test.ts` | E2E | Empty/degenerate, rapid ops, long docs, negative coords, resize |

For detailed test case descriptions, see [TESTS.md](test/TESTS.md).

### Coding Conventions

- ✅ **Language:** TypeScript 5.4 with strict mode enabled
- ✅ **Indentation:** 4 spaces (no tabs)
- ✅ **Naming:** `PascalCase` for classes, `camelCase` for methods/variables
- ✅ **Imports:** Explicit `.js` extensions in import paths (ESM)
- ✅ **Null safety:** `strictNullChecks`, `exactOptionalPropertyTypes`
- ✅ **No unused code:** `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`
- ✅ **TypeScript config:** `@/` path alias maps to `./src/`
- ✅ **File headers:** Every file includes a header block with filename, author, date, description, and copyright

---

## Contributing

Bug fixes, new features, translations, and documentation improvements are all welcome. Human contributors and coding agents alike may participate.

### Coding agents

The codebase is structured to accommodate coding agents. Interfaces are narrow, modules are decoupled, and there is minimal indirection. Agents can be useful for routine tasks such as refactoring, test generation, and boilerplate reduction.

Design decisions and architectural intent remain the responsibility of human contributors. Agent-produced code is held to the same standards as any other contribution.

### Pull requests

1. Fork the repository
2. Create a feature branch (use `dev` as base; never commit to `main` directly)
3. Make your changes, following the coding conventions
4. Run `npm run typecheck` and `npm run test:run`
5. Submit a pull request to `dev`

**Before submitting:**
- [ ] Follows coding conventions (file headers, strict TS, 4-space indent)
- [ ] Code compiles (`npm run typecheck`)
- [ ] All tests pass (`npm run test:run`)
- [ ] Build succeeds (`npm run build`)

---

## Support

- 📖 **Documentation:** See the original [FidoCadJ manual](https://github.com/DarwinNE/FidoCadJ/releases) for usage instructions (the user interface is similar)
- 🐛 **Bug Reports:** [GitHub Issues](https://github.com/DanteCpp/FidoCadJS/issues)
- 💬 **Discussions:** Open a GitHub Discussion for questions and ideas

---

## Acknowledgments

### Original FidoCad

- **Lorenzo Lutti** for creating the original FidoCad for Windows and its text-based file format.

### FidoCadJ (Java)

- **Davide Bucci** ([DarwinNE](https://github.com/DarwinNE)), original author of FidoCadJ, for reverse-engineering the FidoCad format, the complete Java implementation, and years of continued development
- All contributors, beta testers, translators, and library editors listed in the [FidoCadJ README](https://github.com/FidoCadJ/FidoCadJ)

### Icons

- Toolbar icons from [Pictogrammers](https://pictogrammers.com/libraries/)

---

## License

FidoCadJS is free software licensed under **GNU General Public License v3**:

```
FidoCadJS is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

FidoCadJS is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.
```

You should have received a copy of the GNU General Public License along with FidoCadJS.  
If not, see <http://www.gnu.org/licenses/>.

---

<div align="center">

**Copyright © 2026 Dante Loi**

⭐ If you find this project useful, please consider starring the repository!

[🌐 FidoCadJS](https://dantecpp.github.io/FidoCadJS/) • [📖 Source](https://github.com/DanteCpp/FidoCadJS) • [🐛 Report Bug](https://github.com/DanteCpp/FidoCadJS/issues) • [📺 FidoCadJ](https://fidocadj.github.io/FidoCadJ/index.html)

</div>
