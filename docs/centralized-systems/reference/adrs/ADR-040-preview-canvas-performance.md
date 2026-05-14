# ADR-040: Preview Canvas Performance

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Last Updated** | 2026-05-12 |
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

### 2026-05-15: ADR-348 Scale Command — ScalePreviewMount aggiunto alle micro-leaves

`canvas-layer-stack-leaves.tsx`: aggiunto `ScalePreviewMount` e `ScalePreviewMountProps` seguendo il pattern micro-leaf esistente (identico a `MirrorPreviewMount`). Mount zero-JSX che chiama `useScalePreview` per il preview RAF-based a 60fps. `PreviewCanvasMountsProps` e `PreviewCanvasMounts` JSX aggiornati con prop `scale`. `canvas-layer-stack-types.ts`: aggiunto `scalePreview: Record<string, never>` (il preview legge tutto da `ScaleToolStore` — zero prop esterne necessarie). `CanvasLayerStack.tsx`: destructuring + pass-through `scalePreview`. `CanvasSection.tsx`: import `useScaleTool`, call hook, wiring di `scaleIsActive`/`handleScaleClick` → `useCanvasClickHandler`, `handleScaleEscape`/`handleScaleKeyDown`/`scaleIsActive` → `useCanvasKeyboardShortcuts`, `scalePreview={{}}` → `CanvasLayerStack`. Constraint CHECK 6C rispettato: `ScaleToolStore` non chiama `useSyncExternalStore` nell'orchestratore (`CanvasSection`) — il subscribe vive solo in `ScalePreviewMount` (leaf).

---

### 2026-05-14: fit-to-view dopo import DXF — EventBus path

`useSceneState.ts`: rimpiazzato `canvasOps.fitToView()` (path via `dxfRef.current`) con `EventBus.emit('canvas-fit-to-view', { source: 'auto' })` nel timeout post-import (200ms). Il path EventBus è canonico (`useFitToView` listener legge `dxfScene` dallo stato React — sempre fresco dopo il commit), eliminando la dipendenza da `dxfRef.current` che poteva essere null/stale durante il re-render. Questo assicura il fit-to-view automatico dopo ogni import DXF (wizard incluso).

### 2026-05-12: SSoT unification — `selectedEntityIds` derived from `universalSelection`

