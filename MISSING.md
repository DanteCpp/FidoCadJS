# MISSING.md — FidoCadJ → FidoCadJS Feature-Parity Gap

**Date:** 2026-05-14
**Java baseline:** FidoCadJ (`~/FidoCadJ`, read-only reference)
**TS port:** FidoCadJS (`/Users/dante/FidoCadJS`, branch `dev`)
**Effort unit:** millions of tokens (M tokens).

This document is the result of a granular feature comparison between the
Java reference and the TypeScript browser port. Each gap is tagged:

- 🔴 **Critical** — required for "credible feature parity" for a serious user.
- 🟠 **Significant** — visible to every user; closing it materially improves the port.
- 🟡 **Nice-to-have** — small audience, or already trivially worked around.
- ⚪ **Cosmetic / out-of-scope** — JVM-specific, or covered by browser equivalents.

Items present in **both** with notable behavioural differences are flagged
"⚠ Parity quirk" inside the relevant section.

---

## 1. Quick scoreboard

| Surface                | FidoCadJ | FidoCadJS | Gap                     |
|------------------------|----------|-----------|-------------------------|
| Drawing primitives     | 11       | 11        | **0**                   |
| Export formats         | 8        | 4         | -4 (PDF, EPS, JPG, Eagle, PCB-RND)* |
| Import formats         | .fcd, .fcl, image-as-background | .fcd, .fcl | -1 (image-as-bg incomplete) |
| Locale bundles         | 13       | 1 (en)    | **-12**                 |
| Standard FCL libraries | 7        | 5         | -2 (`elettrotecnica.fcl` legacy IT, `PCB.fcl` legacy IT)** |
| Menu items             | ~30      | ~20       | ~-10                    |
| Dialogs                | 11       | 6         | -5                      |
| Alignment ops          | 6        | 4         | -2 (H-center, V-center) |
| Distribution ops       | 2        | 0         | -2                      |
| Keyboard shortcuts     | ~20      | ~30       | +10 (FidoCadJS adds tool letters) ⚠ |
| Undo                   | bounded ring buffer w/ library scope | unbounded, no library scope | ⚠ |
| Layer count            | 16       | 16        | **0** (read-only set in both) |

\* FidoCadJS counts PNG, SVG, PGF, TikZ. FidoCadJ counts PNG, JPG, SVG, EPS, PGF, PDF, Eagle .scr, gEDA PCB.
\** The `*_en.fcl` localised copies are present in both. The IT-language originals are not shipped in the port.

---

## 2. File & I/O

### 2.1 Export formats — 🔴 Critical

Missing from FidoCadJS exporters:

| Format | Java class | Notes |
|--------|------------|-------|
| **PDF** | `ExportPDF.java` | Often the user's actual deliverable. Browser-side `jsPDF`/`pdf-lib` is the obvious path. |
| **EPS / PostScript** | `ExportEPS.java` | LaTeX-via-PostScript workflow. |
| **JPG** | bitmap path via `ImageIO.write` | Trivial: `canvas.toBlob('image/jpeg', q)` — costs almost nothing once we expose a quality slider. |
| **Cadsoft Eagle `.scr`** | `ExportEagle.java` | Script that pastes into Eagle; macros emitted natively (not flattened). |
| **gEDA PCB / pcb-rnd `.pcb`** | `ExportPCBRND.java` | Native PCB layout target with footprint dedupe. |

Per-format option gaps within shared formats:

- **SVG** — FidoCadJ emits `xmlns:xlink`, supports per-layer alpha as `opacity=`. FidoCadJS does ship per-layer opacity. ✅
- **PGF / TikZ** — FidoCadJS already covers all primitives that FidoCadJ does. ⚠ Neither port escapes LaTeX special chars (`_ ^ { } # $ % & \ ~`) in user-supplied text.
- **PNG** — FidoCadJ has DPI presets (72/150/300/600/1200/1800/2400), explicit pixel-size mode, anti-alias toggle, and black-and-white mode. FidoCadJS just `canvas.toBlob()` at current zoom. Missing controls:
  - DPI / pixels-per-unit selector
  - Explicit width × height in pixels
  - Anti-alias toggle (separate from editor setting)
  - **Black-and-white** rendering pass
  - **Split layers into separate files** (single common option in FidoCadJ across all formats)
  - **Magnification** factor for vector formats (0.01–100×)
  - User-provided filename + extension check
