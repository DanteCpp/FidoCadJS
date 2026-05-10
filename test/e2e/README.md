# test/e2e — End-to-End Tests

Playwright-based browser tests that exercise the full FidoCadJS application
stack (canvas rendering, keyboard input, mouse interaction, export).

## Running

```bash
# Run all e2e tests (headless, 3 parallel workers)
npm run test:e2e

# Run with Playwright UI (watch mode, visual debugging)
npm run test:e2e:ui

# Run a single test file
npx playwright test test/e2e/app-loads.test.ts

# Run only unit tests (Vitest)
npm run test:run
```

The Playwright config (`playwright.config.ts` at the project root)
auto-starts the Vite dev server and tears it down after the suite
completes.  It reuses an existing server when one is already running.

## Test Suite

| File | Area under test | Tests |
|------|-----------------|-------|
| `app-loads.test.ts` | App initialisation, canvas, toolbar, libraries | 10 |
| `drawing-tools.test.ts` | Drawing tools (all 11 primitives) via keyboard + mouse | 22 |
| `selection-and-transform.test.ts` | Selection, move, rotate, mirror, nudge, delete | 10 |
| `undo-redo.test.ts` | Undo/redo state tracking and keyboard shortcuts | 6 |
| `clipboard.test.ts` | Copy, cut, duplicate operations via API | 6 |
| `zoom-pan.test.ts` | Zoom in/out, wheel, fit, pan | 10 |
| `grid-snap.test.ts` | Grid visibility and snap-to-grid toggles | 2 |
| `file-operations.test.ts` | New, open, save, view code | 6 |
| `export.test.ts` | SVG, PGF, TikZ export and round-trip determinism | 18 |
| `menu-bar.test.ts` | Menu bar dropdowns and command actions | 8 |
| `keyboard-e2e.test.ts` | Keyboard shortcuts through full browser stack | 16 |
| `macro-library.test.ts` | Library panel, macro placement, library loading | 5 |
| `edge-cases.test.ts` | Empty/degenerate, rapid ops, long docs, negative coords, resize | 15 |
| **Total** | | **134** (132 passing, 2 skipped) |

## Architecture

Tests use `__circuitPanel`, an intentional escape hatch attached to the
canvas element, to call CircuitPanel methods directly from the browser
context.  Helper functions in `utils.ts` wrap common operations:

- `gotoApp(page)` — navigate to the app and wait for readiness
- `pressKey(page, key)` — focus canvas + press a key + settle
- `clickCanvasScreen(page, sx, sy)` — click at CSS-pixel screen coords
- `loadCircuit(page, fcd)` — inject an FCD string via the API
- `exportSVG / exportPGF / exportTikZ(page)` — export and return text
- `primitiveCount(page)` — count primitives in the model
- `getCircuitText(page)` — get the full FCD text output
- `canUndo / canRedo(page)` — check undo/redo availability

## Adding New Tests

1. Create `test/e2e/my-feature.test.ts`
2. Import helpers from `./utils.ts`
3. Use `test.describe` / `test` blocks (Playwright Test API)
4. Use `gotoApp(page)` in `beforeEach` to start from a clean page
5. For complex state verification, use a single `page.evaluate()` to avoid races

## CI Integration

To run e2e tests in CI alongside the existing Vitest suite:

```yaml
- name: Run unit tests
  run: npm run test:run
- name: Run e2e tests
  run: npm run test:e2e
```

The Playwright webServer config handles starting Vite automatically.
