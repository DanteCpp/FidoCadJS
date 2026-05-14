<!--
File: TOTEST.md
Author: Dante Loi
Date: 2026-05-14
Description: Audit of the FidoCadJS test suite — what is *not* covered today,
             grouped by area, with concrete proposed test cases. Particular
             emphasis on the export pipeline, where the SVG output is the
             most-likely-broken format and currently passes only on
             "does-it-contain-a-tag" assertions.
Copyright: (c) 2026 Dante Loi - GPL v3
-->

# FidoCadJS — Tests Still Missing

Baseline at audit time:

- **34** test files (17 Vitest unit, 13 Playwright e2e, `setup.ts`, `e2e/utils.ts`,
  plus the parser/global-state file added in Phase 1.5).
- **479** test cases per `test/TESTS.md`.
- **102** TypeScript source files; **~50** of them have at least one
  test referencing them, **~50** have none.

This document lists everything still uncovered. The opening section (#1 Export)
is the priority — the user has flagged that SVG export "is not working
properly," and the existing export tests confirm that suspicion: they only
check that the right *XML tag* appears, never that the *geometry, colour,
transform and round-trip semantics* match the Java reference.

---

## 1. Exports — priority

### 1.1 What the current export tests DO test

`test/export/{export-svg,export-pgf,export-tikz,latex-escape}.test.ts`:

- Each exporter is constructed in isolation, called with a tiny `200×200`
  page and **one primitive at a time**.
- Each assertion is a single `toContain('<some-tag')` or
  `toContain('\\some-command')` check — i.e., **a smoke test that the
  output isn't empty and isn't a different format**.
- Coordinates are only checked for trivial integer values (`x1="10"`,
  `(50,50)`); no Math.round / cLe edge cases, no negatives, no nudge of
  the rounding boundary.

`test/e2e/export.test.ts`:

- Loads one fixed FCD circuit (5 primitives) and asserts the SVG / PGF /
  TikZ output *contains* the expected tag for each primitive type.
- The "Round-trip consistency" cases only assert
  `exportSVG(page) === exportSVG(page)` — i.e., that the function is
  deterministic, not that the output is *correct*.

**There is no test that compares any exporter's output to a reference
fixture, and no test that validates the exported file would actually
render correctly in an external tool (a browser, `pdflatex`, etc.).**

### 1.2 Concrete bugs the current SVG test would NOT catch

A 30-minute diff of `src/export/ExportSVG.ts` against the Java reference
(`~/FidoCadJ/src/fidocadj/export/ExportSVG.java`) surfaces at least these
behavioural differences. The existing `it()` cases would happily pass for
every one of them:

| # | Java behaviour | TS behaviour | Risk |
|---|----------------|--------------|------|
| S1 | `exportAdvText`: `xscale = sizex/22.0/sizey*38.0`, applies `scale(xscale, 1)`. | TS computes a **different** `yscale`: `(sizey/sizex === 10/7) ? 1.0 : (sizey/sizex) * (22.0/40.0)`, applies `scale(xscale, yscale)`. | Text height in SVG output diverges from Java. |
| S2 | `exportAdvText` rotation: `alpha = isMirrored ? orientation : -orientation`. | TS always emits `rotate(${-orientation})` — **the mirror branch is missing**. | Mirrored rotated text renders with wrong angle. |
| S3 | `exportAdvText` writes a `<DecoratedText>` that emits per-glyph `<text>` elements at `(x, y)` after the group transform. | TS emits a single `<text x="0" y="0">…</text>`. | Subscript / superscript escapes (`^x`, `_x`) and multi-line text are silently dropped. |
| S4 | `font-size` is computed by `setFontSize(sizey)` and Java's font metrics. | TS hard-codes `font-size="${sizex * 2}"` — i.e. derived from the wrong size axis and with an arbitrary `*2`. | Text size in SVG ≠ size on canvas. |
| S5 | `checkColorAndWidth` for SVG always writes a single `<line .../>` per call. | TS appends `stroke-dashoffset:` **only when `currentPhase !== dashPhase`**; the *first* element ever drawn always sets it once, but the first `exportConnection` short-circuits this path entirely (it writes its own `style=`). | Inconsistent dash phase between connection dots and other primitives. |
| S6 | Layer alpha is emitted as `opacity="<a>"`. | TS emits `opacity="<a>"` only on non-PCB elements: `exportConnection`, `exportPCBLine`, `exportPCBPad` build their `style=` string by hand and **never emit `opacity`**. | A circuit on a translucent layer that contains a PCB pad will export the pad fully opaque. |
| S7 | `exportArrow` is called once per arrow. | Same in TS, but TS's `exportArrow` writes a `<polygon>` and then calls `checkColorAndWidth(fill="<color>", 0)`. The dash-style argument is hard-coded to 0 → an arrow on a dashed line ignores the dash. | Pre-existing — matches Java; documented here for the test. |
| S8 | XML header on a single line, header comment carries the version number. | TS header is split across three `buffer.push()` calls and the version comment is the literal string `Created by FidoCadTS`. | Cosmetic but verifiable. Affects determinism if the version ever changes. |
| S9 | Empty SVG (no primitives) yields a valid wrapper. | Same in TS, but `getSvgString()` is the *only* way to read the output — calling it before `exportEnd()` returns a half-string. | Test should pin "calling getSvgString without exportEnd is documented behaviour" or fail. |
| S10 | `exportPCBPad` style 2 (rounded) uses `rx=ry=2.5`. | Same value in TS, but the magic number is repeated literally and not exposed as a constant. | Drift risk on next refactor. |

### 1.3 Tests to add — unit (vitest)

For each exporter (`ExportSVG`, `ExportPGF`, `ExportTikZ`):

- **Fixture-based golden output.** Add `test/export/fixtures/` containing
  - `simple.fcd` (one of each primitive on layer 0)
  - `simple.svg` / `simple.pgf` / `simple.tex` — the exact byte-for-byte
    expected output produced by the *current* exporter on the *current*
    Java reference, captured once and reviewed manually.
  - Test: `parse(simple.fcd) → exportSVG()` equals the fixture (after
    normalising the "Created by …" header line and the timestamp, if any).
  - Refresh-fixture scripts should live next to the fixtures and be
    callable via `npm run test:fixtures:update`.
- **Per-primitive coordinate fidelity.** For every primitive, assert the
  exporter emits the exact coordinate values, not just that the tag is
  present:
  - `exportLine(10.5, 20.25, 30, 40, ...)` → SVG must contain
    `x1="10.5"`, `y1="20.25"`, `x2="30"`, `y2="40"` (note: no trailing `.0`).
  - Same for negative coordinates (the Java reference accepts them).
  - Same for sub-pixel `cLe` rounding (`x1=10.005` → `x1="10.01"`).
- **Layer-driven attributes.**
  - Stroke colour matches `layer.getColor()` for layers 0, 7, 12, 15.
  - `opacity` attribute is emitted ⇔ `layer.getAlpha() < 1.0` for every
    primitive: `exportConnection`, `exportPCBLine`, `exportPCBPad`,
    `exportRectangle`, `exportOval`, `exportPolygon`, `exportBezier`,
    `exportAdvText`. The current suite only covers `exportLine`.
- **Dash state machine.**
  - Calling `exportLine` with `dashStyle=0`, then `=1`, then `=0` again
    flips `stroke-dasharray` on/off correctly per element.
  - `setDashPhase(5)` then `setDashPhase(5)` again emits the phase only
    once (currently tracked by `currentPhase !== dashPhase`).
  - A dash followed by a `exportConnection` must not "carry" the dash
    pattern onto the connection.
- **Arrow geometry.**
  - For a horizontal line, arrow polygon vertices are exactly
    `(x, y), (x-l, y±h)` — currently no test verifies the actual triangle
    vertices.
  - Style flag 0 (filled) → `fill="<color>"`; style 1 (open) → `fill="none"`.
  - Arrow on dashed line: arrow polygon must use `dashStyle=0` (Java
    matches).
- **Mirror + rotation matrix (exportAdvText).**
  - `isMirrored=true, orientation=0` → SVG group has `scale(-x, y)` and
    no `rotate(...)`.
  - `isMirrored=true, orientation=90` → SVG group has `scale(-x, y) rotate(90)`
    in the **Java order** (`isMirrored ? orientation : -orientation`).
    → This test would catch bug **S2** in §1.2.
  - `isMirrored=false, orientation=90` → `scale(x, y) rotate(-90)`.
- **escapeXml.**
  - Text containing `&`, `<`, `>`, `"`, `'` is each escaped to the right
    entity. (One test per char; current suite tests none of them.)
  - Text containing the literal string `</svg>` is escaped (would
    otherwise close the document — XML-injection regression test).
- **Macro expansion guard.** `exportMacro()` and `exportCurve()` returning
  `false` is exercised in TikZ/PGF tests but **not in SVG**. Add it.
- **getSvgString before exportEnd.** Document the contract: either
  "returns a partial document" (current) or "throws". Currently
  unspecified.
- **Numeric rounding.**
  - `cLe(0.001)` → `"0"` (not `"0.001"`).
  - `cLe(0.999)` → `"1"`.
  - `cLe(-0.5)` → `"-0.5"` (NOT `"-0.49"`).
  - These should be done both at the `cLe` level (private — needs `as any`
    in tests, or pull it out into a free function) and at the public
    level (e.g., `exportLine(0.001, ...)`).

### 1.4 Tests to add — cross-exporter comparison

The single most valuable test would be:

- **Pixel-for-pixel comparison against the Java reference.**

  Use the Java CLI (`java -jar fidocadj.jar -e fcd simple.fcd svg`) on a
  fixed set of `.fcd` fixtures, capture the output, then diff against the
  TS exporter output normalised for:
  - the "Created by …" version comment,
  - the `xmlns:xlink` attribute (Java emits it, TS doesn't),
  - whitespace between attributes,
  - `cLe` rounding (Java uses `Math.round(l*100.0)/100.0` — same as TS,
    so this should be identical),

  and fail on any other difference. Implementation:

  - A `scripts/regen-export-fixtures.sh` that calls the Java jar and
    drops the output into `test/export/fixtures/java/`.
  - A vitest case that loads each fixture and compares.

  The fixture corpus should include:
  - `single-line.fcd`, `single-rect.fcd`, etc. (one primitive each)
  - `text-mirrored.fcd` (catches bug S2)
  - `text-rotated.fcd` (catches bug S2)
  - `dashed-line.fcd`
  - `transparent-layer.fcd` (catches bug S6)
  - `arrow-both-ends.fcd`
  - `pcb-pad-each-style.fcd`
  - `nested-macro.fcd` (with two levels of macro nesting — exercises the
    expansion-only contract)
  - One full real-world circuit pulled from `~/FidoCadJ/circuits/` if
    available.

- **Render-and-rasterise comparison.** For SVG, render both Java's SVG
  output and the TS SVG output through Playwright (`page.setContent`)
  and rasterise; compare PNGs with pixelmatch. Tolerances:
  - per-pixel ≤ 5 / 255 brightness drift,
  - ≤ 0.2 % of pixels may differ.
  - Failures emit a side-by-side diff to `test-results/`.

- **PGF / TikZ via pdflatex.** Compile each fixture's exported PGF /
  TikZ in a Docker container (`texlive/texlive:latest`), rasterise the
  PDF, and compare against the Java rasterisation. Skips silently if
  Docker is not present (so CI without Docker still passes).

### 1.5 Tests to add — e2e

`test/e2e/export.test.ts` currently has 18 tests, all of them
"contains a tag" assertions. Add:

- **Download path.** Wire `executeExport()` and assert:
  - File-picker / blob trigger fires with the right MIME type
    (`image/svg+xml`, `text/plain`, `image/png`).
  - Default filename matches the FCD source name with the right extension.
- **PNG export (UNTESTED today — zero tests).**
  - `panel.exportPNG()` (added by the dialog flow) produces a non-empty
    blob.
  - The bitmap is the same width × height as the canvas, post-DPR.
  - The bitmap is fully transparent on an empty circuit.
  - The bitmap has at least one non-white pixel after `loadCircuit(simple)`.
  - High-DPR (Retina) export does not double the requested resolution.
- **Export under a non-default zoom / pan.** Today every export test
  exports at zoom=100 %. Add one at 250 % and one at 50 %: the **SVG
  output should be invariant under zoom** (it operates on logical
  coordinates), while PNG should respect the canvas size.
- **Export with hidden layers.** Hide layer 1; assert nothing on layer
  1 appears in the SVG/PGF/TikZ output. Today, `getDrawOnlyLayer()`
  logic in `circuit/views/Export.ts` is not exercised by any test.
- **Export of a circuit containing a macro.** Today no export test
  loads a circuit with a macro reference. Confirm the macro expands
  into its constituent primitives in the export. This catches the
  `PrimitiveMacro` recursion path through `Export.exportDrawing`.
- **Determinism across reloads.** Currently the test calls
  `exportSVG(page)` twice in the same page session. Reload the page
  between calls and check determinism then — would catch any
  module-level Globals contamination across exports.

---

## 2. Source files with ZERO test coverage

A grep for each `src/` file in `test/` (imports + string references)
reveals these files have **no test that exercises them**, beyond
implicit transitive coverage via `CircuitPanel` construction in
`keyboard-shortcuts.test.ts`. Sorted by importance:

### 2.1 Critical — runtime hot path

| File | Why it matters | Suggested tests |
|------|----------------|-----------------|
| `circuit/InputHandler.ts` | Mouse/touch state machine; converts every click into a tool action. | Unit: simulated `MouseEvent` sequences for click, drag, double-click, modifier-key combinations. Snapshot the resulting tool/state transitions. |
| `circuit/views/Drawing.ts` | The render loop that draws every primitive to the canvas. | Headless `OffscreenCanvas` + golden image (rasterise simple circuits and pixelmatch against fixtures). |
| `circuit/views/Export.ts` | Iterates the primitive vector during export — the "per-layer pass + pad pass + macro pass" logic is non-trivial. | Mock the `ExportInterface`; assert the order of calls (e.g. all layer-0 primitives before layer-1, pads emitted in a second pass). |
| `circuit/CanvasManager.ts` | DPR scaling, resize, repaint scheduling. | jsdom: stub `devicePixelRatio` and a fake `ResizeObserver`; assert canvas size matches `cssSize * dpr`. |
| `circuit/MacroVectorizer.ts` | Flattens macro primitives into vectors for selection / hit-test. | Build a 2-level nested macro; vectorise; assert the flat vector has the expected count and the bounding box matches. |
| `circuit/GhostPreview.ts` | The translucent preview while a tool is being dragged. | Unit: feed a tool state + cursor pos; assert the ghost overlay's path. |
| `circuit/ImageAsCanvas.ts` | Background-image-as-trace (currently has no UI but exists). | Load a 100×100 PNG; assert the canvas is composited at given (x, y, scale, alpha). |
| `circuit/KeyboardHost.ts` | Routes keyboard events to the focused panel. | Unit: ensure unfocused canvas does not receive shortcuts. |
| `circuit/ToolGhostHandler.ts` | The "click on canvas while ghost is showing" path. | Unit: simulate ghost + click; assert primitive committed at click point, ghost cleared. |
| `circuit/ContextMenuManager.ts` | Right-click → context menu. | E2E: right-click on a primitive → menu shows entries `Copy / Cut / Delete / Properties`. Click each. |
| `circuit/EditorFacade.ts` | Public API used by the app shell and tests. | Each method has an integration test, but no unit-level test pins the public surface. Add a "facade methods don't throw on a fresh model" sweep. |
| `circuit/services.ts` | Service-locator / dependency wiring. | Unit: instantiating services with a stub DOM does not throw; cycles are absent. |

### 2.2 Controllers — partially tested

| File | Coverage today | Gap |
|------|---------------|-----|
| `controllers/AddElements.ts` | 8 cases in `add-elements.test.ts`. | Tool-state cancellation (Esc mid-line, tool-switch mid-bezier); error on bad coords. |
| `controllers/SelectionActions.ts` | 8 cases. | `selectByRectangle`, multi-layer selection, "select on hidden layer is no-op". |
| `controllers/UndoActions.ts` | 10 cases in `undo-actions.test.ts`. | Add a depth-cap test (today undo is unbounded — see `MISSING.md` §3.5). Library-undo (currently absent). |
| `controllers/EditorActions.ts` | None. | `alignLeft/Right/Top/Bottom`, `nudge`, `delete`, `bringToFront`, `sendToBack`. Each function is a one-line wrapper but the integration is untested. |
| `controllers/ElementsEdtActions.ts` | Indirect via `keyboard-shortcuts.test.ts`. | Tool-switch side effects (does switching tools cancel a pending ghost?). |
| `controllers/ClipboardController.ts` | E2E via `clipboard.test.ts`. | Unit: parse-paste round-trip with a clipboard containing FCD text. Clipboard with invalid FCD → no-op + warning. |
| `controllers/KeyboardController.ts` | Indirect via keyboard-shortcuts. | Macro single-letter binding (currently not honoured per `MISSING.md` §3.2 — pin this gap with an `it.todo`). |
| `controllers/LibraryLoader.ts` | None. | Loading each of the 5 shipped `.fcl` files into a `LibraryModel`; assert macro counts. |
| `controllers/ParserActions.ts` | 65 round-trip + `parser-global-state` (1 case). | `addString` mid-document; library-string error recovery; `\r\n` line endings (per `MISSING.md` §9). |

### 2.3 UI components — none tested in unit

Every file in `src/ui/` is untested at unit level. Some are exercised by
e2e/`menu-bar.test.ts`. None are exercised at component level.

| File | Suggested unit test |
|------|---------------------|
| `ui/ExportDialog.ts` | `showExportDialog()` returns the user's selection; clicking PNG triggers `exportPNG`; cancel returns `null`. Listener cleanup verified (already covered by `listener-leaks.test.ts`). |
| `ui/MenuBar.ts` | Every menu item dispatches the right action ID; disabled state respects `canUndo` / `canRedo`. |
| `ui/ToolbarController.ts` | Each tool button sets `CircuitPanel.getTool()` to the matching ID; pressed-state mirrors the active tool. |
| `ui/PropertiesPanelController.ts` | For each primitive type, the sidebar shows the matching set of fields; editing a field updates the primitive; undo records the change. |
| `ui/LayerDropdown.ts` | Selecting layer N updates `currentLayer`; the dropdown reflects per-layer visibility. |
| `ui/ContextMenu.ts` | `show(x, y, items)` renders all items; clicking an item invokes its handler. |
| `ui/InPlaceTextEditor.ts` | Mount → user types → Enter commits; Escape cancels; KaTeX preview updates live. |
| `ui/OptionsDialog.ts` | Each `SettingsManager` field has a control; Save persists; Cancel reverts. |
| `ui/PromptDialog.ts` | Modal opens, resolves Promise with input or null on cancel. |
| `ui/ConfirmDialog.ts` | Resolves true/false; Esc → false. |
| `ui/DialogSymbolize.ts` | Build the dialog → fill name/category/library → submit → new macro registered. |
| `ui/Toast.ts` | Toast appears, auto-dismisses after timeout, manual dismiss works. |

### 2.4 Graphics layer — none tested

`src/graphic/canvas/*` (ShapeCanvas, PolygonCanvas, ColorCanvas,
GraphicsCanvas, TextCanvas) wrap the HTML5 canvas API. `src/graphic/nil/GraphicsNull.ts`
is the no-op implementation. **None** are tested.

Suggested tests:

- `GraphicsCanvas.drawLine(0, 0, 100, 100)` records the expected
  sequence of `CanvasRenderingContext2D` calls (use a recording stub).
- `ColorCanvas.setColor` accepts both `ColorInterface` and CSS strings.
- `TextCanvas.getFontMetrics()` returns sensible numbers under jsdom
  (which mocks `measureText`).
- `GraphicsNull` methods do nothing and never throw — important
  contract: it's used during `getImageSize` bounds calculation.
- `RenderCtx`, `FontG`, `RectangleG`, `DimensionG`, `PointG`,
  `PointDouble` are pure data classes — minimal unit tests covering
  constructors, equality, accessors.

### 2.5 Geometry and globals — partially tested

| File | Coverage | Gap |
|------|----------|-----|
| `geom/MapCoordinates.ts` | 24 cases. | The `setOrientation` × `mirror` matrix in isolation (today only one combined case). |
| `geom/DrawingSize.ts` | None. | `getImageSize` on an empty model, on a single-primitive model, on a model where everything is on a hidden layer. |
| `geom/GeometricDistances.ts` | None. | `pointInTriangle`, `distancePointToSegment`, `distancePointToBezier` for known geometric configurations (including degenerate). |
| `globals/Globals.ts` | 13 cases. | `Math` helpers (`Globals.dash` table, `dashNumber`). |

### 2.6 Library model — partially tested

| File | Coverage | Gap |
|------|----------|-----|
| `librarymodel/LibraryModel.ts` | 6 cases. | Cycle-detection during library load; duplicate-key handling; `removeLibrary` event. |
| `librarymodel/Library.ts` | 1 case. | `getCategory(name)` lookup; case-insensitive prefix match. |
| `librarymodel/Category.ts` | None directly. | Construct a category, add/remove macros, assert iteration order. |
| `librarymodel/LibUtils.ts` | None. | Parser for `{Category}` headers, line continuation, comments. |
| `librarymodel/UserLibraryStorage.ts` | None. | Persist user library to `localStorage`; reload; assert macro count survives. |
| `librarymodel/event/*` | None. | Event listener fan-out, removal, ordering. |

### 2.7 Primitives — partially tested

`primitive-edge-cases.test.ts` covers 20 cases across all 11 primitive
types. `complex-curve-fixes.test.ts` covers 2 regression cases on
`PrimitiveComplexCurve`. Gaps:

| File | Gap |
|------|-----|
| `PrimitiveAdvText.ts` | Subscript / superscript escapes (`MISSING.md` §4). Rotation flag combinations (0/90/180/270 × mirror × bold × italic). Multi-line text. KaTeX math expressions in text (`$x = 5$`). |
| `PrimitiveMacro.ts` | Recursive expansion at depth 16 (the hard cap). Library-key resolution failure path. |
| `PrimitivePCBPad.ts` | Style 3 through style 10 (`MISSING.md` §4 flags 11 styles). Hole pass (`needsHoles` flag). |
| `PrimitiveBezier.ts` | Arrow-and-dash combinations. Mid-control-point dragging. |
| `PrimitiveComplexCurve.ts` | `addPointClosest` (today: only end-append per `MISSING.md`). |
| `PrimitivePolygon.ts` | `addPointClosest` — currently absent per `MISSING.md`. |
| `Arrow.ts` | Standalone unit test for arrow polygon math (used by every line primitive). |
| `MacroDesc.ts` | Round-trip of macro definitions, including parameter substitution. |

### 2.8 Settings, layers, undo — mostly tested

| File | Coverage | Gap |
|------|----------|-----|
| `settings/SettingsManager.ts` | 11 cases. | `subscribe` / change event fan-out. Migration from an older schema (forward-compat). |
| `layers/LayerDesc.ts` | 9 cases. | Setting alpha outside `[0, 1]` — clamps or throws? Currently un-pinned. |
| `layers/StandardLayers.ts` | Indirect via `layer-desc`. | The 16 layer names + 16 default colours pinned against the Java reference. |
| `undo/UndoState.ts` | None directly (only `UndoActions`). | Serialisation format of an `UndoState` (does it survive a `JSON.stringify` round-trip?). |

### 2.9 i18n and accessibility

| File | Coverage | Gap |
|------|----------|-----|
| `i18n/i18n.ts` | None. | `getString('key')` returns the key when missing. Fallback to English when a bundle lacks a key. |
| `i18n/AccessResources.ts` | None. | Resource path resolution. |

### 2.10 Macro picker

| File | Coverage | Gap |
|------|----------|-----|
| `macropicker/MacroPicker.ts` | E2E via `macro-library.test.ts`. | Unit: tree filtering on search input; "Change Key" updates the macro descriptor. |
| `macropicker/OperationPermissions.ts` | None. | Permission flags read/write; default state. |

---

## 3. Areas with NO e2e coverage

The Playwright suite is broad but has these holes:

- **PNG export** (entire dialog flow — `MISSING.md` §2.1 calls out the
  missing options: DPI, pixel size, B&W, split-layers). Today: zero
  tests.
- **Properties panel.** The `PropertiesPanelController` renders the
  sidebar for the selected primitive; no e2e edits a field and
  verifies the model updates and the canvas re-renders.
- **In-place text editor.** Double-click text → edit overlay; today:
  zero tests.
- **DialogSymbolize.** "Save selection as macro" flow; today: zero
  tests.
- **OptionsDialog (preferences).** Open settings → change grid step →
  close → snap reflects new step. Zero tests.
- **Library import.** Drag-and-drop a `.fcl` file, click "Add Library";
  zero tests.
- **File-system access API path.** `File > Open` via the FS Access API
  (where available) vs the fallback `<input type="file">`; today the
  load path is only exercised through the JS API (`loadCircuit()`).
- **Drag-to-select rubber band.** Click-and-drag in selection tool
  draws a rubber band and selects intersecting primitives; today
  selection is only exercised via direct API.
- **Mouse-wheel zoom on Windows / Mac trackpad gestures.** Today only
  the keyboard zoom is exercised.
- **Touch (pinch / pan).** Mobile gestures are not exercised at all
  (likely OK — Chromium-headless does not emulate touch by default).
- **Multi-tab consistency.** Open two tabs with different circuits in
  the same origin; ensure `SettingsManager.localStorage` writes do not
  step on each other.
- **Browser back / forward.** App is a single page; hash-routing or
  state-in-URL is absent; this is a feature-decision more than a test
  gap, but the current behaviour is undocumented.

---

## 4. Edge-case + adversarial input

These are unit-level fuzz / negative tests that are entirely absent:

### 4.1 Parser

- **Adversarial FCD input.** Lines longer than `MAX_VERTICES` (10 000)
  tokens. Today the parser is documented to accept this; pin it.
- **Truncated FCD.** A file that ends mid-line (no trailing `\n`).
- **Mixed line endings** (`\r\n` and `\n` in the same file).
- **Embedded NUL bytes** (`\0`) in text fields.
- **Surrogate pairs / emoji** in text fields — today only ASCII is
  tested.
- **Negative layers / out-of-range layer indices.** Parser should clamp
  to `[0, 15]` silently (matches Java).
- **FCJ extension tokens followed by unknown sub-codes.** Should be
  ignored, not crash.
- **Macro reference to itself** (recursion depth = 16 → bail).

### 4.2 Exporters

- **Extreme coordinates** (`Number.MAX_SAFE_INTEGER`, `±Infinity`,
  `NaN`). Should sanitise or refuse cleanly.
- **Very long text strings** (10 000 chars).
- **Empty layer set** (parser currently expects `StandardLayers` —
  exporter behaviour on an empty `layerV[]` is unspecified).
- **All-zero primitive** (`LI 0 0 0 0 0`). Today the parser drops
  zero-length lines (covered for LI) but not for RV / EV.

### 4.3 Undo / Redo

- **Undo across a library import.** Today undo is unscoped (`MISSING.md`
  §3.5); pin the current behaviour and mark with `it.todo` for the
  library-scope work.
- **Undo across a settings change** — should NOT roll back settings.
  Today untested.
- **Undo across a layer-visibility toggle** — likewise not tested.
- **Redo after a destructive action.** New action wipes redo; today
  not asserted.

### 4.4 Memory / leaks

`circuit/listener-leaks.test.ts` covers two cases. Add:

- `MacroPicker` mount / unmount cycle does not leak listeners.
- Repeated `CircuitPanel` construct/destroy cycles (1 000 iterations)
  does not grow the listener count.
- `PropertiesPanelController` listeners cleaned up when selection clears.

---

## 5. Test infrastructure improvements

- **Coverage threshold gate.** `package.json` already wires `vitest --coverage`;
  no threshold is configured. Add an 80 %-line / 70 %-branch gate to
  `vite.config.ts > test.coverage.thresholds`.
- **Fixture management.** `test/export/fixtures/` does not exist. Once
  it does, document the refresh policy in `test/TESTS.md`.
- **Snapshot tests.** Vitest supports `.toMatchSnapshot()` natively;
  not used anywhere in the suite. The export tests are the obvious
  candidate (golden output → snapshot).
- **Cross-browser e2e.** `playwright.config.ts` runs Chromium only;
  Firefox / WebKit reveal genuine bugs (e.g. font-metrics differences).
  Should at minimum smoke-test on all three.
- **Visual regression.** Pair with Playwright's `toHaveScreenshot()`
  for a small set of canonical circuits.
- **Mutation testing.** `stryker-mutator` against `export/`,
  `parser/`, `geom/`. The strict-equality assertion style of the
  current export tests would score very low here — `toContain('<line')`
  passes for almost any mutation.

---

## 6. Priority order

If I had to triage today's gaps into ship-blockers vs nice-to-have:

| # | Item | Severity | Effort | Notes |
|---|------|----------|--------|-------|
| 1 | SVG text rotation/mirror (S2 in §1.2) — fix and add test | 🔴 | S | One-line bug in `ExportSVG.exportAdvText`. |
| 2 | SVG opacity on PCB elements (S6) — fix and add test | 🔴 | S | Three `style=` strings each miss `opacity`. |
| 3 | Fixture-based export tests vs Java reference (§1.4) | 🔴 | M | The only way to catch the rest of the S1–S10 list. |
| 4 | PNG export tests (§1.5) | 🟠 | S | The entire feature is currently untested. |
| 5 | `circuit/views/Drawing.ts` golden-image tests (§2.1) | 🟠 | M | The render loop is the most-used and least-tested code path. |
| 6 | EditorActions unit tests (§2.2) | 🟠 | S | Each action is a one-line wrapper but currently untested. |
| 7 | UI dialog tests (§2.3) | 🟡 | M | Lots of files, none critical individually. |
| 8 | Library import / picker (§2.6) | 🟡 | M | Touched by every user but mostly e2e-exercised. |
| 9 | Adversarial input (§4) | 🟡 | M | Production-hardening; no known bug today. |
| 10 | Cross-browser, visual regression (§5) | 🟡 | L | Pays off once the suite has more golden output. |

---

## 7. References

- `test/TESTS.md` — current test inventory (479 tests across 34 files).
- `MISSING.md` — feature-parity gaps vs FidoCadJ (Java).
- `~/FidoCadJ/src/fidocadj/export/ExportSVG.java` — Java reference for
  the exporter S1–S10 differences.
- `src/export/ExportSVG.ts` — the TS implementation under review.
- `src/export/ExportFacade.ts` — the public entry point used by tests
  and the dialog flow.
