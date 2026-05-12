# ADR-343: DXF Canvas Visual Regression Test Suite

**Status**: ✅ ACTIVE — Phase 1–7 implemented (39 tests)  
**Date**: 2026-05-10  
**Domain**: DXF Viewer / Testing Infrastructure  
**Author**: Giorgio Pagonis  

---

## Context

The DXF canvas is a performance-critical, multi-layer rendering system (ADR-040). Changes to entity renderers, overlay architecture, or transform math can silently break visual output. Without automated regression coverage, regressions reach production undetected.

## Decision

Visual regression tests using Playwright `toHaveScreenshot()` cover:
1. Canvas view states (idle, zoom, fit, overlays)
2. Each entity type renderer in isolation
3. Selection interactions
4. Drawing tool previews
5. Entity operations
6. Snap indicators
7. Edge cases

Tests run **locally** (`npm run test:visual:dxf`). CI integration requires one GitHub Actions workflow file (path-filtered on DXF files) — deferred, zero lock-in.

---

## Architecture

### Test Harness

`src/app/test-harness/dxf-canvas/DxfCanvasHarness.tsx`

- Dev-only page at `/test-harness/dxf-canvas`
- Supports `?fixture=NAME` → loads `/test-fixtures/dxf/{NAME}.json`
- Supports `?rulers=1&grid=1` for overlay tests
- Exposes `window.__dxfTest` API: `fitToView`, `zoomIn`, `zoomOut`, `getRef`, `isReady`, `selectEntities`, `clearSelection`, `getSelectedEntityIds`, `worldToScreen`, `drawPreview`, `clearPreview`, `setActiveTool`
- `PreviewCanvas` loaded via `dynamic({ ssr: false })` (same pattern as DxfCanvas) — avoids Turbopack 2min cold-compile from `../../rendering` barrel
- Production guard: `DxfCanvasHarness.prod.ts` stub + webpack alias in `next.config.js` → zero production bundle impact

### Scene Fixtures

`public/test-fixtures/dxf/`

| File | Purpose |
|------|---------|
| `regression-scene.json` | Default: rectangle + circle + arc + text |
| `entity-line.json` | Line renderer: horizontal + diagonal |
| `entity-circle.json` | Circle renderer |
| `entity-arc.json` | Arc renderer: semicircle + quarter arc |
| `entity-polyline.json` | Polyline renderer: closed + open |
| `entity-text.json` | Text renderer: normal + rotated |
| `entity-angle.json` | Angle-measurement renderer |
| `empty-scene.json` | Edge case: no entities, `bounds: null` |
| `dense-scene.json` | Edge case: 34 entities across 9 layers (floor plan fragment) |

### Playwright Config

`playwright.config.ts` — project `visual-dxf`:
- Browser: Chromium only (deterministic rendering)
- Viewport: 1280×800, deviceScaleFactor: 1
- Timeout: 120s (Turbopack cold compile ~126s)
- Snapshot path: `src/subapps/dxf-viewer/e2e/__snapshots__/`
- `reuseExistingServer: true` — reuses Giorgio's dev server on port 3000
- `webServer.url: /test-harness/dxf-canvas` — pre-warms Turbopack before tests start

---

## Test Phases

### Phase 1 — View States ✅ (2026-05-10, 7 tests)

| Test | What it covers |
|------|---------------|
| `idle` | Default transform, scene loaded |
| `fit-to-view` | fitToView() result |
| `zoom-2x` | 2× zoom at screen center |
| `zoom-0.5x` | 0.5× zoom at screen center |
| `hover-entity` | Crosshair overlay at scene center |
| `selection-box` | Marquee drag selection box |
| `ruler-grid` | Rulers + grid overlay |

### Phase 2 — Entity Rendering ✅ (2026-05-10, 6 tests)

One isolated fixture per entity type. Each test: load fixture → fitToView → screenshot.

| Test | Fixture | What it covers |
|------|---------|---------------|
| `entity-line` | `entity-line.json` | DxfLine renderer (horizontal + diagonal, 2 colors) |
| `entity-circle` | `entity-circle.json` | DxfCircle renderer |
| `entity-arc` | `entity-arc.json` | DxfArc renderer (semicircle + quarter, CCW flag) |
| `entity-polyline` | `entity-polyline.json` | DxfPolyline renderer (closed + open) |
| `entity-text` | `entity-text.json` | DxfText renderer (normal + 45° rotation) |
| `entity-angle` | `entity-angle.json` | DxfAngleMeasurement renderer |

