# FidoCadJS — TODO & Improvement Plan

> Based on the code review in [`CODEREVIEW.md`](./CODEREVIEW.md) and the
> [external audit](#-critical-bugs).
> Current state: **325 tests across 16 files**.

---

## ✅ Completed

| Item | Change |
|------|--------|
| **ParserActions refactor** | Added `createPrimitiveForToken()` factory. Collapsed 30-line if-else chain in `registerPrimitivesWithFCJ()` into a single lookup. File: 495→481 lines. |
| **app.ts split** | Extracted `ToolbarController` (251 L), `PropertiesPanelController` (343 L). app.ts: 1025→351 lines (−66%). |
| **CircuitPanel split** | Extracted `KeyboardController` (380 L) and `ClipboardController` (105 L). CircuitPanel: 1784→1453 lines (−19%). |
| **LayerDropdown** | Reusable widget (124 L) replacing two 65-line inline implementations in toolbar + properties panel. |
| **PrimitiveMacro hardening** | Added `isReady()` and per-operation `assertReady()` with descriptive error messages. |
| **Font caching** | PropertiesPanelController caches font families after first async load. |
| **Test suite** | Added `test/settings/settings-manager.test.ts` (11 cases) and `test/primitives/primitive-edge-cases.test.ts` (20 cases). Tests: 289→325. |
| **TESTS.md** | Updated with all 16 test files + 325 case descriptions. |

---

## 🔴 Critical Bugs — must fix first

These were discovered by an independent audit and should be resolved before
adding new features. Each is a correctness or security issue.

### B1 — Undo/redo is a no-op (snapshot timing)

**Files**: `DrawingModel.addPrimitive()`, `UndoActions.ts`, `EditorActions.ts`

**Root cause**: `saveUndoState()` is called **after** the mutation, so the
undo stack stores the *post-change* state. When `undo()` runs it pops and
restores that same post-change state — making undo a no-op.

**Flow**:
```
addPrimitive(prim) → pushes prim → saveUndoState() → stores state WITH prim
...
undo() → saves current state (WITH prim) → pops same state → restores (nothing changes!)
```

The same pattern exists in `EditorActions.moveAllSelected()`,
`deleteAllSelected()`, `rotateAllSelected()`, and `mirrorAllSelected()`: all
save state *after* mutation.

**Fix**:
1. Call `saveUndoState()` **before** each mutation (before `addPrimitive`,
   before `moveAllSelected`, before `deleteAllSelected`, etc.).
2. Add a test that adds a primitive, undoes, and asserts the primitive is gone.

### B2 — `clearCircuit()` breaks undo: controllers hold stale references

**Files**: `CircuitPanel.ts` constructor + `clearCircuit()`, `EditorActions.ts`,
`ElementsEdtActions.ts`, `AddElements.ts`

**Root cause**: `clearCircuit()` creates a new `UndoActions` instance and
reassigns `this.undoActions`, but `EditorActions`, `ElementsEdtActions`, and
`AddElements` were constructed with the *old* undo reference (stored as
`readonly` in their constructors). After "New/Clear", undo operations go to
the wrong (stale) undo stack.

**Fix**:
1. In `clearCircuit()`, after clearing primitives, re-create the entire
   controller chain (`EditorActions`, `ElementsEdtActions`, `AddElements`,
   `ClipboardController`, `KeyboardController`) so they all use the fresh
   `UndoActions`.
2. Or: reset the existing `UndoActions` instead of replacing it
   (add a `reset()` method to `UndoActions`).

### B3 — Macro vectorization ignores computed transform

**Files**: `CircuitPanel.vectorizeSelectedMacro()`

**Root cause**: The method computes `px`/`py` with mirror + rotation
transforms, then immediately ignores them and only does
`prim.movePrimitive(posX - 100, posY - 100)`. The arbitrary `- 100` offset
and the discarded transforms mean vectorized macros have wrong positions
and orientations.

**Fix**:
1. Apply the computed `px`/`py` after the transform switch statement.
   The intent appears to be: compute the rotated position, then offset by
   the macro's placement position. Replace `-100` with the actual macro
   origin offset that macros use (needs investigating what the offset
   convention is — likely the macro origin minus the first primitive's
   first point).
2. Add a test: create a macro at a known position with orientation 1,
   vectorize, and assert primitives are at correctly rotated coordinates.

### B4 — Parser FJC N token off-by-one (appends `undefined`)

**Files**: `ParserActions.fidoConfig()`

**Root cause**: The loop `for (let t = 3; t < ntokens + 1; t++)` uses
`ntokens + 1` as the upper bound. `ntokens` is the total token count,
so valid indices are `0..ntokens-1`. The loop reads `tokens[ntokens]`
which is out-of-bounds (`undefined`), and pushes a trailing space.

**Fix**:
Change `t < ntokens + 1` to `t < ntokens` (one character). The resulting
description string will no longer contain an extra `undefined ` prefix.

### B5 — Double undo entry on nudge (Alt+Arrow)

**Files**: `CircuitPanel.nudgeSelected()` calls `EditorActions.moveAllSelected()`

**Root cause**: `moveAllSelected()` already calls `this.undoActions?.saveUndoState()`.
`nudgeSelected()` then calls it again. Each nudge creates two undo entries
instead of one.

**Fix**:
Remove the `this.undoActions.saveUndoState()` call from `nudgeSelected()`.
The one inside `moveAllSelected()` is sufficient.

### B6 — `getSize()` returns last-pair distance, not true bounds

**Files**: `GraphicPrimitive.getSize()`

**Root cause**: The nested loop overwrites `qx`/`qy` on every iteration:
```ts
qx = Math.abs(this.virtualPoint[i].x - this.virtualPoint[j].x);
qy = Math.abs(this.virtualPoint[i].y - this.virtualPoint[j].y);
```
It should use `Math.max()` to track the largest separation. As written,
`getSize()` returns the distance between the *last* two control points,
not the bounding-box size. This breaks `alignRight()` / `alignBottom()`.

**Fix**:
```ts
qx = Math.max(qx, Math.abs(this.virtualPoint[i].x - this.virtualPoint[j].x));
qy = Math.max(qy, Math.abs(this.virtualPoint[i].y - this.virtualPoint[j].y));
```

### B7 — XSS via innerHTML in PromptDialog / ConfirmDialog

**Files**: `PromptDialog.ts`, `ConfirmDialog.ts`

**Root cause**: Both dialogs inject `${title}`, `${message}`, and button
labels directly into `innerHTML` strings. If a macro name, library name,
or category name from an imported FCL file contains HTML/script markup,
it will be executed.

**Severity**: Moderate. Exploitable if a user opens a malicious `.fcl` file.
Macro names come from `[name]` bracketed headers in library files.

**Fix**:
Replace `innerHTML` string interpolation with `textContent` assignment
or DOM-safe `document.createElement()` calls. Escape user-provided strings
with `escapeHtml()` before interpolation:
```ts
function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

---

## 🟡 Architecture / performance issues

### A1 — Global mutable hooks (PrimitiveMacro statics, `macroExpansionDepth`)

**Files**: `PrimitiveMacro.ts`, `ParserActions.ts`

`parserFn`/`drawFn`/`exportFn` are global statics assigned from multiple
places. The module-level `macroExpansionDepth` is shared across all
`ParserActions` instances. This makes behaviour instance-order dependent
and hard to test.

**Mitigation**: The `assertReady()` guards already added (Phase 4) will
throw descriptive errors instead of silently failing. A full fix would
replace statics with a `MacroEnvironment` dependency container injected
at `PrimitiveMacro` construction time — but this is a large refactor.

### A2 — Listener leaks

| Location | Listener | Cleanup? |
|----------|----------|----------|
| `ToolbarController.layerDropdown` | `document.mousedown` (close-on-outside) | ❌ never removed |
| `PropertiesPanelController` (per open) | `document.mousedown` (close-on-outside) | ❌ never removed |
| `CircuitPanel` | `window.resize` | ❌ never removed |
| `CircuitPanel` | `ResizeObserver` | ❌ never disconnected |

**Fix**:
1. Add a `destroy()` method to `CircuitPanel` that removes all listeners
   and disconnects the `ResizeObserver`.
2. `LayerDropdown` should remove its `document.mousedown` listener when
   the dropdown element is removed from the DOM (use `MutationObserver` or
   a `dispose()` method).
3. Properties panel should clean up its close-on-outside listener when
   the sidebar is hidden.

### A3 — Unused `UndoManager` class

**Files**: `src/undo/UndoManager.ts`

A full ring-buffer `UndoManager` exists but the active flow uses
`UndoActions` (serialization-based snapshots). Two undo implementations
increase maintenance burden.

**Fix**: Either delete `UndoManager.ts` (if `UndoActions` is the chosen
approach) or migrate to `UndoManager` and remove `UndoActions`. The
serialization approach in `UndoActions` is simpler and works, so remove
`UndoManager`.

---

## 🟠 Performance issues

### P1 — `PrimitiveAdvText.draw()` forces `this.changed = true` every frame

**File**: `PrimitiveAdvText.ts` line ~91

The method sets `this.changed = true` at the *start* of every draw call,
defeating the caching logic that uses `if (this.changed)` to skip font
metric recomputation. Every render frame recomputes all text dimensions.

**Fix**: The `this.changed = true` line should be removed. The
`setChanged(true)` calls from setters and `parseTokens()` already handle
invalidating the cache when data actually changes.

### P2 — Dirty-rect optimization effectively disabled

**File**: `CircuitPanel.render()` lines ~960–962

Every render frame calls `clearDirtyRect()` then `markDirtyFull(width, height)`,
marking the entire canvas as dirty. This makes all `hitClip()` checks
pointless — every draw call passes through unconditionally.

**Fix**: Remove the `markDirtyFull()` call. Instead, only mark regions
that actually changed. At minimum, don't call `markDirtyFull()` at all,
and let `hitClip()` filter draws when nothing has changed. A proper fix
would track which primitives are dirty and only mark their bounding
boxes.

### P3 — Standard library loading is serialized

**File**: `LibraryLoader.ts`

Libraries are fetched one at a time in a `for...await` loop. All fetches
are independent and could run in parallel.

**Fix (one-line)**:
```ts
await Promise.all(STANDARD_LIBRARIES.map(async ({ url, prefix }) => {
    const response = await fetch(url);
    if (!response.ok) return;
    const text = await response.text();
    parserActions.readLibraryString(text, prefix);
}));
```

---

## 🟢 Remaining improvements (from original review)

### Phase 1 — Structural (done, see ✅ above)

### Phase 2 — Testing gaps

- [ ] **2.1** Mouse interaction tests (`test/circuit/mouse-controller.test.ts`)
  — after MouseController is extracted from Phase 1.3.
- [ ] **2.2** Canvas render tests — verify draw call sequences after render.
- [ ] **2.3** ✅ Placeholder dirs filled (settings + primitives).
  Still empty: `test/e2e/`. Populate or remove.
- [ ] **2.4** UI component tests (MenuBar, MacroPicker, dialog flows).

### Phase 3 — CSS migration

- [ ] **3.1** Audit all inline `style.cssText` usage.
- [ ] **3.2** Migrate to CSS modules (`*.module.css`).
- [ ] **3.3** Remove `unsafe-inline` from CSP once migration is done.

### Phase 4 — Medium priority

- [ ] **4.1** Standardize imports on `@/` alias (currently a mix of `@/` and relative).
- [ ] **4.2** Sync `package.json` version (`0.1.0`) with `Globals.version` (`0.24.9 gamma`).
- [ ] **4.3** Optimize KaTeX vendor (move to npm, ship only `.woff2`).
- [ ] **4.4** Extract magic numbers in `PrimitiveAdvText.draw()` (`12/7`, `22/40`, `10/7`)
  to named constants with documentation.
- [ ] **4.5** Fix `any` casts:
  - `(navigator as any).queryLocalFonts()` → add `@ts-expect-error` with spec link.
  - `(prim as any).fontName` in `InPlaceTextEditor.ts` — restructure to avoid the cast.
  - `(canvas as any).__circuitPanel` — used for E2E test access; document the intent.

### Phase 5 — Low priority

- [ ] **5.1** TeX overlay: only call `syncTeXOverlay()` when text content changed.
- [ ] **5.2** Cache `getScreenDensity()`; invalidate via `ResizeObserver`.
- [ ] **5.3** Reuse `layersUsed` array in `sortPrimitiveLayers()`.
- [ ] **5.4** Replace `confirm()` library-overwrite with custom dialog.
- [ ] **5.5** Add `CHANGELOG.md`.
- [ ] **5.6** CSP: add nonces or remove `unsafe-inline` for styles.

---

## Priority order

```
1. 🔴 B1  — Undo no-op          (correctness, blocks all undo testing)
2. 🔴 B2  — clearCircuit desync (correctness, data loss on New)
3. 🔴 B3  — Vectorize bug       (correctness)
4. 🔴 B4  — FJC N off-by-one    (correctness, parser)
5. 🔴 B5  — Double undo nudge   (correctness)
6. 🔴 B6  — getSize() bug       (correctness, alignment)
7. 🔴 B7  — Dialog XSS          (security)
8. 🟡 A2  — Listener leaks      (memory)
9. 🟠 P1  — AdvText.draw cache  (performance, every frame)
10.🟠 P3  — Library parallelism (performance, startup)
11.🟠 P2  — Dirty-rect fix      (performance, rendering)
12.🟡 A3  — Remove UndoManager  (maintenance)
13.🟢 Phase 3–5                 (CSS, polish, tests)
```
