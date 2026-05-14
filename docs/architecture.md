# FidoCadJS Architecture

**Author:** Dante Loi
**Date:** 2026-05-14

## Overview

FidoCadJS is a single-page application (SPA) built on TypeScript, Vite, and Canvas 2D. It has no runtime server — drawings never leave the user's machine. The architecture follows a model-view-controller split with a narrow service container for dependency injection.

## Service Container (`createEditorServices`)

**File:** `src/circuit/services.ts`

All core editor components are created by a single factory function. This is the only place where the dependency graph is assembled. Components do not import each other directly (except via interfaces).

```
createEditorServices() → {
    model,                // DrawingModel
    mapCoordinates,       // MapCoordinates (zoom, snap, coord transform)
    parserActions,        // ParserActions (.fcd read/write)
    selectionActions,     // SelectionActions (query/mutate selection)
    undoActions,          // UndoActions (undo/redo stack)
    editorActions,        // EditorActions (rotate, mirror, move, delete)
    elementsEdt,          // ElementsEdtActions (per-tool drawing dispatch)
    clipboardController,  // ClipboardController (copy/paste/cut)
}
```

## EditorFacade Boundary

**File:** `src/circuit/EditorFacade.ts`

`CircuitPanel` implements `EditorFacade`, a narrow interface consumed by UI modules (toolbar, menus, dialogs). This prevents UI from depending on `CircuitPanel` directly.

```
EditorFacade {
    // Drawing
    getModel(), getMapCoordinates(), getAddElements(), getCanvasElement()
    zoomIn(), zoomOut(), zoomToFit(), loadCircuit(), getCircuitText()
    
    // Export
    exportSVG(), exportPGF(), exportTikZ()
    
    // Tools & selection
    setTool(), getTool(), setMacroTool(), selectAll(), deleteSelected()
    undo(), redo(), canUndo(), canRedo()
    
    // Clipboard
    copySelected(), cutSelected(), paste(), duplicateSelected()
    
    // Grid & appearance
    setGridVisible(), setAntialias(), setRenderTeX(), setSnap()
    
    // Layers
    getCurrentLayer(), setCurrentLayer(), getLayers()
    
    // Text editing
    showInPlaceEdit(), isTextEditActive(), cancelTextEdit()
    
    // Keyboard
    addKeyboardListeners(), removeKeyboardListeners()
}
```

## Render Pipeline

```
CircuitPanel.render()
    │
    ├─ 1. Fill background (backgroundColor)
    ├─ 2. Draw grid (GraphicsCanvas.drawGrid)
    ├─ 3. For each layer (0..15):
    │       Drawing.drawPrimitives(layer, g, cs)
    │         └─ For each primitive in layer:
    │               primitive.draw(g, cs, layers)
    │                 └─ GraphicPrimitive.selectLayer(g, layers)
    │                 └─ Per-primitive drawing
    │                 └─ GraphicPrimitive.drawText(g, cs, layers)
    ├─ 4. Draw selected handles
    │       Drawing.drawSelectedHandles(g, cs)
    ├─ 5. Draw rubber-band selection rect
    ├─ 6. Draw ghost (live preview for drawing tools)
    └─ 7. Sync TeX overlay
            TeXOverlay.sync(model, cs, dpr)
```

The dirty-rect tracking previously in `GraphicsCanvas` has been removed (Phase 4.5). All primitives are always drawn; clipping is left to the canvas's internal scissor.

## Primitive Hierarchy

```
GraphicPrimitive (abstract base)
    ├─ PrimitiveLine
    ├─ PrimitiveBezier
    ├─ PrimitiveRectangle
    ├─ PrimitiveOval
    ├─ PrimitivePolygon
    ├─ PrimitiveComplexCurve
    ├─ PrimitiveConnection
    ├─ PrimitivePCBLine
    ├─ PrimitivePCBPad
    ├─ PrimitiveAdvText
    └─ PrimitiveMacro (delegates to inner DrawingModel)
```

Each primitive implements:
- `draw(g, cs, layers)` — Canvas rendering
- `export(exp, cs)` — Export format rendering
- `parseTokens(tokens, n)` — FCL parsing
- `toString(extensions)` — FCL serialization
- `getDistanceToPoint(px, py)` — Hit testing
- `intersects(rect, ltr)` — Rectangular selection
- `getControlPointNumber()` — Handle count

## Input Flow

```
Canvas DOM events
    │
    ├─ mousedown  ─→ InputHandler.onMouseDown
    ├─ mousemove  ─→ InputHandler.onMouseMove
    ├─ mouseup    ─→ InputHandler.onMouseUp
    ├─ dblclick   ─→ InputHandler.onDoubleClick
    ├─ wheel      ─→ InputHandler.onMouseWheel
    └─ keydown    ─→ KeyboardController
                        └─ KeyboardHost (CircuitPanel)
```

`InputHandler` is a gesture state machine with modes:
- `IDLE` — hover / tool placement
- `DRAWING` — creating a primitive (two-point tools)
- `PANNING` — middle-drag viewport pan
- `SELECTING` — rubber-band rect drag
- `MOVING` — drag-selected move
- `HANDLE_DRAG` — individual control point drag

## FCL Parser

**File:** `src/circuit/controllers/ParserActions.ts`

The parser reads lines of the FidoCad text format. Each line starts with a two-letter token:
- `LI` — Line
- `BE` — Bezier
- `MC` — Macro
- `TE` / `TY` — Text
- `RV`/`RP` — Rectangle
- `EV`/`EP` — Ellipse/Oval
- `PV`/`PP` — Polygon
- `CV`/`CP` — Complex curve
- `PL` — PCB line
- `PA` — PCB pad
- `SA` — Connection dot
- `FCJ` — FidoCadJ extension data (next line)
- `FJC` — Configuration (line width, layers)

## Export Pipeline

```
ExportFacade
    │
    ├─ exportSVG()  ─→ ExportSVG
    ├─ exportPGF()  ─→ ExportPGF
    └─ exportTikZ() ─→ ExportTikZ
            │
            └─ For each primitive:
                  primitive.export(exp, cs)
```

Export formats implement `ExportInterface`. The AbstractExport base provides shared buffer management and `escapeLatex()` for LaTeX-safe text labels.

## Key Design Decisions

1. **Service locator, not DI framework**: `createEditorServices()` is explicit, greppable, and has zero magic.
2. **Narrow interfaces**: `EditorFacade`, `SelectionParser`, `MacroBackend` prevent tight coupling.
3. **Static hooks for macros**: `PrimitiveMacro.parserFn`/`drawFn`/`exportFn` break the circular dependency between the macro primitive and the parser/renderer/exporter. Now also available as a unified `MacroBackend` via `setBackend()`.
4. **Per-instance parser state**: `macroExpansionDepth` moved from module scope to instance field on `ParserActions` for test isolation.
5. **AbortController pattern**: All event listeners in `CircuitPanel` and modal dialogs use `AbortController` for leak-free cleanup.
6. **No dirty-rect**: Removed; the canvas always redraws everything. Simpler and correct.
