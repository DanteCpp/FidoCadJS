<!--
File: TESTS.md
Description: Index of the FidoCadJS test suite, GENERATED from test discovery.
             Do NOT edit by hand — run `npm run docs:tests` to regenerate.
Generated: 2026-06-11
-->

# FidoCadJS — Test Suite Reference

This document indexes every statically discoverable test case in
`FidoCadJS/test/`: **644 unit cases** ([Vitest](https://vitest.dev) + jsdom)
across 52 files and **185 E2E cases**
([Playwright](https://playwright.dev), run on Chromium, Firefox, and WebKit)
across 18 files. Parametrized tests are counted once, so
runtime totals can be higher.

## How to run

| Command | What it does |
|---------|--------------|
| `npm run test` | Vitest in watch mode |
| `npm run test:run` | Run unit tests once (used by CI) |
| `npm run test:coverage` | Unit tests + coverage gate |
| `npm run test:e2e` | Playwright E2E tests against the existing `dist/` build |
| `npm run test:e2e:prod` | Build first, then run Playwright E2E tests |
| `npm run test:e2e:ui` | Playwright E2E tests (interactive UI) |
| `npm run docs:tests` | Regenerate this file |

## Unit suite at a glance

| File | Cases |
|------|-------|
| `circuit/align-distribute.test.ts` | 6 |
| `circuit/controllers/add-elements.test.ts` | 8 |
| `circuit/controllers/editor-actions.test.ts` | 19 |
| `circuit/controllers/library-loader.test.ts` | 5 |
| `circuit/controllers/selection-actions.test.ts` | 8 |
| `circuit/copy-all-as-primitives.test.ts` | 3 |
| `circuit/image-background.test.ts` | 13 |
| `circuit/keyboard-shortcuts.test.ts` | 51 |
| `circuit/listener-leaks.test.ts` | 2 |
| `circuit/macro-rotation.test.ts` | 2 |
| `circuit/model/drawing-model.test.ts` | 8 |
| `circuit/placement.test.ts` | 18 |
| `circuit/ruler.test.ts` | 4 |
| `circuit/views/export.test.ts` | 9 |
| `export/export-adversarial.test.ts` | 13 |
| `export/export-bitmap.test.ts` | 13 |
| `export/export-dialog.test.ts` | 13 |
| `export/export-math.test.ts` | 4 |
| `export/export-pdf.test.ts` | 22 |
| `export/export-pgf.fixtures.test.ts` | 1 |
| `export/export-pgf.test.ts` | 34 |
| `export/export-svg.fixtures.test.ts` | 1 |
| `export/export-svg.java-parity.test.ts` | 1 |
| `export/export-svg.test.ts` | 30 |
| `export/export-tikz.fixtures.test.ts` | 1 |
| `export/export-tikz.test.ts` | 30 |
| `export/latex-escape.test.ts` | 10 |
| `geom/drawing-size.test.ts` | 9 |
| `geom/geometric-distances.test.ts` | 21 |
| `geom/map-coordinates.test.ts` | 27 |
| `globals/globals.test.ts` | 21 |
| `graphic/color-canvas.test.ts` | 8 |
| `graphic/dash-scaling.test.ts` | 8 |
| `graphic/math-layout.test.ts` | 12 |
| `i18n/routing.test.ts` | 14 |
| `layers/layer-desc.test.ts` | 9 |
| `librarymodel/library-model.test.ts` | 10 |
| `macropicker/macro-picker.test.ts` | 6 |
| `macropicker/preview-connection.test.ts` | 2 |
| `parser/parser-adversarial.test.ts` | 23 |
| `parser/parser-global-state.test.ts` | 3 |
| `parser/primitive-round-trip.test.ts` | 65 |
| `primitives/complex-curve-fixes.test.ts` | 5 |
| `primitives/primitive-edge-cases.test.ts` | 27 |
| `settings/settings-manager.test.ts` | 9 |
| `ui/confirm-dialog.test.ts` | 6 |
| `ui/menubar-open-libraries.test.ts` | 1 |
| `ui/prompt-dialog.test.ts` | 5 |
| `ui/properties-batch.test.ts` | 3 |
| `ui/toolbar-controller.test.ts` | 9 |
| `undo/undo-actions.test.ts` | 10 |
| `undo/undo-state.test.ts` | 2 |
| **Total** | **644** |

## E2E suite at a glance

| File | Cases |
|------|-------|
| `e2e/app-loads.test.ts` | 11 |
| `e2e/clipboard.test.ts` | 12 |
| `e2e/drawing-tools.test.ts` | 14 |
| `e2e/edge-cases.test.ts` | 22 |
| `e2e/export-bitmap-render.test.ts` | 4 |
| `e2e/export-png.test.ts` | 6 |
| `e2e/export-svg-pixel-parity.test.ts` | 1 |
| `e2e/export.test.ts` | 22 |
| `e2e/file-operations.test.ts` | 8 |
| `e2e/grid-snap.test.ts` | 4 |
| `e2e/keyboard-e2e.test.ts` | 20 |
| `e2e/layer-dialog.test.ts` | 3 |
| `e2e/macro-library.test.ts` | 7 |
| `e2e/math-render.test.ts` | 4 |
| `e2e/menu-bar.test.ts` | 11 |
| `e2e/selection-and-transform.test.ts` | 12 |
| `e2e/undo-redo.test.ts` | 7 |
| `e2e/zoom-pan.test.ts` | 17 |
| **Total** | **185** |

---

## `circuit/align-distribute.test.ts`

- **Align Center**
  - alignHorizontalCenter aligns primitives to the horizontal center of selection
  - alignVerticalCenter aligns primitives to the vertical center of selection
  - no-op when nothing selected
- **Distribute**
  - distributeHorizontally spaces primitives evenly between extremes
  - distributeVertically spaces primitives evenly between extremes
  - no-op when fewer than 3 selected

## `circuit/controllers/add-elements.test.ts`

- **AddElements**
  - addConnection creates a PrimitiveConnection
  - addPCBPad creates a PrimitivePCBPad
  - addLine creates a PrimitiveLine after two clicks
  - addRectangle creates a PrimitiveRectangle after two clicks
  - addEllipse creates a PrimitiveOval after two clicks
  - addBezier creates a PrimitiveBezier after four clicks
  - addPCBLine creates a PrimitivePCBLine after two clicks
  - pcb thickness getters/setters round-trip

## `circuit/controllers/editor-actions.test.ts`

- **EditorActions — alignment**
  - **alignLeftSelected**
    - no-op when nothing is selected
    - moves selected primitives to the leftmost selected x
    - leaves unselected primitives untouched
    - pushes exactly one undo state
  - **alignRightSelected**
    - moves selected primitives to the rightmost selected x+width
    - no-op when nothing selected
  - **alignTopSelected**
    - moves selected primitives to the topmost selected y
    - no-op when nothing selected
  - **alignBottomSelected**
    - moves selected primitives to the bottommost selected y+height
- **EditorActions — selectRect**
  - selects primitives fully inside the rectangle
  - returns false when no primitives are inside
  - does not select a macro when all of its layers are hidden
- **EditorActions — distancePrimitive**
  - returns the minimum distance to the closest primitive
  - returns MAX_SAFE_INTEGER (or similar very large) for empty model
- **EditorActions — deleteAllSelected**
  - removes selected primitives, leaves unselected ones
  - saveState=true pushes an undo state
  - saveState=false does NOT push an undo state
- **EditorActions — setLayerForSelectedPrimitives**
  - changes the layer for selected primitives only
  - returns false when no primitives are selected

## `circuit/controllers/library-loader.test.ts`

- **loadStandardLibraries**
  - fetches all five standard libraries and parses them with their prefixes
  - uses localized bundles when the locale ships one, English otherwise
  - passes each library body to readLibraryString
  - a failing library does not prevent the others from loading
  - a non-OK HTTP response is skipped with a warning

## `circuit/controllers/selection-actions.test.ts`

- **SelectionActions**
  - getFirstSelectedPrimitive returns null when nothing selected
  - getFirstSelectedPrimitive returns selected primitive
  - setSelectionAll(true) selects everything
  - setSelectionAll(false) deselects everything
  - getSelectedPrimitives returns only selected primitives
  - isUniquePrimitiveSelected is false for 0 selected
  - isUniquePrimitiveSelected is true for 1 selected
  - isUniquePrimitiveSelected is false for 2+ selected

## `circuit/copy-all-as-primitives.test.ts`

- **MacroVectorizer.vectorizeAllToString**
  - flattens a flat macro and keeps plain primitives
  - recursively flattens nested macros
  - round-trips a macro-free drawing unchanged in primitive count

## `circuit/image-background.test.ts`

- **ImageAsCanvas**
  - **initial state**
    - starts with no image attached
    - has default position and alpha
  - **position / scale / alpha**
    - setX and getX work
    - setY and getY work
    - setScale clamps to [0.01, 100]
    - setAlpha clamps to [0, 1]
  - **attachImage**
    - attaches a data URL and sets natural dimensions
    - getState returns the current state when image is attached
  - **detach**
    - removes the image and resets state
  - **restoreState**
    - restores image and position from state
    - serializes image data into FCD and restores it on parse
  - **trackExtremePoints**
    - tracks nothing when no image is attached
    - tracks image bounds when attached

## `circuit/keyboard-shortcuts.test.ts`

- **Keyboard Shortcuts**
  - **Tool selection shortcuts**
    - A selects the Selection tool
    - L selects the Line tool
    - T selects the Text tool
    - B selects the Bezier tool
    - P selects the Polygon tool
    - O selects the Complex curve tool
    - E selects the Ellipse tool
    - G selects the Rectangle tool
    - C selects the Connection tool
    - I selects the PCB track tool
    - Z selects the PCB pad tool
    - uppercase letters also work for tool selection
  - **Special keys**
    - Space selects the Selection tool (FidoCadJ binding)
    - Home triggers fit-to-view
    - Escape clears selection and switches to Selection tool
    - + zooms in
    - = also zooms in (same key without Shift)
    - - zooms out
    - Ctrl+Z undoes the last edit
    - Ctrl+Y redoes an undone edit
    - Ctrl+Shift+Z also redoes
  - **Select all**
    - Ctrl+A selects every primitive when focus is on the canvas
    - Cmd+A (metaKey) also selects all
    - Ctrl+A does not select primitives when focus is on a text input
    - plain A (no modifier) still switches to the Selection tool
  - **Transform shortcuts (with selection)**
    - R rotates selected primitives
    - R does nothing when nothing is selected
    - S mirrors selected primitives horizontally
    - M starts move mode for selected elements
    - M does nothing when nothing is selected
    - Delete removes selected primitives
    - Backspace removes selected primitives
    - Delete does nothing when nothing is selected
  - **Nudge with Alt + arrow keys**
    - Alt+ArrowLeft nudges selected left by 1 unit
    - Alt+ArrowRight nudges selected right by 1 unit
    - Alt+ArrowUp nudges selected up by 1 unit
    - Alt+ArrowDown nudges selected down by 1 unit
    - Alt+arrow does nothing when nothing is selected
  - **Clipboard shortcuts**
    - Ctrl+C copies selected primitives to clipboard
    - Ctrl+X cuts selected primitives
    - Ctrl+D duplicates selected primitives
  - **Input element does not steal shortcuts**
    - tool shortcut keys are blocked when focus is on an input element
    - tool shortcut keys are blocked when focus is on a textarea
    - tool shortcut keys are blocked when focus is on a select element
    - global Ctrl shortcuts still work when focus is on an input
  - **Edge cases**
    - Ctrl+Shift+S triggers save-as without triggering mirror
    - Ctrl+E does not switch to Ellipse tool
    - Ctrl+P does not switch to Polygon tool
    - Ctrl+O does not switch to Complex curve tool
    - Ctrl+Z does not switch to PCB pad tool
    - unknown keys do not crash or change state

## `circuit/listener-leaks.test.ts`

- **CircuitPanel listener leak prevention**
  - CircuitPanel.destroy() calls lifecycle.abort()
  - ExportDialog uses AbortController to clean up document listeners

## `circuit/macro-rotation.test.ts`

- **macro rotation preserves shape**
  - flat macro is rigid across all orientation/mirror combinations
  - nested macro with mirrored sub-macro is rigid across all orientations

## `circuit/model/drawing-model.test.ts`

- **DrawingModel**
  - new model is empty
  - addPrimitive appends a primitive to the vector
  - getPrimitiveVector returns mutable internal vector
  - setPrimitiveVector replaces all primitives
  - setChanged / getChanged flag works
  - getLayers returns layers set by setLayers
  - setLibrary / getLibrary round-trip
  - resetLibrary creates empty map

## `circuit/placement.test.ts`

- **Primitive placement via tools**
  - **line tool**
    - places a line after two clicks (mousedown + mouseup each)
    - resets between lines when switching away and back
  - **rectangle tool**
    - places a rectangle after two clicks
  - **ellipse tool**
    - places an ellipse after two clicks
  - **bezier tool**
    - places a bezier after four clicks
  - **polygon tool**
    - polygon tool is selectable and clickable without crash
  - **connection tool**
    - places a connection after one click
  - **PCB line tool**
    - places a PCB line after two clicks
  - **PCB pad tool**
    - places a PCB pad after one click
  - **text tool**
    - places text after one click (properties panel opens for editing)
  - **tool state consistency**
    - getTool returns the correct tool after setTool
    - switching tools does not place primitives
    - selection tool does not place primitives on click
  - **rapid placement stress test**
    - places 20 connection dots in rapid succession
    - renders primitives at widely spread coordinates without clipping
- **Macro placement**
  - places a macro after one click
  - places multiple macros sequentially
  - macro is placed at correct position

## `circuit/ruler.test.ts`

- **Ruler**
  - is inactive and draws nothing by default
  - reports the length in logical units and millimetres
  - measures a diagonal with Pythagoras
  - exposes its start point

## `circuit/views/export.test.ts`

- **Export view — call ordering**
  - a single line emits exactly one exportLine call
  - per-layer pass: layer 0 primitives emitted before layer 1
  - PCB pads emit one exportPCBPad in the layer pass and one in the hole pass
  - hidden layer skips emission when exportInvisible=false
  - hidden layer still emits when exportInvisible=true
  - multiple primitive types are all emitted
- **Export view — exportHeader**
  - exportStart receives a dimension >= the drawing bounds + EXPORT_BORDER
  - exportStart receives the layer list
  - setDashUnit is called before exportStart

## `export/export-adversarial.test.ts`

- **ExportSVG adversarial input**
  - **extreme numeric values**
    - MAX_SAFE_INTEGER coordinates do not throw
    - -MAX_SAFE_INTEGER coordinates do not throw
    - Infinity is emitted (and the file is still valid XML)
    - NaN coordinates do not throw
    - sub-pixel positive value rounds to its cLe form
  - **text fields**
    - long text (10000 chars) does not throw
    - empty text is emitted as an empty <text> element
    - XML metacharacters are escaped
    - embedded </svg> cannot break out of the document
    - font name with XML metacharacters is escaped
    - surrogate-pair emoji survives without breaking output
  - **many primitives**
    - 1000 lines do not throw or blow the buffer
  - **PCB pad style range**
    - unknown pad style falls back to the oval (style 0) branch

## `export/export-bitmap.test.ts`

- **ExportBitmap**
  - **renderToOffscreen**
    - produces a canvas with valid dimensions at 150 DPI
    - scales proportionally with DPI
    - respects pixel mode dimensions (fits within bounds)
    - applies the antiAlias option to the offscreen context
    - blackAndWhite option triggers the pixel post-processing pass
  - **renderLayerToOffscreen**
    - renders a single layer and restores drawOnlyLayer to -1
  - **canvasToPNGBlob**
    - converts canvas to PNG blob via stubbed toBlob
  - **canvasToJPEGBlob**
    - converts canvas to JPEG blob via stubbed toBlob
  - **exportBitmapBlobs**
    - exports single PNG blob when splitLayers is false
    - exports multiple blobs when splitLayers is true
    - exports JPG blob
  - **DPI presets**
    - matches FidoCadJ standard presets
  - **defaultBitmapOptions**
    - returns sensible defaults

## `export/export-dialog.test.ts`

- **ExportDialog.executeExport**
  - **format dispatch**
    - format=svg calls exportSVG() and downloads .svg
    - format=pgf calls exportPGF() and downloads .pgf
    - format=tikz calls exportTikZ() and downloads .tex
    - format=png calls getModel() and downloads .png (async)
    - format=jpg calls getModel() and downloads .jpg (async)
  - **filename extension handling**
    - appends .svg when missing
    - does not double-append .svg when already present
    - appends .tex (not .tikz) for TikZ
  - **blob lifecycle**
    - SVG blob has the right MIME type
    - PGF blob is text/plain
    - TikZ blob is text/plain
    - SVG blob size matches the exported string length
    - text-format downloads revoke their object URLs immediately

## `export/export-math.test.ts`

- **Math export — SVG**
  - emits glyph paths for math, not literal $ source
  - leaves plain text as a <text> element (no stray paths from text)
  - falls back to literal text for malformed math
- **Math export — PDF**
  - produces a valid PDF that draws math as path fills

## `export/export-pdf.test.ts`

- **ExportPDF**
  - **document structure**
    - emits a valid PDF 1.4 header and EOF
    - includes catalog, pages, page, and font objects
    - emits a cross-reference table with 15 entries (objects 0..14)
    - declares MediaBox sized for the drawing plus border
    - initializes content stream with origin transform and line-cap
  - **primitives**
    - exportLine emits an m/l/S sequence
    - exportRectangle filled emits four edges + f
    - exportRectangle stroke-only emits s
    - exportBezier emits m + c S cubic-curve operator
    - exportPolygon emits move + line vertices + f* (fill)
    - exportPolygon stroke-only emits s
    - exportConnection draws a filled disc via ellipse + f
    - exportPCBLine emits stroke-width and m/l/S
    - exportPCBPad style 1 (square) draws filled square + hole
  - **color and dash state**
    - emits rg/RG color operators for the active layer
    - does not repeat color operators when layer stays the same
    - emits [] 0 d to reset dashing when a solid stroke follows a dashed one
  - **text**
    - exportAdvText emits BT/ET text block
    - escapes PDF special characters in text
    - routes Times and Courier font names to dedicated font slots
  - **arrows**
    - filled arrow ends with f*
    - limiter arrow draws an extra perpendicular line

## `export/export-pgf.fixtures.test.ts`

- **ExportPGF — fixture corpus**
    - ${name} matches committed TS snapshot

## `export/export-pgf.test.ts`

- **ExportPGF**
  - exportStart / exportEnd produce valid PGF wrapper
  - exportStart emits layer color definitions
  - exportLine produces pgfline command
  - exportLine emits color switch for different layers
  - exportLine does not re-emit color for same layer
  - exportLine with arrows emits arrow polygon
  - exportLine with empty arrow style emits qstroke
  - exportRectangle produces pgfmoveto/pgflineto chain
  - exportRectangle filled emits pgffill
  - exportRectangle unfilled emits pgfqstroke
  - exportOval produces pgfellipse command
  - exportOval filled emits fillstroke
  - exportOval unfilled emits stroke
  - exportConnection produces pgfcircle command
  - exportPolygon produces pgfmoveto/pgflineto chain
  - exportPolygon filled emits pgffill
  - exportBezier produces pgfcurveto and pgfstroke
  - exportPCBLine produces pgfline with correct width
  - exportPCBLine always uses solid dash (dash style 0)
  - exportPCBPad with oval style produces pgfellipse
  - exportPCBPad with rect style produces pgfrect
  - exportPCBPad with rounded style produces pgfrect
  - exportPCBPad onlyHole emits white ellipse
  - exportAdvText produces pgfputat with escaped text
  - exportAdvText escapes LaTeX special chars
  - dash styles emit pgfsetdash commands
  - dash style 0 emits solid pattern
  - dash phase is emitted correctly
  - exportMacro returns false (expansion signal)
  - exportCurve returns false (expansion signal)
  - line width change emits pgfsetlinewidth
  - same line width on same layer does not re-emit
  - integer coordinates are emitted without decimal point
  - setDashUnit formats PGF-style dash with pt separators

## `export/export-svg.fixtures.test.ts`

- **ExportSVG — fixture corpus**
    - ${name} matches committed TS snapshot

## `export/export-svg.java-parity.test.ts`

- **ExportSVG — Java parity (semantic)**
    - ${name}: TS drawing elements match Java reference

## `export/export-svg.test.ts`

- **ExportSVG**
  - exportStart / exportEnd produce valid SVG wrapper
  - exportLine produces line element
  - exportRectangle produces rect element
  - exportOval produces ellipse element
  - exportConnection produces circle element
  - exportPolygon produces polygon element
  - exportBezier produces path element
  - exportPCBLine produces line with stroke-width
  - exportPCBPad with oval style produces ellipse
  - exportPCBPad with rect style produces rect
  - exportAdvText produces text element
  - dash style produces stroke-dasharray attribute
  - layer alpha < 1 produces opacity attribute
  - **exportAdvText mirror + rotation**
    - not-mirrored, rotated 90° emits rotate(-90)
    - mirrored, rotated 90° emits rotate(90) — Java convention
    - mirrored, not rotated emits no rotate (and negative xscale)
    - not-mirrored, rotated 180° emits rotate(-180)
  - **PCB elements honour layer alpha**
    - exportConnection on layer 12 (alpha 0.95) emits opacity
    - exportConnection on layer 0 (alpha 1.0) does not emit opacity
    - exportPCBLine on layer 12 emits opacity
    - exportPCBLine on layer 0 does not emit opacity
    - exportPCBPad oval style on layer 12 emits opacity
    - exportPCBPad rect style on layer 12 emits opacity
    - exportPCBPad rounded style on layer 12 emits opacity
    - exportPCBPad onlyHole does NOT emit opacity (hole is always white)
    - exportPCBPad oval style on layer 0 does not emit opacity
  - **exportArrow honours flag bits**
    - style=0 (neither flag) emits filled polygon
    - style=1 (limiter only) emits filled polygon AND limiter line
    - style=2 (empty only) emits no-fill polygon and no extra line
    - style=3 (empty + limiter) emits no-fill polygon AND limiter line

## `export/export-tikz.fixtures.test.ts`

- **ExportTikZ — fixture corpus**
    - ${name} matches committed TS snapshot

## `export/export-tikz.test.ts`

- **ExportTikZ**
  - exportStart / exportEnd produce valid TikZ wrapper
  - exportStart emits layer color definitions
  - exportLine produces draw command with correct coords
  - exportLine emits correct layer color
  - exportLine with arrows emits arrow polygons
  - exportLine with empty arrow emits draw (not filldraw)
  - exportRectangle uses rectangle syntax
  - exportRectangle filled uses filldraw
  - exportRectangle unfilled uses draw
  - exportOval produces ellipse syntax
  - exportOval filled uses filldraw
  - exportConnection produces circle syntax
  - exportPolygon produces point chain with cycle
  - exportPolygon filled uses filldraw
  - exportBezier produces controls syntax
  - exportPCBLine emits correct line width
  - exportPCBLine has no dash pattern (always solid)
  - exportPCBPad oval produces ellipse
  - exportPCBPad square produces rectangle ++
  - exportPCBPad rounded produces rectangle ++
  - exportPCBPad onlyHole emits white filldraw
  - exportAdvText produces node with anchor
  - exportAdvText escapes LaTeX special chars
  - dash style emits dash pattern option
  - solid dash (style 0) has no dash pattern
  - dash phase emits dash phase option
  - arrow with limiter emits limiter line
  - exportMacro returns false
  - exportCurve returns false
  - integer coords emitted without decimals

## `export/latex-escape.test.ts`

- **escapeLatex**
  - escapes backslash
  - escapes curly braces
  - escapes hash, dollar, percent, ampersand
  - escapes underscore
  - escapes caret
  - escapes tilde
  - does not escape non-special characters
  - handles empty string
  - handles complex LaTeX-like input
  - handles multiple special chars in sequence

## `geom/drawing-size.test.ts`

- **DrawingSize.getImageSize**
  - empty model returns a unit dimension and zero origin
  - single horizontal line: width is the line length, origin at top-left
  - negative coordinates are clamped to 0 on read
  - mutates the model.changed flag
  - countMin=false uses absolute max instead of width=max-min
  - clamps min dimensions to 1 (never returns zero)
- **DrawingSize.getImageOrigin**
  - empty model returns (0, 0)
  - returns the bounding-box top-left for a non-empty model
- **DrawingSize.calculateZoomToFit**
  - returns a MapCoordinates instance fitting the drawing into the target box

## `geom/geometric-distances.test.ts`

- **GeometricDistances.pointToSegment**
  - returns 0 for a point on the segment
  - returns the perpendicular distance for a point off the segment
  - returns distance to endpoint when the projection falls outside
  - handles zero-length segments (point-to-point fallback)
  - handles vertical segments
  - returns MIN_DISTANCE for a point far away
- **GeometricDistances.pointInPolygon**
  - returns true for a point clearly inside a triangle
  - returns false for a point clearly outside a triangle
  - handles a square
- **GeometricDistances.pointInEllipse**
  - returns true for the centre of the bounding box
  - returns false for a point just outside the bounding box
  - returns false for a corner of the bounding box (outside the ellipse)
- **GeometricDistances.pointInRectangle**
  - returns true for points strictly inside
  - returns true on the boundary
  - returns false outside
- **GeometricDistances.pointToRectangle**
  - returns 0 for a point on the rectangle edge
  - returns the distance to the nearest edge
- **GeometricDistances.pointToBezier**
  - returns 0 for a point on a flat horizontal bezier
  - returns a moderate distance for a point off the curve
- **GeometricDistances.pointToPoint**
  - returns the Euclidean distance for nearby points
  - returns MIN_DISTANCE for far-apart points

## `geom/map-coordinates.test.ts`

- **MapCoordinates**
  - default construction has zero center, magnitude 1, orientation 0, snap active
  - mapX / unmapXnosnap round-trips correctly
  - mapY / unmapYnosnap round-trips correctly
  - mapX / mapY with non-zero center offsets
  - orientation affects mapping when isMacro=true
  - mirror in macro mode flips X mapping
  - snap mode rounds to grid step when active
  - inactive snap returns raw value
  - setXMagnitude clamps to MIN_MAGNITUDE
  - setXMagnitude clamps to MAX_MAGNITUDE
  - setOrientation accepts values 0-3
  - setOrientation clamps out of range values
  - setXCenter / setYCenter accepts negative values
  - getXGridStep returns default of 5
  - setXGridStep updates grid step
  - setMagnitudes sets both X and Y magnitudes (clamped)
  - push / pop saves and restores full state
  - pop from empty stack does not throw
  - trackPoint extends min/max bounds
  - resetMinMax resets to extremes
  - unmapXsnap with active snap rounds to grid step
  - toString describes the state
  - setMagnitudesNoCheck sets without clamping
  - mirror and isMacro flags toggle correctly
  - center stays pinned after canvas resize (no DPR change)
  - logical-to-screen mapping is consistent after magnitude-only change
  - center preservation ensures origin maps consistently across DPR changes

## `globals/globals.test.ts`

- **Globals**
  - DEFAULT_EXTENSION is fcd
  - prettifyPath truncates long path with ellipsis
  - prettifyPath leaves short paths unchanged
  - adjustExtension replaces existing extension
  - adjustExtension appends extension when none exists
  - checkExtension returns true for matching extension
  - checkExtension returns false for different extension
  - roundTo rounds to specified decimal places using trunc
  - roundTo without ch rounds to 2 decimal places using round
  - getFileNameOnly strips path and extension
  - getFileNameOnly works with just a filename
  - getFileNameOnly works without extension
  - adjustExtension handles quoted paths
  - parseCoord returns the value for valid non-negative integers
  - parseCoord clamps negative coordinates to 0
  - parseCoord clamps values above MAX_COORD
  - parseCoord returns null for non-numeric tokens
  - parseCoord preserves fractional input
  - coord returns 0 for non-numeric tokens
  - formatCoord writes up to 3 decimals, trimming trailing zeros
  - round-trips a fractional coordinate through parse and format

## `graphic/color-canvas.test.ts`

- **ColorCanvas.getRGB**
  - returns a non-negative integer
  - round-trips through setRGB
  - toString(16) produces valid 6-digit hex
  - red (255,0,0) produces #ff0000
  - white (255,255,255) produces #ffffff
  - navy (0,0,128) produces #000080
  - all standard layer colors produce valid 6-digit hex
  - fromRGB + getRGB is idempotent

## `graphic/dash-scaling.test.ts`

- **GraphicsCanvas.applyStroke — dash scaling**
  - solid stroke (dashStyle 0) passes an empty array
  - dashed stroke (dashStyle 1) passes a non-empty array
  - scales dash pattern proportionally to line width
  - doubling line width doubles the dash pattern
  - dashStyle 4 (multi-segment) scales all segments
  - handles minimum line width (D_MIN clamping)
  - handles high zoom (large line width)
  - all 5 dash styles produce valid output

## `graphic/math-layout.test.ts`

- **splitMathSegments**
  - returns empty array for empty string
  - plain text is a single text segment
  - splits inline math
  - splits display math
  - mixes inline and display
  - treats an unclosed $ as literal text
  - handles consecutive inline blocks
- **layoutMath**
  - renders pure inline math to a single positioned math segment
  - lays out mixed text and math left to right with monotonic x
  - falls back to literal text on malformed LaTeX
  - all-plain-text has no math
  - display math produces taller geometry than inline for the same source

## `i18n/routing.test.ts`

- **i18n routing**
  - **SUPPORTED_LOCALES**
    - contains the 11 FidoCadJ languages
    - has a native-language label for every locale
  - **isSupportedLocale**
    - returns true for supported locales
    - returns false for unknown locales
  - **loadLocale**
    - loads the requested locale bundle
    - falls back to English for an unknown locale code
    - keeps the English bundle loaded for missing-key fallback
  - **setLocale**
    - persists the choice in localStorage
    - notifies subscribers when the locale actually changes
    - falls back to English for unknown locales
  - **getPreferredLocale**
    - returns a saved locale from localStorage if valid
    - ignores an unsupported saved locale
  - **getString**
    - returns the active-locale value when present
    - falls back to English when the active bundle lacks a key

## `layers/layer-desc.test.ts`

- **LayerDesc**
  - default constructor creates visible layer
  - constructor with parameters sets values
  - isVisible / setVisible toggles visibility
  - getDescription / setDescription round-trip
  - setColor / getColor round-trip
  - isModified / setModified flag
  - setAlpha / getAlpha round-trip
  - StandardLayers creates visible layers
  - StandardLayers layers have descriptions

## `librarymodel/library-model.test.ts`

- **LibraryModel**
  - builds Library/Category hierarchy from flat MacroDesc map
  - getAllMacros returns the same map as drawingModel.getLibrary
  - groups macros into correct categories
  - category contains correct macros
  - forceUpdate fires libraryLoaded on all listeners
  - removeLibraryListener stops receiving events
- **LibraryModel static helpers**
  - getPlainMacroKey strips library prefix
  - getPlainMacroKey works for unprefixed keys
  - createMacroKey produces lowercase prefixed key
- **Library**
  - containsMacroKey finds macro in any category

## `macropicker/macro-picker.test.ts`

- **MacroPicker**
  - builds one row per macro, all collapsed initially
  - expanding a library then a category reveals its macros only
  - clicking a macro row fires onMacroSelected with key and name
  - setFilter reveals matching macros across collapsed sections
  - filter matches category and library names too
  - refresh rebuilds the tree without duplicating rows

## `macropicker/preview-connection.test.ts`

- **macro preview connection visibility**
  - fills the connection dot with the layer colour (not the background) when cleared via the graphics API
  - demonstrates the original bug: a raw-context clear leaves the dot painted white

## `parser/parser-adversarial.test.ts`

- **ParserActions adversarial input**
  - **malformed structure**
    - empty string yields an empty model
    - only the [FIDOCAD] header yields an empty model
    - truncated final line does not throw
    - mixed line endings (\\r\\n + \\n) parse
    - lone CRs do not crash
    - garbage tokens are skipped; valid primitives still parse
  - **boundary values**
    - very large positive integer coordinates parse
    - very negative integer coordinates parse
    - zero-length line is silently dropped (per round-trip tests)
    - out-of-range layer index does not crash
    - NaN-like tokens degrade gracefully
  - **long input**
    - 1000-line document parses every line into a primitive
    - long polygon (1000 vertices) parses to a single primitive
  - **Unicode in text fields**
    - BMP characters round-trip
    - surrogate-pair emoji round-trips
    - multi-word text is preserved with internal spaces
  - **adversarial text content**
    - embedded </svg> does not crash and is preserved through round-trip
    - LaTeX special characters are preserved through round-trip
  - **FCJ extension robustness**
    - FCJ without preceding primitive does not crash
    - FCJ with too few tokens does not crash
    - FCJ with too many tokens does not crash
  - **macro robustness**
    - reference to non-existent macro is dropped without throwing
    - cyclic macro expansion stops at the configured depth limit

## `parser/parser-global-state.test.ts`

- **ParserActions — macro expansion isolation**
  - multiple instances do not share a global macroExpansionDepth
  - reset via constructor creates clean depth counter
  - deeply nested macro expansion is still guarded

## `parser/primitive-round-trip.test.ts`

- **PrimitiveLine (LI)**
  - parses and re-serializes a basic line
  - preserves non-zero layer
  - produces empty output for zero-length line (no name/value)
  - is stable from test size file
  - round-trips multiple lines
- **PrimitiveBezier (BE)**
  - parses and re-serializes a bezier curve
  - preserves layer on bezier
  - is stable from test size file
- **PrimitiveRectangle (RV/RP)**
  - parses empty rectangle RV
  - parses filled rectangle RP
  - preserves layer
  - is stable from test size file
- **PrimitiveOval (EV/EP)**
  - parses empty oval EV
  - parses filled oval EP
  - is stable from test size file
- **PrimitivePolygon (PV/PP)**
  - parses open polygon PV
  - parses filled polygon PP
  - is stable from test size file
- **PrimitiveComplexCurve (CV/CP)**
  - parses closed filled curve CP
  - parses open unfilled curve CV
  - is stable from test size file (open curve)
  - roundtrips a short CV
- **PrimitivePCBPad (PA)**
  - parses a PCB pad with oval style
  - parses a PCB pad with rect style
  - parses a PCB pad with rounded rect style
  - is stable from test size file
  - preserves layer
- **PrimitivePCBLine (PL)**
  - parses a PCB line with integer width
  - parses a PCB line with different widths
  - preserves layer
  - is stable from test size file
- **PrimitiveConnection (SA)**
  - parses a connection dot
  - parses multiple connections
  - preserves layer
  - is stable from test size file
- **PrimitiveAdvText (TY/TE)**
  - parses TY with default font (*)
  - parses TY with named font
  - converts TE to TY on output
  - TY output is stable (TY → TY, not TE)
  - preserves orientation
  - preserves style flags
  - handles multi-word text
  - is stable from test size file
- **PrimitiveMacro (MC)**
  - parses a macro and re-serializes its key
  - preserves orientation
  - preserves mirror flag
  - is stable (parse → getText → parse → getText)
  - silently skips unknown macros (no library entry)
- **Full document stability**
  - is stable for individual line primitives
  - is stable for individual bezier
  - is stable for a document with mixed primitives (no FCJ)
  - is stable for test_pattern.fcd (strips FCJ, all base primitives present)
  - primitive count is correct after parsing
- **FJC configuration parsing**
  - FJC C changes diameterConnection
  - FJC A changes lineWidth
  - FJC B changes lineWidthCircles
- **FCJ extension tokens**
  - line with FCJ arrow+dash parses without error
  - bezier with FCJ dash parses without error
  - rectangle with FCJ fill type parses without error
  - oval with FCJ fill type parses without error
  - polygon with FCJ fill type parses without error
  - complex curve with FCJ parses without error
- **ParserActions.addString**
  - addString appends to existing primitives
  - parseString clears previous primitives
- **readLibraryString**
  - loads a simple library and makes macro parseable

## `primitives/complex-curve-fixes.test.ts`

- **PrimitiveComplexCurve Phase 1 fixes**
  - **1.3 — Off-by-one in addPointClosest (boundary insertion)**
    - inserts vertex before point 0 when closest segment is before first point
    - inserts vertex at end when point is beyond last segment
    - wraps around on negative minv (no crash)
  - **1.4 — Stale-reference in getDistanceToPoint after mutation**
    - recomputes logical polygon when primitive changed after last draw
    - does not crash when getDistanceToPoint is called before first draw

## `primitives/primitive-edge-cases.test.ts`

- **PrimitiveLine**
  - toString produces LI token format
  - parseTokens round-trips basic line
  - handles zero-length line gracefully
  - handles negative coordinates
- **PrimitiveBezier**
  - toString produces BE token format
  - parseTokens round-trips
- **PrimitiveRectangle**
  - empty rectangle uses RV token
  - filled rectangle uses RP token
  - parseTokens handles RV token
  - parseTokens handles RP token
- **PrimitiveOval**
  - empty oval uses EV token
  - filled oval uses EP token
- **PrimitivePolygon**
  - open polygon uses PV token
  - filled polygon uses PP token
  - addPointClosest inserts at correct segment
- **PrimitiveComplexCurve**
  - open curve uses CV token
  - closed filled curve uses CP token
- **PrimitiveConnection**
  - toString produces SA token format
  - parseTokens round-trips
- **PrimitivePCBLine**
  - toString produces PL token with width
  - round-trips width correctly
- **PrimitivePCBPad**
  - oval style (0) round-trips
  - rect style (1) round-trips
  - rounded rect style (2) round-trips
- **PrimitiveAdvText**
  - toString produces TY token
  - handles multi-word text
  - handles empty text gracefully

## `settings/settings-manager.test.ts`

- **SettingsManager**
  - **defaults**
    - returns sensible defaults when no stored settings
    - returns a copy, not a reference to internal state
  - **updateSettings**
    - merges partial updates
    - persists to localStorage
  - **storage error handling**
    - handles corrupted JSON gracefully
    - ignores invalid field types
    - clamps numeric values to valid ranges
    - accepts valid settings from storage
  - **singleton behavior**
    - getInstance returns the same instance

## `ui/confirm-dialog.test.ts`

- **ConfirmDialog**
  - renders title, message, and both buttons
  - OK resolves true and removes the overlay
  - Cancel resolves false and removes the overlay
  - the ✕ close button resolves false
  - Escape resolves false, Enter resolves true
  - escapes HTML in title and message (no element injection)

## `ui/menubar-open-libraries.test.ts`

- **File → Open waits for libraries before parsing**
  - does not call loadCircuit until librariesReady resolves

## `ui/prompt-dialog.test.ts`

- **PromptDialog**
  - prefills the default value and resolves the edited text on OK
  - Cancel and ✕ resolve null
  - Escape resolves null, Enter resolves the current value
  - validator failure shows the error, disables OK, and blocks Enter
  - escapes HTML in the default value

## `ui/properties-batch.test.ts`

- **Batch layer editing**
  - applies a layer change to every selected primitive
  - shows the multi-selection header with the element count
  - falls back to the single-element panel when only one is passed

## `ui/toolbar-controller.test.ts`

- **ToolbarController**
  - builds 13 tool buttons and arms the Selection tool
  - clicking a tool button selects that tool and highlights only it
  - tool tooltips lead with the canonical shortcut letter
  - changing the zoom dropdown sets the panel zoom
  - onZoomChange snaps the dropdown to the preset nearest the real zoom
  - the Fit button fits the view and re-syncs the dropdown
  - grid and snap buttons toggle panel state on each click
  - the Libs button invokes the library toggle callback
  - updates the coordinates display through onCoordinatesChange

## `undo/undo-actions.test.ts`

- **UndoActions**
  - **stack management**
    - new manager cannot undo or redo
    - saving state enables undo
    - undoing pushes to redo stack
    - redo after undo restores redoability
    - reset clears everything
    - new mutation clears redo stack
  - **add primitive**
    - addPrimitive pushes undo state
    - multiple adds create multiple undo entries
  - **modified flag**
    - starts unmodified
    - setModified toggles flag

## `undo/undo-state.test.ts`

- **UndoState**
  - starts as an empty, unmodified snapshot
  - toString reports text, file name, and library fields

---

## `e2e/app-loads.test.ts`

- App Initialisation
  - page title shows the untitled drawing name
  - canvas element renders in the DOM
  - toolbar container exists
  - zoom select dropdown exists
  - coordinates display shows initial value
  - toolbar contains expected buttons
  - library panel is rendered
  - no page errors on load
  - circuit starts empty
  - window.__FidoCadJS__ exposes circuitPanel for E2E

## `e2e/clipboard.test.ts`

- Clipboard Operations
  - Ctrl+C / Ctrl+V via keyboard inserts a copy on click
  - copySelected preserves primitives
  - cutSelected removes primitives
  - duplicateSelected doubles count
  - cut then duplicate works via internal clipboard
  - duplicate is undoable
  - cut then undo restores
  - paste enters placement mode then commit inserts
  - paste placement cancel inserts nothing
  - copy all as primitives fills a pasteable clipboard
  - paste placement commit is undoable

## `e2e/drawing-tools.test.ts`

- Drawing Tools — Keyboard Selection
    - ${key} selects the ${label} tool
- Drawing Primitives
  - draw a line with two clicks
  - draw a rectangle with two clicks
  - draw an ellipse with two clicks
  - draw a bezier with four clicks
  - draw a polygon and finish with double-click
  - draw a connection dot with one click
  - draw a PCB line with two clicks
  - draw a PCB pad with one click
  - draw a text with one click (text primitive created)
  - draw a complex curve and finish with double-click
  - multiple primitives of different types coexist

## `e2e/edge-cases.test.ts`

- Edge Cases — Empty/Degenerate
  - empty circuit exports valid formats without crashing
  - empty circuit renders without errors
  - empty circuit zoom in/out still adjusts zoom
  - empty circuit Ctrl+Z does nothing
  - zero-length line (same start/end point) produces empty output
- Edge Cases — Rapid Operations
  - rapid tool switching does not crash
  - rapid draw/undo/redo cycle
  - draw, select all, delete — undo entry created
- Edge Cases — Long FCD Documents
  - loads and exports a circuit with many primitives
  - circuit with all primitive types round-trips via getCircuitText
- Edge Cases — Negative Coordinates
  - clamps negative coordinates to zero on read
- Edge Cases — Text
  - text primitive created via tool contains default string
- Edge Cases — Canvas Resize
  - resizing viewport does not crash app
- Edge Cases — Layer Switching
  - primitives on different layers are preserved
  - right-click cancels active drawing tool

## `e2e/export-bitmap-render.test.ts`

- Bitmap export rendering
  - exported PNG contains the (black) text — not white-on-white
  - exported PNG contains typeset math ink
  - exporting does not corrupt the on-screen render

## `e2e/export-png.test.ts`

- Export — PNG
  - exportPNG produces a valid PNG (magic number check)
  - empty circuit produces a valid PNG (small but valid)
  - non-empty circuit exceeds empty-circuit blob size
  - exportPNG is reproducible (same FCD → same PNG)
  - canvas size matches the visible drawing area

## `e2e/export-svg-pixel-parity.test.ts`

- SVG pixel parity vs Java reference

## `e2e/export.test.ts`

- Export — SVG
  - exportSVG produces valid XML wrapper
  - exportSVG contains line element
  - exportSVG contains rect element
  - exportSVG contains ellipse element
  - exportSVG contains circle for connection
  - empty circuit exports valid SVG wrapper only
- Export — PGF
  - exportPGF produces valid PGF wrapper
  - exportPGF contains line command
  - exportPGF contains rect command
  - exportPGF contains ellipse command
  - empty circuit exports valid PGF wrapper only
- Export — TikZ
  - exportTikZ produces valid TikZ wrapper
  - exportTikZ contains draw command for line
  - exportTikZ contains fill command for connection
  - empty circuit exports valid TikZ wrapper only
- Export — Round-trip consistency
  - exportSVG is deterministic (same FCD → same SVG)
  - exportPGF is deterministic
  - exportTikZ is deterministic

## `e2e/file-operations.test.ts`

- File Operations
  - New circuit clears all primitives
  - Ctrl+N shortcut triggers new circuit
  - loadCircuit via API loads FCD text
  - getCircuitText produces valid FCD with FCJ config
  - Save via picker writes circuit text and reuses the handle
  - Save As prompts for a filename when the picker is unavailable
  - View code shows the FCD text and OK reloads edits

## `e2e/grid-snap.test.ts`

- Grid Toggle
  - Show Grid button toggles grid
- Snap Toggle
  - Snap button toggles snap-to-grid

## `e2e/keyboard-e2e.test.ts`

- Keyboard Shortcuts — Tool Selection
  - uppercase L also selects Line tool
  - uppercase G also selects Rectangle tool
  - Ctrl+E does NOT switch to Ellipse tool
  - Ctrl+P does NOT switch to Polygon tool
  - Ctrl+O does NOT switch to Complex curve tool
  - Ctrl+Z does NOT switch to PCB pad tool
  - Ctrl+S does NOT trigger mirror (S)
  - Ctrl+Shift+S does NOT trigger mirror
  - unknown keys do not crash (q, 1, F1)
- Keyboard Shortcuts — Undo/Redo
  - Ctrl+Z undoes, Ctrl+Y redoes
- Keyboard Shortcuts — Input Blocking
  - tool shortcuts blocked when input element is focused
  - global Ctrl shortcuts still work when input is focused
- Keyboard Shortcuts — Nudge
  - Alt+ArrowLeft nudges selected left
  - Alt+ArrowRight nudges selected right
  - Alt+ArrowUp nudges selected up
  - Alt+ArrowDown nudges selected down

## `e2e/layer-dialog.test.ts`

- Layer dialog — header serialization
  - changing one layer writes only that layer to the header
  - confirming with no changes writes no layer lines

## `e2e/macro-library.test.ts`

- Macro Library
  - library panel is visible and contains macro entries
  - Libs button toggles library panel visibility
  - searching and clicking a macro arms the macro tool
- Macro — Load and Place via API
  - can load a simple macro library and place it
  - placing unknown macro key silently drops

## `e2e/math-render.test.ts`

- LaTeX math rendering
  - canvas paints typeset math differently from literal source
  - SVG export embeds math as glyph paths, not literal $
  - no leftover KaTeX overlay DOM is present

## `e2e/menu-bar.test.ts`

- Menu Bar — File Menu
  - File menu opens and shows items
  - Edit menu shows Undo/Redo/Cut/Copy/Paste
  - View menu shows Zoom and Options
  - Circuit menu shows View code
  - menu items show shortcut text
  - Options dialog has a Libraries tab with a folder picker
- Menu Bar — Actions via API
  - Ctrl+N clears circuit (new)
  - Ctrl+S triggers save (does not modify circuit)
  - Ctrl+E opens the export dialog without modifying the circuit

## `e2e/selection-and-transform.test.ts`

- Selection
  - click on a primitive selects exactly that one
  - Escape deselects all and switches to Selection tool
  - rubber-band selection selects primitives in rect
- Transform Operations
  - rotate selected primitives with R key
  - mirror selected primitives with S key
  - Delete key removes selected primitives
  - Backspace also removes selected primitives
  - nudge selected with Alt+Arrow keys
  - R does nothing when nothing is selected
  - move mode via M key changes cursor when selection exists

## `e2e/undo-redo.test.ts`

- Undo / Redo
  - rotate creates undo entry (canUndo becomes true)
  - Ctrl+Shift+Z redo shortcut works
  - delete creates undo entry
  - mirror creates undo entry
  - multiple operations stack undo entries
  - clearCircuit resets undo stack

## `e2e/zoom-pan.test.ts`

- Zoom Operations
  - initial zoom is 100%
  - + key zooms in
  - = key also zooms in
  - - key zooms out
  - zoom in, then zoom out returns to original
  - Home triggers fit-to-view
  - mouse wheel zooms toward cursor
  - Fit button zooms out a zoomed-in drawing
  - zoom select dropdown updates on keyboard zoom
  - zoom select dropdown updates on mouse-wheel zoom
- Pan Operations
  - middle mouse button pans the view
- Resize behavior
  - viewport resize keeps a non-degenerate canvas
  - viewport resize preserves rendering without offset
  - multiple consecutive resizes do not crash
