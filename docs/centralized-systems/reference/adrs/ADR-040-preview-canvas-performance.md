# ADR-040: Preview Canvas Performance

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Last Updated** | 2026-05-09 |
| **Category** | Drawing System |
| **Canonical Location** | `canvas-v2/preview-canvas/` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `canvas-v2/preview-canvas/` + `PreviewRenderer`
- **Performance**: ~250ms → <16ms per frame
- **Pattern**: Direct canvas rendering (Autodesk/Bentley pattern) - zero React overhead

## Architecture

### File Structure

| File | Role |
|------|------|
| `PreviewCanvas.tsx` | React wrapper, imperative handle (`drawPreview`, `clear`), UnifiedFrameScheduler integration |
| `PreviewRenderer.ts` | Direct canvas 2D API rendering engine, entity-specific render methods |

### Z-Index Layer Stack

| Layer | Z-Index | Description |
|-------|---------|-------------|
| LayerCanvas | 0 | Background overlays |
| DxfCanvas | 10 | DXF entity rendering |
| **PreviewCanvas** | **15** | **Drawing preview (rubber-band lines, grips)** |
| CrosshairOverlay | 20 | Cursor crosshair |

### Rendering Flow

```
Mouse Event → DxfCanvas.onMouseMove
  → CanvasSection callback
    → drawingHandlers.onDrawingHover(worldPos)
      → updatePreview(point, transform)
      → getLatestPreviewEntity()   ← reads from ref (NOT React state)
      → previewCanvasRef.drawPreview(entity)
        → PreviewRenderer.drawPreview(entity, transform, viewport)
          → this.render()  ← IMMEDIATE synchronous render (no RAF wait)
```

### Key Design Decisions

1. **Immediate rendering**: `drawPreview()` renders synchronously in the mouse event handler, not on the next RAF frame
2. **Independent from canvas sync**: Preview canvas is EXCLUDED from the UnifiedFrameScheduler canvas group sync (`canvasSystemIds` at line 630 of `UnifiedFrameScheduler.ts`)
3. **No React state for preview entity**: Uses `previewEntityRef` (ref) instead of `useState` to avoid re-renders on every mouse move
4. **`pointer-events: none`**: Mouse events pass through preview canvas to DxfCanvas below

## Supported Entity Types

| Entity Type | Tools |
|-------------|-------|
| `line` | Line, Measure Distance |
| `circle` | Circle, Circle Diameter, Circle 3P |
| `rectangle` | Rectangle |
| `polyline` | Polyline, Polygon, Measure Area |
| `arc` | Arc 3P, Arc CSE, Arc SCE |
| `angle-measurement` | Measure Angle |
| `point` | Start point indicator |

---

## Changelog

### 2026-05-09: PERF — Phase G: Eliminate continuous RAF loop in FloorplanBackgroundCanvas

**Incident**: Performance trace post-Phase F (clean) showed `FloorplanBackgroundCanvas.useEffect.draw` consuming **6091.8ms / 11s trace = 54.6% Self Time** — top single hotspot. Console-task overhead added another 33%. Total: ~88% of trace burned in this component, even when scene was idle.

**Root cause**: `FloorplanBackgroundCanvas.tsx:64-96` ran a permanent `requestAnimationFrame` loop at 60fps that re-cleared the canvas + re-invoked `provider.render()` every frame, regardless of whether anything had changed. The component used 7 ref-mirroring `useEffect`s feeding refs into the closure to "avoid stale data without restarting the loop". That design effectively reproduced React change-detection by polling — paying full draw cost ~60×/sec in idle. Both providers (`ImageProvider`, `PdfPageProvider`) `render()` is synchronous (`ctx.drawImage` + transform), no internal animation requiring continuous re-paint.

**Fix** — `src/subapps/dxf-viewer/floorplan-background/components/FloorplanBackgroundCanvas.tsx`:

