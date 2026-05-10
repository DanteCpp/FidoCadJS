# FidoCadJS — Code Review

**Project**: FidoCadJS — TypeScript browser port of FidoCadJ circuit schematic editor  
**Review date**: 2026-05-09  
**Scope**: Full repository (`src/`, `test/`, config, build pipeline)

---

## Table of Contents

1. [Overall Assessment](#overall-assessment)
2. [Architecture & Design](#architecture--design)
3. [TypeScript & Type Safety](#typescript--type-safety)
4. [Code Quality & Patterns](#code-quality--patterns)
5. [Testing](#testing)
6. [Performance](#performance)
7. [Security](#security)
8. [Build, Config & CI](#build-config--ci)
9. [Documentation](#documentation)
10. [Areas for Improvement](#areas-for-improvement)
11. [Summary](#summary)

---

## Overall Assessment

FidoCadJS is a well-structured, carefully implemented port of a complex Java desktop application to the browser. The codebase demonstrates strong TypeScript discipline, a thoughtful architecture with clear separation of concerns, and an impressive test suite (212 cases, 11 files). The project is in active, competent development.

**Grade**: B+ — Solid production-quality foundation with some debt in UI rendering and parser complexity.

---

## Architecture & Design

### ✅ Strengths

**Clean module boundaries.** The code follows a well-defined layered architecture:

```
src/
├── app.ts                    — Entry point, UI bootstrap, wiring
├── circuit/                  — Editor panel, model, controllers, views
│   ├── CircuitPanel.ts       — The central orchestrator
│   ├── model/                — DrawingModel (data)
│   ├── controllers/          — Business logic (ElementsEdtActions, ParserActions, etc.)
│   └── views/                — Drawing, Export (rendering)
├── primitives/               — Shape primitives (Line, Bezier, Text, Macro, etc.)
├── graphic/                  — Rendering abstraction layer (canvas, interfaces)
├── export/                   — SVG/PGF/TikZ export
├── geom/                     — Coordinate mapping, geometry utilities
├── librarymodel/             — Macro/component library hierarchy
├── layers/                   — Layer management
├── undo/                     — Undo/redo stack
├── ui/                       — Dialogs, menus, pickers
├── i18n/                     — Locale loading
└── settings/                 — Persistent settings
```

This mirrors the Java version's structure but is adapted well to TypeScript idioms.

**Dependency injection via static hooks.** The `PrimitiveMacro` class uses injected `parserFn`, `drawFn`, and `exportFn` static properties to break circular dependencies between the `primitives/`, `circuit/`, and `export/` packages. This is a pragmatic solution for a genuine architectural challenge (macros contain recursive models that need parsing, drawing, and exporting).

**Abstraction layer for rendering.** `GraphicsInterface` / `ExportInterface` abstract the canvas and file-format concerns. This allowed clean separation between the primitive draw logic and the canvas/SVG/PGF backends. `GraphicsNull` exists for measurement-only contexts.

**Event/callback pattern for UI wiring.** `CircuitPanel` exposes callbacks (`onToolChange`, `onZoomChange`, `onUndoStateChange`, `onPropertiesRequested`, etc.) which `app.ts` wires to toolbar buttons, status displays, and the properties sidebar. This keeps the panel agnostic about the surrounding UI.

**Immutable settings with validation.** `SettingsManager` uses a `sanitize()` function that validates every field (type, range, color format) before merging into settings, and localStorage read/parse failures are caught gracefully.

**Defensive parser limits.** `Globals.MAX_VERTICES`, `MAX_MACRO_DEPTH`, `MAX_COORD` defend against malformed or hostile FCD inputs.

### ⚠️ Concerns

**`app.ts` is a monolithic UI builder (840 lines).** The `FidoCadJS` class constructs the entire toolbar, properties panel, layer selector, and context menu handler inline in `createToolbar()` and `showPropertiesPanel()`. The properties panel alone is ~450 lines of `addSection`/`addNumber`/`addCheck` helper calls inside one enormous method. This should be split into:

- `ToolbarController` (tool buttons, zoom, grid toggle, layer selector, coordinates)
- `PropertiesPanelController` (per-type form rendering)
- `LibraryPanelController` (macro picker, context actions)

**`ParserActions.addString` is a large state-machine (280+ lines).** The nested `if-else` chain for token dispatch (`LI`, `BE`, `MC`, `TY`, `PL`, `PA`, `SA`, `EV`, `EP`, `RV`, `RP`, `PV`, `PP`, `CV`, `CP`, `FCJ`, `FJC`) is hard to test in isolation and brittle. A table-driven approach (mapping token → handler function) would be clearer and more maintainable.

**`CircuitPanel` is 1785 lines.** It handles mouse input, tool state, render pipeline, clipboard, context menus, export, and keyboard shortcuts. The keyboard handler alone should be its own module (`KeyboardController`). Mouse handling (pan, zoom, selection rectangle, handle dragging, ghost preview) could be a `MouseController`.

---

## TypeScript & Type Safety

### ✅ Strengths

**Strict mode fully enabled.** `tsconfig.json` has `strict: true` plus `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `exactOptionalPropertyTypes`, `strictNullChecks`, and `useUnknownInCatchVariables`. This is the gold standard for TypeScript projects.

**Interface-driven design.** Core abstractions (`GraphicsInterface`, `ExportInterface`, `ColorInterface`, `TextInterface`, `ShapeInterface`, `PolygonInterface`, `ProcessElementsInterface`) are all typed interfaces, not classes.

**`unknown` for catch clauses and parsed data.** `SettingsManager.sanitize()` takes `unknown` and validates exhaustively before producing `Partial<AppSettings>`. The `catch` clauses use `any` as a last resort only where the error shape is genuinely unpredictable.

### ⚠️ Concerns

**`any` casts in a few strategic locations:**

- `src/app.ts` line ~470: `(navigator as any).queryLocalFonts()` — the Font Access API is experimental, so this is acceptable, but a `@ts-expect-error` comment would document the intent.
- `src/graphic/canvas/GraphicsCanvas.ts` line ~200: `fill(s: ShapeInterface)` casts to `ShapeCanvas` via `as unknown as ShapeCanvas`. This is an intentional design choice (interface → concrete) but is technically a type-safety hole. A `ShapeInterface.isCanvasType()` guard would be safer.
- `src/circuit/controllers/ParserActions.ts`: `any` used for `MacroDesc` in test file. Production code is fine.

**`@/*` path alias defined but barely used.** Only a few imports use `@/`; most use relative paths like `../../primitives/GraphicPrimitive.js`. Consistency one way or the other would improve readability and refactoring safety. Recommend converting all imports to `@/` aliases or removing the alias.

**Constructor overloads with `...args: unknown[]`.** `PrimitiveAdvText` uses multiple constructor signatures with a rest-parameter fallback. This works but is fragile. A static factory method (`PrimitiveAdvText.create(...)`) or a builder pattern would be more type-safe.

---

## Code Quality & Patterns

### ✅ Strengths

**Consistent JSDoc headers.** Every file has `@file`, `@author`, `@date`, `@brief`, and `@copyright` headers. This is excellent for a solo-developer project.

**`toString()` consistency across primitives.** All 11 primitive types implement the same `parseTokens()`/`toString()` pattern, making the FCD format reliable.

**Round-intelligently for clean output.** `GraphicPrimitive.roundIntelligently()` outputs integers when the value is within tolerance of an integer, avoiding `1.0` noise in serialized files.

**Clean `UndoManager` with ring-buffer semantics.** The undo stack correctly handles buffer eviction, pointer clamping, and redo invalidation on new pushes.

### ⚠️ Concerns

**Redundant code duplication in `ParserActions`.** The `registerPrimitivesWithFCJ` method and the inline FCJ handling within `addString` have nearly identical logic for creating primitives. Each token type (`LI`, `BE`, `MC`, `RV`/`RP`, `EV`/`EP`, `PV`/`PP`, `CV`/`CP`, `PL`, `PA`, `SA`) appears in both places. Refactoring to a single token→factory mapping would eliminate ~60 lines of duplication.

**Repeated layer dropdown code.** The custom layer dropdown with color swatches is implemented in two places:
1. `app.ts` → `createToolbar()` (toolbar layer selector)
2. `app.ts` → `showPropertiesPanel()` (properties panel layer selector)

Both share identical structure: button with swatch, dropdown list, `closeOnOutside` handler. Extract to a `LayerDropdown` component.

**Manual CSS strings everywhere.** Inline `style.cssText` strings are used throughout `app.ts` and `CircuitPanel.ts`. This works for a prototype but becomes a maintenance burden. Consider CSS modules or a lightweight CSS-in-JS approach.

**Magic numbers in rendering code.** `PrimitiveAdvText.draw()` uses `12/7`, `22/40`, and `10/7` as inline constants. These appear to be font metric ratios but are unexplained. Extract to named constants with documentation.

**`PrimitiveMacro` static injection order is fragile.** The order in which `parserFn`, `drawFn`, and `exportFn` are set matters and must happen in `CircuitPanel`'s constructor. If these aren't set before the first macro is parsed/drawn/exported, failures are silent (null-check guarded). A builder pattern with `init()` or a dependency container would be more robust.

**`process.nextTick`-style patterns via `requestAnimationFrame`.** `showPropertiesPanel` uses `requestAnimationFrame(() => { contentInput.focus(); })` to defer focus after DOM insertion. This is correct but fragile — a `setTimeout(fn, 0)` inside `requestAnimationFrame` may be needed for some browsers.

---

## Testing

### ✅ Strengths

**212 tests across 11 files with good coverage of:**

- All 11 primitive types (parser/serializer round-trips)
- All keyboard shortcuts (46 cases)
- Coordinate mapping with orientation/mirror/snap
- SVG export element generation
- Undo/redo stack
- Settings validation
- Library model hierarchy
- Configuration token parsing (FJC)

**Stability testing pattern is excellent.** The `assertStable()` helper proves the parser/serializer pair is idempotent without depending on Java reference output. This is ideal for a port where float formatting may differ between languages.

**Test infrastructure is solid.** `jsdom` environment, `beforeEach`/`afterEach` for state isolation, explicit `Globals` save/restore to prevent test pollution.

**Keyboard test `beforeEach` block is well-structured.** Tests create the full `CircuitPanel` in jsdom, add a primitive, select it, and verify shortcut behavior. The "input element blocks shortcuts" group is a nice edge-case check.

### ⚠️ Gaps

**No tests for `CircuitPanel` rendering output.** The `render()` method clears the canvas, draws grid, primitives, selection rect, ghost preview, and TeX overlay in sequence, but the final pixel output is never verified. A canvas snapshot comparison (or at least verifying the 2D context's `fillStyle`/`strokeStyle` after render) would catch regressions in the draw pipeline.

**No tests for `ExportPGF` or `ExportTikZ`.** Test files exist (`test/export/export-pgf.test.ts`, `test/export/export-tikz.test.ts`) but appear to be placeholders (not shown in `TESTS.md` as having cases).

**No tests for mouse interaction.** Panning, zoom-to-cursor, rubber-band selection, handle dragging, ghost preview updates — all untested. The `CircuiPanel` mouse handlers are complex and error-prone.

**No tests for `MacroPicker`, `MenuBar`, or dialog components.** These are UI components but their logic (menu state, macro tree building, dialog result promises) is testable.

**`primEdit` mutation in `ElementsEdtActions` is hard to trace.** The test for `isEnteringMacro()` checks `primEdit instanceof PrimitiveMacro` but doesn't verify the object identity or orientation/mirror carry-over between placements.

**Placeholder directories exist but are empty.** `test/e2e/`, `test/primitives/`, and `test/settings/` are reserved but empty. Either populate them or remove the directories to avoid confusion.

---

## Performance

### ✅ Strengths

**Dirty-rect clipping (`hitClip`).** `GraphicsCanvas` maintains a dirty rectangle and skips drawing operations that fall outside it. This is a reasonable optimization for complex schematics.

**Shell sort for layer ordering.** `DrawingModel.sortPrimitiveLayers()` uses a shell sort, which is efficient for the expected usage (insertion-sorted-by-layer, slightly perturbed).

**Text layout caching.** `GraphicPrimitive.drawText()` recomputes font metrics and string widths only when `changed = true`, then reuses cached values.

**`ResizeObserver` instead of polling.** Canvas sizing uses a `ResizeObserver` for efficient, correct high-DPI resizes without polling or debouncing.

### ⚠️ Concerns

**Full re-render on every change.** `CircuitPanel.render()` always clears the canvas and redraws everything (all primitives, grid, selection rect, ghost). While `hitClip` guards individual draw operations, the grid and every primitive are iterated each frame. For very large schematics (thousands of primitives), this will degrade.

**TeX overlay uses `innerHTML` on every render.** `syncTeXOverlay()` builds an HTML string and sets `texOverlay.innerHTML` every frame. For schematics with many math-heavy text primitives, this causes DOM thrashing. Consider only updating when text content actually changed.

**`setLineDash` called per-primitive.** Each primitive's draw may call `applyStroke()` which sets `ctx.setLineDash()`. The canvas context state changes are relatively cheap but accumulate.

**`getScreenDensity()` computes `window.devicePixelRatio * 96` on every call.** The value changes only on window resize or monitor change. Cache it.

**`Array(n).fill(false)` in `sortPrimitiveLayers` creates a new array every call.** The `layersUsed` array is recreated with `fill(false)` each time. Reusing a pre-allocated array would reduce garbage.

---

## Security

### ✅ Strengths

**Content Security Policy.** `index.html` has a strict CSP: `default-src 'self'`, no `unsafe-eval`, `object-src 'none'`, `form-action 'none'`, `frame-ancestors 'none'`. This is excellent.

**Additional security headers.** `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer` are set via `<meta>` tags.

**XML escaping in SVG export.** `ExportSVG.escapeXml()` properly escapes `&<>'"` characters in user-provided text strings before embedding in SVG output.

**KaTeX renders math in overlay, not injected into canvas script.** Math rendering uses a separate overlay div, keeping untrusted LaTeX source isolated from the canvas context.

**Parser coordinate clamping.** `Globals.parseCoord()` clamps all parsed integers to `[-1_000_000, 1_000_000]`, defending against overflow or DoS via extreme coordinates.

**`localStorage` operations are try/catch guarded.** Both `SettingsManager` and `UserLibraryStorage` wrap all localStorage reads/writes in try-catch.

### ⚠️ Concerns

**`innerHTML` on TeX overlay trusts KaTeX output.** While KaTeX is vendored and the math source is user-provided, the `texOverlay.innerHTML = htmlParts.join('')` assignment uses KaTeX HTML output directly. KaTeX is designed to produce safe HTML, but any KaTeX bug that produces script tags would be exploitable. Consider using `insertAdjacentHTML` or DOM-parse + sanitize.

**No CSP nonce for inline styles.** The app uses many inline `style` attributes and `<style>` blocks. These are allowed because `style-src 'unsafe-inline'` is in the CSP. Moving to external CSS or adding a nonce would be more secure.

**`confirm()` for library overwrite.** `app.ts` uses the native `confirm()` dialog for "A user library with prefix X already exists. Overwrite it?" This is acceptable but stylistically jarring in an otherwise custom-UI app.

---

## Build, Config & CI

### ✅ Strengths

**Clean Vite setup.** `vite.config.ts` is minimal and well-configured: `base: '/FidoCadJS/'` for GitHub Pages, `es2022` target, sourcemaps enabled, path alias `@/*`.

**CI pipeline is solid.** `deploy.yml` runs `typecheck → test → build → deploy` sequentially, with `concurrency` to cancel stale runs.

**`.gitignore` covers OS files, env files, and editor directories.**

**`package.json` scripts are well-named.** `dev`, `build`, `preview`, `test`, `test:run`, `typecheck` — all standard and self-documenting.

### ⚠️ Concerns

**`package.json` `version` is `0.1.0` but `Globals.version` is `0.24.9 gamma`.** These are out of sync. The npm version should track the application version, or a build-time script should sync them.

**KaTeX is vendored in `src/vendor/katex/` (fonts + CSS + JS).** This is 50+ font files totaling several MB. Consider:
- Loading KaTeX from npm instead of vendoring
- Shipping only the font subsets actually used
- Using `woff2` only (the vendored copy includes `.ttf` and `.woff` for each font)

**No `CHANGELOG.md`.** For an actively developed project, a changelog helps contributors and users track changes.

---

## Documentation

### ✅ Strengths

**Comprehensive `README.md`.** The AGENTS.md file at the project root documents the repository layout, development commands, toolchain configuration, architecture, and CI pipeline clearly.

**Exceptional `test/TESTS.md`.** Every test case is documented with a plain-English description of what it verifies. This is rare and valuable.

**`test/TESTS.html` exists as an HTML version of the test index.** Nice touch for offline viewing.

### ⚠️ Concerns

**No architecture diagram.** A visual overview of how `CircuitPanel` → `DrawingModel` → `ElementsEdtActions` → `AddElements` → `PrimitiveLine`/etc. interact would help new contributors.

**No "How to contribute" or `CONTRIBUTING.md`.** While the project is solo-developed, a brief guide on setting up the dev environment, running tests, and submitting changes sets expectations.

**`LICENSE` file is present but no license header script.** Every source file has `@copyright ... GPL v3` but there's no automated check that this is consistent.

---

## Areas for Improvement

### High Priority

| # | Area | Issue | Recommendation |
|---|------|-------|----------------|
| 1 | `app.ts` | 840-line monolithic UI builder | Split into `ToolbarController`, `PropertiesPanelController`, `LibraryPanelController` |
| 2 | `ParserActions.addString` | Large state machine with duplicate logic | Use token→handler map, unify with `registerPrimitivesWithFCJ` |
| 3 | `CircuitPanel` | 1785 lines, multiple responsibilities | Extract `KeyboardController`, `MouseController`, `ClipboardController` |
| 4 | Missing tests | No mouse interaction, render output, or export (PGF/TikZ) tests | Add mouse tests, canvas snapshot tests, export format tests |
| 5 | CSS | Manual inline styles everywhere | Adopt CSS modules or a lightweight CSS-in-JS approach |

### Medium Priority

| # | Area | Issue | Recommendation |
|---|------|-------|----------------|
| 6 | Duplicated UI | Layer dropdown widget built twice | Extract to `LayerDropdown` class |
| 7 | Import paths | Mix of `@/` and relative paths | Standardize on `@/` alias |
| 8 | `PrimitiveMacro` | Fragile static injection order | Use builder pattern or init container |
| 9 | Version sync | `package.json` version ≠ `Globals.version` | Sync or document the convention |
| 10 | KaTeX vendor | ~50 font files vendored | Load from npm, ship only woff2 |
| 11 | Magic numbers | Font ratio constants unexplained | Extract to named constants with docs |

### Low Priority

| # | Area | Issue | Recommendation |
|---|------|-------|----------------|
| 12 | TeX overlay | `innerHTML` on every frame | Only update when text content changed |
| 13 | `getScreenDensity()` | Recomputes every call | Cache value, invalidate on resize |
| 14 | `sortPrimitiveLayers` | Recreates `layersUsed` array each call | Reuse pre-allocated array |
| 15 | Placeholder test dirs | `e2e/`, `primitives/`, `settings/` empty | Populate or remove |
| 16 | Constructor overloads | `PrimitiveAdvText(...args: unknown[])` | Use static factory method |
| 17 | `confirm()` usage | Native dialog for library overwrite | Use custom dialog component |
| 18 | Style CSP | `unsafe-inline` for styles | Add nonces or move to external CSS |
| 19 | No CHANGELOG | Missing release history | Add `CHANGELOG.md` |

---

## Summary

FidoCadJS is a well-engineered port of a complex application. It succeeds where many ports fail: the architecture is clean, the type system is used seriously, the test suite is thorough, and the security posture is thoughtful.

**What's great:**
- Strong TypeScript discipline (full strict mode, interface-driven design)
- Clean separation between model, controllers, and views
- Excellent test suite (212 cases) with a clever stability-testing pattern
- Good defensive coding (input validation, coordinate clamping, CSP headers)
- Pragmatic dependency injection for circular-dependency problems

**What needs attention:**
- `app.ts` is a monolithic UI builder that should be split into controllers
- `ParserActions.addString` is a large, duplicated state machine
- `CircuitPanel` has too many responsibilities at 1785 lines
- Missing tests for mouse interaction, rendering output, and two export formats
- Manual CSS strings are scattered throughout the codebase

**Recommendation:** The codebase is production-ready for its current scope but will become harder to maintain as it grows. The top 5 high-priority items should be addressed before adding significant new features.

---

*Review by automated code analysis of 15,558 lines across ~90 source files (excluding node_modules and dist).*
