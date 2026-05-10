# ADR-343: DXF Canvas Visual Regression Test Suite

**Status**: ✅ ACTIVE — Phase 1 + Phase 2 + Phase 3 implemented  
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
- Exposes `window.__dxfTest` API: `fitToView`, `zoomIn`, `zoomOut`, `getRef`, `isReady`, `selectEntities`, `clearSelection`, `getSelectedEntityIds`, `worldToScreen`
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

### Phase 4 — Drawing Tools (planned, ~8 tests)

Each tool in-progress preview: line, circle, arc, rectangle, polygon.

### Phase 5 — Entity Operations (planned, ~6 tests)

Move, delete, copy, rotate — visual state before/after.

### Phase 6 — Snap Indicators (planned, ~5 tests)

Endpoint, midpoint, center, perpendicular snap visual indicators.

### Phase 7 — Edge Cases (planned, ~5 tests)

Empty scene, extreme zoom, dense entity count, loading state.

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
Phase 3: 5 PNG baselines (pending `npm run test:visual:dxf:update`)  

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