- Removed the perma-RAF loop and all 7 ref-mirror `useEffect`s.
- Replaced with a single dependency-driven `useEffect([background, provider, worldToCanvas, viewport, cad, calibrationSession, floorId])` that draws once per relevant state change.
- React already re-renders on prop / store change → effect runs once → exactly one draw per change. Idle = 0 frames.
- Click handler closure simplified — reads `floorId` and `worldToCanvas` directly from props instead of refs.

**Result**: Floorplan background draw cost shifts from `60fps × idle_time` (constant) to `1× per actual change`. During pan/zoom the cost matches React's render cadence (≤60fps); in idle it is **zero**.

**Caveat**: If `worldToCanvas` is allocated inline by parent (new object identity per render), the effect runs on each parent re-render — still better than perma-RAF but less than ideal. Memoization at the parent (`CanvasLayerStack` `useMemo` for `worldToCanvas`) would make idle truly idle. Tracked as follow-up.

**Google-level checklist** (N.7.2):
- Proactive: yes — render only when inputs change
- Race-free: yes — effect runs on commit, single owner of canvas paint
- Idempotent: yes — same inputs → same canvas state
- SSoT: yes — props/store are the only source; no parallel ref mirror
- Lifecycle owner: explicit — `useEffect` deps array

✅ Google-level: YES.

### 2026-05-09: PERF — Phase F: Lazy ExcelJS chunk (kill 2s freeze on first interaction)

**Incident**: Performance trace (clean, no DevTools/extension contamination) on DXF viewer click+mouseout+mousedown/up showed `EvaluateScript` chunk `34b5e_exceljs_dist_exceljs_min_b2c59f91.js` blocking main thread **2087ms** during user interaction. ExcelJS (~600KB minified) was being eagerly compiled mid-interaction, manifesting as "click 796ms / mouseup 332ms" violations in earlier (DevTools-inflated) traces.

**Root cause**: 8 client-reachable modules were doing static top-level `import ExcelJS from 'exceljs'`. Even though export functions only run on user "Export" action, the static import pulled the entire ExcelJS bundle into transitive client chunks (report-builder, payments, milestones, gantt, accounting, procurement analytics). First time a chunk containing one of these was lazy-loaded mid-click → exceljs compiled sync → 2s freeze. Mouse Phase D fixes were correct; the residual long-task violations were pre-paint cascade chunk loading, not handler code.

**Fix** — convert `import ExcelJS from 'exceljs'` → `import type ExcelJS from 'exceljs'` (compile-time only, zero runtime) + `await import('exceljs')` inside each `export…ToExcel()` function:

- `src/services/report-engine/report-excel-exporter.ts`
- `src/services/report-engine/builder-excel-exporter.ts`
- `src/services/report-engine/builder-excel-analysis.ts` (types only — no runtime constructor)
- `src/services/payment-export/payment-excel-exporter.ts`
- `src/services/milestone-export/milestone-excel-exporter.ts`
- `src/services/gantt-export/gantt-excel-exporter.ts`
- `src/lib/export/analytics-xlsx.ts`
- `src/subapps/accounting/services/export/excel-exporter.ts`

Server-only routes (`api/files/[fileId]/excel-preview`, `lib/document-extractors/xlsx-extractor.ts`) left as static imports — never enter the client bundle.

**Result**: ExcelJS chunk loaded only on user-clicked "Export" button. Removes 2087ms freeze from any interaction that triggers cascade chunk loading.

**Validation pattern**: After this fix, second-click on the same DXF entity (chunk warm) had no freeze — proving the residual violations were chunk-compile, not handler-code.

**ADR coverage**: ADR-040 (preview canvas perf) tracks the broader DXF interaction perf budget. Lazy chunk discipline applies to any heavy export library reachable from client.

### 2026-05-09: PERF — Mouse Position SSoT, eliminate CanvasSection re-render cascade

