<!--
File: TESTS.md
Author: Dante Loi
Date: 2026-05-07
Description: Human-readable index of the FidoCadJS Vitest suite — every
             `it()` case with a plain-English description, grouped by source
             file and `describe()` block.
Copyright: (c) 2026 Dante Loi
-->

# FidoCadJS — Test Suite Reference

This document indexes every test case in `FidoCadJS/test/`. The suite is
written in TypeScript and run with [Vitest](https://vitest.dev) under
`jsdom`. Test files follow the `*.test.ts` convention and each carries a
`@file`/`@author`/`@date`/`@brief` header block.

The suite currently contains **212 `it()` cases across 11 files**.

## How to run

| Command | What it does |
|---------|--------------|
| `npm run test` | Vitest in watch mode |
| `npm run test:run` | Run the suite once (used by CI) |

The `npm run test:run` command is executed
automatically by GitHub Actions
(`FidoCadJS/.github/workflows/deploy.yml`) on every push and pull request
to `main`.

## Suite at a glance

| File | Area under test | `it()` cases |
|------|-----------------|--------------|
| `circuit/controllers/add-elements.test.ts` | `AddElements` — primitive creation per drawing tool | 8 |
| `circuit/controllers/selection-actions.test.ts` | `SelectionActions` — selection queries | 8 |
| `circuit/keyboard-shortcuts.test.ts` | `CircuitPanel` — all keyboard shortcuts | 46 |
| `circuit/model/drawing-model.test.ts` | `DrawingModel` — core data model | 8 |
| `export/export-svg.test.ts` | `ExportSVG` — SVG element generation | 13 |
| `geom/map-coordinates.test.ts` | `MapCoordinates` — coordinate mapping, snap, zoom, orientation | 24 |
| `globals/globals.test.ts` | `Globals` — static utility functions | 13 |
| `layers/layer-desc.test.ts` | `LayerDesc` and `StandardLayers` | 9 |
| `librarymodel/library-model.test.ts` | `LibraryModel`, `Library`, `Category` | 10 |
| `parser/primitive-round-trip.test.ts` | FCD parser/serializer round-trips for all 11 primitives | 65 |
| `undo/undo-manager.test.ts` | Generic `UndoManager` stack | 8 |
| **Total** | | **212** |

---

## `circuit/controllers/add-elements.test.ts`

Verifies that each drawing tool in `AddElements` produces the correct
primitive type and that getter/setter pairs round-trip. Uses a fresh
`DrawingModel` with standard layers per case; `UndoActions` is `null` so
undo states are not pushed.

| Test name | What it verifies |
|-----------|------------------|
| `addConnection creates a PrimitiveConnection` | A single click with the connection tool inserts exactly one `PrimitiveConnection` into the model. |
| `addPCBPad creates a PrimitivePCBPad` | A single click with the PCB-pad tool inserts exactly one `PrimitivePCBPad`. |
| `addLine creates a PrimitiveLine after two clicks` | Two successive clicks with the line tool produce one finished `PrimitiveLine`. |
| `addRectangle creates a PrimitiveRectangle after two clicks` | Two clicks (opposite corners) produce one `PrimitiveRectangle`. |
| `addEllipse creates a PrimitiveOval after two clicks` | Two clicks (bounding-box corners) produce one `PrimitiveOval`. |
| `addBezier creates a PrimitiveBezier after four clicks` | Four clicks (two endpoints + two control points) produce one `PrimitiveBezier`. |
| `addPCBLine creates a PrimitivePCBLine after two clicks` | Two clicks with a given thickness produce one `PrimitivePCBLine`. |
| `pcb thickness getters/setters round-trip` | `setPcbThickness(8)` is read back unchanged by `getPcbThickness()`. |

---

## `circuit/controllers/selection-actions.test.ts`

Tests query and bulk-mutation helpers on `SelectionActions`. Lines are
inserted directly into the primitive vector via a local `addLine` helper
so the tests only exercise selection state, not creation.

| Test name | What it verifies |
|-----------|------------------|
| `getFirstSelectedPrimitive returns null when nothing selected` | With no selection, the helper returns `null` rather than throwing. |
| `getFirstSelectedPrimitive returns selected primitive` | When one primitive has its selected flag set, the helper returns that primitive. |
| `setSelectionAll(true) selects everything` | After calling with `true`, every primitive in the model has `isSelected() === true`. |
| `setSelectionAll(false) deselects everything` | After calling with `false`, every primitive has `isSelected() === false`, even ones previously selected. |
| `getSelectedPrimitives returns only selected primitives` | The returned array contains only the primitive(s) whose flag is set, not all primitives. |
| `isUniquePrimitiveSelected is false for 0 selected` | With nothing selected, the helper reports `false`. |
| `isUniquePrimitiveSelected is true for 1 selected` | With exactly one primitive selected, it reports `true`. |
| `isUniquePrimitiveSelected is false for 2+ selected` | With two or more primitives selected, it reports `false`. |

---

## `circuit/keyboard-shortcuts.test.ts`

Validates every keyboard shortcut wired in `CircuitPanel.onKeyDown()` by
creating a live `CircuitPanel` instance in jsdom, focusing its canvas, and
dispatching `KeyboardEvent`s. A stub 2D context and `ResizeObserver` shim
are installed so the panel can construct without a real browser canvas.

The file is organised into seven `describe` blocks:

- **Tool selection shortcuts** — single-letter keys switch the active tool.
- **Special keys** — Space (fit-to-view), Escape (deselect+select tool),
  zoom (`+`/`=`/`-`), undo/redo (`Ctrl+Z`, `Ctrl+Y`, `Ctrl+Shift+Z`).
- **Transform shortcuts** — `R` (rotate), `S` (mirror), `M` (move mode),
  `Delete`/`Backspace` (delete), all tested with and without a selection.
- **Nudge with Alt + arrow keys** — all four directions, with an explicit
  guard that nudge does nothing when nothing is selected.
- **Clipboard shortcuts** — `Ctrl+C` (copy), `Ctrl+X` (cut, verifies
  deletion), `Ctrl+D` (duplicate — dispatch without crash).
- **Input element blocking** — when focus is on an `<input>`,
  `<textarea>`, or `<select>`, tool shortcuts are suppressed; global
  `Ctrl` shortcuts are still forwarded.
- **Edge cases** — `Ctrl+E`/`Ctrl+P`/`Ctrl+O`/`Ctrl+Z` do not trigger
  their unmodified tool counterparts; `Ctrl+Shift+S` does not mirror;
  unknown keys (`q`, `1`, `F1`) do not crash.

### Tool selection shortcuts

| Test name | What it verifies |
|-----------|------------------|
| `A selects the Selection tool` | `pressKey('a')` sets `getTool() === SELECTION`. |
| `L selects the Line tool` | `pressKey('l')` → `LINE`. |
| `T selects the Text tool` | `pressKey('t')` → `TEXT`. |
| `B selects the Bezier tool` | `pressKey('b')` → `BEZIER`. |
| `P selects the Polygon tool` | `pressKey('p')` → `POLYGON`. |
| `O selects the Complex curve tool` | `pressKey('o')` → `COMPLEXCURVE`. |
| `E selects the Ellipse tool` | `pressKey('e')` → `ELLIPSE`. |
| `G selects the Rectangle tool` | `pressKey('g')` → `RECTANGLE`. |
| `C selects the Connection tool` | `pressKey('c')` → `CONNECTION`. |
| `I selects the PCB track tool` | `pressKey('i')` → `PCB_LINE`. |
| `Z selects the PCB pad tool` | `pressKey('z')` → `PCB_PAD`. |
| `uppercase letters also work for tool selection` | `pressKey('L')` and `pressKey('G')` work because `e.key` is lowercased internally. |

### Special keys

| Test name | What it verifies |
|-----------|------------------|
| `Space triggers fit-to-view` | After adding content and forcing a low zoom, `pressKey(' ')` changes the zoom level via `zoomToFit()`. |
| `Escape clears selection and switches to Selection tool` | All primitives are deselected, tool switches to `SELECTION`. |
| `+ zooms in` | Zoom percentage increases after `pressKey('+')`. |
| `= also zooms in (same key without Shift)` | The `=` key (same physical key as `+` without Shift) also increases zoom. |
| `- zooms out` | Zoom percentage decreases after `pressKey('-')`. |
| `Ctrl+Z triggers undo` | The undo shortcut dispatches without errors (the undo stack pre-exists). |
| `Ctrl+Y triggers redo` | The redo shortcut dispatches without errors. |
| `Ctrl+Shift+Z also triggers redo` | `Ctrl+Shift+Z` is an alias for redo. |

### Transform shortcuts (with selection)

| Test name | What it verifies |
|-----------|------------------|
| `R rotates selected primitives` | A line's control-point coordinates change after a 90° clockwise rotation. |
| `R does nothing when nothing is selected` | Without selection, `R` does not switch tools (it's a transform, not a tool shortcut). |
| `S mirrors selected primitives horizontally` | A line from `(10,10)` to `(40,10)` becomes `(10,10)` to `(-20,10)` — the second point mirrors across `x=10`. |
| `M starts move mode for selected elements` | Canvas cursor changes to `'move'` after `pressKey('m')` with a selection. |
| `M does nothing when nothing is selected` | Without selection, `M` is a no-op that preserves the current tool. |
| `Delete removes selected primitives` | Two selected primitives disappear from the model after `pressKey('Delete')`. |
| `Backspace removes selected primitives` | A selected primitive is removed by `pressKey('Backspace')`. |
| `Delete does nothing when nothing is selected` | With no selection, primitives are left untouched. |

### Nudge with Alt + arrow keys

| Test name | What it verifies |
|-----------|------------------|
| `Alt+ArrowLeft nudges selected left by 1 unit` | All control points shift `-1` in X. |
| `Alt+ArrowRight nudges selected right by 1 unit` | Control points shift `+1` in X. |
| `Alt+ArrowUp nudges selected up by 1 unit` | Control points shift `+1` in Y. |
| `Alt+ArrowDown nudges selected down by 1 unit` | Control points shift `-1` in Y. |
| `Alt+arrow does nothing when nothing is selected` | Without selection, coordinates remain unchanged. |

### Clipboard shortcuts

| Test name | What it verifies |
|-----------|------------------|
| `Ctrl+C copies selected primitives to clipboard` | The copy shortcut dispatches without throwing. |
| `Ctrl+X cuts selected primitives` | After cut, the selected primitive is removed from the model. |
| `Ctrl+D duplicates selected primitives` | The duplicate shortcut (copy + paste) dispatches without errors. |

### Input element does not steal shortcuts

| Test name | What it verifies |
|-----------|------------------|
| `tool shortcut keys are blocked when focus is on an input element` | Pressing `'l'` while an `<input type="text">` has focus does NOT switch to the Line tool. |
| `tool shortcut keys are blocked when focus is on a textarea` | Same guard for `<textarea>` elements. |
| `tool shortcut keys are blocked when focus is on a select element` | Same guard for `<select>` elements. |
| `global Ctrl shortcuts still work when focus is on an input` | `Ctrl+S` is forwarded to `onKeyDown` even when an input is focused (menu bar may be null, but no crash). |

### Edge cases

| Test name | What it verifies |
|-----------|------------------|
| `Ctrl+Shift+S triggers save-as without triggering mirror` | `Ctrl+Shift+S` does not execute the `S` mirror transform. |
| `Ctrl+E does not switch to Ellipse tool` | `Ctrl+E` is export, not ellipse — tool stays unchanged. |
| `Ctrl+P does not switch to Polygon tool` | `Ctrl+P` is print, not polygon. |
| `Ctrl+O does not switch to Complex curve tool` | `Ctrl+O` is open file, not complex curve. |
| `Ctrl+Z does not switch to PCB pad tool` | `Ctrl+Z` is undo, not PCB pad. |
| `unknown keys do not crash or change state` | `q`, `1`, and `F1` are harmless no-ops. |

---

## `circuit/model/drawing-model.test.ts`

Covers the basic API of `DrawingModel`: the primitive vector, the changed
flag, the layer list, and the macro library map.

| Test name | What it verifies |
|-----------|------------------|
| `new model is empty` | A freshly constructed `DrawingModel` has zero primitives. |
| `addPrimitive appends a primitive to the vector` | `addPrimitive(p, true, null)` puts the primitive at the end of the vector. |
| `getPrimitiveVector returns mutable internal vector` | The returned array is the same instance held by the model — `push` on it is observed by subsequent reads. |
| `setPrimitiveVector replaces all primitives` | Replacing the vector wholesale leaves only the new contents. |
| `setChanged / getChanged flag works` | The changed flag round-trips `true`/`false` reliably. |
| `getLayers returns layers set by setLayers` | After loading the standard layer set, `getLayers()` returns at least 2 entries. |
| `setLibrary / getLibrary round-trip` | A user-supplied `Map<string, MacroDesc>` is stored by reference and entries can be read back. |
| `resetLibrary creates empty map` | `resetLibrary()` discards previous entries and leaves a zero-size map. |

---

## `export/export-svg.test.ts`

Confirms that each `ExportSVG` method emits the right SVG element with
correct attributes. Each test starts a fresh export with a 200×200 page,
calls one method, ends the export, and inspects the resulting string.

| Test name | What it verifies |
|-----------|------------------|
| `exportStart / exportEnd produce valid SVG wrapper` | The output begins with an XML declaration and contains a balanced `<svg>` root. |
| `exportLine produces line element` | A line emits `<line>` with the expected `x1`/`y1`/`x2`/`y2` attributes. |
| `exportRectangle produces rect element` | A rectangle emits `<rect>` with `x`, `y`, `width`, `height` attributes. |
| `exportOval produces ellipse element` | An oval emits `<ellipse>` with the centre and radii computed from the bounding box. |
| `exportConnection produces circle element` | A connection dot emits `<circle>` at the right centre with radius equal to half the requested diameter. |
| `exportPolygon produces polygon element` | A 3-point polygon emits `<polygon>` with a `points=` attribute. |
| `exportBezier produces path element` | A cubic Bézier emits `<path>` with a `C` command in the `d=` attribute. |
| `exportPCBLine produces line with stroke-width` | A PCB line emits `<line>` with an explicit `stroke-width` attribute. |
| `exportPCBPad with oval style produces ellipse` | Pad style `0` (oval) renders as `<ellipse>`. |
| `exportPCBPad with rect style produces rect` | Pad style `1` (rectangle) renders as `<rect>`. |
| `exportAdvText produces text element` | An advanced-text call emits `<text>` containing the literal string and a `font-family` attribute. |
| `dash style produces stroke-dasharray attribute` | A non-zero dash style adds a `stroke-dasharray` attribute to the line. |
| `layer alpha < 1 produces opacity attribute` | Drawing on layer 12 (alpha 0.95) adds an `opacity` attribute. |

---

## `geom/map-coordinates.test.ts`

The largest unit-test file: it exercises `MapCoordinates`, the heart of
the screen↔logical-coordinate transform. Covers defaults, mapping
round-trips, orientation/mirror in macro mode, snap behaviour,
magnitude clamping, the `push`/`pop` state stack, bounds tracking, and
debug formatting.

| Test name | What it verifies |
|-----------|------------------|
| `default construction has zero center, magnitude 1, orientation 0, snap active` | The default state has all six getters returning the documented defaults. |
| `mapX / unmapXnosnap round-trips correctly` | `unmapXnosnap(mapX(x))` returns `x` to within 5 decimal places. |
| `mapY / unmapYnosnap round-trips correctly` | Same round-trip for the Y axis. |
| `mapX / mapY with non-zero center offsets` | Mapping `(0, 0)` with centre `(200, 200)` returns `(200, 200)` on screen. |
| `orientation affects mapping when isMacro=true` | In macro mode, orientation 1 rotates the local frame so a point at `(10, 0)` ends up at screen `(0, 10)`. |
| `mirror in macro mode flips X mapping` | With macro+mirror enabled, the X coordinate is negated before centring. |
| `snap mode rounds to grid step when active` | With snap enabled and grid step 10, `unmapXsnap` always returns a multiple of 10. |
| `inactive snap returns raw value` | With snap disabled, `unmapXsnap` returns the unrounded logical X. |
| `setXMagnitude clamps to MIN_MAGNITUDE` | Setting magnitude below the minimum clamps it to `MIN_MAGNITUDE`. |
| `setXMagnitude clamps to MAX_MAGNITUDE` | Setting magnitude above the maximum clamps it to `MAX_MAGNITUDE`. |
| `setOrientation accepts values 0-3` | Orientations 0 and 3 are accepted unchanged. |
| `setOrientation clamps out of range values` | Orientation 5 clamps to 3, -1 clamps to 0. |
| `setXCenter / setYCenter accepts negative values` | Negative centre coordinates are stored as-is. |
| `getXGridStep returns default of 5` | The default X grid step is 5. |
| `setXGridStep updates grid step` | Updating the grid step is observable from the getter. |
| `setMagnitudes sets both X and Y magnitudes (clamped)` | `setMagnitudes(15, 25)` sets X=15 and Y=25 (within clamp range). |
| `push / pop saves and restores full state` | After `push`, mutating and then `pop` restores centre, magnitudes, orientation and snap. |
| `pop from empty stack does not throw` | Calling `pop()` with no pushed state is a no-op, not an exception. |
| `trackPoint extends min/max bounds` | Each tracked point widens the recorded `min`/`max` bounds. |
| `resetMinMax resets to extremes` | After reset, mins are `MAX_SAFE_INTEGER` and maxes are `MIN_SAFE_INTEGER`. |
| `unmapXsnap with active snap rounds to grid step` | Mapping then unmapping a non-grid value with snap on lands on the grid. |
| `toString describes the state` | The debug string contains `xCenter`, `yMagnitude` and `orientation`. |
| `setMagnitudesNoCheck sets without clamping` | The `NoCheck` variant accepts values that the clamping setter would reject (e.g. 200, 300). |
| `mirror and isMacro flags toggle correctly` | Both flags read back the value just assigned. |

---

## `globals/globals.test.ts`

Static utility helpers used across the codebase: file-name handling,
extension manipulation, path prettifying, and numeric rounding.

| Test name | What it verifies |
|-----------|------------------|
| `DEFAULT_EXTENSION is fcd` | `Globals.DEFAULT_EXTENSION` is the string `"fcd"`. |
| `prettifyPath truncates long path with ellipsis` | A long path is shortened below the requested length and contains `...`. |
| `prettifyPath leaves short paths unchanged` | A path already shorter than the limit is returned untouched. |
| `adjustExtension replaces existing extension` | `test.txt` → `test.svg` when the new extension is `svg`. |
| `adjustExtension appends extension when none exists` | `test` becomes `test.fcd`. |
| `checkExtension returns true for matching extension` | `file.fcd` matches `fcd`. |
| `checkExtension returns false for different extension` | `file.svg` does not match `fcd`. |
| `roundTo rounds to specified decimal places using trunc` | `roundTo(3.14159, 2)` yields a value close to `3.14`. |
| `roundTo without ch rounds to 2 decimal places using round` | The single-arg form defaults to 2 decimals. |
| `getFileNameOnly strips path and extension` | `/path/to/file.fcd` becomes `file`. |
| `getFileNameOnly works with just a filename` | `file.fcd` becomes `file`. |
| `getFileNameOnly works without extension` | `/path/to/file` becomes `file`. |
| `adjustExtension handles quoted paths` | A path wrapped in double quotes is unwrapped before the extension is swapped. |

---

## `layers/layer-desc.test.ts`

Covers the `LayerDesc` model and the `StandardLayers` factory.

| Test name | What it verifies |
|-----------|------------------|
| `default constructor creates visible layer` | A no-arg `LayerDesc` is visible, has empty description, alpha 1.0. |
| `constructor with parameters sets values` | The (color, visible, description, alpha) overload stores all four. |
| `isVisible / setVisible toggles visibility` | The visibility flag round-trips correctly. |
| `getDescription / setDescription round-trip` | The description string is preserved across set/get. |
| `setColor / getColor round-trip` | A default-constructed `LayerDesc` has `null` colour. |
| `isModified / setModified flag` | The modified flag starts `false` and tracks updates. |
| `setAlpha / getAlpha round-trip` | Alpha (0.5) is stored and read back. |
| `StandardLayers creates visible layers` | `createStandardLayers()` returns a non-empty list whose first layer is visible. |
| `StandardLayers layers have descriptions` | At least one standard layer carries a non-empty description. |

---

## `librarymodel/library-model.test.ts`

Tests how the flat `Map<string, MacroDesc>` held by `DrawingModel` is
rebuilt into the `Library` → `Category` → `MacroDesc` hierarchy used by
the macro picker. Library content comes from a small inline `SAMPLE_FCL`
string parsed by `ParserActions`.

### `LibraryModel`

| Test name | What it verifies |
|-----------|------------------|
| `builds Library/Category hierarchy from flat MacroDesc map` | After parsing the sample library, `getAllLibraries()` contains a library with filename `"testlib"`. |
| `getAllMacros returns the same map as drawingModel.getLibrary` | The reference returned is identical (`===`) to the model's library map — no copy. |
| `groups macros into correct categories` | The library exposes an `Active` category (defined by `{Active}` in the sample). |
| `category contains correct macros` | The `u001` macro key is present somewhere in the library's categories. |
| `forceUpdate fires libraryLoaded on all listeners` | Registered listeners receive exactly one `libraryLoaded` callback per `forceUpdate`. |
| `removeLibraryListener stops receiving events` | After removal, the listener no longer receives `libraryLoaded`. |

### `LibraryModel static helpers`

| Test name | What it verifies |
|-----------|------------------|
| `getPlainMacroKey strips library prefix` | `testlib.r001` → `r001`. |
| `getPlainMacroKey works for unprefixed keys` | `000` is returned untouched (no prefix to strip). |
| `createMacroKey produces lowercase prefixed key` | `("PCB", "R00")` → `pcb.r00`. |

### `Library`

| Test name | What it verifies |
|-----------|------------------|
| `containsMacroKey finds macro in any category` | `testLib.containsMacroKey("u001")` is `true`; an unknown key returns `false`. |

---

## `parser/primitive-round-trip.test.ts`

The largest test file by case count. It validates `ParserActions`
parser/serializer for all 11 FCD primitives plus FCJ extension tokens,
FJC global config tokens, incremental parsing, and library reading.

The pattern used throughout is the **stability check** `assertStable`:
parse the input once, serialise with `getText(false)` to produce `T1`,
parse `T1`, serialise again to produce `T2`, and assert `T1 === T2`.
This proves the textual form is a fixed point of the parse/serialise
round-trip — without comparing against any external (Java) reference
output. The suite saves and restores `Globals.diameterConnection`,
`Globals.lineWidth`, and `Globals.lineWidthCircles` between cases so
FJC tokens in one test cannot leak into another.

### `PrimitiveLine (LI)`

| Test name | What it verifies |
|-----------|------------------|
| `parses and re-serializes a basic line` | `LI 10 20 30 40 0` round-trips byte-for-byte. |
| `preserves non-zero layer` | A line on layer 3 keeps that layer through the round-trip. |
| `produces empty output for zero-length line (no name/value)` | A degenerate line where both endpoints coincide is dropped on serialisation. |
| `is stable from test size file` | An LI prefixed with `FJC C 1.5`/`FJC B 0.25` is stable. |
| `round-trips multiple lines` | A document with three `LI` rows survives the round-trip. |

### `PrimitiveBezier (BE)`

| Test name | What it verifies |
|-----------|------------------|
| `parses and re-serializes a bezier curve` | `BE 50 5 20 60 70 35 50 70 0` round-trips byte-for-byte. |
| `preserves layer on bezier` | A BE on layer 2 keeps its layer. |
| `is stable from test size file` | A BE preceded by FJC config tokens is stable. |

### `PrimitiveRectangle (RV/RP)`

| Test name | What it verifies |
|-----------|------------------|
| `parses empty rectangle RV` | `RV 25 20 95 75 0` round-trips. |
| `parses filled rectangle RP` | `RP 10 10 50 40 0` round-trips. |
| `preserves layer` | Layer 5 is preserved. |
| `is stable from test size file` | RV with FJC config is stable. |

### `PrimitiveOval (EV/EP)`

| Test name | What it verifies |
|-----------|------------------|
| `parses empty oval EV` | `EV 45 15 95 65 0` round-trips. |
| `parses filled oval EP` | `EP 10 10 40 40 0` round-trips. |
| `is stable from test size file` | EV with FJC config is stable. |

### `PrimitivePolygon (PV/PP)`

| Test name | What it verifies |
|-----------|------------------|
| `parses open polygon PV` | A 5-point `PV` round-trips and contains the expected `PV `, point list and trailing layer. |
| `parses filled polygon PP` | A 3-point `PP` round-trips. |
| `is stable from test size file` | PV with FJC config is stable. |

### `PrimitiveComplexCurve (CV/CP)`

| Test name | What it verifies |
|-----------|------------------|
| `parses closed filled curve CP` | An 8-point closed filled curve round-trips. |
| `parses open unfilled curve CV` | An 8-point open curve round-trips. |
| `is stable from test size file (open curve)` | A curve with FJC `C`/`A`/`B` config is stable. |
| `roundtrips a short CV` | A 4-point `CV` round-trips byte-for-byte. |

### `PrimitivePCBPad (PA)`

| Test name | What it verifies |
|-----------|------------------|
| `parses a PCB pad with oval style` | `PA … 0 0` (style 0 = oval) round-trips. |
| `parses a PCB pad with rect style` | `PA … 1 0` (style 1 = rect) round-trips. |
| `parses a PCB pad with rounded rect style` | `PA … 2 0` (style 2 = rounded rect) round-trips. |
| `is stable from test size file` | A PA with FJC config is stable. |
| `preserves layer` | A PA on layer 3 keeps its layer. |

### `PrimitivePCBLine (PL)`

| Test name | What it verifies |
|-----------|------------------|
| `parses a PCB line with integer width` | `PL 10 110 90 110 5 0` round-trips. |
| `parses a PCB line with different widths` | Two PLs with widths 3 and 4 round-trip. |
| `preserves layer` | A PL on layer 2 with width 2 round-trips and the width is serialised as an integer. |
| `is stable from test size file` | A PL with FJC config is stable. |

### `PrimitiveConnection (SA)`

| Test name | What it verifies |
|-----------|------------------|
| `parses a connection dot` | `SA 70 60 0` round-trips. |
| `parses multiple connections` | Three SA tokens round-trip. |
| `preserves layer` | A SA on layer 3 keeps its layer. |
| `is stable from test size file` | An SA with FJC config is stable. |

### `PrimitiveAdvText (TY/TE)`

| Test name | What it verifies |
|-----------|------------------|
| `parses TY with default font (*)` | `TY 85 25 5 3 0 0 0 * A` round-trips with the `*` font marker preserved. |
| `parses TY with named font` | A TY with `Helvetica` and a multi-word string round-trips. |
| `converts TE to TY on output` | The legacy `TE` form is normalised to `TY` on first serialisation, with default sizes/style. |
| `TY output is stable (TY → TY, not TE)` | Once converted, subsequent round-trips stay as `TY`. |
| `preserves orientation` | A TY with rotation 20 keeps it. |
| `preserves style flags` | A TY with style flag 4 (bold) keeps it. |
| `handles multi-word text` | Text containing several spaces is preserved. |
| `is stable from test size file` | A named-font TY with FJC config is stable. |

### `PrimitiveMacro (MC)`

| Test name | What it verifies |
|-----------|------------------|
| `parses a macro and re-serializes its key` | `MC 100 100 0 0 testmacro` round-trips when the macro is registered in the model's library. |
| `preserves orientation` | An MC with orientation 2 keeps it. |
| `preserves mirror flag` | An MC with the mirror bit set keeps it. |
| `is stable (parse → getText → parse → getText)` | An MC is stable when re-parsed against a freshly built model that holds the same macro definition. |
| `silently skips unknown macros (no library entry)` | Parsing an MC whose key is not in the library does not throw — the unknown reference is silently dropped. |

### `Full document stability`

| Test name | What it verifies |
|-----------|------------------|
| `is stable for individual line primitives` | Single-`LI` document is stable. |
| `is stable for individual bezier` | Single-`BE` document is stable. |
| `is stable for a document with mixed primitives (no FCJ)` | A 15-primitive document covering every base primitive type is stable. |
| `is stable for test_pattern.fcd (strips FCJ, all base primitives present)` | A large reference document modelled on `test_pattern.fcd` (without FCJ extensions) is stable. |
| `primitive count is correct after parsing` | Parsing a 3-line document leaves exactly 3 entries in `getPrimitiveVector()`. |

### `FJC configuration parsing`

| Test name | What it verifies |
|-----------|------------------|
| `FJC C changes diameterConnection` | `FJC C 2.5` updates `Globals.diameterConnection`. |
| `FJC A changes lineWidth` | `FJC A 0.5` updates `Globals.lineWidth`. |
| `FJC B changes lineWidthCircles` | `FJC B 0.25` updates `Globals.lineWidthCircles`. |

### `FCJ extension tokens`

| Test name | What it verifies |
|-----------|------------------|
| `line with FCJ arrow+dash parses without error` | `LI` followed by `FCJ 0 0 3 2 4 0` parses; with extensions disabled the FCJ payload is dropped on output. |
| `bezier with FCJ dash parses without error` | `BE` + `FCJ 0 0 0 0 2 0` parses without throwing. |
| `rectangle with FCJ fill type parses without error` | `RV` + `FCJ 2 0` parses. |
| `oval with FCJ fill type parses without error` | `EV` + `FCJ 2 0` parses. |
| `polygon with FCJ fill type parses without error` | `PV` + `FCJ 2 0` parses. |
| `complex curve with FCJ parses without error` | `CV` + `FCJ 3 0 3 2 0 0` parses. |

### `ParserActions.addString`

| Test name | What it verifies |
|-----------|------------------|
| `addString appends to existing primitives` | After parsing one primitive, `addString` adds another rather than replacing. |
| `parseString clears previous primitives` | Calling `parseString` again replaces the primitive vector entirely. |

### `readLibraryString`

| Test name | What it verifies |
|-----------|------------------|
| `loads a simple library and makes macro parseable` | A library defining `RLED` is parsed, and the resulting key (lowercased and prefixed) appears in `model.getLibrary()`. |

---

## `undo/undo-manager.test.ts`

Tests the generic ring-buffer undo/redo stack used by the editor.

| Test name | What it verifies |
|-----------|------------------|
| `new manager cannot undo or redo` | A fresh `UndoManager` reports `canUndo() === false` and `canRedo() === false`. |
| `undoPush followed by undoPop returns state` | After pushing two states, `undoPop` returns the earlier state. |
| `undoRedo after undoPop re-applies state` | After undoing once, `undoRedo` returns the state that was just undone. |
| `undoReset clears everything` | After `undoReset`, neither undo nor redo is possible. |
| `undoPop at bottom returns same state (pointer clamped to 1)` | Popping past the bottom keeps returning the oldest state (the pointer is clamped, not allowed to go negative). |
| `buffer max size evicts oldest entries` | A manager with capacity 3 drops the oldest entry when a 4th is pushed. |
| `isNextOperationOnALibrary detects library operation` | A pushed state flagged `libraryOperation: true` is reported as such after popping the next one. |
| `undoRedo throws when nothing to redo` | Calling `undoRedo` with nothing on the redo stack throws. |

---

## Conventions worth knowing

- **Stability pattern.** The parser tests use the `assertStable(s)` helper:
  parse `s` → `getText(false)` → parse → `getText(false)`, and require
  the two serialisations to be identical. This catches both lossy parsing
  and non-deterministic serialisation without depending on a Java
  reference output (Java and TypeScript may format floats differently).
- **Globals leakage is explicitly prevented.** `primitive-round-trip.test.ts`
  saves `Globals.diameterConnection`, `Globals.lineWidth`, and
  `Globals.lineWidthCircles` in `beforeEach` and restores them in
  `afterEach`, so FJC tokens in one case do not leak into the next.
- **`AddElements` with a `null` UndoActions.** `add-elements.test.ts`
  passes `null` for the undo handle so creation calls do not push
  states. The test isolates primitive creation from the undo pipeline.
- **No DOM/disk needed for libraries.** The library tests build a
  `DrawingModel` and hand `ParserActions.readLibraryString` an inline
  FCL string (`SAMPLE_FCL`). Nothing reads from disk.
- **jsdom environment.** Tests run under `jsdom`, configured in
  `vite.config.ts`. There are no real-browser tests at present.

## Placeholder areas

The directories `test/e2e/`, `test/primitives/`, and `test/settings/`
exist but currently hold no tests. They are placeholders for future
end-to-end, primitive-unit, and settings tests respectively.
