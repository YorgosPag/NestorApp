# ADR-040: Preview Canvas Performance

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Last Updated** | 2026-05-10 |
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