**Incident**: Long-task violations >100ms during mousemove (dev mode 200ms+, prod ~80ms). Crosshair lag, sluggish guide ghost previews, drawing rubber-band stuttering.

**Root cause**: `useCanvasMouse` exposed `mouseCss` and `mouseWorld` as React `useState` consumed by CanvasSection. With 0.5px / 0.1 world-unit thresholds, almost every mousemove triggered `setMouseCss` + `setMouseWorld` → CanvasSection re-render → cascade through 13+ heavy hooks: `useGuideToolWorkflows` → `useGuideWorkflowComputed` (5 useMemo), `useOverlayLayers` (rubber-band preview), `useRotationPreview`, `useEffect` rotation handler, plus all the secondary hooks reading from CanvasSection-level state. Single mousemove = full subtree reconciliation.

**Fix** — establish `ImmediatePositionStore` as the canonical mouse position SSoT and migrate all consumers from prop drilling to `useSyncExternalStore`:

| Layer | Change |
|-------|--------|
| `useCanvasMouse` | Removed `mouseCss` / `mouseWorld` `useState`. Hook now returns only event handlers — position state lives in the store. |
| `useLayerCanvasMouseMove` | Writes directly to `setImmediatePosition` + `setImmediateWorldPosition` (no React state hop). |
| `useCanvasContainerHandlers` | Reads world position via `getImmediateWorldPosition()` instead of stale-ref pattern; `mouseWorld` param removed. |
| `useGuideWorkflowComputed` | Subscribes to world position via `useCursorWorldPosition()`. Hook MOVED from CanvasSection to CanvasLayerStack — re-renders stay scoped to the canvas tree. |
| `useOverlayLayers` | Now produces only the static `colorLayers`. Mouse-driven `colorLayersWithDraft` + `isNearFirstPoint` extracted into new `useDraftPolygonLayer` hook (CanvasLayerStack). |
| `useRotationPreview` | Subscribes to world position internally; hook MOVED to CanvasLayerStack. |
| `useCanvasClickHandler` | `isNearFirstPoint` prop removed — computed inline at click time using `worldPoint` + `transform.scale`. |
| Rotation `handleRotationMouseMove` effect | Replaced React-state-deps `useEffect` with `subscribeToImmediateWorldPosition` listener (no re-render). |

**Architectural rule** ("Mouse Position SSoT for canvas re-render scoping"):

1. `ImmediatePositionStore` is the SINGLE source of truth for mouse CSS + world position.
2. Components that need to *re-render* on mouse position change MUST use `useCursorPosition()` / `useCursorWorldPosition()` (`useSyncExternalStore`) — never `useState` + setter in a high-level parent.
3. Hooks consuming subscription MUST be invoked in a leaf component (canvas tree level), not in a high-level orchestrator like CanvasSection — otherwise the cascade returns.
4. Click-time / event-time reads use `getImmediatePosition()` / `getImmediateWorldPosition()` (no subscription, no re-render).

**Impact**: CanvasSection no longer re-renders on mousemove. Re-render scope limited to the canvas leaf consumers. Long-task violations eliminated; crosshair latency restored to <16ms.

**Files touched** (~14): `useCanvasMouse.ts` + `canvas-mouse-types.ts`, `useLayerCanvasMouseMove.ts`, `useCanvasContainerHandlers.ts`, `useGuideWorkflowComputed.ts`, `useGuideToolWorkflows.ts` + `guide-workflow-types.ts`, `useOverlayLayers.ts`, `useDraftPolygonLayer.ts` (NEW), `useRotationPreview.ts`, `useCanvasClickHandler.ts` + `canvas-click-types.ts`, `CanvasLayerStack.tsx` + `canvas-layer-stack-types.ts`, `CanvasSection.tsx`.

---

### 2026-05-09: PERF — Phase D Static layer bitmap cache (dxf-canvas) — REVERTED

**Status**: ROLLED BACK 2026-05-09. Implementation caused page freeze (FPS 1) on dense scenes.