- **Macro expansion at export time** — both ports return `false` from `exportMacro()` in SVG/PGF/TikZ, so macros are *flattened* into primitives. Eagle and PCB-RND keep macros native. Implementing that for FidoCadJS only matters once those two formats are added.

**Effort estimate:** ~6–9 M tokens to bring all four missing formats + per-format options online with tests. PDF + Eagle dominate the cost.

### 2.2 Import — 🟠 Significant

- **Image as background** — `DialogAttachImage.java` lets the user load a raster image, position/scale it, set transparency, and trace over it. `src/circuit/ImageAsCanvas.ts` exists and `DrawingModel` already holds an `imgCanvas` field, but no UI wires it. Finishing it is mostly: file picker → `<img>` → blit + transform sliders.
  - Effort: ~1.5 M tokens.
- **Recent files list** — Java keeps a recents menu under File. FidoCadJS uses File System Access API (or download/upload) and shows nothing. Browser equivalent: persist last N File handles via `IndexedDB`. ⚪ Optional given the browser's own download history.

### 2.3 Save / save-as semantics — 🟡

- FidoCadJ has **Save Split** (one file per layer) and **Save As** as distinct items. FidoCadJS has a single `Save FCD` (`MenuBar.ts:148`).
- FidoCadJ tracks **modified flag** + window title `*` indicator; FidoCadJS does not.
- Effort: ~0.4 M tokens.

### 2.4 Print — ⚪ Out of scope (delegated)

`DialogPrint.java` + `PrintTools.java` + full print-preview, page-setup, margins, B&W, fit-to-page, mirror are JVM-AWT specific. The README already states FidoCadJS delegates to `window.print()`. Browser-native is acceptable for now, but the current implementation is a **stub** (`MenuBar.ts:432`); `Ctrl+P` is wired to a `console.log`. Either:
- Wire `Ctrl+P` to `window.print()` with a print-only stylesheet that hides toolbars, **or**
- Remove the menu item and shortcut entirely.
- Effort: ~0.3 M tokens.

---

## 3. Editor capabilities

### 3.1 Selection & arrangement — 🟠 Significant

| Java action | TS port | Status |
|-------------|---------|--------|
| Align Left   | `EditorActions.alignLeftSelected`     | ✅ present |
| Align Right  | `EditorActions.alignRightSelected`    | ✅ present |
| Align Top    | `EditorActions.alignTopSelected`      | ✅ present |
| Align Bottom | `EditorActions.alignBottomSelected`   | ✅ present |
| **Align Horizontal Center** | — | ❌ missing |
| **Align Vertical Center**   | — | ❌ missing |
| **Distribute Horizontally** | — | ❌ missing |
| **Distribute Vertically**   | — | ❌ missing |
| Rotate 90° CW | `R` | ✅ |
| Mirror | `S` | ✅ |
| **Continuous-move drag** (`ContinuosMoveActions.java`) | partial | ⚠ FidoCadJS supports drag but does not have FidoCadJ's "preserve angle" snapping during drag |
| **Copy Split** (`Cmd+M`) — copy selection with macros expanded into primitives | — | ❌ missing |
| **Copy as Image** (`Cmd+I`) — bitmap/vector to system clipboard | — | ❌ missing |

Effort: ~1.5 M tokens for the four alignment + two distribute ops; ~0.7 M for Copy Split / Copy as Image.

### 3.2 Macro placement quality-of-life — 🟠 Significant

FidoCadJ supports during macro placement:

- **Rotate while placing** (single-key `R` toggles orientation before click).
- **Mirror while placing** (`S` toggles `m` flag before click).
- **Right-click during placement** switches back to selection tool (added in 0.24.8).
- **Macro single-letter shortcuts** — every macro can have a key (`Change Key` action), so a one-letter press inserts that macro under the cursor.

FidoCadJS currently:
- Tool is set via `setMacroTool(key)` (`app.ts:154`), but the ghost preview does not rotate/mirror before placement.
- Right-click reverts to selection only on the canvas, not during ghost preview cleanly.
- "Change Key" UI exists (`MacroPicker` context menu) but the assigned key is **not bound to the keyboard handler** — verified by absence of any `macroKey` lookup in `src/circuit/controllers/KeyboardController.ts`. The metadata survives the round-trip but does nothing at edit time.

Effort: ~1.2 M tokens to wire all three.

### 3.3 Properties / parameter editor — ✅ ahead