### Phase 3 — Selection ✅ (2026-05-10, 5 tests)

| Test | What it covers |
|------|---------------|
| `click-to-select` | Real click at world→screen coords, entity highlight via hit-test pipeline |
| `multi-select` | Programmatic `selectEntities(['line-bottom','circle-1'])` — two entities highlighted |
| `select-all` | Ctrl+A keyboard → all 7 entities highlighted |
| `deselect` | selectEntities then clearSelection → back to no-selection state |
| `select-then-delete` | selectEntities then Delete key → entity removed from scene |

**Harness extensions**:
- `selectedEntityIds` state + `renderOptions={{ selectedEntityIds }}` → visual highlight wired
- `onEntitySelect` + `onEntitiesSelected` wired to state
- `keydown` listener: Delete removes selected entities, Ctrl+A selects all
- `__dxfTest.selectEntities`, `clearSelection`, `getSelectedEntityIds`, `worldToScreen`

### Phase 4 — Drawing Tool Previews ✅ (2026-05-10, 5 tests)

| Test | What it covers |
|------|---------------|
| `draw-line-preview` | `ExtendedLineEntity` ghost via `PreviewCanvas.drawPreview()` |
| `draw-circle-preview` | `ExtendedCircleEntity` with `previewCursorPoint` radius arm |
| `draw-arc-preview` | `ExtendedArcEntity` with construction lines (3-point arc mode) |
| `draw-polyline-preview` | Open `ExtendedPolylineEntity` in-progress |
| `draw-rectangle-preview` | Closed polyline rectangle ghost |

**Approach**: Programmatic `__dxfTest.drawPreview(entity)` → `PreviewCanvasHandle.drawPreview()` — deterministic, no mouse simulation needed. Tests the `PreviewRenderer` visual output directly.

**Infrastructure fixes**:
- `PreviewCanvas` dynamic import (`ssr: false`) — eliminates 2min Turbopack cold-compile
- `--workers=1` in npm scripts — sequential execution avoids parallel Turbopack lock conflicts
- canvas-ready timeout: 60s → 120s

### Phase 5 — Entity Operations ✅ (2026-05-10, 5 tests)

| Test | What it covers |
|------|---------------|
| `entity-moved` | `updateSceneEntity('circle-1', { center: newPos })` → circle at new world position |
| `entity-copied` | `addSceneEntity(offsetLine)` → original + copy both visible |
| `entity-multi-removed` | `removeSceneEntity` × 2 → arc + text gone |
| `entity-color-changed` | `updateSceneEntity` color/lineWidth patch → cyan circle |
| `entity-added` | `addSceneEntity(largeCircle)` → new entity in scene |

**New `__dxfTest` API**: `updateSceneEntity(id, patch)`, `addSceneEntity(entity)`, `removeSceneEntity(id)`

### Phase 6 — Snap Indicators ✅ (2026-05-10, 6 tests)

| Test | Snap Type | Visual |
|------|-----------|--------|
| `snap-endpoint` | `endpoint` | Square outline at line corner |
| `snap-midpoint` | `midpoint` | Triangle at line midpoint |
| `snap-center` | `center` | Circle at entity center |
| `snap-intersection` | `intersection` | X at corner |
| `snap-perpendicular` | `perpendicular` | Right-angle symbol on line |
| `snap-grid` | `grid` | Dot at grid point |

**Approach**: `SnapIndicatorOverlay` (dynamic import, SVG-based) added to harness. `__dxfTest.showSnap(type, wx, wy)` / `hideSnap()` expose world-coords snap positioning.

### Phase 8 — Text Rendering ✅ (2026-05-12, 4 tests)

| Test | Fixture | What it covers |
|------|---------|---------------|
| `text-entity-normal` | `entity-text.json` | Plain TEXT entity — position, height, color |
| `text-entity-rotated` | `entity-text.json` | TEXT entity at 45° rotation |
| `text-mtext-multiline` | `text-mtext-multiline.json` | MTEXT block (3 lines) + colored text + small label |
| `text-layer-hidden` | `text-mtext-multiline.json` | Entity on hidden layer (`visible: false`) is not rendered |

**New fixture**: `text-mtext-multiline.json` — 3 entities (MTEXT block, colored TEXT, small label), 2 layers (`TEXT`, `DIMS`).

---

### Phase 7 — Edge Cases ✅ (2026-05-10, 5 tests)