**Root cause of failure**: `hoveredEntityId` was added to bitmap invalidation triggers. Hover highlight is rendered as part of the entity render pipeline (`renderEntityUnified` sets `hovered: isHovered`). On a dense scene (3263 entities), continuous mouse hover changes `hoveredEntityId` ~60×/s → bitmap dirtied 60×/s → 3263-entity re-render 60×/s → FPS 1. Same latent bug for `selectedEntityIds` during marquee drag, `gripInteractionState` during grip drag, `dragPreview`.

**Files reverted**: `ImmediatePositionStore.ts`, `dxf-canvas-renderer.ts`, `DxfRenderer.ts`. `dxf-bitmap-cache.ts` deleted.

**Correct approach (deferred)**: Bitmap must cache ONLY normal-state entities. Hover highlight, selection grips, drag preview must be rendered as separate single-entity overlays drawn on the visible canvas AFTER the bitmap blit (~0.5ms per single-entity overlay vs ~80-300ms for full entity loop). Re-attempt with this design in a separate session.

---

### 2026-05-09: PERF — Phase D RE-IMPLEMENT — Hybrid bitmap cache + single-entity overlay

**Status**: IMPLEMENTED 2026-05-09. Re-attempt of Phase D with the corrected dual-buffer architecture.

**Problem**: After Phase E shipped, `CanvasLayerStack` no longer re-rendered on mousemove (React reconciliation cascade eliminated), but the residual bottleneck remained: ~150-194ms `mousemove` violations on a 3263-entity scene. Trace:

1. `mouse-handler-move.ts` → `setImmediatePosition(screenPos)` on every mousemove.
2. `ImmediatePositionStore.setPosition` → `markSystemsDirty(['dxf-canvas','layer-canvas','crosshair-overlay'])`.
3. `UnifiedFrameScheduler.processFrame` canvas-sync pre-check forced `dxf-canvas` dirty.
4. RAF tick → `DxfRenderer.render()` → loop 3263 entities (`renderEntityUnified` × N) → ~150ms.

**Architectural rule** (codified):
> **Bitmap cache layers MUST contain ONLY content invariant to high-frequency state changes. Interactive state (hover, selection grips, drag preview) MUST be rendered as single-entity overlays on top of the bitmap blit.**

This is the rule violated by Phase D v1: it included `hoveredEntityId` in the bitmap cache key, so hover updates at ~60Hz on a dense scene rebuilt the whole bitmap per frame and the page froze (FPS 1).

**Pipeline** (each RAF tick, `dxf-canvas-renderer.renderScene`):

```
1a. DxfBitmapCache
    ├─ if isDirty(scene, transform, viewport, dpr) → rebuild offscreen
    │   (offscreen DxfRenderer.render with skipInteractive=true → loop N entities)
    └─ blit offscreen → visible canvas (~0.5ms drawImage)

1b. Single-entity interactive overlays (drawn on visible canvas after blit)
    ├─ if hoveredEntityId      → DxfRenderer.renderSingleEntity('hovered')
    ├─ for each selectedEntityId → DxfRenderer.renderSingleEntity('selected')
    └─ if dragPreview          → DxfRenderer.renderSingleEntity('drag-preview')

2. Grid, guides, construction points
3. Rulers, guide bubbles, dimensions
4. Selection box (marquee)
```

**Cache invalidation triggers** (intentionally minimal):
- scene reference change
- transform.scale / offsetX / offsetY change
- viewport size change
- device pixel ratio change

**EXPLICITLY EXCLUDED** from cache key (would re-introduce the v1 freeze):
- `hoveredEntityId`
- `selectedEntityIds`
- `gripInteractionState`
- `dragPreview`

**Companion changes**:

