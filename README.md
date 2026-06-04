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

These match FidoCadJ 0.24.9 exactly and are the same in every language.

| Key | Action | Key | Action |
|-----|--------|-----|--------|
| `A` `Space` `Esc` | Select tool | `L` | Line tool |
| `T` | Text tool | `B` | Bezier tool |
| `P` | Polygon tool | `O` | Complex curve |
| `E` | Ellipse tool | `G` | Rectangle tool |
| `C` | Connection dot | `I` | PCB line |
| `Z` | PCB pad | `M` | Move selected |
| `R` | Rotate selected | `S` | Mirror selected |
| `Delete` | Delete selected | `Home` | Fit to view |
| `Ctrl+Z` | Undo | `Ctrl+Y` | Redo |
| `Ctrl+C/V/X` | Clipboard | `Alt+arrows` | Nudge 1px |
| `+`/`-` | Zoom in/out | `Right-drag` | Ruler |

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

For a deeper dive into the project's history, see Davide Bucci's article (in Italian) at [ElectroYou](https://www.electroyou.it/darwinne/wiki/fidocadj).

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

FidoCadJS targets feature parity with FidoCadJ for editing and `.fcd` interoperability. A few things from the Java upstream are not yet ported:

- **Export formats**: PNG, SVG, PGF/TikZ (LaTeX), and FCD. PDF, EPS, and JPG export from FidoCadJ are not yet implemented.
- **Locales**: the i18n framework is in place but only the English bundle ships. FidoCadJ has 10+ translations.
- **Platform integrations**: there is no Android-specific build. The browser version covers mobile via touch events.
- **Print**: the native print dialog is delegated to the browser's built-in print.
- **PCB**: PCB trace and pad tools plus the PCB Footprints library are available. The app supports schematic capture and single-layer PCB layout side by side, same as FidoCadJ.

If you need any of the missing pieces, FidoCadJ remains fully supported and can read and write the same `.fcd` files.

### Known Export Limitations

The SVG, PGF, and TikZ exporters approximate some FidoCad primitives:

| Export format | Limitation |
|---------------|------------|
| **TikZ** | Complex curves (CV/CP) and macros (MC) are not supported natively; they are expanded into polygon/line primitives. Text orientation and mirroring are delegated to LaTeX formatting. |
| **PGF** | Same as TikZ — complex curves and macros are expanded. Font metrics do not match the canvas exactly; LaTeX handles final typesetting. |
| **SVG** | Complex curves are rendered as polyline approximations (24 segments per control point). Macro instances are fully expanded. Text mirroring uses CSS transforms. |

These limitations are documented in the source with `// LIMITATION:` comments.

### LaTeX Math

Text primitives may embed LaTeX math between `$...$` (inline) or `$$...$$`
(display). Math is rendered with a vendored, dependency-free **MathJax** SVG
engine (`src/vendor/mathjax/`) that produces vector glyph outlines. The same
engine drives every target, so math looks identical on-screen and in export:

| Target | How math is rendered |
|--------|----------------------|
| **On-screen / PNG / JPG** | Glyph outlines painted onto the canvas as vector paths (crisp at any zoom). |
| **SVG** | Glyph outlines embedded as `<path>`/`<rect>` geometry — self-contained, no external fonts or `foreignObject`. |
| **PDF** | Glyph outlines emitted as vector path-fill operators. |
| **PGF / TikZ** | Literal `$...$` is passed through for the downstream LaTeX compiler to typeset (idiomatic for these formats). |

Malformed LaTeX degrades gracefully to the literal source text. On-screen math
follows the *Render TeX* option; exports always typeset.

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
    │   ├── app.ts           # Application entry point and UI bootstrap
    │   ├── circuit/         # Editor core
    │   │   ├── CircuitPanel.ts        # Main editor panel, canvas host
    │   │   ├── EditorFacade.ts        # Narrow interface for UI decoupling
    │   │   ├── CanvasManager.ts       # Canvas element and DPR management
    │   │   ├── InputHandler.ts        # Mouse and touch event dispatch
    │   │   ├── GhostPreview.ts        # Per-tool cursor ghost primitives
    │   │   ├── ContextMenuManager.ts  # Right-click context menus
    │   │   ├── MacroVectorizer.ts     # Macro to primitive decomposition
    │   │   ├── ImageAsCanvas.ts       # Background image attachment
    │   │   ├── KeyboardHost.ts        # Keyboard event interface
    │   │   ├── ToolGhostHandler.ts    # Ghost handler type definitions
    │   │   ├── services.ts            # Editor service container factory
    │   │   ├── model/                 # DrawingModel, ProcessElementsInterface
    │   │   ├── controllers/           # Parser, EditorActions, AddElements, Selection, Undo, Clipboard
    │   │   └── views/                 # Drawing, Export, TeXOverlay
    │   ├── primitives/      # 11 graphic primitive types
    │   ├── librarymodel/    # Component library system (CRUD, events, storage)
    │   ├── export/          # SVG, PGF, and TikZ export
    │   ├── graphic/         # Canvas 2D graphics abstraction layer
    │   ├── geom/            # Coordinate mapping, zoom, geometry utilities
    │   ├── layers/          # Layer definitions and standard layers
    │   ├── macropicker/     # Library tree browser with search and preview
    │   ├── ui/              # Toolbar, menus, dialogs, properties panel
    │   ├── undo/            # Undo state snapshot model
    │   ├── settings/        # Persisted application settings
    │   ├── i18n/            # Internationalization framework
    │   ├── globals/         # Constants and utility functions
    │   └── vendor/          # Vendored third-party code (KaTeX shim)
    ├── test/                # Unit and E2E test suites
    └── public/
        ├── lib/             # Standard FCL libraries
        ├── icons/           # Toolbar and application icons
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

FidoCadJS separates model, view, and control logic:

- **Model**: `DrawingModel` holds the primitive vector, layer state, and macro library map. `UndoState` captures full model snapshots for undo and redo. `LibraryModel` manages the component library hierarchy with CRUD operations and change events.
- **View**: `Drawing` renders primitives layer by layer through the `GraphicsInterface` abstraction backed by Canvas 2D. `TeXOverlay` handles KaTeX math rendering on a separate overlay canvas. `MacroPicker` renders the collapsible library tree with a canvas preview pane.
- **Control**: `CircuitPanel` owns the editor lifecycle. Input is routed through `InputHandler` to `ElementsEdtActions`, which dispatches to per-tool handlers in `AddElements`, `EditorActions`, and `SelectionActions`. `GhostPreview` uses a strategy registry to render cursor feedback for each tool. `EditorFacade` exposes a narrow interface so that UI modules (toolbar, menus, dialogs) do not depend on `CircuitPanel` directly.

The FCL parser (`ParserActions`) reads and writes the `.fcd` text format. It enforces a token limit (10 000 per line) and a macro expansion depth limit (16 levels) to guard against malformed input.

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

For detailed test case descriptions, see [TESTS.md](test/TESTS.md).

### Coding Conventions

- **Language:** TypeScript 5.4 with strict mode enabled
- **Indentation:** 4 spaces (no tabs)
- **Naming:** `PascalCase` for classes, `camelCase` for methods/variables
- **Imports:** Explicit `.js` extensions in import paths (ESM)
- **Null safety:** `strictNullChecks`, `exactOptionalPropertyTypes`
- **No unused code:** `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`
- **TypeScript config:** `@/` path alias maps to `./src/`
- **File headers:** Every file includes a header block with filename, author, date, description, and copyright
- **File length**: keep files compact and relevant, no more than 400 lines.

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
4. Run `npm run typecheck`, `npm run test:run`, and `npm run test:e2e`
5. Submit a pull request to `dev`

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