FidoCadJS's `PropertiesPanelController` is **richer than FidoCadJ's `DialogParameters`**: it exposes a live-updating sidebar with every numeric, text, and enum field for every primitive, including the Font Access API for picking installed fonts. FidoCadJ uses a one-shot modal dialog. Worth calling out as a port strength, not a gap.

### 3.4 In-place text editing — ⚠ Parity quirk

Both have it, but FidoCadJ's text edit is a synchronous modal-ish field and FidoCadJS's `InPlaceTextEditor` floats over the canvas with KaTeX-rendered preview. Behaviour is mostly the same.

### 3.5 Undo — ⚠ Parity quirk, 🟡

- **FidoCadJ:** circular buffer with `sizeMax` capacity + separate **library-undo scope** flagged via `isNextOperationOnALibrary()` (`UndoManager.java:125`).
- **FidoCadJS:** unbounded array of full circuit-text snapshots; no library/scratchpad distinction. Memory growth on long sessions is plausible but not measured.

Two implications:
1. No cap on FidoCadJS undo memory — should add `MAX_UNDO_DEPTH = 200` or similar.
2. Library edits in `MacroPicker` (rename / remove / change-key) are **not undoable** in FidoCadJS, whereas FidoCadJ rolls them back via its library-scope undo. `LibraryModel` fires events but there is no `LibraryUndoListener` equivalent.

Effort: ~1 M tokens to add a depth cap; ~2 M to implement library-scope undo.

### 3.6 Strict FidoCAD compatibility mode — 🟡

`DialogSettings` (Java) has a **"Strict FidoCAD compatibility"** checkbox that disables the Complex Curve tool and reroutes parser quirks for legacy-DOS FidoCAD files. FidoCadJS does not expose this toggle and always runs in extended mode. Effort: ~0.6 M tokens.

### 3.7 Symbolize selection — ✅ present (parity)

`DialogSymbolize.ts` mirrors the Java dialog and even shares the same UX language ("Symbol-o-matic"). Both let you snap the origin and pick library/category/name. No gap.

---

## 4. Drawing primitives

Every one of the **11 Java primitives** has a FidoCadJS counterpart with the same control-point count and the same FCD serialisation tokens. Parity confirmed by the round-trip tests at `test/parser/primitive-round-trip.test.ts`.

Sub-features where FidoCadJ differs:

| Feature | FidoCadJ | FidoCadJS | Severity |
|---------|----------|-----------|----------|
| Subscripts / superscripts in `PrimitiveAdvText` | yes (0.24.8 issue #71) | ❌ | 🟠 |
| Arrow length / half-width as **float** | yes (0.24.8 issue #111) | partial — accepted on input but `PrimitiveLine.ts:140` rounds via `_tc_w1 - 1` | 🟡 |
| Polygon `addPointClosest` (insert point at nearest edge) | yes | ❌ — only append at end | 🟡 |
| Complex curve `addPointClosest` | yes (24-step natural-spline approximation) | ❌ — same limitation | 🟡 |
| Filled (`PV/EV/RV` vs `PP/EP/RP`) | yes | ✅ | — |
| PCB pad style range | 4 styles in `PrimitivePCBPad.java` | 11 styles (0–10) per inventory | ⚠ verify FidoCadJ actually has 4 only; FidoCadJS may have invented extras |
| Bold / italic / mirrored text flags | yes | ✅ | — |
| Macro recursion limit | 16 (`Globals.MAX_MACRO_DEPTH`) | 16 — same | ✅ |
| Hole drawing pass (PCB pads with drill) | `needsHoles()` flag in Java | implemented but verify the second-pass rendering produces hole-on-top | ⚠ |

**Action items:**
- Implement subscript / superscript escapes in `PrimitiveAdvText` rendering and exporters.
- Verify PCB pad style numbers match FidoCadJ exactly — diff serialised `PA` tokens for every style.
- Add `addPointClosest` to polygon/complex-curve editing.

Effort: ~2 M tokens combined.

---

## 5. Layers

Both ship the same **16-layer fixed standard set**. Notable gaps:

| Feature | FidoCadJ | FidoCadJS | Severity |
|---------|----------|-----------|----------|
| `DialogLayer` (edit layer color/name/alpha/visibility) | ✅ | ❌ — only the dropdown for *selection* exists | 🟠 |
| `DialogEditLayer` (per-layer line dash + fill pattern selector) | ✅ | ❌ | 🟡 |
| Per-document layer overrides via `FJC L` / `FJC N` tokens | ✅ — `ParserActions.java:236-243` reads them | ⚠ FidoCadJS parser handles them on read but does not write them back when the user edits a layer (because there is no edit UI) | 🟠 |
| Layer reorder / rename / add / delete | ❌ in both | ❌ | — |

Effort: ~2.5 M tokens for the layer-edit dialog with color picker, alpha slider, name field, visibility toggle, and FJC round-trip.

---

## 6. UI surface area

### 6.1 Menus — itemised diff

The following Java menu items have **no equivalent** in FidoCadJS:

| Java menu | Item | Shortcut | Severity |
|-----------|------|----------|----------|
| File | Save As | `Cmd+Shift+S` | 🟠 |
| File | Save Split (one file per layer) | — | 🟡 |
| File | Print | `Cmd+P` | ⚪ (delegated; stub in TS) |
| File | Print preview | — | ⚪ |
| Edit | Copy Split | `Cmd+M` | 🟡 |
| Edit | Copy as Image | `Cmd+I` | 🟠 |
| Edit | Define Clipboard (paste as new circuit) | — | 🟡 |
| Edit | Move (M-tool) | `M` | 🟡 (the FidoCadJ Move *mode* is dragging — FidoCadJS does this via selection-drag, so it's behavioural parity, not a missing item) |
| Edit | Alignment ▶ H-center, V-center | — | 🟠 (see §3.1) |
| Edit | Distribution ▶ Horizontally, Vertically | — | 🟠 |
| View | Layer Options (full dialog) | `Cmd+L` | 🟠 |
| View | Attach Image | — | 🟠 |
| View | Libraries (visibility) | — | ✅ present in toolbar but not menu |
| Circuit | Update Libraries | `Cmd+U` | 🟡 (FidoCadJS reloads on import; no "rescan" button) |
| About | About FidoCadJ | — | 🟡 (FidoCadJS has no About dialog) |

Effort to close all 🟠 items in this table: ~3.5 M tokens.

### 6.2 Toolbars — parity ✅

Both ports expose the same 13 drawing tools in the same order. The two-row layout matches: tools above, zoom/grid/snap/library/layer/coords below. FidoCadJ additionally allows the user to toggle **"Text in toolbar"** and **"Small icons in toolbar"** (`DialogSettings` General tab). Effort: ~0.3 M tokens, mostly CSS.

### 6.3 Dialogs — itemised diff

Present in FidoCadJ but **missing** in FidoCadJS:

| Java dialog | Purpose | Severity |
|-------------|---------|----------|
| `DialogAbout.java` | Version / license / link | 🟡 |
| `DialogAttachImage.java` | Image-as-background (offset, scale, opacity) | 🟠 |
| `DialogCopyAsImage.java` | Bitmap/vector to clipboard | 🟠 |
| `DialogLayer.java` + `DialogEditLayer.java` | Layer editor | 🟠 |
| `DialogParameters.java` | Macro parameter prompt at insertion | 🟡 (FidoCadJS edits parameters post-placement via the properties sidebar — different UX, similar outcome) |
| `DialogPrint.java` / `PrintPreview.java` | Print pipeline | ⚪ |
| `DialogSettings*.java` (Theme tab) | Light / Dark / Custom theme + theme path | 🟡 |

Present in FidoCadJS only:

| TS file | Purpose |
|---------|---------|
| `ExportDialog.ts` | streamlined modal — different look from Java |
| `PropertiesPanelController.ts` | live sidebar editor (no Java equivalent) |
| `InPlaceTextEditor.ts` | floating editable text overlay |
| `LayerDropdown.ts` | toolbar mini-dropdown |
| `ContextMenu.ts` | right-click in macro picker |
| `ConfirmDialog.ts` / `PromptDialog.ts` | generic modal helpers |

Effort to close 🟠 dialogs: ~3 M tokens.

### 6.4 Settings (`DialogSettings` / `OptionsDialog`) — itemised diff

| Setting | FidoCadJ | FidoCadJS |
|---------|----------|-----------|
| Grid step X / Y | ✅ | ✅ |
| Snap to grid | ✅ | ✅ |
| Anti-alias | ✅ | ✅ |
| Stroke size | ✅ | ✅ |
| Connection size | ✅ | ✅ |
| PCB line / pad / drill | ✅ | ✅ |
| Macro font + macro size | ✅ (with font discovery, range 1–10) | partial — font discovery yes (Font Access API), but the "macro size" field is missing as a global setting |
| Library directory | ✅ | ❌ (browser; libraries are URL-fetched) |
| **Text in toolbar** | ✅ | ❌ |
| **Small icons in toolbar** | ✅ | ❌ |
| **Strict FidoCAD compatibility** | ✅ | ❌ |
| **Shift copy/paste auto-offset** | ✅ | ⚠ FidoCadJS *always* offsets by one grid step; no toggle |
| **Zoom key** modifier | ✅ | ❌ |
| **Profile** (beta-only telemetry) | ✅ | ❌ (and no analytics in TS port — fine) |
| **Theme: Light / Dark / Custom** | ✅ | ❌ — hardcoded light only |
| Background / grid / selection-LTR / selection-RTL colors | ✅ | ✅ |
| **Render LaTeX math (KaTeX)** | ❌ | ✅ ahead |

Effort: ~1.5 M tokens for the macro-size setting + the three "Strict / Shift CP / Zoom key" toggles. Theme system (Dark mode) is its own milestone at ~2 M tokens.

### 6.5 Macro picker — 🟡 Mostly at parity

Both ports have tree + search + preview + context menu. FidoCadJ context-menu actions:
`rename`, `remove`, `copy`, `paste`, `changeKey` — **all present** in FidoCadJS (`MacroPicker.ts:26`). Gaps:

- **Drag-and-drop** in the tree (Java supports it; TS is `// future work`).
- **Macro single-letter shortcut binding** to keyboard (see §3.2 — the value is stored but never honoured).
- **Library export** (write a user library back to a `.fcl` download). FidoCadJS imports but does not export.
- **Update Libraries** action (re-fetch standard libs from disk/URL).

Effort: ~1.2 M tokens.

---

## 7. Internationalisation

- **FidoCadJ bundles:** 13 locales in `bin/MessagesBundle_*.properties` — `cs, de, el, en, es, fr, it, ja, nl, ru, zh` (and historic `pl`/Czech variations from `NEWS.txt`).
- **FidoCadJS bundles:** `en.json` only.

Severity 🟠. Two parts:
1. **Coverage** — the framework only fires `getString()` from `StandardLayers.ts:46`. Every menu / dialog string is hardcoded English.
2. **Bundles** — only English ships. Italian (FidoCadJ's first language) is the obvious next target.

Effort: ~2 M tokens for full key routing + one extra locale (it).

---

## 8. Native / platform features

| Feature | FidoCadJ | FidoCadJS | Severity |
|---------|----------|-----------|----------|
| Native file dialogs (Win/macOS) | ✅ | ⚠ browser-mediated (File System Access API where available) | ⚪ |
| Window position persistence | ✅ | n/a | ⚪ |
| Recent files | ✅ | ❌ | 🟡 |
| OS-level clipboard image | ✅ (Copy as Image) | ❌ — only text FCD | 🟠 |
| High-DPI handling | ✅ since 0.24.7 | ✅ via DPR scaling in `CanvasManager` | ✅ |
| Dark mode | ✅ since 0.24.9 (Theme tab) | ❌ | 🟠 |
| Android build | ✅ | ⚪ browser covers mobile | ⚪ |
| Command-line export mode | ✅ (`-e fcd output.svg svg`) | ❌ — no headless mode | 🟡 |
| Auto-save | ❌ in both | ❌ | — |

Effort: dark mode ~2 M tokens; image-on-clipboard ~0.6 M tokens; recent files ~0.5 M tokens.

---

## 9. Parser / FCL format

FidoCadJS's parser (`ParserActions.ts`) covers every documented token: `LI BE MC RV RP EV EP PV PP CV CP PL PA SA TE TY` and the `FJC` extensions for line widths, connection diameter, layer colour, layer name.

Verified by round-trip tests on all 11 primitives.

Outstanding parser-level gaps:

| Item | FidoCadJ | FidoCadJS | Severity |
|------|----------|-----------|----------|
| `FJC L` / `FJC N` (per-document layer color/name) | read **and write** | reads, but never writes (no layer-edit UI to trigger) | 🟠 |
| Subscript / superscript escapes inside `TE` text | yes (0.24.8) | ❌ | 🟠 |
| Strict mode handling of accented chars (issue #149) | yes | ✅ — UTF-8 throughout, no quirk | ✅ |
| Tolerance limit of 10 000 tokens per line | yes | ✅ — same `MAX_VERTICES` value | ✅ |
| Line endings `\r\n` vs `\n` user-selectable | yes (`ParserActions.java:64`, disabled) | ❌ — always `\n` | 🟡 |
| Per-line error recovery | yes | partial — parser swallows errors silently and may discard state on malformed primitives | 🟠 |

Effort: ~1.5 M tokens (most of the cost is improved error recovery).

---

## 10. Standard libraries (`.fcl` content)

| Library | FidoCadJ ships | FidoCadJS ships |
|---------|----------------|------------------|
| `FCDstdlib_en.fcl`         | ✅ | ✅ |
| `FCDstdlib.fcl` (IT)       | ✅ | ❌ |
| `elettrotecnica_en.fcl`    | ✅ | ✅ |
| `elettrotecnica.fcl` (IT)  | ✅ | ❌ |
| `PCB_en.fcl`               | ✅ | ✅ |
| `PCB.fcl` (IT)             | ✅ | ❌ |
| `EY_Libraries.fcl`         | ✅ | ✅ |
| `IHRAM_en.fcl`             | n/a (community add) | ✅ |

🟡 Severity. The IT-language originals are content gaps tied to the i18n
work; they are static assets and can be dropped into `public/lib/` without
code changes once the UI can pick a language at startup.

Effort: ~0.1 M tokens (file copy + reference in loader).

---

## 11. Effort summary

All estimates are in **M tokens**:

| Severity bucket | Items | Estimated effort |
|-----------------|-------|------------------|
| 🔴 Critical     | Missing export formats (PDF, EPS, JPG, Eagle, PCB-RND) + per-format options | **~7 M** |
| 🟠 Significant  | Image-as-background, layer-edit dialog, FJC L/N write-back, align-center & distribute, Copy as Image, dark mode, full i18n + 1 locale, macro placement UX, subscript/superscript text | **~12 M** |
| 🟡 Nice-to-have | Recent files, Save As/Split, Save-Split menu, About dialog, library export, drag-drop in tree, library-undo, macro shortcut keys binding, strict mode toggle, toolbar text/icons settings, macro size setting, line-ending choice, IT-original libraries | **~7 M** |
| ⚪ Cosmetic     | Print pipeline, CLI export, Android | **defer / skip** |

**Total to "feature parity":** ~26 M tokens, ±30 % planning band → roughly
20 – 34 M tokens. Big drivers are PDF export, Eagle/PCB-RND exporters,
and the layer-edit dialog. Everything else is small modules.

---

## 12. Suggested ordering

If you want to maximise visible parity per M-token, here is one credible
order. None of these depend on each other:

1. **PNG export options** (DPI, pixel size, B&W, split layers) — ~1 M.
   Highest-frequency export, lowest cost.
2. **JPG export** — ~0.3 M. Trivial on top of PNG.
3. **Image as background** — ~1.5 M. Existing scaffolding makes this cheap.
4. **Layer edit dialog + FJC L/N write-back** — ~2.5 M. Closes the gnarliest
   parity hole in the editor itself.
5. **Align-center / distribute** — ~1.5 M.
6. **Copy as Image** — ~0.6 M. One-line `canvas.toBlob()` plus an
   `ClipboardItem`.
7. **About dialog + Save As + recent files** — ~1 M. Boring UX but they
   are the items every reviewer notices first.
8. **i18n routing + Italian locale** — ~2 M. Unlocks the rest of the
   `_en` / non-`_en` library pairs.
9. **PDF export** — ~3 M. Needs a library decision (`pdf-lib` vs
   `jsPDF`). Confirm choice before starting.
10. **Eagle .scr + pcb-rnd .pcb** — ~4 M combined. Niche but the only way
    to claim true parity for PCB workflows.
11. **Dark mode + theme system** — ~2 M.
12. **Subscript / superscript in `PrimitiveAdvText`** — ~0.8 M.
13. **Macro single-letter shortcut binding** — ~0.4 M.
14. **EPS** — ~1.5 M. Lowest-priority of the missing formats unless a
    user actually asks.

---

## 13. Sources

- FidoCadJ Java source `/Users/dante/FidoCadJ/src/fidocadj/`
- FidoCadJ `NEWS.txt` (used to verify feature provenance, e.g. issue #71
  for subscripts, #154 for split-layer export, #146 for copy-as-image)
- FidoCadJ `manual/manual_en.tex` chapter outline
- FidoCadJS `/Users/dante/FidoCadJS/src/`
- FidoCadJS `README.md` "Differences from FidoCadJ" section