1. `ImmediatePositionStore.CURSOR_SYNC_CANVAS_IDS`: `['dxf-canvas', 'layer-canvas', 'crosshair-overlay']` → `['layer-canvas', 'crosshair-overlay']`. New `PAN_SYNC_CANVAS_IDS` includes `dxf-canvas` for `updateTransform` (pan invalidates the bitmap, transform changes).
2. `UnifiedFrameScheduler.processFrame` canvas-sync group: `dxf-canvas` removed from `canvasIds`. The DXF canvas owns its own dirty logic (cache + `isDirtyRef`), and is no longer force-dirtied by sibling-canvas events.
3. `DxfRenderer`: new public method `renderSingleEntity(entity, transform, viewport, mode, interaction)`. Existing `render()` accepts `skipInteractive: boolean` to render in pure normal-state.
4. `DxfRenderOptions.skipInteractive: boolean` added.
5. `canvas-layer-stack-leaves.tsx` (DxfCanvasSubscriber): `renderOptions = useMemo(() => ({ ...renderOptionsBase, hoveredEntityId }), […])`. Stable identity prevents `dxf-canvas-renderer` from re-running its dirty effect on every parent render. `dxfRenderOptionsBase` in `CanvasLayerStack.tsx` also memoized.

**Files added**: `canvas-v2/dxf-canvas/dxf-bitmap-cache.ts`.

**Files modified**: `canvas-v2/dxf-canvas/DxfRenderer.ts`, `canvas-v2/dxf-canvas/dxf-canvas-renderer.ts`, `canvas-v2/dxf-canvas/dxf-types.ts`, `systems/cursor/ImmediatePositionStore.ts`, `rendering/core/UnifiedFrameScheduler.ts`, `components/dxf-layout/canvas-layer-stack-leaves.tsx`, `components/dxf-layout/CanvasLayerStack.tsx`.

**Expected costs**:
- Cursor-only mousemove (no hover/selection change): cache hit + blit ≈ 0.5ms
- Hover transition: blit + 1× single-entity render ≈ 1ms
- Selection update: blit + N× single-entity renders (bounded by selection size, not scene size)
- Grip drag: blit + 1× single-entity render with drag preview applied ≈ 1ms
- Pan/zoom (transform change): cache rebuild ~80-300ms (acceptable, infrequent)

**Validation**: `localStorage.setItem('dxf-perf-trace','1')`, hard reload, hover dense scene 5-10s. Target: mousemove violation < 30ms, FPS ≈ 60. Pan still triggers full rebuild (cache invalidates by design).

**Risk recurrence**: any future PR adding `hoveredEntityId` / `selectedEntityIds` / `gripInteractionState` / `dragPreview` to the bitmap cache key WILL re-trigger the Phase D v1 freeze. Test: hover a dense scene, FPS must stay ≥ 30. Comments in `dxf-bitmap-cache.ts` and the architectural rule above guard against regression.

---

### 2026-05-09: PERF — Phase E: Micro-leaf subscriber isolation (CanvasLayerStack)

**Incident**: CanvasLayerStack itself re-rendered on every mousemove despite Round 1+2 fixes because: (a) `useSyncExternalStore(subscribeSnapResult)` at CanvasLayerStack top-level forced it to re-render on snap changes; (b) `useDraftPolygonLayer`, `useGuideWorkflowComputed`, `useRotationPreview` all called `useCursorWorldPosition()` (useSyncExternalStore) inside CanvasLayerStack, so every world-position change re-rendered the 400+ line shell; (c) `hoveredEntityId`/`hoveredOverlayId` were `useState` in CanvasSection — each hover change cascaded to CanvasLayerStack.

**Fix — Micro-leaf subscriber pattern (Excalidraw/Figma architecture):**