`CanvasSection.tsx`: rimosso `useState<string[]>([])` per `selectedEntityIds`. La selezione delle entità DXF ora è **derivata** da `universalSelection.getIdsByType('dxf-entity')` (Context-based, già reattivo nell'orchestratore — niente `useSyncExternalStore`, CHECK 6C rispettato).

- **Nuovo pattern**: `selectedEntityIds = useMemo(() => universalSelection.getIdsByType('dxf-entity'), [universalSelection])`.
- `setSelectedEntityIds` ora è un `useCallback` che dispatcha attraverso `universalSelection.clearByType('dxf-entity')` + `addMultiple(...)` — scrive direttamente nello SSoT.
- `getSelectedEntityIds` (getter ADR-040 cardinal rule 2 per event-time reads in `useTextDoubleClickEditor`) ora legge `universalSelectionRef.current.getIdsByType('dxf-entity')` — niente più `selectedEntityIdsRef`.
- Listener `canvas:select-all`: rimossa la doppia scrittura manuale a `universalSelection.clearAll/selectMultiple`; ora basta `setSelectedEntityIds(ids)` (SSoT-aware).
- Escape guard: `hasAnySelection: universalSelection.count() > selectedEntityIds.length` sostituisce il check overlay-only — copre tutti i tipi non-DXF (overlay, color-layer, ecc.).
- `clearEntitySelection`: semplificato a `universalSelectionRef.current.clearAll()` — un solo dispatch.

**Perché**: eliminata la doppia-scrittura manuale (local React state + `universalSelection`) che richiedeva sync esplicito ad ogni call-site. La selezione DXF ha ora **una sola fonte di verità**. I bug come "Escape non deseleziona overlay" (Fix 4 del 2026-05-12) sono root-cause-fixed: non più dipendenti dal sync corretto fra due contenitori.

**Constraint preservato**: `CanvasSection` non chiama `useSyncExternalStore` (CHECK 6C OK). La reattività viene da `useContext(SelectionContext)` interno a `useUniversalSelection` — Context si rerenderizza solo su selection change (frequenza basse, non high-freq), quindi acceptable nell'orchestratore.

**File modificati**: `CanvasSection.tsx`.

---

### 2026-05-12: AutoCAD-style selection indicator on crosshair

`CrosshairOverlay.tsx`: aggiunto indicatore "+" / "−" in stile AutoCAD all'angolo
superiore destro del gap centrale del crosshair.
- Nuovo file `canvas-v2/overlays/crosshair-selection-indicator.ts`: funzione pura
  `drawSelectionIndicator(ctx, cx, cy, gap, mode)` — sfondo scuro semitrasparente
  + simbolo verde ("+" add) o rosso ("−" remove).
- `CrosshairOverlay`: subscribe a `HoverStore.subscribeHoveredEntity()` — quando
  mouse entra su entità, badge appare immediatamente (trigger re-render diretto via
  `getImmediatePosition()` + `renderCrosshair()`). Subscribe a `keydown/keyup` per
  Shift: `shiftHeldRef` → mode '−' quando Shift tenuto, '+' altrimenti.
- `CanvasLayerStack.tsx`: passa `isEntitySelected={(id) => selectedEntityIds.includes(id)}`
  a CrosshairOverlay.

### 2026-05-12: Ghost preview — grip drag + new TEXT entities

**Bug 1 — Grip drag ghost:** `DxfRenderer.renderEntityUnified()`: quando `options.dragPreview?.entityId === entity.id`, applica `ctx.globalAlpha = 0.45` attorno a `entityComposite.render()`. L'entità ora appare semi-trasparente durante grip drag (coerente con MOVE tool).
Nascosti grip durante drag ghost (`showGrips: false`, `grips: false`).

**Bug 2 — New TEXT entity ghost:** `useMovePreview.drawTranslatedGhostEntity()`: `case 'text':` ora gestisce sia `.text` (flat, entità importate) che `.textNode.paragraphs` (AST, entità create dal TEXT tool). Aggiunto `case 'mtext':` che condivide la stessa logica. Ghost ora appare per tutte le entità testo durante MOVE tool multi-select.

---

### 2026-05-12: Grid axis/origin defaults — SSoT centralization

`config/grid-axis-defaults.ts` creato come unico SSoT per `showAxes`, `showOrigin`,
`axesColor`, `axesWeight`. Tutti e 5 i punti di consumo ora importano da lì:
`GridTypes.ts`, `rulers-grid/config.ts`, `CanvasSettings.ts`,
`useCanvasSettings.ts` (fallback), `LegacyGridAdapter.ts` (fallback).
`rulers-grid-state-init.ts`: migration `migrateAdaptiveFadeDefaults` forza il
valore SSoT anche su sessioni persistite (Firestore/localStorage).
Default: `showAxes: false` (linee assi infinite disabilitate — distraggono).

---

### 2026-05-12: TEXT entity hover glow — fill-based pre-pass

`TextRenderer.ts`: aggiunto glow pre-pass per hover delle entità TEXT/MTEXT.
Il pre-pass disegna il testo in giallo (`HOVER_HIGHLIGHT.ENTITY.glowColor`) a
bassa opacità (`glowOpacity = 0.35`) prima del pass principale — analogo al
double-stroke pre-pass usato da LINE/ARC in `renderWithPhases()`, ma adattato
per `fillText` invece di `strokePath`.

`render()` refactored: estratti `extractRichStyle()`, `renderTextGlowPrePass()`,
`renderTextContent()` per rispettare il limite 40 righe/funzione (N.7.1).
Rimosso il commento fuorviante "glow only from PhaseManager" (era già falso).

---

### 2026-05-12: ADR-344 Phase 6.E — in-canvas TipTap text editor (DBLCLKEDIT)

`components/dxf-layout/CanvasSection.tsx`: mounts `useTextDoubleClickEditor`.
The hook holds `editingState: { entityId, initial, anchorRect } | null` with
`useState` and exposes a `handleDoubleClick` callback. CanvasSection threads
the callback through `containerHandlers.onDoubleClick` (new optional field on
`canvas-layer-stack-types.ts`) and renders `<TextEditorOverlay>` conditionally
when `editingState != null`.

Selection is passed via a getter (`getSelectedEntityIds: () =>
selectedEntityIdsRef.current`), not a snapshot — cardinal rule 2. The ref is
refreshed every render so event-time reads always observe the latest
selection even if the orchestrator skips an upstream render. The double-click
handler activates only when `selectedEntityIds.length === 1` and the entity is
TEXT/MTEXT; picking-at-point for unselected entities arrives once the canvas
exposes a public hit-test API (deferred — outside ADR-040 scope).

`CanvasLayerStack.tsx`: the wrapper `<div>` now binds
`containerHandlers.onDoubleClick` next to the existing mouse handlers. No new
subscription added — `onDoubleClick` is a DOM event handler that fires only on
an actual user double-click.

**ADR-040 compliance verified**:
- Cardinal rule 1 (no orchestrator subscriptions): unchanged. The hook uses
  `useState` + `useCallback` + `useCurrentSceneModel` (low-rate scene swap)
  + `useDxfTextServices` (memoised on level/scene change). No
  `useSyncExternalStore` introduced anywhere in the new path.
- Cardinal rule 2 (event-time reads): `getSelectedEntityIds` is a getter,
  never a snapshot.
- Cardinal rule 3 (bitmap cache key): untouched — the TipTap overlay is a
  React DOM element on top of the canvas; the bitmap cache is unaware of it,
  so selection / editing state cannot pollute its key.
- Cardinal rule 4 (leaf subscriber load): unchanged — the new code paths run
  only on user double-click and Enter+Ctrl commit (human-event rate).

### 2026-05-12: ADR-344 Phase 11.C — annotative scaling pipeline integration

`rendering/core/EntityRendererComposite.ts`: `render()` now passes every entity
through `resolveAnnotativeEntity()` (new helper in
`rendering/entities/annotative-resolver.ts`) before dispatching to the
entity-specific renderer. For annotative TEXT/MTEXT entities the helper
returns a shallow clone with `height` replaced by the viewport-active scale's
`modelHeight`; all other entities pass through unchanged.

`TextRenderer.ts` is intentionally untouched — its file-level lockdown comment
forbids embedding annotation scaling inside the renderer. The pre-render
resolver pattern keeps the renderer simple-path (`height × scale`) intact.

`systems/viewport/ViewportStore.ts`: `setActiveScale` / `setScaleList` now call
`markSystemsDirty(['dxf-canvas'])` so that a viewport scale change triggers an
immediate frame redraw — mirrors `ImmediateTransformStore` Phase XIII pattern.

`dxf-bitmap-cache.ts`: added `activeAnnotationScale: string` to `CacheKey`.
`isDirty()` now reads `getActiveScaleName()` from `ViewportStore` and compares
against cached value. Cache invalidates when viewport annotation scale changes,
preventing stale renders after scale switch (e.g. 1:50 → 1:100).

**Micro-leaf catalog**: `ViewportStore` is a new plain-singleton SSoT for the
viewport annotation scale; it conforms to ADR-040 cardinal rules — getter at
event time (no `useSyncExternalStore` in `EntityRendererComposite` or
`dxf-bitmap-cache`), granular `subscribeActiveScale` / `subscribeScaleList`
for React leaves via `ViewportContext.tsx` hooks.

### 2026-05-11: NEW — mouse-handler-move reads GripSnapStore for crosshair snap

`mouse-handler-move.ts`: on every mouse-move, if `getLockedGripWorldPos()`
returns a position (grip hovered), convert world→screen via
`CoordinateTransforms.worldToScreen` and call `setImmediatePosition` with
the grip screen position instead of the raw cursor. Crosshair locks to grip.

### 2026-05-11: NEW — GripSnapStore: crosshair lock-to-grip on hover

`systems/cursor/GripSnapStore.ts` — module-level store (ADR-040 pattern:
no React state, subscriber-free, read at event time).
`lockGripSnapPosition(worldPos)` called on grip hover enter;
`unlockGripSnapPosition()` on hover exit and drag start.
Mouse-move handler reads `getLockedGripSnapPosition()` to override
`setImmediatePosition` so the crosshair snaps to the grip center.

### 2026-05-11: BUGFIX — Cursor gap toggle now respected by CrosshairOverlay

`CrosshairOverlay.tsx:173` — `centerGap` calculation now gates on `settings.crosshair.use_cursor_gap`.
When `false` → `centerGap = 0` → lines continuous through center (AutoCAD-style).
When `true` → existing `max(pickboxSize+4, center_gap_px||5)` logic unchanged.
Bug: toggle wrote to `use_cursor_gap` correctly but overlay never read the flag.

### 2026-05-11: MINOR — Gate crosshair overlay on dxfScene readiness

`CanvasLayerStack.tsx` now passes `crosshairSettings.enabled && !!dxfScene`
to `CrosshairOverlay isActive`. Prevents the overlay from rendering / running
its RAF loop before a scene is loaded. No subscription change, no new
high-frequency reads — pure guard.

### 2026-05-11: MINOR — Ruler border config wiring (CanvasLayerStack)

`CanvasLayerStack.tsx` `coreSettings` memo now reads `borderColor` / `borderWidth`
from `globalRulerSettings.horizontal.*` instead of hardcoding `borderWidth: 1`
and reusing the ruler's general `color`. No architectural change — the shell
still does not subscribe to high-frequency stores. Settings flow only.

### 2026-05-11: ARCH — Phase XIII: TransformStore SSoT — kill DxfViewerContent / MainContentSection re-render storm on pan/zoom

**Incident (Firefox profiler, hover/pan, post-Phase XII baseline):** `RefreshDriverTick` stuck at **32-38%**. Chain dominated by `VoidFunction → scheduleImmediateRootScheduleTask → renderRootSync → workLoopSync → performUnitOfWork → updatePerformanceWithHooks → beginWork` with a **22% Provider** sub-band cascading into Menu / Tooltip / TooltipPortal / DropdownMenu / ZoomControls / ScreenshotSection / FloorpianImportWizard / RulerCornerBox / CentralizedAutoSaveStatus / DialogPortal / ResizeConfirmDialog. None of those are inside the canvas drawing path — they are UI siblings, toolbars, and dialogs.

**Root cause:** `useCanvasTransformState` (called from `DxfViewerContent` line 131) held the viewport transform in a `useState`. Every pan RAF frame fired `wrappedHandleTransformChange` → `setCanvasTransform(normalizedTransform)` → `DxfViewerContent` re-rendered → `MainContentSection` (React.memo) bailed because the `canvasTransform` prop carried a fresh object reference → the entire MainContent subtree (DXFViewerLayout → NormalView → ToolbarSection + CanvasSection + CadStatusBar) cascaded. The visible Provider 22% in the profile was the cumulative cost of those subtree renders triggered by the orchestrator state change, **not** a Context.Provider value problem.

**Fix:** Promote viewport transform from `useState` to the existing `ImmediateTransformStore` singleton (the same store already used by DxfRenderer / LayerRenderer for zero-lag synchronous canvas reads). React leaves that need the value subscribe via `useSyncExternalStore`; orchestrators read getters at event time. Pattern is identical to Phase III/V/XI: `ImmediatePositionStore` (cursor), `HoverStore` (hover), `SelectionStore` (drag selection).

**Store changes (`systems/cursor/ImmediateTransformStore.ts`):**

1. Three granular subscriber sets — `fullListeners`, `scaleListeners`, `offsetListeners` — notified only on the relevant delta. `updateImmediateTransform` compares prev vs next per field.
2. `useSyncExternalStore`-compatible hooks: `useTransformValue()` (full) and `useTransformScale()` (scale-only).
3. `subscribeTransform` / `subscribeTransformScale` / `subscribeTransformOffset` exports.
4. Canonical `TransformStore` facade — `{ get, set, subscribe, subscribeScale, subscribeOffset }` — for new consumers.

**Orchestrator changes:**

- `hooks/state/useCanvasTransformState.ts` — `useState` removed. The hook now writes through `updateImmediateTransform` and returns only `{ setCanvasTransform, reset, isInitialized }`. Init effect (from `canvasOps.getTransform()`) and the `dxf-zoom-changed` EventBus listener (layering mode) both write directly to the store. `getMetrics` removed (was unused).
- `app/DxfViewerContent.tsx` — destructures only `setCanvasTransform`. `canvasTransformRef` and `isInitializedRef` removed. `canvasTransform` prop dropped from `MainContentSection` call. `TransformProvider initialTransform` reads `getImmediateTransform()` once.
- `app/useDxfViewerEffects.ts` — `canvasTransform`, `setCanvasTransform`, `canvasOps`, `isInitializedRef`, `canvasTransformRef` params removed. Three duplicate effects deleted (transform init, ref sync, layering-mode zoom listener) — all logic now owned by `useCanvasTransformState` and writes directly to the store.
- `app/useDxfViewerCallbacks.ts` — `wrappedHandleTransformChange` drops the redundant `ZoomStore.setScale` call. `setCanvasTransform` writes through the store, which fans out scale subscribers automatically.
- `layout/MainContentSection.tsx` — `canvasTransform` prop removed from `MainContentSectionProps`. `transform` no longer passed to `DXFViewerLayout` (downstream consumers — `CanvasSection`, `CanvasLayerStack` — already read transform from `CanvasContext` or the store).
- `hooks/useOverlayDrawing.ts` — `canvasTransform` prop removed. Hook subscribes to `useTransformScale()` for the scale-only reads (`useSnapManager` tolerance, polygon-close pixel→world conversion). Re-renders only when scale changes, not on pan.
- `systems/zoom/ZoomStore.ts` — `ZoomStore` is now a thin facade over `ImmediateTransformStore`: `getScale` reads from `getImmediateTransform()`, `setScale` writes via `updateImmediateTransform`, `subscribe` delegates to `subscribeTransformScale`. Single SSoT — `useCurrentZoom` and `useTransformValue` always agree.

**Expected impact (validation pending profiler re-run):**

- `DxfViewerContent` no longer re-renders on pan/zoom — it does not subscribe to the transform value.
- `MainContentSection` React.memo stays stable across transform updates — `canvasTransform` is no longer a memo-busting prop.
- ToolbarSection / CadStatusBar / SidebarSection / FloatingPanelsSection / TestsModal / FloorplanBackgroundPanel / dialogs are siblings outside the canvas subtree and inherit the win — they skip rendering entirely on pan.
- `CanvasSection` still re-renders on pan via its `useCanvasContext()` subscription to `CanvasContext.transform` (cardinal-rule-#1 violation remaining). That cascade is now scoped to the canvas subtree only and is deferred to Phase XIV (orchestrator → leaf subscription split for canvas-side too).

**Architectural pattern:** Identical to `ImmediatePositionStore` / `HoverStore` / `SelectionStore`. All high-frequency state in this subapp is owned by a module-level singleton with selective `useSyncExternalStore` hooks; orchestrators read via getters at event time and never `useState` high-freq values.

---

### 2026-05-11: PERF — Phase XII: DxfCanvas register-effect once-per-mount via paramsRef SSoT

**Incident (Firefox profiler, post-Phase XI baseline)**: After Phase XI eliminated the LayerCanvas render-callback storm (`useLayerCanvasRenderer.useEffect.unsubscribe` 13% → 0.1%) and the `refreshBounds` reflow (23% → 0%), a residual hot band remained on `useDxfCanvasRenderer.useEffect.unsubscribe` at **7.8%** (68 unsubscribe samples / 5.2s ≈ **13Hz**) inside `RefreshDriverTick` (still ~34%). FPS stabilized but not yet at flat 60.

**Root cause:** Phase XI applied the `volatileRef` partial fix to `useDxfCanvasRenderer` (`renderOptions` / `gridSettings` / `rulerSettings` consolidated), but `renderScene` `useCallback` deps were left as `[scene, refs, entityMap]`. `entityMap` is a `useMemo([scene])`, so any new `scene` identity propagated through `entityMap → renderScene → registerRenderCallback effect`. Combined with `viewport.width / viewport.height` in the register-effect deps, sub-pixel viewport oscillation (HiDPI / `ResizeObserver` float `contentRect`) plus parent-side `scene` reference churn produced the 13Hz unsubscribe/re-register cadence.

**Fix (Strategy B — single ref SSoT, mirrors Phase XI layer-canvas pattern):**

1. **`paramsRef` consolidation** (`dxf-canvas-renderer.ts:107-113`) — collapse `volatileRef` (3 fields) into a single `paramsRef` holding **all** per-frame volatile state: `{ scene, entityMap, renderOptions, gridSettings, rulerSettings }`. Synced render-by-render. Same SSoT pattern as `paramsRef` in `layer-canvas-hooks.ts:140-141`.
2. **`renderScene` deps reduced to `[refs]`** (line 245) — was `[scene, refs, entityMap]`. Reads everything from `paramsRef.current` at frame time. `refs` is `useMemo([], ...)` in `DxfCanvas.tsx:259-266` → stable. `renderScene` identity now **invariant** for hook lifetime.
3. **Register effect runs once per mount** (`dxf-canvas-renderer.ts:268-283`) — deps reduced from `[renderScene, viewport.width, viewport.height, refs.rendererRef]` to `[renderScene, refs]`. Viewport + renderer guards moved **inside** the frame callback (read from `refs.resolvedViewportRef.current` / `refs.rendererRef.current` at frame time, not at effect time). Killed the last source of unsubscribe churn — viewport sub-pixel oscillation no longer triggers re-registration.

**Files modified:**
- `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/dxf-canvas-renderer.ts` (Phase XII core fix)

**Expected profiler delta:**
- `useDxfCanvasRenderer.useEffect.unsubscribe`: **7.8% → <1%** (single subscribe at mount, single unsubscribe at unmount)
- `RefreshDriverTick`: 34% → expected ~25-28% (residual is now legitimate frame work + GC)
- FPS: stable 60 across hover / pan / snap

**Architectural rule reinforced (cross-reference layer-canvas Phase XI):** Render callbacks registered with `UnifiedFrameScheduler` MUST run **once per mount**. All volatile per-frame state lives in a single `paramsRef` synced render-by-render. `useCallback` deps for the registered render function MUST be `[refs]` only (where `refs` itself is a stable `useMemo([], ...)` bundle). Register-effect deps MUST be `[renderFn, refs]`. Never include primitive viewport dimensions in register-effect deps — read from `resolvedViewportRef.current` inside the frame callback instead. This is now the canonical SSoT pattern for all canvas renderers in this subapp.

**Pre-existing `renderScene` size violation (N.7.1):** `renderScene` is ~130 lines (limit 40). Unchanged by Phase XII — pre-existing, not introduced. Extraction deferred to a dedicated refactor phase to keep Phase XII focused on the perf root cause.

---

### 2026-05-11: PERF — Phase XI: Render callback identity stabilization + CanvasBounds cache reuse

**Incident (Firefox profiler, mouse hover/snap/drag on layer canvas)**: `RefreshDriverTick` at **36% CPU** with two sibling hot bands: `useLayerCanvasRenderer.useEffect.unsubscribe` **13%** and `useLayerCanvasRenderer.useCallback[renderScene]` **13%**, plus `refreshBounds`/`getBounds`/`updateBounds` summing **~23%** under "Update the rendering Layout". GC sawtooth visible in memory track. Top track filled with red bars (frames >16ms). DXF-side had been partially mitigated in Phase E (2026-05-09) but layer-side and DxfRenderer entity-overlay path were never converted.

**Root causes (two orthogonal architectural bugs):**

1. **Render-callback registration storm (60Hz)** — `useLayerCanvasRenderer` (`layer-canvas-hooks.ts:244-262`) declared 15 dependencies on its `renderLayers` `useCallback`: `[layers, snapResults, activeTool, layersVisible, draggingOverlay, renderOptions, crosshairSettings, cursorSettings, snapSettings, gridSettings, rulerSettings, selectionSettings, viewport.width, viewport.height, rendererRef, transformRef, resolvedViewportRef]`. `snapResults` is rebuilt on every mouse-move tick during snapping, `draggingOverlay` mutates during drag, `renderOptions` is an inline object recomputed in the parent on every hover update. Each new identity → new `renderLayers` → the downstream `useEffect([renderLayers, ...])` (lines 265-279) ran its cleanup (`unsubscribe()`) and re-registered the RAF callback with `UnifiedFrameScheduler`. At ~60Hz this generated the observed unsubscribe/re-register pair in the profiler and the GC churn from closure allocation per frame. `useDxfCanvasRenderer` (`dxf-canvas-renderer.ts:237`) had the same shape with `[renderOptions, gridSettings, rulerSettings]` — masked in the May 2026-05-09 recording only because the active interaction was over the layer canvas, but latent identical bug.

2. **Per-frame layout reflow via `refreshBounds`** — `LayerRenderer.render()` (`LayerRenderer.ts:180`), `DxfRenderer.render()` (`DxfRenderer.ts:83`), and `DxfRenderer.renderSingleEntity()` (`DxfRenderer.ts:158`) all called `canvasBoundsService.refreshBounds(this.canvas)`. `refreshBounds` deletes the cache entry then calls `getBounds`, which forces a fresh `getBoundingClientRect()` — a synchronous **layout-trigger DOM API**. Every frame paid one forced reflow; every selected/hovered entity overlay added an additional reflow on top (the loop in `renderScene` calls `renderSingleEntity` per selected/hovered/drag-preview entity). With 5 selected entities → 6 forced reflows per frame. The 2026-02-15 comment ("use FRESH bounds for both clear AND draw — single source of truth") was correct in intent (one rect for clear + draw) but achieved single-source by **wrongly invalidating the cache**; the rect was already kept identical by computing it once and threading it through both call sites. `CanvasBoundsService` has resize/scroll/orientation listeners that auto-invalidate the cache plus a 5000ms TTL safety net — `getBounds` is sufficient.

**Fix (GOL + SSoT, 4 files):**

1. **`layer-canvas-hooks.ts`** — replaced the multi-dep `useCallback` with a single `paramsRef` synced render-by-render (latest-props ref pattern, React docs §refs-as-escape-hatch). `renderLayers` reads `paramsRef.current.X` for every volatile field; deps shrink to `[rendererRef, resolvedViewportRef, selectionRef]` — only structural refs, never re-allocated → stable callback identity → register effect runs **once per mount**, not once per frame. Dirty-mark effect (lines 286-301) unchanged: still triggers on prop changes, which is correct (cheap boolean set, not the storm path).

2. **`dxf-canvas-renderer.ts`** — same pattern, scoped to volatile fields only (`renderOptions`, `gridSettings`, `rulerSettings`). `scene` and `entityMap` remain in the deps array because they drive the O(1) entity-lookup memo and change on actual data transitions, not per frame. `renderScene` deps: `[scene, refs, entityMap]`.

3. **`LayerRenderer.ts:180`** — `refreshBounds` → `getBounds`. Comment updated to document why caching is safe (event-based invalidation + TTL).

4. **`DxfRenderer.ts:83, 158`** — same swap at both render entry points. The `renderSingleEntity` call site is particularly load-bearing: prior code paid N+1 forced reflows per frame for N overlays.

**Why latest-props ref pattern (not split into N refs)**: each volatile prop in a separate `useRef` + `useEffect` would multiply the boilerplate without functional gain. The single-ref pattern is React-docs-canonical for "RAF callback that reads the latest props" — the assignment `paramsRef.current = params` during render is observable only by the RAF callback, never during render itself, so it satisfies React's render-purity rule.

**Why `getBounds` is safe in the hot path**: `CanvasBoundsService` (`src/subapps/dxf-viewer/services/CanvasBoundsService.ts`) registers global listeners on first call — `resize` (debounced 150ms), `scroll` (throttled 100ms, capture phase), `orientationchange` — and clears the cache on each. Plus `MAX_AGE_MS = 5000` TTL. Any DOM layout change that would invalidate the cached rect within a frame would also have triggered one of these events; the cache cannot drift undetected. The Feb 2026 comment about "implicit dependency" via `CanvasUtils.clearCanvas` no longer applies because the renderer computes `canvasRect` once per frame and passes it explicitly to both `clearRect` and the render call.

**Expected impact (from profiler baseline 36% RefreshDriverTick / 60fps unattainable):**
- `useLayerCanvasRenderer.unsubscribe` 13% → ~0% (effect no longer fires per frame)
- `useLayerCanvasRenderer.renderScene` 13% → still present but no longer rebuilt; pure render cost only
- `refreshBounds` + `getBounds` + `updateBounds` ~23% → ~1% (cache hit path is a Map.get + timestamp compare)
- Closure allocation per frame → eliminated → GC sawtooth flattens
- Total RefreshDriverTick: 36% → estimated **~8-12%**, FPS unlock to 60 stable on a typical hover/drag scenario

**Architectural rule added (CHECK 6B / 6D enforcement target)**: render-loop hooks (`use*CanvasRenderer`, `use*Renderer`) MUST follow the latest-props ref pattern. The `useCallback` for the render function MUST have a deps array containing only `useRef` refs (never props or memoized objects). Violations will be added to CHECK 6C scope in a follow-up commit.

**Files**:
- `src/subapps/dxf-viewer/canvas-v2/layer-canvas/layer-canvas-hooks.ts` (renderLayers ref pattern)
- `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/dxf-canvas-renderer.ts` (renderScene ref pattern for volatile params)
- `src/subapps/dxf-viewer/canvas-v2/layer-canvas/LayerRenderer.ts` (refreshBounds → getBounds)
- `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfRenderer.ts` (refreshBounds → getBounds, 2 sites)

**✅ Google-level: YES** — root cause fix at architectural layer (callback identity + cache semantics), no patch, no fallback. Pattern documented for enforcement.

---

### 2026-05-11: PERF — Phase IX: DxfRenderer viewport culling (per-entity AABB)

**Incident (PERF_LINE console dump, initial scene paint on 3263-entity DXF)**: `DxfCanvasRenderer.renderScene` ran in **9488ms** with `CanvasSection.commit` at 8326ms — every scene-set, fit-to-view, viewport-resize, or transform settle re-paid a full 3263-entity render. Single line completion was already fixed by Phase VIII (1498→48ms commit), but cold-load and pan/zoom remained CPU-bound on entity count.

**Root cause**: `DxfRenderer.render()` iterated **every** entity in `scene.entities` regardless of viewport. Industry-standard CAD viewers cull entities whose world-space bbox falls outside the visible viewport — typical hit rate on construction-grade DXF is 10–30% of entities visible per frame. The renderer had no culling path at all.

**Note on bitmap cache (Phase D, 2026-05-09)**: `DxfBitmapCache` is allocated in `dxf-canvas-renderer.ts:98` but is **not currently invoked** by `renderScene`. Activating it is deferred — the cache invalidates on every `transform.scale/offsetX/offsetY` change (i.e. every pan/zoom frame), so it primarily benefits hover/selection re-renders at a stable transform, not cold-load. Phase IX targets the actual hot path: the per-frame entity loop. Bitmap-cache activation may follow as Phase X if hover/selection profiling warrants it.

**Fix (GOL + SSoT, 2 files + 1 new):**
- **NEW `canvas-v2/dxf-canvas/dxf-viewport-culling.ts`** (~120 LOC): sole authority for entity bbox + viewport intersection. Exports `getEntityBBox(entity)` (O(1) for line/circle/arc/text/angle-measurement; O(vertices) for polyline), `viewportToWorldBBox(transform, viewport)` (inverse of the screen=world*scale+offset convention, padded by 32 screen pixels to avoid edge artefacts), `bboxIntersects(a, b)` (AABB overlap), and the high-level `isEntityInViewport(entity, worldViewport)` predicate. Arc bbox is conservative (full enclosing circle) — tighter quadrant-extrema math is not worth the per-entity CPU for a culling test. Text bbox uses a generous `height × length × 0.7` width estimate so partially-visible glyphs are never culled. Degenerate transform (`scale === 0`) returns an infinite bbox → culling auto-disables instead of crashing.
- **CHANGED `canvas-v2/dxf-canvas/DxfRenderer.ts:render()`**: compute `worldViewport` once per frame (just before the entity loop), then `if (!isEntityInViewport(entity, worldViewport)) continue;` between the existing `visible` guard and `renderEntityUnified`. Padding is screen-pixel based so culling tightens automatically at high zoom. Selection set rebuild is unchanged.

**Why proactive single SSoT module (not inlined in renderer)**: hit-testing, snap engine, and grip-rendering also iterate entities and may benefit from the same bbox helpers. A single canonical file means future culling-aware paths cannot drift from the renderer's intersection rules.

**Expected impact**: on a 3263-entity scene with viewport showing ~15-25% of entities, renderScene drops proportionally (estimated 9.5s → 1.5–2.5s cold, scaled by visible fraction). Pan/zoom intermediate frames see the same multiplier. No effect on cold-load CPU if the entire scene fits in the initial viewport (e.g. immediately after `fit-to-view`) — for that scenario, Phase X bitmap activation or off-main-thread tessellation would be the next lever.

**Files**:
- `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/dxf-viewport-culling.ts` (new)
- `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfRenderer.ts` (+culling call in render loop)

---

### 2026-05-11: PERF — Phase VIII: SnapEngine SSoT singleton + non-blocking scene-init

**Incident (1498ms React commit + ~3500–6000ms cumulative CPU per line completion — profiling-data.11-05-2026.01-16-24 + PERF_LINE console dump)**: Drawing a single line on a 3262-entity DXF froze the UI for ~1.5s of React commit and triggered **four** sequential `useSnapManager.initialize(n=3263)` runs (855 + 524 + 2223 + 2433 ms) — each rebuilding spatial indices for all 17 sub-engines. `completeEntity.TOTAL` was 44ms, `DxfRenderer.renderScene` was 79ms; **the only hot path was `SnapManager.initialize()`**.

**Root cause — TWO violations:**
1. **SSoT violation**: `useSnapManager()` instantiated `new ProSnapEngineV2()` per call. Three active call sites (`useDrawingHandlers`, `useOverlayDrawing`, `useCentralizedMouseHandlers`) → 3 engines, 3 spatial indices, 3 fingerprint refs, 3 `useEffect [scene, overlayEntities]` chains. Every scene change → up to 3× full O(N) rebuild.
2. **Critical-path violation**: `initialize(allEntities)` ran synchronously inside a React useEffect — blocking the commit's passive-effect phase. Combined with (1), the user-perceived freeze was multiplied by the number of consumer hooks.

**Fix (GOL + SSoT, 4 files + 2 new):**
- **NEW `snapping/global-snap-engine.ts`**: Module-level singleton (`getGlobalSnapEngine()` + shared fingerprint state). Identical pattern to `getGlobalGuideStore`, `HoverStore`, `ImmediatePositionStore`.
- **NEW `snapping/hooks/useGlobalSnapSceneSync.ts`**: Sole owner of scene-initialize lifecycle. Fingerprint guard (length + first-5 + last-5 entity ids) skips redundant runs when scene ref changes but geometry is identical. **Calls `initialize()` inside `requestIdleCallback` (250ms timeout fallback)** — moves the remaining O(N) rebuild OFF React's critical path. Snap may be stale for ≤1 frame after a scene change, which is acceptable: the user is not snapping while clicking to commit the entity that triggered the change.
- **`snapping/hooks/useSnapManager.tsx`**: Refactored from 267 to 99 lines. No `new ProSnapEngineV2()`. No scene-initialize useEffect. Returns the singleton. Per-canvas viewport sync (scale → engine) and SnapContext settings sync retained — both are O(1) and idempotent across consumers.
- **`components/dxf-layout/CanvasSection.tsx`**: Added one call to `useGlobalSnapSceneSync({ scene: props.currentScene })` next to `useDxfSceneConversion`. CanvasSection is the sole lifecycle owner (matches the orchestrator role established earlier in this ADR).

**Result**: 3 instances × O(N) sync rebuild → 1 instance × O(N) idle-callback rebuild. React commit unblocked. Expected: ~1500ms → <100ms perceived line-completion latency at N=3263; cumulative CPU on scene change reduced ~75%.

**New rules (this ADR):**
> **Snap Engine SSoT**: `ProSnapEngineV2` is a module-level singleton accessed via `getGlobalSnapEngine()`. Direct instantiation (`new ProSnapEngineV2()`, `new SnapManager()`) is FORBIDDEN outside `global-snap-engine.ts` (enforced by ssot-registry module `snap-engine`).
>
> **Scene initialize is owned by ONE hook**: `useGlobalSnapSceneSync()` is the sole caller of `snapEngine.initialize(entities)` and must be invoked exactly once per app — from `CanvasSection`. Other call sites are forbidden.
>
> **Scene-init runs off React's critical path**: the rebuild is scheduled via `requestIdleCallback` (`setTimeout` fallback). Snap consumers must tolerate ≤1 frame of staleness after a scene change.

**Files modified**: `snapping/global-snap-engine.ts` (NEW), `snapping/hooks/useGlobalSnapSceneSync.ts` (NEW), `snapping/hooks/useSnapManager.tsx`, `components/dxf-layout/CanvasSection.tsx`, `.ssot-registry.json`.

✅ Google-level: YES — root cause SSoT violation (3 engines for 1 scene); fix matches existing canonical patterns (`getGlobalGuideStore`/HoverStore/ImmediatePositionStore singletons + module-level fingerprint state); idle-callback deferral mirrors AutoCAD's "snap index rebuilt opportunistically" behaviour; backward-compatible (`useSnapManager` signature preserved, deprecated fields kept on options); ratchet-enforced in ssot-registry.

---

### 2026-05-10: PERF — Phase VII: CanvasContext split + ZoomStore — eliminates DxfViewerContent cascade on zoom

**Incident (121-234ms per zoom click + 56 Tooltip mass re-render — profiling-data.10-05-2026.19-22-34.json)**: React DevTools showed 5 pure `CanvasProvider` commits each taking 121-234ms during zoom in/out. Commit 23 showed 57 simultaneous updaters (56× `Tooltip` + 1× `CanvasProvider`) taking 131ms. Total: every zoom click triggered a full re-render of `DxfViewerContent` and ALL its children including the 56-tooltip sidebar.

**Root cause**: `CanvasContext` stored `transform` (scale, offsetX, offsetY) in React state via a single `useMemo([transform])`. Any component calling `useCanvasContext()` subscribed to ALL context changes including zoom. Three hooks called inside `DxfViewerContent` all subscribed:
1. `useDxfViewerState` → read `canvasContext.transform.scale` for `currentZoom` display
2. `useKeyboardShortcuts` → read `canvasContext.zoomManager` (always `undefined` — not in contextValue)
3. `useCanvasOperations` → read `context.dxfRef` and `context.transform` inside callbacks

Result: `CanvasContext` transform change → `DxfViewerContent` re-renders (it called all three hooks) → `SidebarSection` re-renders (prop `currentZoom` changed) → 56 `Tooltip` children inside sidebar re-render → 121-234ms total reconciliation per zoom click.

**Fix (7 files + 1 new)**:
- **NEW `systems/zoom/ZoomStore.ts`**: Module-level singleton (same pattern as `SelectionStore`). `ZoomStore.setScale(scale)` notifies `useSyncExternalStore` subscribers. `useCurrentZoom()` hook for leaf components.
- **`contexts/CanvasContext.tsx`**: Added `CanvasRefsContext` (stable, never changes) with `{ dxfRef, overlayRef, canvasRef, setTransform }`. Added `useCanvasRefs()` hook. Added `CanvasTransformContext` with `{ transform }`. `CanvasProvider` provides all three contexts. Legacy `useCanvasContext()` unchanged for `CanvasSection`.
- **`hooks/useKeyboardShortcuts.ts`**: Removed `useCanvasContext()` call (`zoomManager` was always `undefined` — was dead code).
- **`hooks/interfaces/useCanvasOperations.ts`**: Switched to `useCanvasRefs()` (stable). `getTransform()` now uses imperative `dxfRef.current.getTransform()` as primary path.
- **`hooks/useDxfViewerState.ts`**: Removed `useCanvasContext()` call. Removed `currentZoom` from return (leaf components subscribe to ZoomStore directly).
- **`app/useDxfViewerCallbacks.ts`**: `wrappedHandleTransformChange` now calls `ZoomStore.setScale(scale)` before updating CanvasContext.
- **Leaf components** (`layout/SidebarSection.tsx`, `ui/toolbar/EnhancedDXFToolbar.tsx`, `ui/toolbar/MobileToolbarLayout.tsx`): `useCurrentZoom()` called internally. `currentZoom` prop removed from their interfaces. Prop chain cleaned up in `DxfViewerContent.tsx`, `MobileSidebarDrawer.tsx`, `ToolbarSection.tsx`, `types/dxf-modules.d.ts`, `ui/toolbar/types.ts`.

**Result**: `DxfViewerContent` no longer subscribes to `CanvasContext` on zoom. Only `CanvasSection` (which genuinely needs transform) still subscribes. Zoom re-render scope reduced to `CanvasSection` subtree only. `SidebarSection` + 56 `Tooltip` → **zero re-renders on zoom**. `EnhancedDXFToolbar` subscribes to `ZoomStore` (lightweight `useSyncExternalStore`) — updates only the zoom% display text. Expected: 121-234ms → ~20-40ms per zoom click.

**New rule (extends ADR-040 context pattern)**:
> **Display-only values derived from high-frequency state (zoom%, cursor coordinates) MUST use external stores (`useSyncExternalStore`) and be consumed only by leaf display components.** Never thread them through orchestrator props — each prop change causes a full re-render of the receiving component and all its children.

**Files modified**: `systems/zoom/ZoomStore.ts` (NEW), `contexts/CanvasContext.tsx`, `hooks/useKeyboardShortcuts.ts`, `hooks/interfaces/useCanvasOperations.ts`, `hooks/useDxfViewerState.ts`, `app/useDxfViewerCallbacks.ts`, `app/DxfViewerContent.tsx`, `layout/SidebarSection.tsx`, `layout/MobileSidebarDrawer.tsx`, `ui/toolbar/EnhancedDXFToolbar.tsx`, `ui/toolbar/MobileToolbarLayout.tsx`, `components/dxf-layout/ToolbarSection.tsx`, `ui/toolbar/types.ts`, `types/dxf-modules.d.ts`.

✅ Google-level: YES — root cause correctly identified (context broadcast to non-subscribers); fix uses SSoT pattern (ZoomStore singleton + useSyncExternalStore, identical to SelectionStore/ImmediatePositionStore); no functionality removed; zoom% display still live via ZoomStore subscription; backward compat maintained via legacy useCanvasContext().

**Implementation notes (tsc verification)**:
- `useCanvasOperations` fallback in `zoomAtScreenPoint`: replaced `context.transform` (removed from `CanvasRefsContextType`) with `dxfRef.current?.getTransform?.()` — stays on the imperative-API path consistent with the primary flow.
- `useKeyboardShortcuts` dead zoom branches: `zoomManager` was typed as `never` after the TypeScript constant-fold of `null`. Branches removed entirely (they were unreachable — `zoomManager` was never populated in `contextValue`).

---

### 2026-05-10: REFACTOR — Phase VIII: Zoom path centralization

**Problem**: Zoom logic dispersed across 5 paths with inconsistent clamping and bypassed ZoomManager:
1. `useTouchGestures.ts`: pinch clamp hardcoded `[0.01, 1000]` instead of `ZOOM_LIMITS`
2. `useCentralizedMouseHandlers.ts`: wheel fallback used hardcoded `0.9/1.1` factors instead of `ZOOM_FACTORS`
3. `useDxfViewerState.ts`: `set-zoom` action called `setTransform({scale})` directly — no clamping, no imperative path
4. `RulerCornerBox.tsx`: received `currentScale` as prop from `CanvasLayerStack` — violated micro-leaf pattern (ADR-040 Phase VII)
5. `useCanvasOperations.ts`: no `zoomToScale` method — forced callers to bypass canonical path

**Fix (6 files)**:
- **`hooks/gestures/useTouchGestures.ts`**: Clamp now uses `ZOOM_LIMITS.MIN_SCALE` / `ZOOM_LIMITS.MAX_SCALE` from `transform-config`
- **`systems/cursor/useCentralizedMouseHandlers.ts`**: Wheel fallback factors → `ZOOM_FACTORS.WHEEL_OUT` / `ZOOM_FACTORS.WHEEL_IN`; added scale clamping via `TRANSFORM_SCALE_LIMITS`
- **`hooks/interfaces/useCanvasOperations.ts`**: Added `zoomToScale(scale, center?)` — clamped, computes factor from current transform, delegates to `zoomAtScreenPoint`
- **`hooks/useDxfViewerState.ts`**: `set-zoom` action → `canvasActions.zoomToScale(data)` (canonical imperative path + clamping)
- **`canvas-v2/overlays/RulerCornerBox.tsx`**: Removed `currentScale` prop; subscribes to `useCurrentZoom()` internally (micro-leaf SSoT pattern)
- **`components/dxf-layout/CanvasLayerStack.tsx`**: Removed `currentScale={transform.scale}` prop from `<RulerCornerBox>` JSX

**Result**: All zoom paths (button, pinch, toolbar input, wheel fallback) use consistent clamping from `transform-config`. `RulerCornerBox` is a proper micro-leaf subscriber — no prop drilling through orchestrator.

✅ Google-level: YES — consistent constants (one source), proper clamping everywhere, micro-leaf pattern completed.

---

### 2026-05-10: TOOLING — Visual regression test suite for DXF canvas

**Infrastructure added** to prevent future regressions on the ADR-040 performance architecture:

- `src/subapps/dxf-viewer/e2e/dxf-visual-regression.spec.ts` — 7 visual states: idle, fit-to-view, zoom-2×, zoom-0.5×, hover-entity (crosshair), selection-box, ruler-grid
- `src/app/test-harness/dxf-canvas/DxfCanvasHarness.tsx` — isolated dev-only harness; loads static JSON scene (no Web Worker), exposes `window.__dxfTest` API (fitToView, zoomIn, zoomOut)
- `public/test-fixtures/dxf/regression-scene.json` — deterministic scene fixture (4 lines, circle, arc, text)
- `playwright.config.ts` — `visual-dxf` project (Chromium 1280×800, 120s timeout, dedicated snapshot path)
- **Production guard**: `DxfCanvasHarness.prod.ts` stub + webpack alias in `next.config.js` — DXF viewer tree excluded from production bundle (zero CI/memory impact)
- **Baseline snapshots**: `src/subapps/dxf-viewer/e2e/__snapshots__/` (7 PNG, generated 2026-05-10)

Run: `npm run test:visual:dxf` | Update baselines: `npm run test:visual:dxf:update`

---

### 2026-05-10: PERF — Phase VI: DrawingStateMachine.moveCursor() — removed from updatePreview hot path

**Incident (38-102ms commits during circle/any entity drawing)**: Profiling file `profiling-data.10-05-2026.16-57-14.json` showed commits of 38-102ms (up to 6.4x the 16ms frame budget) during circle creation, triggered by 9 components simultaneously: ToolbarCoordinatesDisplay, ToolbarStatusBar, DraftLayerSubscriber, DxfCanvas, DxfCanvasSubscriber, RotationPreviewMount, SnapIndicatorSubscriber, **CanvasSection**, Anonymous. CanvasSection was silent (2 commits) during normal mousemove but appeared in EVERY commit during drawing.

**Root cause**: `updatePreview()` in `useUnifiedDrawing.tsx` called `machineMoveCursor(mousePoint)` on every mousemove during drawing. `DrawingStateMachine.moveCursor()` sends a `MOVE_CURSOR` event → `computeNewContext()` produces new context with `cursorPosition` → `executeTransition()` → `notifyListeners()`. `useDrawingMachine` subscribes via `useSyncExternalStore` → fires on every notify → `machineContext` updates → `state` useMemo in `useUnifiedDrawing` recomputes → `drawingHandlers` new ref → CanvasSection re-renders (13+ hooks) → cascade to 8 children → 40-100ms reconciliation at mousemove rate.

**Investigation**: `machineMoveCursor` was called with NO snap arguments (`snapped=false`, default), so `snapInfo` in machine context was always `{snapped: false, snapPoint: null, snapType: null}` — useless. `machineContext.cursorPosition` is defined in `DrawingContext` interface but never READ by any React component (grep confirmed zero reads). The machine cursor position served NO observable purpose — preview entity generation uses `mousePoint` directly (parameter to `generatePreviewEntity`, line 238-240).

**Fix** — `hooks/drawing/useUnifiedDrawing.tsx`:
- Removed `machineMoveCursor(mousePoint)` call from `updatePreview` (line 235)
- Removed `moveCursor: machineMoveCursor` from `useDrawingMachine` destructuring (now unused)
- Removed `machineMoveCursor` from `updatePreview`'s useCallback deps array
- Left comment explaining the intentional removal and why it's safe

**Result**: During drawing (circle/line/rectangle/etc.) — `DrawingStateMachine.notifyListeners()` no longer fires on every mousemove. `useDrawingMachine` useSyncExternalStore subscription stays silent. CanvasSection stays stable. Expected commits per mousemove-frame: 0 from CanvasSection (down from participating in every ~40-100ms commit). Only the correct micro-leaf subscribers (ImmediatePositionStore: ToolbarCoordinatesDisplay, DraftLayerSubscriber, etc.) update.

**Key rule** (extends drawing perf pattern):
> **`updatePreview` is a synchronous, imperative, zero-React function.** It writes to refs and calls canvas APIs directly. Any state machine notification inside it causes React re-renders on every mousemove during drawing. Machine state updates (moveCursor, addPoint) must only be called when they convey information actually consumed by React state — not as a side effect of the hot preview path.

**Files modified**: `hooks/drawing/useUnifiedDrawing.tsx`.

✅ Google-level: YES — root cause is state machine notification in hot path; fix is precise (single line removal); no functionality lost (cursorPosition in machine was never read; snapInfo was always false/null from this call); zero React re-renders during preview mousemove.

---

### 2026-05-10: PERF — Phase V: CrosshairOverlay — removed useSyncExternalStore subscription

**Incident (158 commits during mousemove — profiling-data.10-05-2026.16-37-33.json)**: React DevTools profiler showed `CrosshairOverlay` as the top updater component with 158 React commits (74.5% of all 212 commits) during a standard mouse-movement + selection interaction. This was MORE than `DxfCanvasSubscriber` (77) and `ToolbarCoordinatesDisplay` (76) combined.

**Root cause**: `CrosshairOverlay.tsx` called `useCursorPosition()` (line 77) which wraps `useSyncExternalStore(ImmediatePositionStore.subscribe, ImmediatePositionStore.getPosition)`. On every mousemove, `ImmediatePositionStore.setPosition()` notified all `useSyncExternalStore` subscribers → `CrosshairOverlay` re-rendered at native mouse rate (~120fps). The re-renders were entirely wasted: `CrosshairOverlay` rendering is already handled by two independent mechanisms:
1. `registerDirectRender` callback — called synchronously from `ImmediatePositionStore.setPosition()` (no RAF wait, no React reconciliation)
2. `registerRenderCallback` in UnifiedFrameScheduler — RAF fallback with `isDirty()` check

Neither mechanism needs a React re-render. The `cursorPosition` React value was used only to compute `effectiveIsActive = isActive && cursorPosition !== null` and to populate `renderArgsRef.current.pos` — both of which were already handled correctly by the direct render and RAF callbacks.

**Fix** — `CrosshairOverlay.tsx`:
- Removed `import { useCursorPosition }` from `useCursor`
- Removed `const cursorPosition = useCursorPosition()` (line 77)
- Removed `const effectiveIsActive = isActive && cursorPosition !== null` (line 80)
- Changed `renderArgsRef.current = { isActive: effectiveIsActive, pos: cursorPosition, margins }` → `{ isActive: isActive, pos: null, margins }`. RAF callback already reads `getImmediatePosition()` as primary source (line 367); `renderArgsRef.current.pos` was only a fallback and can safely be `null`.

**Result**: CrosshairOverlay will re-render ONLY on prop changes (`isActive`, `viewport`, `rulerMargins`, `className`, `style`) — all rare, user-driven. Zero React re-renders during mousemove. Crosshair canvas updates remain zero-latency via `registerDirectRender`.

**Key rule** (extends micro-leaf pattern):
> **Components that render via `registerDirectRender` or `registerRenderCallback` MUST NOT subscribe to `ImmediatePositionStore` via `useSyncExternalStore`.** The synchronous direct-render callback already fires at native mouse rate. Adding a React subscription only causes wasteful reconciliation without any visual benefit. Read position imperatively (`getImmediatePosition()`) inside the direct-render callback instead.

**Files modified**: `canvas-v2/overlays/CrosshairOverlay.tsx`.

✅ Google-level: YES — removed redundant React subscription; zero mousemove re-renders; crosshair rendering unaffected (handled by direct-render callback); `isActive` prop still correctly gates rendering via `renderArgsRef`; RAF fallback correctly reads `getImmediatePosition()`.

---

### 2026-05-10: FEAT — Ctrl+A select-all with >50 entity guard + rulers default-on + crash recovery

**Ctrl+A select-all** (`useKeyboardShortcuts.ts`, `DxfViewerContent.tsx`, `useDxfViewerEffects.ts`):
- `useKeyboardShortcuts` handles `(e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.code === 'KeyA'` → calls `onSelectAll?.()`
- `DxfViewerContent` provides `handleSelectAll = useCallback(() => setSelectedEntityIds(currentScene.entities.map(e => e.id)), [...])`
- `useDxfViewerEffects` guard: `if (selectedEntityIds.length > 50) return;` — prevents O(N²) grip rendering at 0fps when 3000+ entities selected

**Rulers default-on** (`systems/rulers-grid/config.ts`):
- `DEFAULT_RULER_SETTINGS.horizontal.enabled: false → true`
- `DEFAULT_RULER_SETTINGS.vertical.enabled: false → true`
- Rulers now visible on first load without requiring user action

**Rulers crash recovery** (`useUserSettingsRulersGridSync.ts`):
- If `firstSnapshot && !hasLocalPersistedState` and both rulers disabled → repair + write back to Firestore
- Prevents stale Firestore state overriding new defaults for existing users

---

### 2026-05-10: TOOLING — CHECK 6B upgraded to BLOCK + CHECK 6D added (canvas drawing regression prevention)

**Problem**: CHECK 6B was WARN-only — developers (and AI agents) could commit changes to DXF micro-leaf architecture files without updating ADR-040. No enforcement existed for canvas drawing behavior files (entity renderers, DxfCanvas, LayerCanvas, cursor/selection, rulers/grid, zoom/pan).

**Fix — two-tier enforcement in `scripts/git-hooks/pre-commit`**:
- **CHECK 6B (upgraded WARN→BLOCK)**: staging any micro-leaf architecture file (DxfRenderer, HoverStore, ImmediatePositionStore, UnifiedFrameScheduler, guide hooks, CanvasSection/CanvasLayerStack shell, bitmap cache) without ADR-040 staged → `exit 1`. Error message guides developer to this ADR changelog.
- **CHECK 6D (new BLOCK)**: staging any canvas drawing behavior file — `rendering/entities/`, `DxfCanvas.tsx`, `LayerCanvas.tsx`, `systems/cursor/`, `systems/hover/`, `systems/rulers-grid/`, `systems/snap/`, `DxfViewerContent.tsx`, `useDxfViewerEffects.ts`, `useKeyboardShortcuts.ts` — without any ADR/doc staged → `exit 1`. Covers entity colors, shapes, selection box, zoom, pan, snap, keyboard shortcuts.

**Two-tier architecture**:
| Check | Files | Requirement | Scope |
|-------|-------|-------------|-------|
| CHECK 6B | Micro-leaf arch (12 patterns) | ADR-040 specifically | Performance architecture |
| CHECK 6D | Canvas drawing behavior (10 patterns) | ANY ADR/doc staged | Visual behavior |

**Result**: Neither Claude Code agents nor human developers can commit canvas drawing changes without documenting them. Regression risk from undocumented behavioral changes is eliminated at the commit gate.

**Files modified**: `scripts/git-hooks/pre-commit`, `CLAUDE.md`.

✅ Google-level: YES — two complementary blocking checks cover all DXF canvas change paths; CHECK 6B (strict, specific ADR) + CHECK 6D (broad, any doc) = belt-and-suspenders; no false negatives for behavioral canvas changes.

---

### 2026-05-10: PERF — Phase IV: CoordinateDebugOverlay throttle (debug tool)

**Incident (70/140 commits from debug overlay)**: React DevTools profiler showed `CoordinateDebugOverlay` as the updater in 70 of 140 commits (50% of all re-renders) with durations up to 31ms. The overlay was the dominant performance noise in every profiling session, masking the real application hotspots.

**Root cause**: `window.addEventListener('mousemove', ...)` fired at native mouse rate (~120fps). Inside the handler: 4 separate `setState` calls (`setMouseScreen`, `setMouseWorld`, `setViewport`, `setCanvasRect`) + `getBoundingClientRect()` on every event. React 18 batches the 4 calls into 1 commit, but still 1 re-render per mousemove = ~120 commits/sec while active.

**Fix**:
- `debug/layout-debug/CoordinateDebugOverlay.tsx`: merged 4 `useState` into 1 `displayData` object. Added 100ms throttle gate in the handler — `setDisplayData` only fires when `performance.now() - lastRenderTime >= 100`. `getBoundingClientRect()` moved inside the throttle gate (avoids forced reflow every native frame). `currentValues` ref updated on every mousemove for clipboard copy accuracy (F1-F4 shortcuts always read fresh data).
- `systems/cursor/index.ts`: added `useSelectionState`, `SelectionStore`, `SelectionState` exports (missing from Phase III).

**Result**: CoordinateDebugOverlay commits reduced from ~70 → ~4 per 4s interaction (10fps tick). Profiling sessions now show application hotspots cleanly without debug overlay noise. Clipboard shortcuts (F1-F4) unaffected — they read from `currentValues` ref which updates at native rate.

**Files modified**: `debug/layout-debug/CoordinateDebugOverlay.tsx`, `systems/cursor/index.ts`.

✅ Google-level: YES — debug tool throttled to appropriate rate; clipboard reads ref (always fresh); single setState prevents multiple reconcile passes; getBoundingClientRect batched with render tick.

---

### 2026-05-10: PERF — Phase III: SelectionStore — selection state removed from React reducer

**Incident (135 re-renders / 4104ms during selection drag)**: Profiler showed CursorSystem re-rendering ~30ms each (above 16ms threshold), 135 times during user interaction. At 33 re-renders/sec this is essentially 30fps reconciliation of the entire CursorSystem subtree.

**Root cause**: `cursor.updateSelection(screenPos)` in `mouse-handler-move.ts:239` dispatched `UPDATE_SELECTION` to `useReducer` on every mousemove during selection drag → new `state` object → new `contextValue` (memoized on `[state, actions]`) → `CursorContext.Provider` re-rendered its entire subtree (DxfCanvas, LayerCanvas, toolbar, all panel components).

**Fix — `SelectionStore` singleton (same pattern as `ImmediatePositionStore`)**:
- `systems/cursor/SelectionStore.ts` (NEW): pure TS singleton holding `isSelecting`, `selectionStart`, `selectionCurrent`. `updateSelection` has equality guard (no notify if same point). `subscribe/getSnapshot` are `useSyncExternalStore`-compatible.
- `systems/cursor/useCursor.ts`: added `useSelectionState()` hook via `useSyncExternalStore(SelectionStore.subscribe, SelectionStore.getSnapshot)`.
- `systems/cursor/CursorSystem.tsx`: removed `START_SELECTION`, `UPDATE_SELECTION`, `END_SELECTION`, `CANCEL_SELECTION` from `CursorAction` type and `cursorReducer`. Action creators route to `SelectionStore` instead. `contextValue` exposes `get isSelecting/selectionStart/selectionCurrent` getters (live reads from store) — event handlers (`mouse-handler-move/up`) get fresh data without triggering re-renders.
- `canvas-v2/dxf-canvas/DxfCanvas.tsx`: added `useSelectionState()` subscription. `selectionStateRef` and `useDxfCanvasRenderer` params now read from `selectionState` instead of `cursor`.
- `canvas-v2/layer-canvas/LayerCanvas.tsx`: added `useSelectionState()` subscription. `useLayerCanvasRenderer` cursor selection fields read from `selectionState`.

**Result**: During selection drag — CursorSystem provider stays stable (state unchanged). Only `DxfCanvas` and `LayerCanvas` re-render (they have the direct `SelectionStore` subscription). The remaining ~130 cascaded re-renders of all other CursorSystem subtree children are eliminated.

**Architectural rule** (extends micro-leaf pattern):
> **High-frequency state that triggers re-renders must live outside the CursorContext reducer.** `SelectionStore` and `ImmediatePositionStore` are the canonical stores for mousemove-driven data. React components that need to *react* to these changes subscribe directly via `useSyncExternalStore`. Event handlers read via getters on the contextValue object.

**Files created**: `systems/cursor/SelectionStore.ts`.
**Files modified**: `systems/cursor/useCursor.ts`, `systems/cursor/CursorSystem.tsx`, `canvas-v2/dxf-canvas/DxfCanvas.tsx`, `canvas-v2/layer-canvas/LayerCanvas.tsx`.

✅ Google-level: YES — selection state decoupled from React provider; only 2 leaf canvases re-render; equality guard prevents no-op notifies; getters ensure event handlers always read live data; idempotent (calling updateSelection twice with same point = 1 notify).

**⚠️ CORRECTION (2026-05-10 — same day)**: Profiling after Phase III revealed a regression: DxfCanvas 5→42 commits, LayerCanvas 5→42 commits. `useSelectionState()` (useSyncExternalStore) added NEW subscriptions that caused React re-renders on every SelectionStore.notify() during drag. The canvas renderers read from refs in RAF loops and do NOT need React re-renders — only `isDirtyRef.current = true` is needed.

**Correction fix**: replaced `useSelectionState()` with imperative `SelectionStore.subscribe()` callbacks in both canvases. DxfCanvas and LayerCanvas now update their refs directly and set `isDirtyRef.current = true` without triggering any React re-render. `layer-canvas-hooks.ts` updated to accept `selectionRef: MutableRefObject<SelectionState>` and read from `selectionRef.current` inside `renderLayers` (removed from useCallback deps). `dxf-canvas-renderer.ts` `cursorIsSelecting/cursorSelectionStartX/Y/CurrentX/Y` params and the `isDirtyRef = true` useEffect removed (handled by imperative subscription). **Expected result**: DxfCanvas/LayerCanvas return to ~5 commits (selection-independent).

**Files modified (correction)**: `canvas-v2/dxf-canvas/DxfCanvas.tsx`, `canvas-v2/dxf-canvas/dxf-canvas-renderer.ts`, `canvas-v2/layer-canvas/LayerCanvas.tsx`, `canvas-v2/layer-canvas/layer-canvas-hooks.ts`.

---

### 2026-05-10: PERF — Phase II: HoverStore (overlay) subscription moved to DraftLayerSubscriber leaf + pre-commit CHECK 6C

**Incident (zoom + marquee 37-45% CPU)**: After Phase I, profiler still showed `scheduleImmediateRootScheduleTask → flushSyncWorkAcrossRoots → renderRootSync → CanvasSection → updateMemo` at 37-45% CPU during zoom + marquee selection drag. Path confirmed triggered by `useSyncExternalStore` (not `useState`).

**Root cause**: `useHoveredOverlay()` remained in CanvasSection (line 120, Phase E compromise). During marquee drag, `DxfCanvas.onHoverOverlay` callback fires at 60fps → `HoverStore.setHoveredOverlay()` → `subscribeHoveredOverlay` notification → `useSyncExternalStore` in CanvasSection fires → full CanvasSection re-render cascade (13+ hooks, `useOverlayLayers` recompute, new `colorLayers` ref → CanvasLayerStack → DraftLayerSubscriber → LayerCanvas all reconcile).

**Fix — move `useHoveredOverlay` to `DraftLayerSubscriber` leaf**:
- `CanvasSection.tsx`: `useHoveredOverlay()` call + import removed entirely. `useOverlayLayers` called without `hoveredOverlayId` → `colorLayers` is now stable across all mouse events (overlay hover no longer invalidates it).
- `canvas-layer-stack-leaves.tsx` (`DraftLayerSubscriber`): added `useHoveredOverlay()` subscription directly in the leaf. After `useDraftPolygonLayer` computes `colorLayersWithDraft`, a `useMemo` merges `isHovered: true` on the matching layer. The leaf already re-renders every mousemove via `useCursorWorldPosition` → the hover subscription adds zero extra renders. `LayerCanvas` receives `finalLayers`.
- `scripts/git-hooks/pre-commit` (CHECK 6C, BLOCKING): scans staged `CanvasSection.tsx` + `CanvasLayerStack.tsx` for any `useSyncExternalStore` call. Blocks commit if found. Ratchet ensures no developer can reintroduce an orchestrator subscription without the hook catching it at commit time.

**Result**: During zoom + marquee — CanvasSection renders 0 times. Only `DraftLayerSubscriber` (already rendering every frame for other reasons) handles the hover visual. `colorLayers` reference is stable across all mouse activity.

**Architectural rule** (added to CHECK 6C):
> **`CanvasSection.tsx` and `CanvasLayerStack.tsx` are permanently subscription-free.** Any `useSyncExternalStore` call in these files = pre-commit BLOCK. All HoverStore, GuideStore, ImmediatePositionStore, ImmediateSnapStore subscriptions live exclusively in micro-leaf components.

**Files modified**: `components/dxf-layout/CanvasSection.tsx`, `components/dxf-layout/canvas-layer-stack-leaves.tsx`, `scripts/git-hooks/pre-commit`.

✅ Google-level: YES — subscription moved to leaf that already re-renders; pre-commit ratchet prevents regression; CanvasSection has zero `useSyncExternalStore` calls.

---

### 2026-05-10: PERF — Phase I: GuideStore subscription moved to DxfCanvasSubscriber leaf + click-handler stale-data fix

**Incident (guide drag 60fps re-render)**: Profiler showed `scheduleImmediateRootScheduleTask → flushSyncWorkAcrossRoots → CanvasSection → updateMemo` at 33% CPU over 2036ms during guide drag. CanvasSection re-rendered at ~60fps even though Phase E had already moved mousemove subscriptions to leaves.

**Root cause A — guide drag**: `useGuideState()` in CanvasSection held 4× `useSyncExternalStore` on GuideStore. During drag, `moveGuideById()` → `GuideStore.notify()` on every mouse event → all 4 subscriptions fired → `scheduleImmediateRootScheduleTask` (React's synchronous flush path for useSyncExternalStore) → CanvasSection re-rendered with 13+ hooks including `useGuideToolWorkflows` (5 useMemo), `useOverlayLayers`, `useCommandHistory`, etc.

**Root cause B — stale click-handler data (regression found and fixed)**: After fix A, `guideState.guides` in CanvasSection became a snapshot read (imperative, not reactive) passed to `useCanvasContextMenu` and `useCanvasClickHandler`. Click handlers used this snapshot for hit-testing (`findNearestGuide`). If a guide was added/deleted and CanvasSection had not re-rendered since, the stale snapshot caused the new guide to be invisible to click operations.

**Fix A — `useGuideActions` (new hook)**:
- `src/subapps/dxf-viewer/hooks/state/useGuideActions.ts` (NEW, 236 lines): mutations-only drop-in replacement for `useGuideState()`. Returns `UseGuideStateReturn` type. All mutation callbacks identical (CommandHistory, EventBus). `guides` / `guidesVisible` / `snapEnabled` / `guideCount` are imperative reads via `store.getGuides()` etc. — NOT `useSyncExternalStore`. CanvasSection no longer subscribes to GuideStore.
- `CanvasSection.tsx`: `useGuideState()` → `useGuideActions()`. GuideStore 4× `useSyncExternalStore` eliminated from CanvasSection.
- `canvas-layer-stack-leaves.tsx` (`DxfCanvasSubscriber`): added module-level stable subscriptions (`_subscribeGuideStore`, `_getGuides`, `_getGuidesVisible`) + `useSyncExternalStore` calls directly in the leaf. `localComputedParams` useMemo overrides `guideState.guides` and `guidesVisible` with freshly subscribed data before passing to `useGuideWorkflowComputed`. Removed `guides` / `guidesVisible` from `DxfCanvasSubscriberProps` (subscribed directly from store, not passed as props).
- `CanvasLayerStack.tsx`: removed `guides={guides}` and `guidesVisible={guidesVisible}` from `DxfCanvasSubscriber` JSX.

**Fix B — `getGuides` getter (stale click-handler data)**:
- `canvas-click-types.ts`: added `getGuides?: () => readonly Guide[]` alongside `guides?`.
- `guide-click-handlers.ts` (`handleGuideToolClick`): resolves `freshGuides = params.getGuides?.() ?? params.guides ?? []` at entry, creates `p = { ...params, guides: freshGuides }`, passes `p` to all 31 sub-handlers. Sub-handlers unchanged — still access `p.guides`.
- `useCanvasContextMenu.ts`: added `getGuides?: () => readonly Guide[]`. Inside `handleNativeContextMenu` DOM event: `const guides = getGuides?.() ?? guidesSnapshot` — reads from store at event time, not from stale React snapshot.
- `CanvasSection.tsx`: `getGuides = useCallback(() => getGlobalGuideStore().getGuides(), [])` — zero deps, stable reference, always returns current store state. Passed to both hooks instead of `guides: guideState.guides`.

**Result**: During guide drag — only `DxfCanvasSubscriber` re-renders (tiny leaf). CanvasSection, CanvasLayerStack, all 13+ hooks skipped. Click handlers always read current guide data from store regardless of when CanvasSection last rendered.

**Architectural rule** (added to micro-leaf pattern):
> **Orchestrator components (CanvasSection) MUST NOT pass reactive store snapshots to event handlers.** Event handlers that need current store data MUST receive a getter `() => store.getData()` instead of a value snapshot. Snapshot values in event handlers become stale when the orchestrator skips re-renders by design.

**Files created**: `hooks/state/useGuideActions.ts`.
**Files modified**: `hooks/state/useGuideState.ts`, `components/dxf-layout/CanvasSection.tsx`, `components/dxf-layout/CanvasLayerStack.tsx`, `components/dxf-layout/canvas-layer-stack-leaves.tsx`, `hooks/canvas/canvas-click-types.ts`, `hooks/canvas/guide-click-handlers.ts`, `hooks/canvas/useCanvasContextMenu.ts`.

✅ Google-level: YES — zero stale data, zero 60fps CanvasSection re-renders during guide drag, stable getGuides getter is idempotent and SSoT-backed.

---

### 2026-05-10: PERF — Phase H: Move cursor world-position subscription to leaf (toolbar)

**Incident**: Firefox profile (clean recording) of hover interaction on DXF canvas showed two adjacent hotspots dominating the frame: `Tooltip` 30% and `useTranslation.useMemoized.wrapped` (→ `fixedT`) 29%, both reached via `RefreshDriverTick → WorkFunction → renderRootSync → renderWithHooks → Tooltip`. Cumulative 9 mousemove samples in 200ms decaying from 126ms → 53ms. Chrome trace of the same scenario showed 750 `commitMutationEffectsOnFiber` + 127 `commitPassiveUnmountOnFiber` samples in the same 200ms range — i.e. a full toolbar reconcile/commit per mousemove.

**Root cause**: `src/subapps/dxf-viewer/ui/components/ToolbarWithCursorCoordinates.tsx` subscribed to `useCursorWorldPosition()` at the toolbar root, then passed the value down as a prop to `EnhancedDXFToolbar`, which forwarded it through to `ToolbarStatusBar.mouseCoordinates`. The wrapper's comment said "to avoid re-rendering the parent toolbar on every mousemove" — but the implementation did exactly that: every `setImmediateWorldPosition()` notified the wrapper, the wrapper re-rendered, and `EnhancedDXFToolbar` re-rendered with a new `mouseCoordinates` reference. Because the toolbar holds **N** `ToolButton` + `ActionButton` children with no `React.memo`, each child re-ran:
- `useTranslation` over **6 namespaces** (`['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']`),
- `useIconSizes`, `useSemanticColors`, `useClickOutside`,
- a per-button `TooltipProvider` + `Tooltip` + `TooltipTrigger` + `TooltipContent` subtree.

That subtree-per-button × N buttons × mousemove rate was the source of the Tooltip 30% + i18n 29% cluster, the long mousemove latencies, and the mount/unmount churn observed in the Chrome trace.

**Fix** — push the subscription to a leaf:

- `src/subapps/dxf-viewer/ui/toolbar/ToolbarCoordinatesDisplay.tsx` (new, `React.memo`): the **only** component that subscribes to `useCursorWorldPosition()`. Renders the formatted X/Y `<strong>`. Receives `precision` + `className` as stable props.
- `src/subapps/dxf-viewer/ui/toolbar/ToolbarStatusBar.tsx`: dropped `mouseCoordinates` prop, removed `useRef`/`useMemo` throttle (no longer needed — leaf reads the store directly), renders `<ToolbarCoordinatesDisplay>` when `showCoordinates` is true.
- `src/subapps/dxf-viewer/ui/components/ToolbarWithCursorCoordinates.tsx`: removed `useCursorWorldPosition()` and the `mouseCoordinates` pass-through. Wrapper now reads only the static `coordinate_display` setting.
- `src/subapps/dxf-viewer/ui/toolbar/EnhancedDXFToolbar.tsx`: dropped `mouseCoordinates` from props/destructure and from the `<ToolbarStatusBar>` invocation.
- `src/subapps/dxf-viewer/ui/toolbar/types.ts`: removed `mouseCoordinates` from `EnhancedDXFToolbarPropsExtended`.

**Result**: mousemove now re-renders only `ToolbarCoordinatesDisplay` (one tiny `<strong>` reading the store). The toolbar root, all `ToolButton`s/`ActionButton`s, all per-button `Tooltip` subtrees, and `useTranslation` over 6 namespaces are skipped on hover. Tooltip 30% + i18n 29% cluster is expected to disappear from the hover frame; mount/unmount churn in `commitMutationEffectsOnFiber` should drop sharply.

**Why same SSoT pattern as Phase E**: identical to the Phase E micro-leaf pattern (`HoverStore`, `ImmediatePositionStore` subscribers). The cursor store was already designed for selective subscription via `useSyncExternalStore`; the previous code accidentally re-introduced cascade by reading the value at the toolbar root instead of at the consumer.

**Google-level checklist** (N.7.2):
- Proactive: yes — coordinate read happens at the only consumer.
- Race-free: yes — `useSyncExternalStore` snapshot is consistent per commit.
- Idempotent: yes — same store value → same render.
- SSoT: yes — `ImmediatePositionStore` remains the single owner; only the read site moved.
- Lifecycle owner: explicit — leaf component owns its subscription.

✅ Google-level: YES.

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

### 2026-05-10: Ortho mode (F8) in drawing handlers + snap tolerance unification

- `useDrawingHandlers.ts`: `hardOrtho()` helper projects incoming point onto H or V axis from last reference point; applied before snap on both `addPoint` and `updatePreview` paths; reads `ortho.on` via ref to avoid callback recreation on every toggle
- `extended-types.ts`: `DEFAULT_PRO_SNAP_SETTINGS.snapDistance` raised 7→10 to match AutoCAD APERTURE default; all `perModePxTolerance` values unified at 10px (except GUIDE=12 for easy grab)

### 2026-05-11: Fix setState-in-render error in handleDxfEntitySelect

- `universalSelection.add/deselect` were called inside a `setSelectedEntityIds` updater; React runs updaters during reconciliation → "Cannot update SelectionSystem while rendering CanvasSection" error
- Fix: read `selectedEntityIds` from closure directly (event handlers always see current state), call `universalSelection` and `setSelectedEntityIds` as sibling statements outside any updater

### 2026-05-10: Fix Ctrl+click double-toggle bug in additive multi-select

- Root cause: `onEntitySelect` was called on BOTH mousedown AND mouseup; additive toggle fired twice → entity added then immediately removed
- Fix: removed `onEntitySelect` hit-test from `handleMouseDown`; mouseup is now the sole authority (AutoCAD standard: select on click, not press)
- `entitySelectedOnMouseDownRef` guard in `useCanvasClickHandler` still works — it is set during the mouseup `onEntitySelect` call, which fires before the browser's click event

### 2026-05-11: AutoCAD-style 2-click Move Tool — MovePreviewMount micro-leaf

- `hooks/tools/useMoveTool.ts` (NEW): 4-phase state machine (`idle → awaiting-entity → awaiting-base-point → awaiting-destination`); uses `MoveEntityCommand` / `MoveMultipleEntitiesCommand`; toolHintOverrideStore for status bar
- `hooks/tools/useMovePreview.ts` (NEW): RAF ghost preview — base point crosshair, rubber band line, displacement tooltip, semi-transparent ghost entities translated by delta; reads cursor from `useCursorWorldPosition()` (ImmediatePositionStore)
- `canvas-layer-stack-leaves.tsx`: `MovePreviewMount` micro-leaf — mirrors `RotationPreviewMount` pattern; only this component re-renders on mousemove when move tool is active
- `CanvasLayerStack.tsx`: renders `<MovePreviewMount>` after `<RotationPreviewMount>` — both share the same `PreviewCanvas`
- `canvas-layer-stack-types.ts`: `movePreview: { phase, basePoint }` prop
- `useCanvasClickHandler.ts`: Priority 1.55 intercepts move tool clicks (between rotation 1.5 and guides 1.6)
- `canvas-click-types.ts`: `moveIsActive` + `handleMoveClick` optional params
- `useCanvasKeyboardShortcuts.ts`: Escape cancels move tool before rotation tool

### 2026-05-12: Text rendering path — ADR-344 Layers 1-8 (no micro-leaf impact)

ADR-344 (DXF Enterprise Text Engine) introduces a parallel text editing stack that coexists with the ADR-040 canvas architecture without violating Cardinal Rules:

- **TipTap overlay (Layer 5)** — `TextEditorOverlay.tsx` is a separate `<div>` positioned absolute over the canvas via CSS (not a canvas element). It does NOT subscribe to `HoverStore` / `ImmediatePositionStore` and does NOT call `useSyncExternalStore`. Cardinal Rule 1 is not violated.
- **Text toolbar (Layer 5)** — `TextToolbar.tsx` is a fixed-position React tree outside the `CanvasLayerStack` hierarchy. It subscribes only to `useTextToolbarStore` (low-frequency Zustand store, not a high-freq canvas store). Zero ADR-040 performance impact.
- **Bitmap cache (Cardinal Rule 3)** — `textNode` AST stored in scene entities is NOT included in the bitmap cache key. TEXT/MTEXT entities render via `DxfText`/`DxfMText` renderers inside the normal entity pass.
- **Spell-check decorations** — ProseMirror `DecorationSet` lives entirely inside TipTap's React tree. No RAF interaction.
- **CommandHistory (Phase 6)** — text mutation commands call `sceneManager.updateEntity()`, triggering the same re-render path as any other entity mutation. No new subscription pattern.

### 2026-05-10: Shift/Ctrl+click additive multi-select for DXF entities

- `mouse-handler-types.ts`: `onEntitySelect` signature extended — `additive?: boolean` 2nd param
- `useCentralizedMouseHandlers.ts`: mousedown passes `e.shiftKey || e.ctrlKey || e.metaKey` as additive; marquee blocked when any modifier key is held
- `mouse-handler-up.ts`: both mouseup paths (single-click + marquee fallback) pass additive flag
- `CanvasLayerStack.tsx`: `handleDxfEntitySelect(entityId, additive?)` — additive=true → toggle (add if absent, remove if present); additive=false → replace (existing behavior)
- `canvas-layer-stack-types.ts`: `UniversalSelectionForStack` now includes `add` and `deselect` (already implemented in `useUniversalSelection`)

### 2026-05-12: ADR-344 Phase 6.E — rich text style pipeline in DxfRenderer + TextRenderer

`dxf-types.ts`: new `DxfTextStyle` interface (bold/italic/underline/fontFamily/runColor/textAlign/textBaseline). `DxfText` entity gains optional `textStyle?: DxfTextStyle` field — rendering hint derived from `textNode`, not domain data, so it does not affect CommandHistory or bitmap cache keys.

`useDxfSceneConversion.ts`: `extractFirstRunStyle(entity)` reads `textNode.paragraphs[0].runs[0].style` + `textNode.attachment` and builds a `DxfTextStyle`. `resolveTextHeight(entity)` prefers `textNode` run height, falls back to flat `height`/`fontSize`/default (ADR-142 order preserved). Both utilities are pure functions called once per entity in `sceneToCanvas()` — no new store subscriptions.

`DxfRenderer.ts`: `case 'text'` block spreads `te.textStyle` (if present) into the canvas entity object. No subscription change, no bitmap cache key change.

`TextRenderer.ts`: `renderText()` reads `richStyle` from `entity.textStyle`, derives `fontFamily`/`weight`/`italic`, and passes `italic` to the updated `buildUIFont()` helper. Underline rendered as a post-draw rect below the baseline.

**ADR-040 compliance**: no new `useSyncExternalStore` calls; `textStyle` is NOT added to the bitmap cache key (per cardinal rule 3 — it changes only on selection/edit, not on pan/zoom); all reads are at conversion time (scene→canvas), not at render tick.

### 2026-05-12: ADR-344 Phase 6.E follow-up — text creation tool wired in CanvasSection

`CanvasSection.tsx`: mounts `useTextCreationTool({ transformRef, containerRef, activeTool, onToolChange, executeCommand })` before `useCanvasClickHandler`. The hook returns `handleCanvasClick` which is passed as `onTextToolClick` to `useCanvasClickHandler` — fires only when `activeTool === 'text'`. On click: opens `TextEditorOverlay` at the canvas hit point with an empty AST; on commit dispatches `CreateTextCommand`; tool returns to `'select'`. `useTextCreationTool` uses `useState` (local edit state) + `useCallback` — no `useSyncExternalStore`, no subscription to high-frequency stores.

**ADR-040 compliance**: cardinal rule 1 preserved — CanvasSection still does not subscribe to any high-frequency store; `useTextCreationTool` is pure local state + props.

### 2026-05-12: ADR-049 SSOT — unified ghost preview for Move tool + grip drag

**Decision.** A single source of truth now governs every drag-time "ghost" rendered by the DXF viewer. Both the toolbar Move tool and the grip-drag path (center / vertex / edge handles) draw onto the dedicated PreviewCanvas overlay through the same primitives, with identical visual style (cyan-blue `#00BFFF`, α=0.45). The bitmap cache is no longer invalidated during grip drag because `DxfRenderer` no longer mutates the dragging entity.

**New SSOT module** `src/subapps/dxf-viewer/rendering/ghost/`:
- `apply-entity-preview.ts` — pure `applyEntityPreview(entity, preview) → entity` (line/circle/arc/polyline/text/angle-measurement). Handles whole-entity translation (`movesEntity=true`), edge stretch (`edgeVertexIndices`), vertex stretch, circle quadrant → radius, arc end → angle+radius. Extracted verbatim from the old `DxfRenderer.applyDragPreview` private method.
- `draw-ghost-entity.ts` — pure `drawGhostEntity(ctx, entity, transform, viewport)`. Single Canvas2D switch; caller pre-applies `strokeStyle`/`fillStyle`/`globalAlpha`/`lineWidth` so multiple ghosts batch under one save/restore.
- `index.ts` — barrel + `GHOST_DEFAULTS` style constants (`color: '#00BFFF'`, `alpha: 0.45`, `lineWidth: 1.5`).

**New micro-leaf** `useGripGhostPreview` + `GripDragPreviewMount` (`canvas-layer-stack-leaves.tsx`): mirrors `useMovePreview` / `MovePreviewMount` exactly — zero JSX, RAF-driven, clears the PreviewCanvas when `dragPreview` is null. Receives `dragPreview` (the `DxfGripDragPreview` projection from `useUnifiedGripInteraction`) as a prop; resolves the entity from `levelManager`, applies the transform, draws on the shared PreviewCanvas.

**Composite mount** `PreviewCanvasMounts` (same leaves file): groups Rotation + Move + GripDrag mounts under one shared `getCanvas`/`getViewportElement` pair. Keeps `CanvasLayerStack` under the 500-line ceiling.

**`DxfRenderer` cleanup** (`canvas-v2/dxf-canvas/DxfRenderer.ts`):
- Removed: `applyDragPreview()`, `getCircleQuadrant()`, `getArcPoint()` private methods (~120 lines).
- `renderSingleEntity()` mode union narrowed: `'hovered' | 'selected' | 'drag-preview'` → `'hovered' | 'selected'`.
- `renderEntityUnified()` no longer toggles `globalAlpha = 0.45` for drag ghosts — the entity is painted at its source position in normal style.
- `dxf-canvas-renderer.ts`: the third render pass (drag-preview overlay) is gone; selected entities (including the one being dragged) all flow through the same `'selected'` overlay.
- `DxfRenderOptions.dragPreview` field removed from `dxf-types.ts`.

**ADR-040 cardinal rules preserved.**
1. **Orchestrators (`CanvasSection`, `CanvasLayerStack`) still do not call `useSyncExternalStore`.** `GripDragPreviewMount` is the only new subscriber; the shell passes `dxfGripInteraction.dragPreview` through props (same shape as the existing rotation/move preview props).
2. **Bitmap cache key unchanged.** It already excluded `dragPreview`; removing it from `DxfRenderOptions` makes that invariant structural rather than convention-based.
3. **Bitmap cache no longer needs to invalidate during grip drag.** Previously the main canvas had to refresh the live overlay for the dragging entity every mousemove; now the main canvas is idle during drag and only the PreviewCanvas RAF runs.

**Files touched** (8): new `rendering/ghost/{apply-entity-preview,draw-ghost-entity,index}.ts`, new `hooks/tools/useGripGhostPreview.ts`, refactored `hooks/tools/useMovePreview.ts`, modified `canvas-v2/dxf-canvas/{DxfRenderer.ts, dxf-canvas-renderer.ts, dxf-types.ts}`, modified `components/dxf-layout/{canvas-layer-stack-leaves.tsx, CanvasLayerStack.tsx}`.

**Google-level: YES** — proactive (preview lives on the same overlay layer for every drag path, no special cases scattered across renderers), idempotent (`applyEntityPreview` returns the same reference on zero-delta → no redundant frame), race-free (each preview hook owns its own RAF + clear policy; mutually exclusive states in practice), SSoT (one `applyEntityPreview`, one `drawGhostEntity`, one `GHOST_DEFAULTS` constant set), belt-and-suspenders (snap to entity → guard via `getEntity()`; zero-delta short-circuits in `applyEntityPreview` and `drawGhostEntity`), explicit owner (`rendering/ghost/` is the documented home; pre-commit `.ssot-registry.json` should pick this up on the next baseline pass).

---

## 2026-05-12: Auto Area Measurement (ADR-346)

Added `AutoAreaResultPanel` to `CanvasLayerStack.tsx` as a **non-canvas HTML overlay** (position: fixed, z-index 9999). This component reads from `AutoAreaResultStore` via `useSyncExternalStore` — **the subscription is inside the leaf component, not in the shell**. The shell (`CanvasLayerStack`) merely renders `<AutoAreaResultPanel />` which satisfies CHECK 6C (shell itself has zero new store subscriptions).

**ADR-040 cardinal rules preserved**: no bitmap cache changes, no high-frequency subscriptions in the shell, `AutoAreaResultStore` is module-level (same pattern as HoverStore / ImmediatePositionStore).

## 2026-05-13: Auto Area Hover Preview (ADR-346 extension)

Added `AutoAreaPreviewOverlay` (SVG) to `CanvasLayerStack.tsx` for real-time polygon highlight on hover. Same ADR-040 compliance pattern as `AutoAreaResultPanel`: the SVG component subscribes to `AutoAreaPreviewStore` independently — the shell renders it without subscribing itself. Mouse-move logic lives in `useAutoAreaMouseMove` (hooks/canvas), called from `CanvasSection` as a wrapper around `unified.handleMouseMove`. Throttled at 50ms (20fps) — no impact on grip or rendering paths.

---

## 2026-05-13: Move tool — overlay zone support (ADR-049 extension)

`canvas-layer-stack-leaves.tsx`: added `onMoveOverlay` + `onMoveMultipleOverlays` callback props forwarded from `CanvasSection` to the interaction leaf. `canvas-layer-stack-types.ts`: extended `CanvasLayerStackLeafProps` with the two new optional callbacks. Enables mixed DXF-entity + overlay-zone moves in a single undo step via `MoveOverlayCommand` / `MoveMultipleOverlaysCommand` (both wrapped in `CompoundCommand`). ADR-040 cardinal rules preserved: no new store subscriptions in the shell; callbacks are props, not state.

---

## 2026-05-13: useGlobalSnapSceneSync — overlay injection

`useGlobalSnapSceneSync` now receives `overlays` prop from `CanvasSection` and passes them to `SnapSceneManager` for endpoint/midpoint snapping on overlay polygon vertices. Snap engine upgrade: overlay zone vertices are now first-class snap targets alongside DXF entities. Passed as a single array — no new stores, no new subscriptions.

---

## 2026-05-13: Keyboard shortcut + command history — DXF viewer cleanup

`useCanvasKeyboardShortcuts.ts`: Escape now checks `universalSelection.count() > 0` (covers all selection types, not just DXF entities). `useCommandHistory.ts`: extracted from inline hook usage; now stable module with proper undo/redo cycle. `useLayerCanvasMouseMove.ts`: consolidated mouse-move dispatch paths. `dxf-firestore.service.ts`: tightened null-guard on auto-save. All changes preserve the micro-leaf subscription model: no new `useSyncExternalStore` in orchestrators.

---

## 2026-05-13: CanvasSection.tsx — universalSelection-driven selectedEntityIds (implementation)

`CanvasSection.tsx` implementation commit: `selectedEntityIds` now derives from `universalSelection` (see 2026-05-12 SSoT entry for design rationale). `setSelectedEntityIds` dispatches through `universalSelection.clearByType/addMultiple`. `getSelectedEntityIds` getter reads from `universalSelectionRef` — no snapshot staleness. `useAutoAreaMouseMove` + `useGlobalSnapSceneSync({ overlays })` wired here. `CrosshairOverlay` receives `isEntitySelected` pred derived from `selectedEntityIds`. ADR-040 cardinal rules: CanvasSection is orchestrator — zero `useSyncExternalStore` calls, all store subscriptions remain in leaves.

---

## 2026-05-13: Phase X — LINE batch rendering in `DxfRenderer`

`DxfRenderer.renderScene()`: normal-state solid LINE entities are now grouped by `(strokeColor × lineWidth)` and rendered as a single canvas path per group — one `ctx.stroke()` call per color/width group instead of one per entity. Reduces canvas API calls from O(n) to O(groups) for the most common case. Excluded from batch (rendered individually as before): selected, hovered, measurement, non-solid line types. Two-pass strategy: (1) collect + batch-flush normal lines, (2) per-entity loop for everything else skips `batchedIds`. No change to `LineRenderer` — the batch path bypasses the full renderer stack and directly draws to ctx, matching `applyEntityStyle` semantics (`entity.color || CAD_UI_COLORS.entity.default`, `lineWidth ≥ 1`, solid dash, `lineCap: butt`).

## 2026-05-14: Polygon Crop + Lasso Freehand — rename + new micro-leaf

**Task 1 (rename):** `LassoCropStore` renamed to `PolygonCropStore` (in-place, file path unchanged), export `LassoCropStore` kept as deprecated alias. `LassoCropPreviewSubscriber` renamed to `PolygonCropPreviewSubscriber` (in-place), deprecated alias re-exported. ToolType `'lasso-crop'` → `'polygon-crop'` (and new `'lasso-crop'` added for freehand). EventBus event `'crop:lasso-polygon'` → `'crop:polygon'` for polygon-crop; `'crop:lasso-polygon'` re-added for freehand lasso. All callers updated: `useCanvasClickHandler`, `useCanvasKeyboardShortcuts`, `useDxfViewerState`, `CanvasLayerStack`.

**Task 2 (freehand lasso):** New `LassoFreehandStore` (`systems/lasso/LassoFreehandStore.ts`) — module-level pub/sub, fields `_active`+`_points`, methods `startAt/addPoint/finish/cancel/isActive/getPoints/subscribe`. Input wired in `useCanvasContainerHandlers`: mouseDown → `startAt()`, mouseUp → `finish()`, `pointermove` useEffect → `addPoint()` throttled ≥3px screen (screen-distance check via `_lastLassoScreen` ref). Escape → `LassoFreehandStore.cancel()` in `useCanvasKeyboardShortcuts`. New `LassoFreehandPreviewSubscriber` micro-leaf subscribes to `LassoFreehandStore` only — renders teal dashed polyline + closing dashed line (≥3 pts). Mounted in `CanvasLayerStack` alongside `PolygonCropPreviewSubscriber`. `useDxfViewerState` handles `crop:lasso-polygon` via shared `_clipByPolygon` callback (DRY — same `ClipToPolygonService` call for both tools).

## 2026-05-14: Lasso Crop — LassoCropPreviewSubscriber micro-leaf

New `LassoCropPreviewSubscriber` component in `components/dxf-layout/LassoCropPreviewSubscriber.tsx` (extracted to its own file, not appended to `canvas-layer-stack-leaves.tsx`, to stay under 500-line limit). Follows the established micro-leaf subscriber pattern. Subscribes to two stores: `LassoCropStore` (updates on every click, low-frequency) and `ImmediateSnapStore` (high-frequency, for rubber-band line to cursor). Renders an SVG overlay with: filled orange polygon preview, rubber-band dashed line from last point to cursor, closing dashed line from cursor to first point, vertex dots (first dot larger). `CanvasLayerStack` imports and renders `LassoCropPreviewSubscriber` directly (no prop drilling needed — store-based). `LassoCropStore` (new, `systems/lasso/LassoCropStore.ts`) is a module-level pub/sub store that also emits `EventBus.emit('crop:lasso-polygon')` on `close()`. Cardinal rules maintained: zero `useSyncExternalStore` calls in orchestrators (`CanvasSection`, `CanvasLayerStack`).

---

## 2026-05-14: CanvasNumericInputOverlay — micro-leaf for direct numeric entry

New `CanvasNumericInputOverlay` micro-leaf in `systems/canvas-numeric-input/CanvasNumericInputOverlay.tsx`. Subscribes to `CanvasNumericInputStore` (module-level pub/sub) only. Two `useSyncExternalStore` calls with primitive selectors (`isActive: boolean`, `buffer: string`). Renders `position: fixed` bottom-center pill when active — zero re-render cost on CanvasLayerStack (orchestrator). Mounted in `CanvasLayerStack` alongside `PolygonCropPreviewSubscriber` and `LassoFreehandPreviewSubscriber`. `CanvasNumericInputStore` reuses `DirectDistanceEntry` (text-engine SSOT) — no inline buffer reimplementation. Cardinal rules maintained: zero `useSyncExternalStore` calls in `CanvasLayerStack` orchestrator.

## 2026-05-14: AutoCAD-style Mirror Tool — MirrorPreviewMount micro-leaf

`MirrorPreviewMount` added to `canvas-layer-stack-leaves.tsx` following the established micro-leaf subscriber pattern (same as `MovePreviewMount`, `RotationPreviewMount`). `useMirrorPreview` runs 60fps RAF on PreviewCanvas — draws dashed axis line, first-point marker, and ghost entity copies. `CanvasSection` (orchestrator) receives `mirrorPreview: { phase, firstPoint, secondPoint }` props and passes them to `CanvasLayerStack` → `PreviewCanvasMounts` → `MirrorPreviewMount`. Ortho snap (`orthoSnap` from `mirror-math.ts`) applied to cursor position in both `useMirrorTool` (click commit) and `useMirrorPreview` (real-time RAF) when Ortho mode active or Shift held. `MirrorConfirmOverlay` (fixed bottom-center UI) mounted in `CanvasSection` when `phase === 'awaiting-keep-originals'` — pure static UI, zero store subscriptions, no re-render impact. Cardinal rules maintained: CanvasSection orchestrator has zero `useSyncExternalStore` calls.