| Test | Fixture | What it covers |
|------|---------|---------------|
| `empty-scene` | `empty-scene.json` | Canvas with `entities: [], bounds: null` — blank dark frame |
| `extreme-zoom-in` | `regression-scene.json` | 4× `zoomIn()` = 16× from fit — partial entity, thick strokes |
| `extreme-zoom-out` | `regression-scene.json` | 4× `zoomOut()` = ~0.06× from fit — scene as tiny cluster |
| `dense-scene` | `dense-scene.json` | 34 overlapping entities (walls, arcs, circles, text, polylines, hatch) |
| `loading-state` | — | `page.route()` holds fixture fetch; captures `data-testid="loading"` dark frame |

**New fixtures**:
- `empty-scene.json` — `{ entities: [], layers: ['0'], bounds: null }` — verifies graceful empty render
- `dense-scene.json` — floor plan with 34 entities across 9 layers: outer/inner walls, door arcs, windows, furniture circles, text labels, hatch lines, staircase polyline, dimension lines, WC polyline

---

## Running Tests

```bash
# Run all visual-dxf tests
npm run test:visual:dxf

# Regenerate baselines (after intentional visual change)
npm run test:visual:dxf:update
```

---

## Screenshot Thresholds

```typescript
{ threshold: 0.01, maxDiffPixelRatio: 0.001 }
```

- `threshold`: per-pixel color tolerance (1% CIEDE2000)
- `maxDiffPixelRatio`: max 0.1% of pixels can differ

---

## Baseline Snapshots

Location: `src/subapps/dxf-viewer/e2e/__snapshots__/`  
Generated: 2026-05-10  
Phase 1: 7 PNG baselines  
Phase 2: 6 PNG baselines  
Phase 3: 5 PNG baselines  
Phase 4: 5 PNG baselines  
Phase 5: 5 PNG baselines  
Phase 6: 6 PNG baselines  
Phase 7: 5 PNG baselines  
Phase 8: 4 PNG baselines (generate with `npm run test:visual:dxf:update`)

---

## Production Safety

- `page.tsx`: `if (process.env.NODE_ENV === 'production') notFound()` — route inaccessible in production
- `next.config.js` webpack alias: `DxfCanvasHarness.tsx` → `DxfCanvasHarness.prod.ts` (empty stub) in production builds → DXF viewer tree excluded from production bundle → zero GitHub CI / Netcup memory impact

---

## ADR Index

Related ADRs:
- **ADR-040**: Canvas performance architecture (micro-leaf pattern, bitmap cache, CardinalRules)
- **ADR-027**: Keyboard shortcuts (Ctrl+A, Home, etc.)
- **ADR-183**: Grip system
- **ADR-105**: Hit test tolerance

---

## Changelog

### 2026-05-12: Phase 8 implemented (ADR-344 Phase 10)

- Phase 8: 4 text rendering tests — baselines generated on first `npm run test:visual:dxf:update`
- New fixture: `public/test-fixtures/dxf/text-mtext-multiline.json`
- ADR-343 + ADR-040 updated

### 2026-05-10: Phase 5 implemented

- Phase 5: 5 entity operation tests — 28/28 passing
- New `__dxfTest` API: `updateSceneEntity`, `addSceneEntity`, `removeSceneEntity`
- ADR-343 updated

### 2026-05-10: Phase 4 implemented + infra fixes

- Phase 4: 5 drawing preview tests — all 23 tests passing
- PreviewCanvas: static → `dynamic({ ssr: false })` (eliminates Turbopack 2min cold-compile)
- `--workers=1` added to npm scripts (sequential, avoids Turbopack lock contention)
- canvas-ready timeout: 60s → 120s
- ADR-343 updated

### 2026-05-10: Phase 3 implemented

- Phase 3: 5 selection tests added
- Harness: `selectedEntityIds` state + `renderOptions` wired, keyboard handlers (Delete/Ctrl+A), `__dxfTest` extended with `selectEntities`/`clearSelection`/`getSelectedEntityIds`/`worldToScreen`
- `onEntitySelect` + `onEntitiesSelected` wired to selection state
- Spec: Phase 3 test.describe block added (18 tests total)
- ADR-343 updated

### 2026-05-10: Phase 1 + Phase 2 implemented

- Phase 1: 7 view state tests — all passing, baselines generated
- Phase 2: 6 entity rendering tests — all passing, baselines generated
- Harness: `?fixture=NAME` param for isolated entity fixtures
- Production guard: webpack alias stub (zero CI impact)
- ADR-040 changelog updated