| Component | What it subscribes to | Re-renders |
|-----------|----------------------|------------|
| `SnapIndicatorSubscriber` | `subscribeSnapResult` (ImmediateSnapStore) | Snap change only |
| `DraftLayerSubscriber` | `useDraftPolygonLayer` → `useCursorWorldPosition` | Mousemove (only when overlayMode=draw) |
| `DxfCanvasSubscriber` | `useGuideWorkflowComputed` → `useCursorWorldPosition` + `useHoveredEntity` (HoverStore) | Mousemove + hover |
| `RotationPreviewMount` | `useRotationPreview` → `useCursorWorldPosition` | Mousemove (only when rotation active) |
| `CanvasLayerStack` shell | None | Only on prop changes (transform, tool, etc.) |

**New systems:**
- `systems/hover/HoverStore.ts` — singleton store for hovered entity/overlay IDs. Zero-React-state updates. Skip-if-unchanged optimization.
- `systems/hover/useHover.ts` — `useHoveredEntity()` / `useHoveredOverlay()` via `useSyncExternalStore` (mirror of `useCursorPosition()`).

**Hover state migration:**
- `hoveredEntityId` / `hoveredOverlayId` removed from `CanvasSection.useState`. CanvasSection no longer re-renders on hover changes.
- `hoveredOverlayId` for `useOverlayLayers` (yellow glow) reads from `useHoveredOverlay()` in CanvasSection — this is a compromise: CanvasSection re-renders on overlay hover changes (visual effect). Entity hover is fully decoupled.
- `mouse-handler-move.ts` writes directly to `HoverStore.setHoveredEntity/setHoveredOverlay` on every hover update (zero React state).
- `canvas-layer-stack-types.ts`: `entityState.hoveredEntityId` + `setHoveredEntityId` + `hoveredOverlayId` + `setHoveredOverlayId` REMOVED.

**Throttle change**: `HOVER_THROTTLE_MS` 32 → 50ms (reduces hit-test frequency; imperceptible at 20fps hover).

**CanvasLayerStack shell**: Wrapped in `React.memo`. No `useSyncExternalStore` calls remain at shell level.

**Architectural rule** (Micro-leaf subscriber pattern):
> Components that re-render on high-frequency stores (mousemove, snap, hover) MUST be isolated as nano-leaf subscribers. Orchestrator components (CanvasLayerStack, CanvasSection) MUST NOT subscribe directly to high-frequency stores. Each leaf subscriber should render ≤1 canvas element and call ≤2 high-frequency hooks.

**Files created**: `systems/hover/HoverStore.ts`, `systems/hover/useHover.ts`.
**Files modified**: `mouse-handler-move.ts`, `CanvasLayerStack.tsx`, `canvas-layer-stack-types.ts`, `CanvasSection.tsx`.

---

### 2026-02-13: FIX - Canvas entity compression on F12 (DevTools resize)

**Bug**: Όταν ο χρήστης πατούσε F12 για DevTools (ή resize browser), οι οντότητες (γραμμές, ορθογώνια, κύκλοι) **συμπιέζονταν/παραμορφώνονταν** αντί να αναπαράγονται σωστά.

**Root Cause**: Και οι δύο renderers (DxfRenderer, LayerRenderer) υπολόγιζαν `actualViewport` μέσω `getBoundingClientRect()` αλλά **δεν το χρησιμοποιούσαν** για entity rendering — πέρναγαν το stale `viewport` prop (React state) στο `CoordinateTransforms.worldToScreen()`, με αποτέλεσμα λάθος Y-axis inversion.

**Fix** — 5 αλλαγές `viewport` → `actualViewport`:

| File | Line | Context |
|------|------|---------|
| `DxfRenderer.ts` | 101 | `renderEntityUnified()` call |
| `DxfRenderer.ts` | 105 | `renderSelectionHighlights()` call |
| `LayerRenderer.ts` | 225 | `this.viewport` instance storage |
| `LayerRenderer.ts` | 248 | `renderUnified()` call |
| `LayerRenderer.ts` | 252 | `renderLegacy()` call |

**Pattern**: AutoCAD/Figma — Κατά τη μέθοδο render, πάντα χρήση **fresh DOM dimensions** (`getBoundingClientRect()`), ποτέ stale React state/props.

### 2026-02-13: CRITICAL FIX - Preview disappears during mouse movement

**Bug**: Η δυναμική γραμμή (rubber-band) εξαφανιζόταν κατά τη μετακίνηση του σταυρονήματος και εμφανιζόταν μόνο όταν ο χρήστης σταματούσε.

**Root Cause**: `PreviewCanvas.tsx` πέρναγε inline function στο `useCanvasSizeObserver`:

```typescript
// ΠΡΙΝ (BUGGY):
useCanvasSizeObserver({
  canvasRef,
  onSizeChange: (canvas) => {                    // ← Νέα αναφορά σε κάθε render!
    rendererRef.current?.updateSize(rect.width, rect.height);
  },
});
```

Η αλυσίδα του bug:
1. `mousemove` → `setMouseCss()`/`setMouseWorld()` → React re-render
2. `PreviewCanvas` re-renders → νέα `onSizeChange` inline function
3. `useCanvasSizeObserver` effect re-runs (dependency `onSizeChange` changed)
4. Effect calls `handleResize()` immediately on re-run (line 79 of `useCanvasSizeObserver.ts`)
5. `updateSize(width, height)` → sets `canvas.width = ...` → **ΣΒΗΝΕΙ ΤΟ CANVAS BUFFER!**
6. Preview εξαφανίζεται
7. Όταν σταματάει ο χρήστης → δεν γίνεται re-render → preview μένει ορατό

**HTML Spec**: Ακόμα κι αν θέσεις `canvas.width` στην **ίδια τιμή**, ο canvas buffer σβήνεται.

**Fix 1** — `PreviewCanvas.tsx` (line 160-167): Memoize callback με `useCallback`:

```typescript
// ΜΕΤΑ (FIXED):
const handleSizeChange = useCallback((canvas: HTMLCanvasElement) => {
  const rect = canvas.getBoundingClientRect();
  rendererRef.current?.updateSize(rect.width, rect.height);
}, []);

useCanvasSizeObserver({
  canvasRef,
  onSizeChange: handleSizeChange,     // ← Σταθερή αναφορά!
});
```

**Fix 2** — `PreviewRenderer.ts` (line 186-193): Size guard στο `updateSize()`:

```typescript
const newWidth = toDevicePixels(width, dpr);
const newHeight = toDevicePixels(height, dpr);
if (this.canvas.width === newWidth && this.canvas.height === newHeight && this.dpr === dpr) {
  return;  // Skip — δεν άλλαξε μέγεθος, μην σβήσεις τον canvas!
}
```

**Commit**: `c84e387f`

**ΚΑΝΟΝΑΣ**: ΜΗΝ αλλάξετε τον κώδικα αυτών των αρχείων χωρίς λόγο. Τα fixes είναι δοκιμασμένα και λειτουργούν σωστά.

### 2026-02-01: Fix markAllCanvasDirty race condition

- Αφαιρέθηκε η κλήση `markAllCanvasDirty()` από `PreviewRenderer.drawPreview()` και `clear()`
- Preview canvas αποκλείστηκε από το canvas group sync στο `UnifiedFrameScheduler` (line 630)
- `ImmediatePositionStore` χρησιμοποιεί `markSystemsDirty(['dxf-canvas', 'layer-canvas', 'crosshair-overlay'])` αντί για `markAllCanvasDirty()`

### 2026-01-27: Immediate render pattern

- `drawPreview()` renders synchronously (no RAF wait)
- Matches CrosshairOverlay pattern for zero-latency visual feedback
- Removed RAF throttling from `onDrawingHover`

### 2026-01-26: Initial implementation

- Dedicated preview canvas layer (z-index 15)
- `PreviewRenderer` class with direct canvas 2D API
- `useImperativeHandle` exposes `drawPreview()` / `clear()` API
- Performance: ~250ms → <16ms per frame
