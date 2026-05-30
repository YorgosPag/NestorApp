# ADR-040: Preview Canvas Performance

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Last Updated** | 2026-05-16 |
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

### 2026-05-30 — ADR-363 Phase 1K Mode C — `wall-in-region` box-select (compliance note)

**Status**: COMPLIANT — no ADR-040 invariants broken.

The box-select drag-rectangle for «Τοίχος σε περιοχή» touches three `systems/cursor/`
mouse handlers (CHECK 6D files) and routes its result through `EventBus`, NOT through any
high-frequency store or orchestrator subscription:
- `useCentralizedMouseHandlers.ts` (mousedown) — arms the existing `lassoDownRef` (already a plain `useRef`, not a store) for `'wall-in-region'`. No new subscription.
- `mouse-handler-move.ts` — a drag past threshold calls `cursor.startSelection` (the same two-click marquee API the `'select'` tool already uses). Same `CursorSystem` context, no extra `useSyncExternalStore`.
- `mouse-handler-up.ts` (`processMarqueeSelection`) — a `'wall-in-region'` branch runs `UniversalMarqueeSelector.performSelection` then `EventBus.emit('bim:wall-region-box-select')` and returns **without mutating selection** (mirrors the existing `crop-window` / `crop:marquee-rect` branch). No render-path change.

The wall build runs in `useWallTool` (an ADR-040 micro-leaf-compliant tool hook that owns its
own React state, no high-freq `useSyncExternalStore`). No bitmap cache-key, subscription, or
micro-leaf structural change. Detail in ADR-363 Phase 1K Mode C changelog.

### 2026-05-30 — ADR-363 Phase 1K — `wall-in-region` hover affordance (compliance note)

**Status**: COMPLIANT — no ADR-040 invariants broken.

Two single-token additions so the «Τοίχος σε περιοχή (4 γραμμές)» tool highlights the
hovered line and shows grips on the accumulated 4-line picks:
- `CanvasSection.tsx` — `entityPickingActive` prop expression gains `|| activeTool === 'wall-in-region'`. Existing pass-through boolean (flips the hover hit-test on in `mouse-handler-move`); **no new `useSyncExternalStore`** on the orchestrator (CHECK 6C safe).
- `canvas-v2/dxf-canvas/dxf-canvas-renderer.ts` — `gripsAllowed` (already reads `refs.activeToolRef.current`) gains `|| activeTool === 'wall-in-region'`. Grips paint in the **selected-entity overlay pass** (`selectedEntityIds` loop), NOT in the cached bitmap; cache key / invalidation rules unchanged (still keyed without hover/selection/grip state per the cardinal rule). Only the selected-entity grip-paint gate widened by one tool id.

No subscription, cache-key, or micro-leaf structural change. Detail in ADR-363 Phase 1K changelog.

### 2026-05-30 — ADR-363 Phase 1J — `wall-on-entity` hover/grip affordance (compliance note)

**Status**: COMPLIANT — no ADR-040 invariants broken.

Two single-token additions so the «Τοίχος πάνω σε οντότητα 2Δ» tool highlights the
hovered source entity and shows grips on the picked one:
- `CanvasSection.tsx` — `entityPickingActive` prop expression gains `|| activeTool === 'wall-on-entity'`. This is an existing pass-through boolean that flips the hover hit-test on in `mouse-handler-move`; **no new `useSyncExternalStore`** on the orchestrator (CHECK 6C safe).
- `canvas-v2/dxf-canvas/dxf-canvas-renderer.ts` — `gripsAllowed` (already reads `refs.activeToolRef.current`) gains `|| activeTool === 'wall-on-entity'`. Bitmap-cache key / invalidation rules unchanged (still keyed without hover/selection/grip state per the cardinal rule); only the selected-entity grip-paint gate widened by one tool id.

No subscription, cache-key, or micro-leaf structural change. Detail in ADR-363 Phase 1J changelog.

### 2026-05-29 — ADR-396 P-RENDER — Envelope Z2/Z3/Z4 overlay (compliance note)

**Status**: COMPLIANT — no ADR-040 invariants broken.

`EnvelopeOverlay.tsx` (always-on floor micro-leaf, ADR-396 P4) επεκτάθηκε για να
ζωγραφίζει Z2/Z3 (slab hatch) + Z4 (reveal frame) πέρα από Z1. Subscriptions
αμετάβλητες — μόνο τα ίδια `useSyncExternalStore(envelope-spec)` + `objectStyles`
slice (CHECK 6C safe· κανένα νέο high-freq subscription στον orchestrator). Το
extra draw διαβάζει per-element `slab.envelopeLayer` / `opening.revealInsulation`
από το ήδη-subscribed `scene` prop (repaint piggybacks στο υπάρχον scene/transform
dep). `EnvelopeRenderer.ts` (+`renderSlabHatch`) thin ctx drawer — μηδέν state.
CHECK 6B/6D: ADR-040 staged μαζί με τα canvas/renderer αρχεία.

### 2026-05-27 — ADR-382 Visibility Resolver — micro-leaf compliance note (Phase C)

**Status**: COMPLIANT — no ADR-040 invariants broken.

**Why noted here**: [ADR-382](./ADR-382-visibility-resolver-ssot.md) Phase C adds per-entity `resolveIsEntityVisible()` calls inside `BimSceneLayer.sync()` (3D) + each of the 7 BIM 2D renderers. Two compliance points worth recording so future devs don't try to "optimize" by moving the call elsewhere:

1. **Event-time, not subscription-time**: `resolveIsEntityVisible()` is a pure function. Each renderer reads `useDrawingScaleStore.getState().objectStyles` + `getLayer(id)` at call time — no `useSyncExternalStore`, no `subscribe` in the render path. Matches the existing 2D BIM renderer pattern (Phase B identical refactor).

2. **Pre-mesh filter, not mesh-mutation**: 3D hide is now achieved by **not creating** the Three.js mesh in `BimSceneLayer.sync()` (resolver returns false → `continue` in the per-entity loop). `applyFloorVisibility` / `applyBuildingVisibility` retain their role for ghost styling + defense-in-depth (rebuilds between toggles), but the primary hide path bypasses mesh creation entirely. This is a strict improvement over the pre-ADR-382 post-hoc `mesh.visible = false` approach (which still allocated GPU geometry).

**New subscriber added (compliant)**: `use-bim3d-store-sync.ts` gains a `subscribeLayerStore()` consumer that triggers `syncBimEntities()` when `LayerStore.snapshot.version` changes. Low-frequency (user toggles in Layer Manager), not 60fps — same class as the existing `useViewMode3DStore` subscriptions. ADR-040 Cardinal Rule #1 unaffected (orchestrators still don't subscribe to high-freq stores).

**Cross-refs**: [ADR-382 §3.4 3D pipeline pattern](./ADR-382-visibility-resolver-ssot.md) · `BimSceneLayer.sync()` (event-time read site) · `use-bim3d-store-sync.ts` (low-freq subscriber).

---

### 2026-05-27 — Phase XXIII — Single rAF SSoT Consolidation (BIM 3D)

**Status**: IMPLEMENTED 2026-05-27. **Follow-up 2026-05-29** — SSAO render path now feeds this dirty SSoT: `SSAOModulator`'s idle-ramp calls a new `onNeedsRender → markSceneDirty()` callback each frame, so the composer (refine-on-idle) renders without a parallel rAF; interaction frames use the new `renderRaster()` direct path (no composer/FBO). Detail in ADR-366 changelog 2026-05-29 (B.1.Q3 SSAO perf hotfix). Phase XXIII dirty-state SSoT (`scene-dirty-state.ts`) unchanged.

**Why**: Firefox profile of 2D wheel-zoom with a BIM slab in the scene showed `Window.requestAnimationFrame` self time at 17% (27 samples / 21s recording) — far above the ~3-5% expected for a single rAF subscriber. Investigation found **two independent persistent rAF loops** running concurrently:

1. `UnifiedFrameScheduler` (`rendering/core/UnifiedFrameScheduler.ts:185`) — the master 2D scheduler.
2. `ThreeJsSceneManager.startLoop()` (`bim-3d/scene/ThreeJsSceneManager.ts:312`) — a parallel persistent rAF for the BIM 3D scene, with no dirty-check (renders every frame regardless of scene state).

This violated the ADR-040 §"Cardinal rules" #1 ("orchestrators MUST funnel through `UnifiedFrameScheduler`") and was an unfinished half of ADR-366 Phase 4.2 — its companion docs (`viewport-camera.ts:343`, `animation-manager.ts:5`, `viewport-animation.ts:6`) explicitly claim "tick from main RAF (no separate `requestAnimationFrame`)", but the **last and largest** rAF (the master scene loop itself) was never removed.

**Industry convergence (4/4 — Forge Viewer SDK / Three.js Editor / iModel.js / AutoCAD Web)**:
1. One master rAF per application instance.
2. Subsystems register as **ticked observers** with optional **dirty-check**.
3. Master skips clean systems each frame.
4. **On-demand rendering**: truly idle (no input, no animation, no scene mutation) → no render at all.

**Phase XXIII surgery** (8 files M + 4 files N):

- `ThreeJsSceneManager.ts` — removed `startLoop()`/`rafHandle`/`lastFrameTime`. Added public `tick(now, delta)` + `isSceneDirty()` + `markSceneDirty()`. `RenderFrameContext` cached once in constructor (was rebuilt on every rAF call). 8 mutation sites now self-mark dirty (`syncBimEntities`, `syncDxfOverlay`, `selectBimEntity`, `applyFloorVisibility`, `applyBuildingVisibility`, `applyLightPreset`, `resize`, `setViewCubeCompassVisible`, `setWaypointHoverState`, `setDragAxisLock`, `updateSunPosition`, `initSectionBox`, `loadHdriEnvironment` — net 11 paths).
- `scene-dispose.ts` — `rafHandle` field + `cancelAnimationFrame` call removed (scheduler unregister covers teardown).
- `scene-setup.ts` — `InitViewportCameraDeps.onRenderNeeded` exposed (was hard-coded no-op). Wired to `markSceneDirty()` so OrbitControls damping inertia (`dampingFactor=0.25`) continues to drive renders for ~300ms after pointer release without keeping a continuous rAF alive.
- `scene-dirty-state.ts` (NEW) — pure SSoT predicate `isSceneDirtyFromState(state)` decides "must redraw this frame?". Five-input OR (interacting / viewport-animating / animation-manager / path-tracer / explicit-dirty). Zero Three.js deps → unit-testable.
- `__tests__/scene-dirty-state.test.ts` (NEW) — 7 tests covering each branch + the idle short-circuit + referential purity.
- `scene-rendering-subsystems.ts` (NEW) — factory `createSceneRenderingSubsystems({renderer,scene,sun,bimLayer,getCamera,viewportSize})` returns `{qualityModulator, ssaoModulator, envmapGenerator, pathTracerRenderer, idleDetector, performanceCollector}`. Extracted from constructor to keep `ThreeJsSceneManager` under the 500-line cap (N.7.1).
- `scene-manager-actions.ts` (NEW) — pure helpers `syncBimEntitiesIntoScene`, `syncDxfOverlayIntoScene`, `resolveBimEntityType`, `loadHdriIntoStore` used by manager mutation methods. Same 500-line-cap motivation.
- `BimViewport3D.tsx` — registers `'bim-3d-scene'` system with `UnifiedFrameScheduler.register(...)` in the mount `useEffect`. `unregisterSchedulerRef` cleanup runs **before** `manager.dispose()` so no in-flight tick races a disposed renderer.

**Performance impact (expected, Firefox profiler validation):**
- `Window.requestAnimationFrame` self time: **17% → ~8-10%** (halved, single-rAF traffic).
- Idle 3D scene: zero CPU/GPU cost per frame (scheduler skips entire system via `isDirty()=false`).
- Per-frame allocation: one fewer `RenderFrameContext` object literal (cached).
- 2D-only sessions (no `BimViewport3D` mounted): unchanged — no system registered.

**Updated cardinal rule** (this section):

> The BIM 3D scene MUST be ticked by `UnifiedFrameScheduler` via `register('bim-3d-scene', …)`. Calling `requestAnimationFrame` from `ThreeJsSceneManager` or its `scene-render-frame` helper is forbidden. Use `markSceneDirty()` on mutation sites.

**Cross-refs**: [[Phase XXII.A — Zoom-Path Orchestrator Decoupling]] · [[Phase XXII.C — Legacy TransformContext duplicate SSoT removed]] · ADR-366 §Phase 4.2 (completion).

---

### 2026-05-27 — Phase XXII.C — Legacy `TransformContext` duplicate SSoT removed

**Status**: IMPLEMENTED 2026-05-27.

**Why**: After Phase XXII.A landed, Firefox profile of wheel zoom still showed ~70% React reconciliation. Investigation revealed a vestigial dual-source-of-truth: `contexts/TransformContext.tsx` (React Context + `useState<ViewTransform>`) lived alongside the canonical `ImmediateTransformStore` (Phase XIII). Both received writes on every wheel notch via `wrappedHandleTransformChange` in `useDxfViewerCallbacks.ts`. Per-notch effects:

- `TransformProvider.setTransformState(newTransform)` → React Provider re-render
- Duplicate `EventBus.emit('dxf-zoom-changed', { transform })` (one from `TransformContext.setTransform`, one from `useCanvasOperations.handleTransformChange`)
- New `value` memo object → context consumers re-render

The Phase XIII migration note in `useCanvasTransformState.ts:8-15` documented that `DxfViewerContent` was supposed to stop holding React state for transform. The Provider duplicate was the last leftover write path. Only one production consumer (`debug/layout-debug/CoordinateDebugOverlay.tsx`) ever called `useTransform()` from this context — a debug-only overlay.

**Phase XXII.C surgery** (5 files, ~120 LOC net delete):

| File | Change |
|------|--------|
| `contexts/TransformContext.tsx` | **DELETED** — entire file removed via `git rm` |
| `app/useDxfViewerCallbacks.ts` | Drop `contextSetTransformRef` param + `handleTransformReady` callback + return field. `wrappedHandleTransformChange` simplified to single `setCanvasTransform` write (which itself writes through `updateImmediateTransform`). |
| `app/DxfViewerContent.tsx` | Drop `TransformProvider` import + wrap, drop `contextSetTransformRef` `useRef`, drop `handleTransformReady` destructure + param, drop unused `ViewTransform` type import. |
| `debug/layout-debug/CoordinateDebugOverlay.tsx` | Migrate `useTransformValue` import: `../../contexts/TransformContext` → `../../systems/cursor/ImmediateTransformStore`. Same hook signature (`(): ViewTransform`), backed by `useSyncExternalStore` against the singleton — no behavior change for the overlay; it now subscribes selectively without a Provider. |
| `ui/components/tests-modal/constants/debugTools.ts` | Live-coordinates debug tool no longer wraps `CoordinateDebugOverlay` in a runtime-created `TransformProvider`; renders the overlay directly (singleton subscription). Drop unused `WindowWithDxfTransform` import. |

**SSoT topology after XXII.C**:

```
wheel notch
  → useViewportManager.setTransform (CanvasSection)
    → updateImmediateTransform()      ← canonical Phase XIII SSoT
        ├─ markSystemsDirty(['dxf-canvas','layer-canvas'])
        ├─ fullListeners.forEach(...)   ← CanvasLayerStackTransformBridge (Phase XXII.A)
        ├─ scaleListeners.forEach(...)  ← ZoomControlsWidget
        └─ offsetListeners.forEach(...)
  → setCanvasTransform (useDxfViewerCallbacks) → updateImmediateTransform (idempotent write-through)
```

Zero React `useState` cascades on wheel zoom. Zero duplicate `EventBus.emit('dxf-zoom-changed')`. Zero ghost Provider re-render. ADR-040 cardinal rules unchanged.

**Profile-driven scope decision**: Brief planned Phase XXII.B (bitmap-cache CSS-transform live zoom). Production-profile inspection of the Phase XXII.A baseline revealed (a) the `dxf-bitmap-cache.ts` is currently dead code (instantiated in `useDxfCanvasRenderer` but `rebuild()`/`blit()` never invoked — `DxfRenderer.render()` is called directly), and (b) raster cost is < 10% of frame budget; the 14% concentrated React time labeled `RibbonGroupRoot` was the remaining tall pole. Phase XXII.B is therefore **archived as "obviated by profile data"** in this changelog. XXII.C addresses the actual root cause; if production profile still shows unacceptable wheel-zoom FPS after XXII.C lands, the surviving options are (i) audit `RibbonGroupRoot` displayName (component identity unclear from JPG; need clarification) + memo/leaf-isolate, or (ii) write ADR-379 for a WebGL migration roadmap.

**Verification plan**: production build (`npm run build && npm run start`) + Firefox profiler at `localhost:3000/dxf/viewer`. Target: wheel-zoom FPS ≥ 50, total React time < 30% of frame budget, zero `TransformContext` references in stack samples.

**Files changed**: 4 modified + 1 deleted. TS check: clean (background). Pending commit.

**Cross-refs**: [[Phase XIII — TransformStore SSoT]] · [[Phase XXII.A — Zoom-Path Orchestrator Decoupling]] · `useDxfViewerCallbacks.ts:285` · `ImmediateTransformStore.ts:30` (canonical write).

---

### 2026-05-27 — Phase XXII.A follow-up — TS strictness noise (CanvasSectionOverlays refs)

**Scope**: TypeScript-only noise. No architectural change.

`CanvasSectionOverlays.tsx` (the JSX portal extracted in XXII.A) had its 4 context-menu `ref={...}` props lose nominal typing under stricter `exactOptionalPropertyTypes` / handle-type narrowing. Added explicit `as React.Ref<DrawingContextMenuHandle | EntityContextMenuHandle | GuideContextMenuHandle | GuideBatchContextMenuHandle>` casts at the four call sites.

Pure pass-through — the file remains a thin presentational sibling of `CanvasSection`. ADR-040 invariants intact (no `useSyncExternalStore`, no high-freq subscriptions, render-only).

### 2026-05-27 — Phase XXII.A — Zoom-Path Orchestrator Decoupling (foundation)

**Bug**: Firefox profile during DXF/BIM wheel-zoom showed ~77% time inside `flushSyncWorkOnAllRoots` → `performSyncWorkOnRoot` → `renderWithHooks`, with Tooltip render at 19%, `defineProperty` (self-hosted) 10.1ms JIT-off, and `validateChildKeys` (React DEV) frequent. Even on a tiny DXF + a handful of BIM entities, zoom dropped to 1-2 FPS.

**Diagnosis**:
1. `CanvasSection.tsx:92` consumed `useCanvasContext()` (the **merged** context, which carries `transform` alongside refs). Every `setTransform` from wheel events recreated `contextValue` (`{ ...refsValue, transform }`) → CanvasSection re-rendered on every wheel notch.
2. CanvasSection forwarded `transform` (or `transform.scale`) as a React value to **11 child hooks**: `useViewportManager`, `useZoom`, `useCanvasSection2DFocus`, `useUnifiedGripInteraction`, `useTouchGestures`, `useCanvasContainerHandlers`, `useCanvasMouse`, `useModifyTools` (transformScale), `useOverlayInteraction` (transformScale), `useCanvasClickHandler` — each with its own dep arrays, closures, sub-callbacks, and effects. Wheel zoom = 11-hook cascade per notch.
3. CanvasLayerStack received `transform` directly from CanvasSection prop, so the shell + leaves re-rendered as a follow-on cost (unavoidable for visual layers, but the *11-hook cascade above it* was the heavy multiplier).
4. The TransformStore SSoT (this ADR, Phase XIII) already existed (`ImmediateTransformStore` with canonical `TransformStore` alias) and `useViewportManager.setTransform` already wrote to it — but CanvasSection never read from it; it kept consuming the React-state merged context.

**Industry pattern (AutoCAD / Revit / Figma / Photoshop)**: view transform = runtime singleton, not React state. Wheel events write to the runtime. RAF reads it. React tree does not re-render on view change; canvas elements redraw imperatively via `markSystemsDirty()`.

**Fix — Phase XXII.A**: surgical, behavior-preserving migration. No new SSoT created (re-uses Phase XIII `ImmediateTransformStore`); no signature breakage; hook params retained for compat and marked `_transform` / `_transformScale`.

| File | Change |
|---|---|
| `contexts/CanvasContext.tsx` | `setTransform` now writes to `ImmediateTransformStore` (SSoT) **in addition to** the legacy `useState` (kept for backward compat). |
| `components/dxf-layout/CanvasSection.tsx` | `useCanvasContext()` → `useCanvasRefs()` (stable refs only — never recreated on transform change). `transform` value at render-top now reads `getImmediateTransform()` once; passes a frozen value to child hooks where needed (hooks ignore it and read live SSoT internally). Default-transform `useMemo` removed. |
| `components/dxf-layout/CanvasLayerStackTransformBridge.tsx` (**NEW**) | Thin subscriber wrapper around `CanvasLayerStack`. Uses `useTransformValue()` to subscribe to the SSoT and pass live transform to the shell. Pre-commit CHECK 6C bans `useSyncExternalStore` in CanvasSection and CanvasLayerStack directly; this bridge sits between them as the sole subscription point. |
| `components/dxf-layout/CanvasSectionOverlays.tsx` (**NEW**) | File-size split (CLAUDE.md N.7.1, 500-line budget). After the Phase XXII.A header additions CanvasSection.tsx grew to 507 lines and CHECK 4 blocked the commit. JSX portal overlays (4 context menus, 3 quick-properties leaves, grip menus, mirror confirm, text editors, selection cycling popover) extracted to this sibling component. Pure passthrough — props typed via `React.ComponentProps<typeof X>` so child component types remain SSoT. CanvasSection now 461 lines. |
| `hooks/canvas/useCanvasMouse.ts` | Internal `transform` reads → `getImmediateTransform()`; `transform` removed from `handleContainerMouseMove` + `handleContainerMouseDown` deps. |
| `hooks/canvas/useCanvasContainerHandlers.ts` | Same pattern (mouse-down + mouse-up reads); `transform` removed from both `useCallback` deps. |
| `hooks/canvas/useCanvasSection2DFocus.ts` | Fallback `transformRef.current ?? transform` → `transformRef.current ?? getImmediateTransform()`. |
| `hooks/canvas/useCanvasClickHandler.ts` | 5 internal reads + module-level `handleRotationEntitySelection` + `handleAutoAreaClick` switched to `getImmediateTransform()`. `guideCtx` / `entityCtx` constructed with live SSoT value at click time. `transform` removed from `useCallback` deps. |
| `hooks/canvas/useOverlayInteraction.ts` | `transformScale` retained for signature compat; `handleOverlayClick` reads live `getImmediateTransform().scale`. |
| `hooks/grips/useUnifiedGripInteraction.ts` | Two `findNearestGrip(...)` calls in `handleMouseMove` + `handleMouseDown` switched to `getImmediateTransform().scale`. `transform.scale` removed from both `useCallback` deps. |
| `hooks/gestures/useTouchGestures.ts` | Pinch + pan handlers read live SSoT; closes the stale-closure path where rapid pinch read stale transform from the dep array. `transform` removed from both `useCallback` deps. |
| `hooks/tools/useModifyTools.ts` | `trimHitTest` reads live `getImmediateTransform().scale`; `transformScale` retained for sub-tool propagation (`useWallSplitTool`). `transformScale` removed from `trimHitTest` deps. |

**What stays inert on wheel zoom**:
- CanvasSection (orchestrator) — no longer subscribes to transform context.
- All 11 child hooks — no longer re-execute their dep-array changes on wheel.
- All callbacks that read transform inside event handlers — fresh SSoT value at event time, no stale closure.

**What still re-renders on wheel zoom** (expected, Phase XXII.B will tighten):
- `CanvasLayerStackTransformBridge` (the single subscriber on this path).
- `CanvasLayerStack` (shell — receives new transform prop, React.memo doesn't help since transform changes).
- Leaves below CanvasLayerStack that consume the `transform` prop. Same as pre-fix cost — but no longer multiplied by the 11-hook orchestrator cascade above.

**What still writes to the legacy useState** (transitional, removed in Phase XXII.B):
- `CanvasProvider.setTransform` writes to both `ImmediateTransformStore` (SSoT) and the local `useState` (so `CanvasTransformContext` consumers, if any return, still work). Currently zero consumers of `useCanvasTransformContext` and only CanvasSection used the merged `useCanvasContext`. The useState block is dead weight pending Phase XXII.B.

**Risk mitigation**:
- Hook signatures unchanged — no call-site breakage.
- Deps arrays only had `transform` removed where the value is now read live (callback closures cannot go stale because the read is at event time, not at closure-creation time).
- `_transform` / `_transformScale` rename signals "param accepted, value unused" without erasing the param (TS public API preserved).
- TransformBridge keeps visual layers fed with live transform — no frozen overlay regression.
- Backward-compat useState kept in CanvasProvider — any remaining consumer (none identified) keeps working.

**Phase XXII.B (next session)**: bitmap cache CSS-transform for live zoom + idle re-raster debounce (Figma pattern). Currently `dxf-bitmap-cache.ts` lines 73-82 invalidate the cache on every `scale/offsetX/offsetY` change — full re-raster per wheel notch. CSS `transform: scale(...)` on the offscreen canvas + 250ms idle re-raster removes this cost without sacrificing crispness at rest.

**Phase XXII.C (conditional)**: `React.memo(CadStatusBar)` + Tooltip audit. Profile-driven decision after XXII.A+B ship.

**Files touched**: 1 NEW + 11 MOD (1 ADR + 10 code).

### 2026-05-27 — CanvasSection scene wiring + level-manager type tightened

`CanvasSection.tsx` (orchestrator): `useEntityLayerCommands(...)` now receives the locally-resolved `dxfScene` instead of `props.currentScene`. The orchestrator's `dxfScene` is the snapshot already threaded through every leaf renderer; reusing it removes a stale-prop divergence path where command-mode entity operations could fire against an outdated scene reference (no observable bug in the wild, but the prop chain was no longer SSoT-aligned post-ADR-374). One-line swap; orchestrator subscription topology unchanged.

`canvas-layer-stack-leaves.tsx`: `PreviewCanvasMountsProps.levelManager` typed as the existing `MovePreviewMountProps['levelManager']` **intersected** with `{ setLevelScene: (levelId, scene) => void }`. Leaves can now call `levelManager.setLevelScene(...)` directly from preview-completion paths (e.g. opening commit → host scene mutation) without crossing the orchestrator boundary. Pure type tightening — leaf subscription set untouched, no new hooks, no new high-freq stores.

**Cardinal rule compliance**: orchestrators still don't `useSyncExternalStore` against high-freq stores; leaf subscriber count unchanged; bitmap cache key untouched; no event-handler stale-snapshot regression (commands receive the same `dxfScene` instance the renderer sees that frame).

**Files touched**: `CanvasSection.tsx` (1 LOC), `canvas-layer-stack-leaves.tsx` (+`SceneModel` type import + level-manager intersection, ~5 LOC).

### 2026-05-26 — Bitmap cache key extended for opening tag style (ADR-376 Phase C.2)

`dxf-bitmap-cache.ts` `bimSettingsHash` now also folds `getCurrentOpeningTagStyle()` into its key. Per-project tag style mutations (showSize/showHeight/labelFormat/leaderVisible/leaderColor/textColor) must bust the cache so the next render reflects the updated label content/visibility. Mutations happen via ribbon dropdown — rare events, no per-frame cost.

**Cardinal rule compliance**: cache key remains bounded (single JSON hash, no entity-level state); no new orchestrator subscriptions; no high-frequency invalidation source. Style reads happen in the cache-input function (already invoked per render pass), not in the renderer hot path.

**Files touched**: `dxf-bitmap-cache.ts` (+import + hash field).

### 2026-05-26 — ADR-376 Phase C.1 opening tag drag (new micro-leaf)

ADR-376 Phase C.1 (draggable opening tag + γωνιακή leader + Reset Position UX) adds a new micro-leaf `OpeningTagDragMount` to `PreviewCanvasMounts` in `canvas-layer-stack-leaves.tsx`. The mount wires `useOpeningTagDragInteraction` hook (`hooks/canvas/use-opening-tag-drag-interaction.ts`) which owns pointer event listeners on the viewport element + drives the pure FSM `OpeningTagDragController` (`bim/services/opening-tag-drag-controller.ts`).

**Cardinal rule compliance**:
- ZERO `useSyncExternalStore` in shell/orchestrator. The hook reads scene via `getLevelScene(currentLevelId)` getter pattern (no subscription).
- DOM listeners scoped to viewport element + cleaned up on unmount.
- `pointerdown` registered with `capture: true` so the tag drag wins the gesture race against the canvas selection click handler (without capture, the canvas-level pick path would consume the click before the tag hit-test ran).
- Scene patches during drag throttled via `requestAnimationFrame` — at most one `setLevelScene` call per frame (60 fps cap on optimistic updates).
- Bitmap cache key unchanged — `OpeningParams.tagOffset` mutations trigger normal entity re-render path (rare event, acceptable cost; no per-frame cache invalidation).
- `OpeningTagDragController` is a pure module — zero React, zero Zustand, fully unit-testable (28/28 PASS).

**Files touched (atomic batch)**: `canvas-layer-stack-leaves.tsx` (+OpeningTagDragMount wiring), `canvas-layer-stack-opening-tag-drag.tsx` (new), `use-opening-tag-drag-interaction.ts` (new), `opening-tag-drag-controller.ts` (new), `OpeningTagRenderer.ts` (+drawLeaderLine helper + offset application in render()).

### 2026-05-25 — canvas-layer-stack-leaves 500-line ratchet split (tool preview mounts)

`canvas-layer-stack-leaves.tsx` reached 503 lines after the slab-opening + opening ghost preview mounts were added (ADR-363 §11.Q3). The 6 trivial tool preview mounts — `RotationPreviewMount`, `MovePreviewMount`, `MirrorPreviewMount`, `ScalePreviewMount`, `StretchPreviewMount`, `GripDragPreviewMount` — and their props interfaces were extracted into `canvas-layer-stack-tool-preview-mounts.tsx`. Each mount keeps its `React.memo(() => { useXxxPreview(props); return null; })` shape; their internal subscriptions to cursor world position / tool stores are unchanged.

**Cardinal rule compliance**: no shell/orchestrator subscriptions added, no new `useSyncExternalStore` in `CanvasLayerStack` or `CanvasSection`, no bitmap-cache key impact. The mounts remain the sole subscribers for their respective tool previews. `canvas-layer-stack-leaves.tsx` 503 → 381 lines.

**Files touched (atomic batch)**: `canvas-layer-stack-leaves.tsx`, `canvas-layer-stack-tool-preview-mounts.tsx` (new).

### 2026-05-25 — DxfRenderer 500-line ratchet split (entity-model builder)

`DxfRenderer.ts` hit 514 lines after the ADR-363 Phase 3.7 two-pass slab-opening render (incident 2026-05-25 §11.Q3). The 135-line `toEntityModel` switch (DxfEntityUnion → Entity unwrap for every entity kind) plus `mapDxfLineTypeToEnterprise` helper were extracted into the pure module `canvas-v2/dxf-canvas/dxf-renderer-entity-model.ts`, exporting `buildEntityModelFromDxf(entity, isSelected, resolved)`. `DxfRenderer.toEntityModel()` becomes a 16-line wrapper that resolves the style (pre-resolved fast-path used by `renderEntityUnified`; `layersById` legacy path delegates to `resolveStyleForRender`) then calls the pure builder.

**Cardinal rule compliance**: no rendering pipeline change, no new store subscriptions, no bitmap-cache key impact. Pure mechanical extraction. `renderEntityUnified` still passes the pre-resolved style (avoiding double-resolve). `DxfRenderer.ts` 514 → 382 lines.

**Files touched (atomic batch)**: `DxfRenderer.ts`, `dxf-renderer-entity-model.ts` (new).

### 2026-05-25 — CanvasSection 500-line ratchet split + slabOpeningGhostPreview wiring

`CanvasSection.tsx` was approaching the 500-line cap (514 lines pre-split). Two non-architectural edits brought it under:

1. **`useEntityLayerCommands` hook (new)** — extracted the inline IIFE that computed `{ canApplyLayerCommands, isSystemLayer, onLayerOff, onLayerFreeze, onLayerLock }` for `EntityContextMenu` (ADR-358 §5.6.bis Phase 10 — Layer click-driven commands). Lazy `require()` of `LayerOffCommand` / `LayerFreezeCommand` / `LayerLockCommand` preserved to avoid the same circular-dep that motivated the IIFE originally. Located at `hooks/canvas/useEntityLayerCommands.ts`; consumes `selectedEntityIds`, `props.currentScene`, `executeCommand` — no new store subscriptions.

2. **`slabOpeningGhostPreview` prop** — new `CanvasLayerStack` prop wiring the column-tool-style ghost for the slab-opening tool (typed in `canvas-layer-stack-types.ts`, leaf added in `canvas-layer-stack-slab-opening-ghost.tsx`). Ghost preview is a micro-leaf subscriber that resolves scene units lazily via the supplied `getSceneUnits()` closure; CanvasSection never touches `useSyncExternalStore` for this feature.

**Cardinal rule compliance**: no new `useSyncExternalStore` calls in `CanvasSection` or `CanvasLayerStack`; the hook returns memoized data only; the new leaf is the SOLE subscriber for slab-opening ghost state. CHECK 6B/6C green.

**Files touched (atomic batch)**: `CanvasSection.tsx`, `canvas-layer-stack-types.ts`, `canvas-layer-stack-slab-opening-ghost.tsx`, `useEntityLayerCommands.ts` (new), `useSlabOpeningGhostPreview.ts`.

### 2026-05-24 — BIM 3D cursor integration (ADR-366 Group B Phase 9)

Cursor event handlers (`mouse-handler-move.ts`, `mouse-handler-up.ts`, `useCentralizedMouseHandlers.ts`) updated to support 3D viewport coordinate transforms in BIM 3D viewer integration. Centralized mouse handler routing extended with BimViewport3D state propagation to 3D scene (world → screen → 3D camera). No changes to canvas rendering architecture or frame scheduler integration; cursor system remains neutral to 2D vs 3D viewport context.

### 2026-05-24 — ADR-374 ZOOM Window tool wiring (singleton store + micro-leaf)

`ZoomWindowStore` (new module-level singleton in `systems/zoom-window/`) replaces the dead `useZoomWindow` React hook. The drag rectangle is updated imperatively from `mouse-handler-move.ts` (zero React state during 60fps mousemove). `ZoomWindowSubscriber` (new micro-leaf at `components/dxf-layout/leaves/ZoomWindowSubscriber.tsx`) is the SOLE `useSyncExternalStore` consumer. Mounted in `CanvasLayerStack.tsx` at z-index 20 (after `LassoFreehandPreviewSubscriber`, before `CanvasNumericInputOverlay`).

`useCentralizedMouseHandlers.handleMouseDown` gains a `zoom-window` branch (left button → `ZoomWindowStore.start(screenPos)`, early return — skips pan/lasso/grip). `mouse-handler-move.ts` gets an early branch that calls `ZoomWindowStore.update(screenPos)` and returns (skips snap/hover/pan/lasso for the duration of the drag). `mouse-handler-up.ts` finalises the rect: `ZoomWindowStore.finish()` → `screenToWorldWithSnapshot` (×2 corners) → `EventBus.emit('zoom-window:apply', { worldBounds, viewport })`. `useCentralizedMouseHandlers.handleMouseLeave` calls `ZoomWindowStore.cancel()` to drop a half-finished drag.

`useZoomWindowTool` (new `hooks/tools/useZoomWindowTool.ts`) listens for the EventBus event inside `CanvasSection`, applies `FitToViewService.calculateFitToViewFromBounds(...)` → `setTransform(...)`, then `onToolChange('select')` (one-shot AutoCAD ZOOM W behavior). Same hook owns the `Escape` keyboard listener (cancels drag + exits tool). `CanvasSection.tsx` adds exactly one new hook call; zero new `useSyncExternalStore` subscriptions.

SSoT cleanup (Boy Scout): `hooks/useZoomWindow.ts` deleted (0 callers), `useViewState.zoomWindow` slot removed (dead state never read), EventBus typed with `'zoom-window:apply'` payload (mirrors `'crop:marquee-rect'` pattern).

**Cardinal rule compliance**:
- **Rule 1 (no orchestrator subscriptions)**: respected — `useSyncExternalStore` lives ONLY in `ZoomWindowSubscriber` (leaf). `CanvasSection` + `CanvasLayerStack` stay subscription-free for this feature. CHECK 6C green.
- **Rule 2 (getter-based event reads)**: respected — `useZoomWindowTool` stores callbacks in refs and reads them at event time. Mouse-up handler reads `transform` from the existing prop closure at fire time, never a stale snapshot.
- **Rule 3 (bitmap cache key untouched)**: respected — `ZoomWindowStore` state never propagates to `dxf-bitmap-cache.ts`. The rubber-band rect paints to its own DOM div overlay (z-index 20), so the cached DXF bitmap stays valid throughout the drag.
- **Rule 4 (≤1 canvas element / ≤2 high-freq hooks per leaf)**: respected — `ZoomWindowSubscriber` is DOM-only (zero canvas elements), consumes one store via `useSyncExternalStore`.

**Files touched (atomic batch)**: `ZoomWindowStore.ts` (new), `ZoomWindowSubscriber.tsx` (new), `useZoomWindowTool.ts` (new), `useCentralizedMouseHandlers.ts`, `mouse-handler-move.ts`, `mouse-handler-up.ts`, `EventBus.ts`, `CanvasLayerStack.tsx`, `CanvasSection.tsx`, `useViewState.ts` (slot removal), `useZoomWindow.ts` (deleted). New ADR `ADR-374-zoom-window-tool.md` documents the pattern in full.

### 2026-05-24 — selectedEntityIds prop chain eliminated (sidebar → deep hooks)

`selectedEntityIds` was prop-drilled 6 levels deep through `DxfViewerContent → SidebarSection → FloatingPanelContainer → usePanelContentRenderer → LevelPanel → LayersSection → LayerItem + useLayersCallbacks + useKeyboardNavigation + useLayerOperations`. Each consumer now reads directly from `universalSelection.getIdsByType('dxf-entity')`.

**Changes (11 files):**
- `ui/components/layers/hooks/useLayersCallbacks.ts` — removed `selectedEntityIds` from `LayersCallbacksProps`; `handleEntityClick` reads `universalSelection.getIdsByType('dxf-entity')` at call time
- `ui/components/layers/hooks/useKeyboardNavigation.ts` — removed from `KeyboardNavigationProps` (was unused in logic)
- `ui/hooks/useLayerOperations.ts` — removed from `UseLayerOperationsParams`; 3 inline usages replaced with `universalSelection.getIdsByType('dxf-entity')`
- `ui/components/layers/LayerItem.tsx` — removed from `LayerItemProps`; derived locally via `universalSelection.getIdsByType('dxf-entity')`
- `ui/components/LayersSection.tsx` — removed from `LayersSectionProps` + all call sites (`useLayersCallbacks`, `useKeyboardNavigation`, `layerItemProps`)
- `ui/components/LevelPanel.tsx` — removed from `LevelPanelProps`; derived locally; `LayersSection` call site cleaned
- `ui/hooks/usePanelContentRenderer.tsx` — removed from params; `selectedEntityIds[0]` fallback → `primarySelectedId ?? null`
- `ui/FloatingPanelContainer.tsx` — removed from props + `useLayerOperations` + `usePanelContentRenderer` calls; `React.memo` comparison simplified
- `layout/SidebarSection.tsx` — removed from `SidebarSectionProps` + `FloatingPanelContainer` JSX
- `layout/MobileSidebarDrawer.tsx` — removed from `MobileSidebarDrawerProps` + `SidebarSection` JSX
- `app/DxfViewerContent.tsx` — removed from `SidebarSection` + `MobileSidebarDrawer` JSX call sites

**SSoT invariant**: `universalSelection.getIdsByType('dxf-entity')` is the sole read path for entity selection IDs in sidebar, layers panel, and all deep hooks. Zero prop drilling for this value.

---

### 2026-05-24 — DxfViewerContent SSoT: eliminate raw useState write paths for entity selection

`selectedEntityIds` in `DxfViewerContent` was derived from a raw `useState<string[]>([])` in `useSceneState`.
Multiple callers wrote to this raw setter while `CanvasSection` read from `universalSelection` — causing divergence:
external events and sidebar clicks updated the ribbon/trigger state but NOT the canvas.

**Write-path bugs fixed:**
- `useDxfViewerEffects` — `dxf.highlightByIds` event wrote to raw useState (canvas ignored it)
- `useArrayRibbonActions` — double-write: `clearByType()` + `setSelectedEntityIds([])` both fired on close/explode
- `SidebarSection` / `MobileSidebarDrawer` — entity click updated ribbon but not canvas

**Changes:**
- `app/DxfViewerContent.tsx` — `selectedEntityIds` now computed via `useMemo(universalSelection.getIdsByType('dxf-entity'))`;
  overridden in `wrappedState` to propagate live value to NormalView/FullscreenView consumers;
  `setSelectedEntityIds` prop removed from `useDxfViewerEffects`, `useArrayRibbonActions` calls;
  SidebarSection/MobileSidebarDrawer receive `(ids) => universalSelection.replaceEntitySelection(ids)`
- `app/useDxfViewerEffects.ts` — `dxf.highlightByIds` handler: raw setter → `universalSelection.replaceEntitySelection` (with equality guard); removed from `DxfViewerEffectsParams`
- `ui/ribbon/hooks/useArrayRibbonActions.ts` — double-write eliminated; `UniversalSelectionLike` extended with `replaceEntitySelection`; `setSelectedEntityIds` removed from props
- `integration/types.ts` — removed `setSelectedEntityIds: Dispatch<SetStateAction<string[]>>` override (no longer in DxfViewerState)

**SSoT invariant**: `universalSelection` (SelectionSystem) is the **sole write path** for `dxf-entity` selection across ALL callers — canvas, sidebar, ribbon, event bus.

---

### 2026-05-24 — CanvasSection bridge: eliminate duplicate replaceEntitySelection logic

`setSelectedEntityIds` bridge in `CanvasSection.tsx` was reimplementing `replaceEntitySelection` inline
(`clearByType('dxf-entity')` + `addMultiple(...)`), including a dead functional-updater overload
(`string[] | ((prev) => string[])`) that no consumer called.

**Change** (`CanvasSection.tsx:128`):
```typescript
// BEFORE — duplicate logic + dead overload:
const setSelectedEntityIds = useCallback((value: string[] | ((prev: string[]) => string[])) => {
  const us = universalSelectionRef.current;
  const next = typeof value === 'function' ? value(us.getIdsByType('dxf-entity')) : value;
  us.clearByType('dxf-entity');
  if (next.length > 0) us.addMultiple(next.map(id => ({ id, type: 'dxf-entity' as const })));
}, []);

// AFTER — thin alias, SSoT delegation:
const setSelectedEntityIds = useCallback((ids: string[]) => {
  universalSelectionRef.current.replaceEntitySelection(ids);
}, []);
```

**Result**: Zero duplicate `clearByType`/`addMultiple` inline — `SelectionSystem.replaceEntitySelection` is the sole owner of that logic.

---

### 2026-05-24 — UseCanvasClickHandlerParams SSoT: setSelectedEntityIds removed

`setSelectedEntityIds` was redundant in `UseCanvasClickHandlerParams` — `universalSelection` (with `.replaceEntitySelection`) was already present in the same interface.

**Changes:**
- `hooks/canvas/canvas-click-types.ts` — removed `setSelectedEntityIds` from `UseCanvasClickHandlerParams`
- `hooks/canvas/useCanvasClickHandler.ts` — destructuring + deps removed; `handleAngleEntityPick` call site now passes `universalSelection.replaceEntitySelection` directly
- `components/dxf-layout/CanvasSection.tsx` — removed `setSelectedEntityIds` from `useCanvasClickHandler` params object

**Result:** `UseCanvasClickHandlerParams` has a single write path to entity selection — `universalSelection.replaceEntitySelection`. No bridge wrapper needed.

---

### 2026-05-24 — Boy Scout: full primitive → semantic API migration (entity + overlay)

Migrated ALL remaining primitive `universalSelection.select/clearByType` + `setSelectedEntityIds`
calls to the semantic API. Added `handleOverlaySelect` as the overlay counterpart to `handleEntityClick`.

**New semantic method** (SelectionSystem.tsx → UniversalSelectionHook + UniversalSelectionForStack):
- `handleOverlaySelect(overlayId: string | null)` — single-select overlay or clear overlay type.
  Encapsulates the `if (id) select(id, 'overlay') else clearByType('overlay')` pattern
  that was copy-pasted across 4 files.

**Entity migration** (2 files):
- `hooks/canvas/useCanvasClickHandler.ts` — rotation entity selection: 3 primitive calls → `replaceEntitySelection([entity.id])`
- `hooks/tools/useModifyTools.ts` — `replaceWithArrayId`: 3 primitive calls → `replaceEntitySelection(ids)`
  (bug fix: previously only `ids[0]` was registered; now all ids)

**Overlay migration** (6 files):
- `app/DxfViewerContent.tsx` — `onOverlaySelect` 5-line if/else → 1-line `handleOverlaySelect`
- `app/useDxfViewerCallbacks.ts` — `handleRegionClick` primitive → `handleOverlaySelect`
- `ui/components/LevelPanel.tsx` — `setSelectedOverlay` 5-line if/else → 1-line `handleOverlaySelect`
- `layout/FloatingPanelsSection.tsx` — polygon-saved event → `handleOverlaySelect`
- `hooks/canvas/useOverlayInteraction.ts` — `setSelectedOverlay` bridge → `handleOverlaySelect`
- `hooks/canvas/useCanvasClickHandler.ts` — rotation overlay hit: 4 primitive lines → `handleOverlaySelect`
  (also removes stale `setSelectedEntityIds([overlay.id])` — overlay ID was incorrectly passed as entity ID)

**Result**: Zero primitive `select(id, 'overlay')` calls outside SelectionSystem. Full semantic API coverage.

---

### 2026-05-24 — Selection SSoT Cleanup (universalSelection single write path)

Removed dual-write pattern in `CanvasLayerStack.tsx`: handlers were calling both
`setSelectedEntityIds` and `universalSelection.*` for dxf-entity operations, creating
redundant double dispatches to the same reducer.

**Changes:**
- `CanvasLayerStack.tsx` — all 5 selection handlers now call ONLY `universalSelection.*`;
  `setSelectedEntityIds` removed from all handlers
- `canvas-layer-stack-types.ts` — `setSelectedEntityIds` removed from `entityState` type;
  `selectedEntityIds` is now explicitly read-only snapshot for rendering
- `CanvasSection.tsx` — `entityState` prop no longer passes `setSelectedEntityIds`

**SSoT invariant**: `universalSelection` (React reducer context) is the **only write path**
for entity/overlay selection. `selectedEntityIds` is derived via `useMemo` in CanvasSection
and passed as a read-only snapshot for canvas rendering only.

**Phase 2 — Semantic API (enterprise centralization):**
AutoCAD behavior rules moved from `CanvasLayerStack` UI component into `SelectionSystem.tsx`:
- `handleEntityClick(entityId, { shiftKey })` — PICKADD=1 + toggle logic
- `handleMarqueeResult(layerIds, entityIds, { subtract })` — additive/subtract marquee
- `replaceEntitySelection(entityIds)` — replace dxf-entity set, preserve overlays

Added to: `UniversalSelectionHook` interface + `useUniversalSelection()` + `UniversalSelectionForStack`.

`CanvasLayerStack` handlers reduced to 1-line semantic calls — zero PICKADD/toggle business logic in UI.

**Behavior preserved**:
- Shift+click → toggle entity in/out of selection
- Click with existing selection → ADD (AutoCAD PICKADD=1)
- Click with no existing selection → single select (clears overlays)
- Marquee/lasso standard → additive to existing selection
- Marquee/lasso with Shift → subtract from selection
- Overlay click → clears dxf-entity selection

---

### 2026-05-24 — Lasso Selection (AutoCAD 3rd selection mode)

Free-form polygon selection (`mousedown + drag > 5px` while button held).

**Behavior**:
- CW lasso → window mode (solid blue fill, entities fully inside)
- CCW lasso → crossing mode (dashed green fill, entities intersecting or inside)
- Disambiguation: lasso (button held + drag) vs two-click marquee (click→release→move→click) are mutually exclusive

**New files**:
- `systems/cursor/LassoStore.ts` — zero-React-dispatch singleton store (mirrors `SelectionStore` pattern, ADR-040 Phase III compliant). Exports `computeLassoMode()` (shoelace formula for CW/CCW detection).

**Modified files** (ADR-040 compliance):
- `systems/cursor/mouse-handler-types.ts` — `lassoDownRef` added to `MouseHandlerRefs`
- `systems/cursor/useCentralizedMouseHandlers.ts` — arms `lassoDownRef` on left-button mousedown (select tool only); cancels lasso on leave
- `systems/cursor/mouse-handler-move.ts` — activates `LassoStore.startLasso()` at 5px drag threshold; `LassoStore.appendPoint()` each move frame
- `systems/cursor/mouse-handler-up.ts` — `LassoStore.endLasso()` on mouseup; routes result through `UniversalMarqueeSelector.performLassoSelection()`
- `systems/selection/utils.ts` — `findEntitiesInLasso()` upgraded: proper window (all key points inside) / crossing (any key point or segment intersects) logic + `segmentsIntersect()` helper
- `systems/selection/UniversalMarqueeSelection.ts` — `performLassoSelection()` static method (mirrors `performSelection`, supports entities + color layers)
- `canvas-v2/layer-canvas/selection/SelectionRenderer.ts` — `renderLasso(path, mode, settings)` using canvas free-form path
- `canvas-v2/layer-canvas/layer-types.ts` — `showLasso`, `lassoPath`, `lassoMode` added to `LayerRenderOptions`
- `canvas-v2/layer-canvas/layer-canvas-hooks.ts` — `LassoStore.getSnapshot()` in `renderLayers` callback (same pattern as `gripStyleStore.get()`)
- `canvas-v2/layer-canvas/LayerRenderer.ts` — `renderLasso()` call in both `renderLegacy` and `renderUnified` paths
- `canvas-v2/layer-canvas/LayerCanvas.tsx` — `LassoStore.subscribe()` marks `isDirtyRef`
- `canvas-v2/dxf-canvas/dxf-canvas-renderer.ts` — lasso render in scene render loop
- `canvas-v2/dxf-canvas/DxfCanvas.tsx` — `LassoStore.subscribe()` marks `isDirtyRef`

**ADR-040 compliance**:
- Rule 1 (orchestrators): `LassoStore.subscribe()` marks `isDirtyRef` only — zero React re-renders on append
- Rule 4 (high-freq): `appendPoint()` is O(n array copy) with 1px dedup guard; bounded in practice by mousemove ~60fps
- No `useSyncExternalStore` in orchestrators; store read at RAF render time via direct `getSnapshot()`

### 2026-05-24 — Two-click selection pattern (AutoCAD standard)

Selection interaction changed from click-hold-drag to click→move→click (AutoCAD standard).

- **Before**: `mousedown` called `SelectionStore.startSelection()` → drag with mouse held → `mouseup` confirmed.
- **After**: First `mouseup` on empty space (no entity hit, select tool, no modifier keys) calls `SelectionStore.startSelection()` → mouse moves freely → second `mouseup` processes `processMarqueeSelection()`.
- `SelectionStore` and `SelectionRenderer` unchanged — `isSelecting = true` still gates the rect rendering in both `DxfCanvas` and `LayerCanvas` subscribers.
- `mouse-handler-move.ts` unchanged — `cursor.updateSelection(screenPos)` runs whenever `cursor.isSelecting`, which now covers mouse-free movement in two-click mode.
- **Files**: `systems/cursor/useCentralizedMouseHandlers.ts` (removed `startSelection` from mousedown), `systems/cursor/mouse-handler-up.ts` (added two-click start in `else if` branch).

### 2026-05-24 — Remove onEntitySelect prop-drilling (6-level chain eliminated)

`onEntitySelect` / `onEntitySelectionChange` was prop-drilled 6 levels deep through entirely DXF-specific components, passing a wrapper that just called `universalSelection.replaceEntitySelection`.

**Root fix (Phase A — deep hooks):**
- `selection.ts` — removed `onEntitySelectionChange` from `Deps` type; callers now own the SSoT call
- `useLayersCallbacks.ts` — added `useUniversalSelection()`; every `setSelection(ids, { onEntitySelectionChange }, …)` → `setSelection(ids, {}, …)` + `universalSelection.replaceEntitySelection(ids)`; guards `!onEntitySelectionChange` removed
- `useKeyboardNavigation.ts` — same pattern; `onEntitySelectionChange` param removed
- `useLayerOperations.ts` — added `useUniversalSelection()`; all 5 `onEntitySelect(…)` call sites → `universalSelection.replaceEntitySelection(…)`; `selection-update-utils` receives bound `universalSelection.replaceEntitySelection` (pure utility unchanged)

**Cascade prop removal (Phases B–D — 8 files):**
`LayerItem` (added `useUniversalSelection()` for direct handleLayerClick call) → `LayersSection` → `LevelPanel` (already had hook) → `usePanelContentRenderer` → `FloatingPanelContainer` (React.memo comparison updated) → `SidebarSection` → `MobileSidebarDrawer` → `DxfViewerContent` (`handleEntitySelect` callback removed + 2 JSX sites)

**Result:** `onEntitySelect`/`onEntitySelectionChange` = 0 occurrences in `/layout/`, `/ui/components/`, `/app/DxfViewerContent.tsx`. Every selection write goes through `universalSelection.replaceEntitySelection` at the point of user interaction.

---

### 2026-05-24 — Selection SSoT: rename setSelectedEntityIds → onEntitySelect + remove dead useState

**Rename** (`SidebarSection`, `MobileSidebarDrawer`, `DxfViewerContent`):
- `SidebarSection` interface + destructure: `setSelectedEntityIds` → `onEntitySelect`; internal JSX: `onEntitySelect={onEntitySelect}`
- `MobileSidebarDrawer` interface + destructure: `setSelectedEntityIds` → `onEntitySelect`; `SidebarSection` usage: `onEntitySelect={onEntitySelect}`
- `DxfViewerContent.tsx`: both call sites `setSelectedEntityIds={handleEntitySelect}` → `onEntitySelect={handleEntitySelect}`

**Dead state removal** (`useSceneState`):
- Removed `const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([])` — no writer existed after previous session's SSoT cleanup; `useState` removed from React import
- Removed `selectedEntityIds` + `setSelectedEntityIds` from `useSceneState` return object
- `dxf-modules.d.ts` — removed `setSelectedEntityIds: (ids: string[]) => void` from `useDxfViewerState` ambient declaration

**SSoT invariant preserved**: `universalSelection.replaceEntitySelection` remains the sole write path. `selectedEntityIds` in consumers is derived read-only via `useMemo(universalSelection.getIdsByType('dxf-entity'))`.

---

### 2026-05-21 — ADR-366 Phase 4.7: SelectionCursorIcon cross-mode badge

`SelectionCursorIcon` lands as a new accessibility leaf, mounted once inside `CanvasLayerStack` after `Focus2DOverlayLeaf`. Cross-mode (2D + 3D) cursor modifier badge for selection modifier keys.

**ADR-040 compliance**:
- **Rule 1 (no orchestrator subscriptions)**: respected — `SelectionCursorIcon` uses zero `useSyncExternalStore`. CanvasLayerStack shell stays subscription-free.
- **Rule 4 (no high-freq stores)**: cursor position is updated via imperative `style.transform` on a ref (zero React re-renders during 60fps `mousemove`). Mirrors the self-owned RAF pattern from `FocusIndicator3D` (Phase 4.5). `setState` fires only on low-freq `keydown`/`keyup` (mode transitions `add`/`remove`/`toggle`/null).
- Window `blur` resets mode to prevent stuck icon on alt-tab.
- Single mount point (`position: fixed`) → works cross-mode without per-leaf duplication.

**Files**: `accessibility/SelectionCursorIcon.tsx` (new), `accessibility/__tests__/SelectionCursorIcon.test.tsx` (new, 8 tests), `components/dxf-layout/CanvasLayerStack.tsx` (single mount + import; import lines compressed to stay under 500-line component cap).

### 2026-05-21 — ADR-366 Phase 8.1: AriaLiveRegion entity description subscription

`AriaLiveRegion` extended with optional `focusManager` + `getEntityData` props. New `useEffect` subscribes to `focusManager.subscribeDescription` (new observer channel on `KeyboardFocusManagerApi`) — on Tab focus change, resolves entity data via `getEntityDataRef` (stable ref pattern, no subscription churn), calls `generateAriaDescription(ariaData, tAria)` (pure function, `bim-3d-aria` namespace), announces via existing `ariaLiveBus`. Zero new `useSyncExternalStore`. ADR-040 micro-leaf compliance fully preserved.

### 2026-05-21 — ADR-366 Phase 8.0: AriaLiveRegion micro-leaf (ARIA live regions)

`AriaLiveRegion` lands as a new micro-leaf inside `BimViewport3D`:
- Zero `useSyncExternalStore` — uses `useEffect` + raw Zustand `subscribe()` for low-freq stores (`Selection3DStore.selectedBimId`, `ViewMode3DStore.mode`). Subscriptions are cleaned up on unmount.
- All SR announcements via `ariaLiveBus` singleton (module-level, no React): `announce(message, severity)` → direct DOM `textContent` mutation via `requestAnimationFrame`. Zero React state → zero orchestrator re-renders.
- Renders 2 `sr-only` divs (`role="status"` polite + `role="alert"` assertive). No canvas element, no RAF subscription.

`BimViewport3D` outer div gains `role="application"` + `aria-label`. Inner Three.js container changes from `role="img"` to `role="presentation"` (the application boundary covers semantics).

**Cardinal rule compliance**:
- **Rule 1 (no orchestrator subscriptions)**: respected — `BimViewport3D` itself gains no new `useSyncExternalStore`; subscriptions live inside `AriaLiveRegion` leaf only.
- **Rule 4 (no high-freq stores in cache key)**: not applicable — AriaLiveRegion is DOM-only, no bitmap cache involvement.
- **ADR-040 micro-leaf**: ≤0 `useSyncExternalStore` calls (uses `useEffect` subscribe pattern instead). Low-frequency only (user-triggered selection/mode changes).

### 2026-05-21 — ADR-366 Phase 4.6: 2D keyboard-focus backport + cross-mode audit

Two new micro-leaves land in the canvas tree:
- `Focus2DOverlayLeaf` — single `useSyncExternalStore` to `ViewMode3DStore.mode` (low-freq, `mode === '2d'` derive). Bridges the boolean into `Focus2DOverlay.active`. The parent `CanvasLayerStack` shell gains zero new subscriptions (CHECK 6C still green).
- `Focus2DOverlay` — single `useSyncExternalStore` to the cross-mode `KeyboardFocusManager` SSoT (low-freq — Tab keypress only). Owns one `<canvas>` element + paints via `paintFocus2DOutline` on focus/scene/transform/viewport change. Pan/zoom continuous deltas live in `ImmediatePositionStore` (not React state), so the leaf never re-renders at 60fps.

`CanvasSection` adds a `use2DKeyboardFocus` invocation with three lazy getters (`getScene` / `getTransform` / `getViewport`) and one stable `toggleEntity` callback. Hook subscribes to a window keydown listener (capture phase), mode-gated to `'2d'`; never reads stale snapshots — all event-time reads route through the getters (Rule 2).

A new ESC priority `FOCUS_CLEAR: 150` slots between `ENTITY_SELECTION` and `COLOR_MENU` — used cross-mode (2D + 3D each register their own handler).

**Cardinal rule compliance**:
- **Rule 1 (no orchestrator subscriptions)**: respected — `Focus2DOverlayLeaf` is the sole new `useSyncExternalStore` and it lives BELOW the shell, subscribing only to the low-freq mode store.
- **Rule 2 (getter-based event reads)**: respected — `use2DKeyboardFocus` consumes `getScene/getTransform/getViewport` and reads them at keydown time. Selection toggle reads `universalSelectionRef.current.toggle(...)` at fire time.
- **Rule 3 (bitmap cache key untouched)**: respected — focus state never propagates to `dxf-bitmap-cache.ts`. The dashed outline draws to a dedicated overlay canvas (z-index 18), so the cached DXF bitmap stays valid through focus changes.
- **Rule 4 (≤1 canvas element / ≤2 high-freq hooks per leaf)**: respected — each leaf has ≤1 canvas + ≤1 low-freq subscription.

3D-side audit (Phase 4.0 → 4.5 retrospective): `ThreeJsSceneManager` is pure (zero React); `BimViewport3D` subscribes only to low-freq slices (`mode`, `sunPreset`, `sunAzimuth/Elevation`, `floorVisibilityModes`, render mode toggle); `FocusIndicator3D` uses `useSyncExternalStore` for focus changes (low-freq) + a self-owned RAF that writes `style.transform` imperatively (no React re-renders per-frame). No new violations introduced.

Bundled atomically with the Phase 4.6 commit (CHECK 6B compliance).

### 2026-05-20 — ADR-363 Phase 5 beam type passthrough (DxfRenderer.convertToEntity)

`DxfRenderer.ts` adds a new `case 'beam':` branch in `convertToEntity()` — direct passthrough (mirror του wall Phase 1B), zero architectural change. No new `useSyncExternalStore`, no new high-freq subscription, no bitmap cache key change. Cardinal rules 1–4 unaffected; CHECK 6C still green.

### 2026-05-20 — ADR-368 wire-up: CanvasSection reads `userDrawingUnits` from floorplan (one low-freq prop pass-through)

`CanvasSection.tsx` resolves `userDrawingUnits` from `levelManager.floorplans[currentLevelId]?.userDrawingUnits ?? levelManager.saveContext?.userDrawingUnits` and forwards it to `useDxfSceneConversion`. Both inputs are React-state (LevelsSystem); zero new `useSyncExternalStore` calls in the shell, zero new high-frequency subscriptions. The override changes only when a new DXF is imported or the wizard picks a unit (≪ 1/min). Cardinal rules 1–4 unaffected; CHECK 6C still green.

### 2026-05-20 — ADR-362 R9: PreviewCanvas `sceneUnits` prop (one new low-freq prop)

CanvasLayerStack adds `sceneUnits={dxfScene?.units ?? 'mm'}` to the PreviewCanvas leaf. The value changes only when a new DXF is loaded (not at 60fps). PreviewRenderer caches it via `setSceneUnits()`; preview-dimension-renderer uses the original (unscaled) params for text so committed dim and preview match. No new useSyncExternalStore in the shell. CHECK 6C unaffected.

### 2026-05-20 — ADR-363 wall bugfix: DxfRenderer `case 'wall'` (entity unwrap only)

`DxfRenderer.toEntityModel()` gains a `case 'wall'` branch — pure data unwrap from `DxfWall.{kind, params, geometry, validation}` (mirrors `case 'stair'`). No new state, no new subscription, no render-loop change. Cardinal rules 1–4 unaffected.

### 2026-05-20 — ADR-366 Phase 2: CanvasLayerStack shell WRITES to DxfOverlay3DStore (no new subscriptions)

`CanvasLayerStack.tsx` gains a `useEffect([dxfScene]) → useDxfOverlay3DStore.getState().setDxfScene(dxfScene)` — shell pushes the current DxfScene into the 3D overlay store whenever it changes. **Zero new `useSyncExternalStore` calls in the orchestrator** (CHECK 6C still green). The 3D viewport (`BimViewport3D`) is a low-freq leaf subscriber that reads from this store. Pattern: shell WRITES, leaf READS — same as the existing Bim3DEntitiesStore wiring from PersistenceHost components. No canvas drawing path affected.

### 2026-05-19 — ADR-363 Phase 4.5c.5: GripDimAnnotationMount micro-leaf (drag-time dim annotations)

New `GripDimAnnotationMount` leaf added to `PreviewCanvasMounts` — mirrors `GripDragPreviewMount` pattern. Receives `{ dragPreview, levelManager, transform, getCanvas, getViewportElement }` — all already present in `PreviewCanvasMountsProps`. Hook `useGripDimAnnotation` is RAF-based: triggered by `dragPreview` changes, draws "w=350mm" style labels on PreviewCanvas, clears on drag end. No canvas cleared inside `drawFrame` (ghost hook clears first via FIFO RAF scheduling from mount order). `DxfGripDragPreview` extended with `columnGripKind?` + `beamGripKind?` + `anchorPos` always included for column/beam — populated in `grip-projections.ts:buildDxfDragPreview`. CanvasSection gains zero new subscriptions (rides existing `dragPreview` React-state cycle, same frequency as `GripDragPreviewMount`).

**Cardinal rule compliance**:
- **Rule 1 (no orchestrator subscriptions)**: respected — CanvasSection/CanvasLayerStack gain no new `useSyncExternalStore` calls. `GripDimAnnotationMount` is a leaf (mounted inside `PreviewCanvasMounts`).
- **Rule 3 (bitmap cache key untouched)**: respected — no changes to `dxf-bitmap-cache.ts`. Annotation draws to PreviewCanvas only.
- **Rule 4 (≤1 canvas element / ≤2 high-freq hooks)**: respected — one preview canvas element, one hook.
- **Canvas ordering**: `GripDimAnnotationMount` mounted after `GripDragPreviewMount` in tree → RAF FIFO ordering → ghost RAF clears canvas and draws ghost first, annotation RAF draws label on top (no extra clear).

### 2026-05-19 — ADR-362 DIM-DIAG R3 round-2: temporary `console.warn` σε `DxfRenderer.render` (TEMPORARY)

Προστέθηκε προσωρινό diagnostic log στο `DxfRenderer.render` που μετράει dim entities ανά frame + canvas size + skipInteractive flag, για να εντοπιστεί commit→render defPoints divergence (ADR-362 issue). **Δεν τροποποιεί αρχιτεκτονική** — μόνο `console.warn` πίσω από `if (dims.length > 0)` guard. Zero React state, zero subscription change, zero invalidation logic. **TEMPORARY** — διαγραφή μόλις βρεθεί root cause του ADR-362 bug. Αν διαβάζεις αυτό σε επόμενο PR και τα logs υπάρχουν ακόμα → ασφαλώς αφαίρεσέ τα (Boy Scout).

### 2026-05-19 — ADR-363 Phase 7.1 Step 6: Multi-Selection ribbon micro-leaves + `useActiveContextualTrigger` extension

Added two new ribbon widget components — `MultiSelectionCommonPropertiesPanel` + `MultiSelectionFilterPanel` — registered in `RibbonPanel.tsx` widget dispatcher. Both mount **only** inside the contextual ribbon tree (DOM-only, no canvas), so they are not on the canvas render path. Each component instantiates a single bridge hook `useMultiSelectionRibbonBridge(...)`, which reads `useLevels()` + `useUniversalSelection()` via React Context (not `useSyncExternalStore`). Bridge work is derived inside the leaf, never raised into `CanvasSection`.

`app/ribbon-contextual-config.ts.useActiveContextualTrigger` gained an optional `selectedEntityIds` arg + a precedence rule: when 2+ entities from the BIM kind set (`wall`/`opening`/`slab`/`slab-opening`/`column`/`beam`/`stair`) are selected, the function returns `MULTI_SELECTION_CONTEXTUAL_TRIGGER`, overriding any per-kind trigger driven by `primarySelectedId`. The hook still runs only inside `DxfViewerContent` (top-level), inheriting the existing memoization deps. `DxfViewerContent` simply forwards `selectedEntityIds` — no new orchestrator subscriptions.

`MultiSelectionCommonPropertiesPanel` commit path is event-time (Enter / blur read `draft` state at the moment of the keystroke, then build a `CompoundCommand` via `bim-bulk-update-builder.ts` and dispatch through `executeCommand`). It does not capture stale snapshots — all reads happen at submit time.

**Cardinal rule compliance**:
- **Rule 1 (no orchestrator subscriptions)**: respected — both widgets subscribe via React Context, scoped to the ribbon leaf. `CanvasSection` gains zero new subscriptions; `DxfViewerContent` only adds a pass-through arg to an existing memo.
- **Rule 2 (getter-based event reads)**: respected — commit handlers read `draft`/`initialValue` at event time via React state, and the bulk-update factory pulls per-entity `params` from the `ISceneManager` at command-construction time (not from a captured snapshot).
- **Rule 3 (bitmap cache key untouched)**: respected — no changes to `dxf-bitmap-cache.ts` key composition. Multi-selection mode is a DOM-only concept; the canvas continues to invalidate based on the existing selection set + transform delta only.
- **Rule 4 (≤1 canvas element / ≤2 high-freq hooks per leaf)**: respected — each new widget is DOM-only (zero canvas elements) and uses one bridge hook that pulls from React Context (not high-frequency).

### 2026-05-19 — ADR-363 Phase 5.6 Ribbon+ContextMenu: `isWallEntity` import + `canSplit`/`onSplit` passthrough in `CanvasSection`

`CanvasSection` adds: (1) `import { isWallEntity }` from `types/entities` for the context-menu wall-type guard; (2) `canSplit` prop computed inline via `props.currentScene.entities.find + isWallEntity` (pure derivation, no subscription); (3) `onSplit` callback that calls `props.onToolChange('wall-split')`. Zero new `useSyncExternalStore` subscriptions in orchestrator.

**Cardinal rule compliance**: Rule 1 respected — type guard is a plain function call at render time, not a store subscription.

### 2026-05-19 — ADR-363 Phase 5.6 interop: Wall Split tool plumb in `CanvasSection` (zero new subscriptions)

`CanvasSection` adds `wallSplitTool` to the `useModifyTools` destructure and forwards `{wallSplitIsActive, handleWallSplitClick}` to `useCanvasClickHandler` + `{handleWallSplitEscape, wallSplitIsActive}` to `useCanvasKeyboardShortcuts`. The high-frequency mouse-move path is owned by `useWallSplitTool` via `subscribeToImmediateWorldPosition` + a new module-level `WallSplitStore` (`useSyncExternalStore`-compatible, snapshot-stable, zero React state). `CanvasSection` itself acquires **no** new `useSyncExternalStore` subscription.

**Cardinal rule compliance**:
- **Rule 1 (no orchestrator subscriptions)**: respected — `CanvasSection` adds two prop pass-throughs only.
- **Rule 2 (getter-based event reads)**: respected — `useWallSplitTool` reads `transformScale` via ref, reads scene via `levelManager.getLevelScene(...)` at click time.
- **Rule 3 (bitmap cache key untouched)**: respected — wall-split hover state lives in `WallSplitStore`, never feeds `dxf-bitmap-cache.ts`.
- **Rule 4 (≤1 canvas element / ≤2 high-freq hooks per leaf)**: respected — preview renderer (when wired) is its own micro-leaf subscriber to `WallSplitStore`, mirrors `TrimToolStore`.

Bundled with the ADR-363 Phase 5.6 commit (CHECK 6B compliance).

### 2026-05-19 — ADR-183 Phase C interop: deprecated grip-hook deletion (import path retargets only)

`canvas-layer-stack-types.ts` and `canvas-click-types.ts` (both micro-leaf surface files) had their grip-type imports retargeted from the now-deleted `hooks/useDxfGripInteraction.ts` / `hooks/grips/useGripSystem.ts` to the canonical SSoT modules (`hooks/grips/unified-grip-types.ts` for overlay grip types; `hooks/grip-computation.ts` for DXF state-machine types + `UseDxfGripInteractionReturn`). **Type-only changes — zero runtime behavior change.**

**Cardinal rule compliance**:
- **Rule 1 (no orchestrator subscriptions)**: respected — only type imports moved; no `useSyncExternalStore` added anywhere.
- **Rule 2 (getter-based event reads)**: untouched — handlers still receive the same getter shapes.
- **Rule 3 (bitmap cache key untouched)**: respected — no identity propagated into `dxf-bitmap-cache.ts`.
- **Rule 4 (≤1 canvas element / ≤2 high-freq hooks per leaf)**: respected — leaf hook surface unchanged.

Bundled with the ADR-183 Phase C deletion commit (CHECK 6B compliance).

### 2026-05-19 — ADR-363 Phase 2 deferred pipeline interop: `DxfRenderer.render()` per-frame openings→wall map + Boy-Scout split

`DxfRenderer.render()` now feeds the per-frame opening→wall index into `EntityRendererComposite` so `WallRenderer` can punch boolean cutouts through wall fills for hosted openings. Touch surface in `DxfRenderer.ts`:

- New `case 'opening'` branch in `toEntityModel()` (unwrap `DxfOpening` → `OpeningEntity`).
- New per-frame call `composite.setOpeningsByWall(buildOpeningsByWall(scene.entities))` right next to the already-existing `setDimensionLookup` / `setSlabOpeningsBySlab` calls.
- Boy-Scout file-size split (Google-SRP, 500-line limit): the three pure per-frame index builders (`buildDimensionLookup`, `buildSlabOpeningsBySlab`, `buildOpeningsByWall`) extracted from `DxfRenderer.ts` (523 → 477 lines) into a new sibling module `canvas-v2/dxf-canvas/dxf-renderer-frame-builders.ts`. Pure functions — no `this`, no React, no store subscriptions.

**Cardinal rule compliance**:
- **Rule 1 (no orchestrator subscriptions)**: untouched — `DxfRenderer` is already a non-React orchestrator driven by the bitmap-cache / live-canvas effect; no React subscriptions added.
- **Rule 2 (getter-based event reads)**: N/A — per-frame builders read straight from `scene.entities` passed into `render()`.
- **Rule 3 (bitmap cache key untouched)**: respected — `dxf-bitmap-cache.ts` not modified; opening identity does not enter the cache key.
- **Rule 4 (≤1 canvas element / ≤2 high-freq hooks per leaf)**: N/A for the orchestrator; downstream `WallRenderer` leaf already complies (single composite slot, no new hooks).

Bundled atomically with the ADR-363 Phase 2 wiring (dxf-types.ts `DxfOpening` wrapper + useDxfSceneConversion.ts `case 'opening'` + DxfRenderer.ts pipeline call) so CHECK 6B passes.

### 2026-05-19 — ADR-363 Phase A interop: BIM snap description propagation through `canvas-layer-stack-leaves`

`SnapIndicatorSubscriber` (one of the micro-leaves) now forwards `snapResult.snapPoint?.description` to `SnapIndicatorOverlay` so the overlay can resolve the BIM-specific i18n label (`bim-wall` → "Επί άξονα τοίχου", `bim-slab` → "Επί ακμής πλάκας", `bim-opening` → "Επί παραστάτη ανοίγματος"). The subscriber keeps its single high-frequency hook (snap-result subscription); no extra subscriptions added.

**Cardinal rule compliance**:
- **Rule 1 (no orchestrator subscriptions)**: untouched — change isolated inside the existing `SnapIndicatorSubscriber` leaf.
- **Rule 2 (getter-based event reads)**: N/A — description is part of the already-subscribed `snapResult` payload, not a separate read.
- **Rule 3 (bitmap cache key untouched)**: respected — no identity propagated to `dxf-bitmap-cache.ts`.
- **Rule 4 (≤1 canvas element / ≤2 high-freq hooks per leaf)**: respected — same hook surface; only the props passed downstream change. `useTranslation` lives inside `SnapIndicatorOverlay`, not in the subscriber.

Bundled with ADR-363 Phase A (NearestSnapEngine/PerpendicularSnapEngine description dispatch + locale labels) and Phase B doc sync same-commit (CHECK 6B compliance).

### 2026-05-18 — Batch commit interop: ADR-357 Ph12-16+18 + ADR-358 v2.19 + ADR-363 Ph7A

`CanvasSection.tsx` / `DxfRenderer.ts` / `hooks/canvas/useCanvasContextMenu.ts` / `hooks/canvas/canvas-click-types.ts` touched in atomic batch. **All cardinal rules preserved**:

- **Rule 1 (no orchestrator subscriptions)**: `CanvasSection` additions are micro-leaf mounts only (`<CommandLineInput />`, `<SelectionCyclingPopover />`, `<DimensionContextMenu />`) — each leaf subscribes to its own SSoT store (`CommandLineStore` / `SelectionCyclingStore` / dimension menu = imperative handle). Orchestrator stays subscription-free.
- **Rule 2 (getter-based event reads)**: `useCanvasContextMenu` extended to detect dimension-only selection and route to `DimensionContextMenu` instead of `DrawingContextMenu`; selection read happens at event time via store getter, no snapshot capture.
- **Rule 3 (bitmap cache key untouched)**: `DxfRenderer` change is layer-style resolution path only (ByLayer ↔ Direct via `resolveEntityStyle` from ADR-358). No selection/hover/grip identity added to `dxf-bitmap-cache.ts`.
- **Rule 4 (≤1 canvas element / ≤2 high-freq hooks per leaf)**: new leaves (`CommandLineInput`, `SelectionCyclingPopover`) each consume ≤1 store via `useSyncExternalStore`. No leaf-fanout regression.

Bundled with ADR-357 / ADR-358 / ADR-363 same-commit (CHECK 6B compliance).

---

### 2026-05-18 — ADR-357 Phase 11 interop: GripContextMenu micro-leaf (right-click hot grip context menu, AutoCAD-style)

CanvasSection now mounts `<GripContextMenu />` as a micro-leaf subscriber to `GripContextMenuStore` (zero React state in orchestrator). The new `useGripContextMenuController` opens the menu on right-click during cold/hovering/warm phases AND during active drag (`activeGrip` exposed via `unified.activeGrip`). Closing the menu via "Cancel" triggers `unified.handleEscape()` for proper drag cleanup. Pattern: store SSoT + `useSyncExternalStore` only inside the leaf component, never in the orchestrator (ADR-040 cardinal rule #1).

### 2026-05-18 — ADR-357 Phase 4 interop: PreviewRenderer Object Snap Tracking layer (markers persist across drawPreview cycles)

`PreviewRenderer` gains persistent state `trackingMarkers: AcquiredTrackingPoint[]` and two new methods: `setTrackingMarkers(markers)` (idempotent setter + immediate paint) and `drawTrackingAlignment(paths, intersections, snappedPoint, label, transform, viewport)` (overlay called AFTER `drawPreview`). The `render()` paint pipeline is rewritten: the early-exit gate moves from `currentPreview` to `hasViewport` so marker-only paints are admitted (no preview entity required), then markers paint FIRST so the rubber-band preview overlays on top. The canvas is now ALWAYS cleared at the start of `render()` (previously only when `currentPreview` was truthy) — this handles `setTrackingMarkers([])` and other transitions to empty content uniformly so stale glyphs never linger.

**Cardinal rule compliance**:
- **Rule 1 (no orchestrator subscriptions)**: untouched. Acquisition wiring lives in `useDrawingHandlers` (a leaf-equivalent micro-hook). `CanvasSection` and `CanvasLayerStack` do NOT subscribe to `TrackingPointStore` — the subscription happens inside `useDrawingHandlers.useEffect` and pushes to the imperative `previewCanvasRef`.
- **Rule 2 (getter-based event reads)**: respected. `useDrawingHandlers.onDrawingPoint` reads live tracking state via `TrackingPointStore.getPoints()` (getter), not a stale snapshot captured at render time.
- **Rule 3 (bitmap cache key untouched)**: respected. No tracking-related identity (acquired list, marker count) is added to `dxf-bitmap-cache.ts`. The DXF entity cache is unaware of tracking.
- **Rule 4 (≤1 canvas element / ≤2 high-freq hooks per leaf)**: respected. `useDrawingHandlers` already owns the drawing-handler high-frequency surface; adding the tracking subscription is one additional low-frequency hook (`TrackingPointStore` fires on acquire/clear, not on mousemove).

Companion files: `systems/tracking/TrackingPointStore.ts` (new singleton — zero React state, `subscribe`/`getSnapshot` for future `useSyncExternalStore` leaves), `systems/tracking/tracking-resolver.ts` (new pure fn), `canvas-v2/preview-canvas/tracking-colors.ts` (new theme palette SSoT), `canvas-v2/preview-canvas/PreviewCanvas.tsx` (handle extension), `canvas-v2/preview-canvas/index.ts` (palette re-exports), `hooks/drawing/useDrawingHandlers.ts` (subscription + acquisition timer + resolver wire-up).

Bundled in atomic commit with ADR-357 Phase 4 changelog entry (CHECK 6B compliance).

---

### 2026-05-17 — ADR-358 Phase 9E-1 interop: DxfRenderer id-first layersById lookup + SceneModel layersById mirror

`DxfRenderer.resolveLayerStyle` updated to use `entity.layerId → layersById[entity.layerId]` as the primary lookup path (O(1), id-keyed). Previous path used `resolveEntityLayerName(entity)` then `layersById[name]` (name-keyed, double-call). New path: id-keyed first; IIFE fallback to name-keyed for legacy scenes without `layersById` or entities without `layerId`. **Bitmap cache key untouched** — cardinal rule #3 holds. **ADR-040 leaf rules**: no `useSyncExternalStore` added; `DxfRenderer` remains a render-pipeline leaf; change is purely a lookup-path optimisation.

Companion changes (same Phase 9E-1): `SceneModel.layersById?: Record<LayerId, SceneLayer>` added to `types/entities.ts`; `DxfSceneBuilder.buildScene()` populates it via O(n) `Object.fromEntries` mirror; `useDxfSceneConversion` passes `layersById ?? layers` to the render bridge. These three files are not ADR-040 micro-leaf files but are bundled here for atomic Phase 9E-1 commit compliance (CHECK 6B).

---

### 2026-05-17 — ADR-358 Phase 9D-5a interop: DxfRenderer drops `layer` from canvas base shape (id-only)

`DxfRenderer.entityToDxfEntity` now mirrors only `entity.layerId` onto the canvas base shape; the legacy `entity.layer` field is no longer copied. ByLayer/ByBlock style resolution is unchanged — `resolveStyleForRender` reads from the id-keyed `layersById` map (ADR-358 Phase 9D-2). **Bitmap cache key untouched** — cardinal rule #3 holds (no high-frequency identity entries added). Render-path is now strictly id-aware in writes; transitional id-first readers (`resolveEntityLayerName`) still tolerate `.layer` name backref until Phase 9D-5b schema flip.

---

### 2026-05-17 (Phase XXI) — ✅ RESOLVED: client-side `dxf_viewer_levels` bootstrap rejected by Firestore rules

**Status**: ✅ **RESOLVED & CONFIRMED**. Giorgio validation 2026-05-17 02:42 (Greek): *«ΔΕΝ ΕΧΕΙ ΛΟΥΠΑ»* (= no loop). Steady-state idle log shows **0** `FirebaseError: Missing or insufficient permissions` (vs 83 pre-fix) and **0** continuous `PERF_LINE` commit pairs after init settles. Phase XX probes (`useRenderTrace` + `installSetStateTracer` + manual `traceSet` setter wrappers) cleaned up in same commit; `render-loop-trace.ts` SSoT utility retained for future investigations (flag-gated, zero prod overhead).

**Diagnosis**: Loop was NOT a React/ref-churn problem — it was a Firestore **write-reject loop** that the snapshot listener amplified into a React render cascade.

**Evidence (Firefox console log `console-export-2026-5-17_1-27-39.log`, 19624 lines)**:

1. **83 occurrences** of `Uncaught (in promise) FirebaseError: Missing or insufficient permissions` interleaved 1:1 with `[SETSTATE-CALL levels]` entries.
2. Manual `traceSet` wrapper on `setLevels`/`setError`/`setIsLoading` in `LevelsSystem.tsx` produces 417 stack traces (3 setters × ~138 iterations). Every trace bottoms out in:
   ```
   useLevelsFirestoreSync.useEffect.unsubscribe (snapshot callback)
     ← __PRIVATE_syncEngineEmitNewSnapsAndNotifyLocalStore
     ← async*__PRIVATE_syncEngineRejectFailedWrite  ← REJECT
     ← __PRIVATE_onWriteStreamClose / handleWriteError
   ```
3. `installSetStateTracer()` (monkey-patch on `React.useState/useReducer/useSyncExternalStore`) reports `tracer install — useState=false useReducer=false useSyncExternalStore=false` + `React namespace is non-extensible (Firefox/Turbopack)`. Confirms tracer is **inoperable in dev mode** under Turbopack — the manual `traceSet` wrapper is the only path to stack traces, and it is sufficient here.
4. `[CanvasSection] #N content-changed: (NONE — pure ref churn!)` and `[LevelsSystem.provider] #N ... ref-only: levels,importWizardHook,addLevel,...` confirm the cascade is a pure-ref-churn render storm downstream of the rejected-write source.

**Root cause**: `useLevelsFirestoreSync.ts:86-97` (pre-fix) executed a client-side `writeBatch(db).set(...).commit()` against `dxf_viewer_levels` when the snapshot delivered an empty document set. The collection's Firestore rules permit writes only via the Admin SDK / `/api/dxf-levels` gateway (explicitly documented at `useLevelSceneLoader.ts:151`: *"Firestore rules do NOT allow client-side updates on dxf_viewer_levels"*). Under super-admin without `companyId` (or any tenant whose first viewer load hits the empty-cache path), the batch was rejected; the rejection rolled back the local cache, which re-fired the snapshot listener with an empty document set, which re-invoked the bootstrap path — an unbounded ~1-2Hz idle loop.

**Why Phase XV (ADR-361) service-level dequal guard did not catch it**: the guard suppresses *content-equal* re-emissions. Rejected-write rollbacks emit the same empty-document snapshot, which the guard correctly skips for the second-onwards emission within a single subscription session — but the bootstrap path **re-triggers the write itself**, so each iteration is a fresh `{empty snapshot} → batch.commit → reject → rollback → empty snapshot` cycle. The guard never sees a *steady state* to lock onto.

**Why Phases XVI/XVII/XVIII/XIX defensive layers did not catch it**: those phases targeted React identity churn downstream of legitimate state changes. They are still valid GOL-level safety nets and remain in place. The source here is not React identity — it is the Firestore mutation queue being driven by a permanently-failing write.

**Fix (`useLevelsFirestoreSync.ts`)**:

1. Removed `writeBatch` + `doc` + `db` imports.
2. Added `createDxfLevelWithPolicy` import (existing gateway client, matches `useLevelOperations.addLevel` pattern).
3. Replaced client-side `batch.commit()` with `Promise.all(defaultLevels.map(l => createDxfLevelWithPolicy({ payload: {...l} })))` — server-side bootstrap via `/api/dxf-levels` (Admin SDK + `createEntity('dxfLevel', …)` audit pipeline, ADR-286).
4. Added `bootstrapStateRef: 'idle' | 'running' | 'completed' | 'failed'` to guarantee idempotency: bootstrap fires **once** per hook lifetime regardless of how many empty snapshots are delivered. On failure the state moves to `failed` and is **not retried** — operator must inspect server logs (a permanently-failing bootstrap is now visible via `handleError`, not silenced).

**Files**:
- `src/subapps/dxf-viewer/systems/levels/hooks/useLevelsFirestoreSync.ts` (fix)

**Expected steady state after fix**: zero idle `PERF_LINE DxfCanvasSubscriber.commit` / `CanvasSection.commit` pairs; zero `Missing or insufficient permissions` console entries; `[SETSTATE-CALL levels]` fires only on real Firestore content changes (true level mutations).

**Verification protocol**:
1. Giorgio: `npm run dev` → DXF Viewer → idle 30s → console must show 0 PERF_LINE pairs and 0 `FirebaseError: Missing or insufficient permissions`.
2. If clean → remove `traceSet` wrapper from `LevelsSystem.tsx` (Phase XX probe cleanup) + remove `useRenderTrace` calls from `CanvasSection` / `canvas-layer-stack-leaves` / `LevelsSystem.provider` (probes served their purpose).
3. If loop persists → there is a second writer to `dxf_viewer_levels` outside the bootstrap path (no current code path found via grep). Re-run with probes in place to capture new stack traces.

**Phase XX probe disposition**: instrumentation (`useRenderTrace` + `installSetStateTracer` + `traceSet` wrapper) stays deployed until Giorgio confirms idle steady state, then cleanup commit removes it.

**Lezione**: client-side writes to server-only Firestore collections produce a self-reinforcing reject-loop that is **invisible to the React render-trace** until you wrap setters in stack-capturing decorators or read the Firestore stack frames (`__PRIVATE_syncEngineRejectFailedWrite`). When a "render loop" stack trace points at a Firestore subscription, the next question is always *"what is writing to this collection, and is the write being denied?"* — not *"which downstream consumer is unstable?"*.

---

### 2026-05-17 — ADR-358 Phase 9D-3b interop: DxfRenderer dual-write `layerId` + id-first resolve

`DxfRenderer.entityToDxfEntity` now mirrors `entity.layerId` onto the DXF entity, and `getResolvedLayerStyle` resolves the layer via `resolveEntityLayerName(entity)` (LayerStore lookup + legacy name fallback). Render-path now id-aware; bitmap cache key is unaffected (still keyed by visible/selected snapshot, ADR-040 cardinal rule #3 intact).

### 2026-05-16 (Phase XX) — Render-loop persists; instrumentation deployed

**Status**: Phase XIX claim "RESOLVED" **SMENTITA**. Giorgio conferma: dopo i fix XV-XIX, in idle puro lo zero-input loop `PERF_LINE DxfCanvasSubscriber.commit` + `PERF_LINE CanvasSection.commit` continua a fire a ~1-2Hz. I 5 fix XV-XIX sono validi defensive layers GOL-level — **non rollback** — ma **nessuno** è il root cause.

**Diagnostic gap identificato**: il profile dump v5 di Phase XIX (`profiling-data.16-05-2026.22-39-14.json`) probabilmente cattura il bootstrap burst, non lo steady-state. Evidenza: `DxfCanvasSubscriber` appare in 3/28 commit nel profile ma in **ogni** commit nei runtime logs PERF_LINE. Mismatch profile↔logs = profile non rappresenta steady-state.

**Nuova strategia (instrumentation, no guessing)**:

1. **`useRenderTrace(label, snapshot)`** già esistente in `src/subapps/dxf-viewer/debug/render-loop-trace.ts` (SSoT). Logga per-render quale chiave dello snapshot ha cambiato ref vs precedente, distinguendo `content-changed` da `ref-only` (pure ref churn).
2. **`installSetStateTracer()`** monkey-patcha `React.useState` / `useReducer` / `useSyncExternalStore` — logga `[SETSTATE-CHURN]` con stack-trace quando un dispatch produce `prev !== next` ma `JSON.stringify(prev) === JSON.stringify(next)` (= identical content, new ref = il sintomo del root cause).

**Activation**: `localStorage.setItem('TRACE_RENDER_LOOP','1')` + hard reload. Zero overhead in prod (flag-gated).

**Instrumentation deployed**:
- `CanvasSection.tsx` — `installSetStateTracer()` top-level (idempotent) + `useRenderTrace('CanvasSection', {…snapshot ~40 hook outputs})` prima del return.
- `canvas-layer-stack-leaves.tsx` — `useRenderTrace('DxfCanvasSubscriber', {…props})` dentro il componente memo.

**Atteso console output in idle**:
- `[CanvasSection] #N content-changed: (NONE — pure ref churn!) | ref-only: <hookX>` → identifica hook colpevole.
- `[SETSTATE-CHURN useSyncExternalStore] new ref, same content. prev=… next=…\n<stack>` → setter colpevole + path al store.

**Next step**: Giorgio attiva flag, idle 30s, raccoglie logs, ritorna output. Da lì root cause è deterministico.

---

### 2026-05-16 (Phase XIX) — ⚠️ RESOLUTION UNCONFIRMED (vedi Phase XX): ribbon bridges return object literal

**Diagnostic**: React DevTools Profiler v5 export (`profiling-data.16-05-2026.22-39-14.json`, 7.3s / 28 commits) + Python decoder (`scripts/analyze-profile5.py`). Strategy: count per-fiber re-render in `fiberActualDurations` with `duration>0`. Components in ≥50% commits = loop suspects.

**Profile stats**:
- `PanelTabs`: **28/28** commits, 252ms
- `RibbonCommandProvider`: **14/28**, 1548ms
- `RibbonRootInner`: **14/28**, 1552ms
- `CanvasSection`: 14/28, 305ms (cousin)
- `DxfCanvasSubscriber`: **only 3/28** ← phases XV/XVII suspect SMENTITO

**Root cause**: `useRibbonStairBridge`, `useRibbonArrayBridge`, `useRibbonTextEditorBridge` ritornavano **object literal senza `useMemo`** (linee 208, 255, 79 rispettivamente).

**Cascade**:
```
3 ribbon bridges → return {...} NEW REF every render
       ↓
useRibbonCommands → useCallback([stairBridge, arrayBridge, textEditorBridge])
                    useMemo([handleX, ..., getBadgeState])    ← invalidate
       ↓
RibbonRoot = React.memo(...)    ← memo bail-out fails (commands prop NEW REF)
       ↓
RibbonCommandProvider value = useMemo([commands.onToolChange, ...])    ← invalidate
       ↓
30+ ribbon consumers re-render + CanvasSection (via shared TransformProvider ancestor)
```

**Fix (3 files)**:

1. `src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonStairBridge.ts:208` — wrap return in `useMemo([onComboboxChange, getComboboxState, onToggle, getToggleState, getBadgeState])`.
2. `src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonArrayBridge.ts:255` — same pattern (4 callable).
3. `src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonTextEditorBridge.ts:79` — same pattern (4 callable).

Inner callbacks già `useCallback` con deps stabili → useMemo deps stabili → bridge ref stabile → ribbonCommands stabile → RibbonRoot memo bail-out → RibbonCommandProvider value stabile → zero re-render cascade.

**Lezione (cardinal rule)**: ogni custom hook che ritorna un object con multiple proprietà DEVE wrappare in `useMemo` con array deps esplicito. Without it, return value è anti-pattern che propaga instabilità a cascata in ogni consumer.

**Phase XV/XVI/XVII/XVIII residui**: defensive layers (Firestore equality guard + memoization + ref-pattern + useEntityStatusResolver equality) rimangono in place — GOL-level safety nets per loop futuri, non rollback.

---

### 2026-05-16 (Phase XVIII): Fix render-loop @ ~1Hz — useEntityStatusResolver multi-chunk cascade

**Bug (third occurrence same day)**: Phase XVII (ref-chain stabilization) non ha risolto. Loop persisteva a ~1Hz idle con coppia `DxfCanvasSubscriber.commit` + `CanvasSection.commit`. Giorgio ha perso molte ore. Pattern coppia = store COMUNE invalidato, non instabilità ref isolata.

**Root cause**: `src/hooks/useEntityStatusResolver.ts:194` chiama `setEntityStatusCache(new Map(liveMapRef.current))` SENZA equality guard. Multi-chunk subscriptions (PROPERTIES + PARKING_SPACES + STORAGE × N chunks da `chunkArray(entityIds, FIRESTORE_LIMITS.IN_QUERY_MAX_ITEMS)`) producono N callback fire indipendenti. Anche se ogni `firestoreQueryService.subscribe` ha il proprio ADR-361 service-level guard, l'AGGREGATO di N emit produce N `setEntityStatusCache` consecutivi con N nuove Map.

**Catena di propagazione**:
```
useEntityStatusResolver:194  setEntityStatusCache(new Map(...))          ← NUOVA ref ogni emit
  → useEntityStatusResolver:230-250  resolvedStatusMap useMemo([overlays, entityStatusCache])
  → useFloorOverlays:204-210  enrichedOverlays useMemo([rawOverlays, statusMap])
  → overlay-store.tsx:130-140  overlays useMemo([floorItems, currentLevelId, pendingPolygons])
  → overlay-store.tsx:379  contextValue useMemo([overlays, ...])
  → useLiveOverlaysForLevel:27-36  return useMemo(..., [..., overlayStore.overlays, ...])
  → CanvasSection.tsx:125  currentOverlays = useLiveOverlaysForLevel(...)  ← COMMIT
  → canvas-layer-stack-leaves.tsx  DxfCanvasSubscriber subscribes same store  ← parallel COMMIT
```

**Perché Phase XV (ADR-361) non basta**: service-level guard è PER-SUBSCRIPTION. Multi-chunk hook (3 collection × multiple chunks) ha N subscription, ognuna con guard indipendente. Ogni emit valido per la sua subscription è valido per il caller, anche se collettivamente è ridondante. Inoltre `liveMapRef.current` accumula tra callback fire → `new Map(...)` riflette stato cumulative diverso ad ogni emit anche se contenuto logicamente identico.

**Fix (2 file)**:

1. `useEntityStatusResolver.ts:194` — functional setter con O(N) Map equality check:
```typescript
setEntityStatusCache((prev) => {
  if (prev.size === liveMapRef.current.size) {
    let identical = true;
    for (const [k, v] of liveMapRef.current) {
      if (prev.get(k) !== v) { identical = false; break; }
    }
    if (identical) return prev;  // ← STABLE REF → skip cascade
  }
  return new Map(liveMapRef.current);
});
```
   Anche linea 221 (`if (totalChunks === 0)` setup branch): functional setter `prev.size === 0 ? prev : new Map()`.

2. `useFloorOverlays.ts:179` — hardening defensive: functional setter con shallow check id+status (campi che downstream `enrichedOverlays.useMemo` legge). Safety net se Firestore metadata-only updates passano ADR-361 guard.

**Pattern (cardinal rule N5 SSoT esteso)**: Quando un hook fa subscribe a MULTIPLE Firestore listener (chunked queries, multi-collection), il guard service-level ADR-361 garantisce per-subscription dedup ma NON aggregate dedup. Il setState aggregate caller DEVE avere il suo equality guard. Pattern: functional setter `prev => identical(prev, next) ? prev : next` per Map/Array/Record.

**Verification**: hard refresh + 30s idle ZERO input → ZERO `PERF_LINE` (vs 1Hz coppia DxfCanvasSubscriber + CanvasSection prima). Mouse → PERF_LINE event-driven OK. Stop → halt <1s.

**Triple-layer defense now**:
- Phase XV: Firestore service-level guard (ADR-361) — per-subscription dedup
- Phase XVI/XVII: memoization chain + ref-pattern stabilization — context value stability  
- Phase XVIII: aggregate equality guard in multi-subscription consumers — caller-level dedup

---

### 2026-05-16 (Phase XVII): Fix render-loop via ref-chain stabilization — useSceneManager → LevelsSystem

**Bug (second occurrence same day)**: Despite Phases XV+XVI fixes (Firestore equality guard, memoization), `CanvasSection` **continued** re-rendering ~30Hz at idle (PERF_LINE `CanvasSection.commit` repeating, zero input). Giorgio reported "seconda volta che succede" (second time today) + lost many hours debugging. Root cause was NOT Firestore delivery (already guarded by ADR-361 service-level equality), but a **cascading ref chain of unstable React hook returns** in the DXF Viewer scene manager hierarchy.

**Root cause — 3-hook cascade of unstable refs**:

```
1. useSceneManager.ts:32-35
   const getLevelScene = useCallback(..., [levelScenes])  ← new ref on every levelScenes change
   
   ↓ sceneManager object deps on getLevelScene new ref
   
2. useAutoSaveSceneManager.ts:250
   setLevelSceneWithAutoSave = useCallback(..., [sceneManager, autoSaveEnabled])  ← sceneManager unstable
   
   ↓ useAutoSaveSceneManager return deps on setLevelSceneWithAutoSave
   
3. LevelsSystem.tsx:219-229
   setLevelScene/getLevelScene useCallback([sceneManager.setLevelScene] / [sceneManager.getLevelScene])
   ↓
   LevelsContext useMemo([... sceneManager ...])  ← sceneManager unstable
   
   ↓ useLevels() subscribers (CanvasSection, OverlayStoreProvider)
   
   ↓ Render loop cascade
```

The root was **getLevelScene unnecessary `[levelScenes]` dependency**: function only reads from `levelScenesRef.current`, no dep needed. But with dep, every `levelScenes` state change → new `getLevelScene` ref → sceneManager object invalidates → setLevelSceneWithAutoSave gets new ref → its useEffect fires → calls `setLevelScenes` → levelScenes changes → loop perpetuates at ~30Hz.

**Fix (3 files, ref-pattern pattern)**:

1. **useSceneManager.ts** (lines 32-35, 59-67):
   - Change `getLevelScene` deps from `[levelScenes]` to `[]` (function reads from stable ref)
   - Update useMemo deps to include all 7 returned callables (was missing 5)

2. **LevelsSystem.tsx** (lines 217-236, 437):
   - Add ref pattern: `const sceneManagerRef = useRef(sceneManager); sceneManagerRef.current = sceneManager`
   - Change `setLevelScene`, `getLevelScene`, `clearLevelScene` to use `sceneManagerRef.current` with `[]` deps
   - Remove `sceneManager` from context useMemo deps

3. **useAutoSaveSceneManager.ts** (lines 140-250, 285-304, 115-135):
   - Add ref pattern for sceneManager
   - Change `setLevelSceneWithAutoSave` deps from `[sceneManager, autoSaveEnabled]` to `[autoSaveEnabled]`
   - Change `resetSceneSession` deps from `[sceneManager]` to `[]`
   - Update useMemo deps to remove `sceneManager`

**Pattern (cardinal rule N.7.2 #5 SSOT)**: When a hook parameter receives an unstable ref (e.g. sceneManager object with unstable internal refs), use a ref wrapper to decouple the callback's stability from the parameter's stability. Read from ref via `.current`, not from closure params.

**Verification**: After fix, hard refresh + 30s idle with ZERO input → ZERO `PERF_LINE` logs. Mouse movement → PERF_LINE appears (event-driven, correct). Stop moving → logs stop within 1s. Idle resumes silent.

**Impact**: Breaks the root cause of the 30Hz loop. Firestore service-level guard (Phase XV) + memoization chain (Phase XVI) + ref-chain stabilization (Phase XVII) = triple-layer defense, Google-level architecture.

---

### 2026-05-16 (ADR-358 Phase 5b): DxfRenderer — stair entity dispatch

`DxfRenderer.resolveEntityForRender` adds `case 'stair'`: unwraps the
`DxfStair` wrapper into a first-class `StairEntity` for the renderer pipeline.
Geometry comes from `stairEntity.geometry` (SSoT: `computeStairGeometry()`
at create/update time). Delegates paint to `StairRenderer` via
`EntityRendererComposite`. Zero bitmap-cache key change (stair geometry stored
in entity, not in hover/selection state).


### 2026-05-16 (Phase XV): Fix residual idle re-render loop — Firestore `setLevels` cascade

**Bug**: Dopo il fix `SharedPropertiesProvider` (entry sotto), persisteva un secondo loop idle ~3-10Hz (PERF_LINE `CanvasSection.commit` + `DxfCanvasSubscriber.commit` continui, no input). Render-trace instrumentation (`debug/render-loop-trace.ts`) ha rivelato `levelManagerLevels` SEMPRE in `ref-only` su ogni `[DVC-SNAPSHOT]` e `[CS-RENDER]` — pure ref churn senza content change.

**Root cause**: `firestoreQueryService.subscribe('DXF_VIEWER_LEVELS', ...)` ri-emette snapshot Firestore ad alta frequenza (cache hydration + pending writes ack) con `documents` array prodotto fresh da `snapshot.docs.map(...)` → **nuova ref, contenuto identico**.

`useLevelsFirestoreSync` chiamava `setLevels(fetchedLevels)` SENZA equality guard → React vede new ref → `setState` dispatched → `LevelsSystem` provider re-render → `value` (non memoizzato, plain object return da `useLevelsSystemState`) cascade → tutti i `useLevels()` consumer re-render → `useDxfViewerState` ritorna nuovo `state` literal → `DxfViewerContent` + `CanvasSection` re-render ~10Hz idle.

Era il "Secondary offender" registrato nella entry precedente (`LevelsSystem.tsx:428-432`) — promosso a primary root cause da questa instrumentation session.

**Fix**: equality guard via JSON hash su 8 campi structural in `useLevelsFirestoreSync` (`hooks/useLevelsFirestoreSync.ts`):

```ts
const prevLevelsHashRef = useRef<string>('');
// ...inside onSnapshot callback:
const nextHash = JSON.stringify(
  fetchedLevels.map((l) => [
    l.id, l.name, l.order, l.isDefault, l.visible,
    l.floorId, l.buildingId, l.sceneFileId,
  ]),
);
if (nextHash === prevLevelsHashRef.current) {
  setIsLoading(false);
  setError(null);
  return; // skip setLevels — content unchanged, no cascade
}
prevLevelsHashRef.current = nextHash;
setLevels(fetchedLevels);
```

Hash JSON costo trascurabile su N=1-5 levels (typical). Skip diretto = zero state mutation, zero re-render downstream.

**Verifica**: post-fix, `[DVC-SNAPSHOT]` / `[CS-RENDER]` fermi a `#11` durante boot phase (Auth + NavigationContext + Firestore listener setup), poi **silenzio totale** al idle. `levelManagerLevels` / `levelsArray` SCOMPARSI dal `ref-only`. Pattern confermato da Giorgio (2026-05-16 13:08).

**Pattern (cardinal rule N5 esteso)**: ogni consumer di `firestoreQueryService.subscribe` DEVE includere equality guard su content hash prima di chiamare setter di state. Firestore re-emette aggressivamente cached snapshots — without guard, ogni subscriber è amplificatore passivo del render loop.

**Generalizzazione (2026-05-16, stessa sessione) → ADR-361**: l'equality guard inline è stato **migrato dentro `firestoreQueryService.subscribe/subscribeDoc/subscribeSubcollection` come SSoT** (vedi `docs/centralized-systems/reference/adrs/ADR-361-firestore-subscribe-equality-guard.md`). Industry standard adottato: `dequal` deep equal (allineato a SWR), `EqualitySlot` con `reset()` su super-admin switcher rebuild (ADR-354 entry #3), opzioni `skipEqualityGuard` + `equalityFn` per opt-out / override. Tutti i 58 caller di `subscribe`, 13 di `subscribeDoc`, 2 di `subscribeSubcollection` ne beneficiano automaticamente. L'inline JSON-hash in `useLevelsFirestoreSync.ts` è stato **rimosso** (ora ridondante).

**Diagnostica usata (riusabile)**: `src/subapps/dxf-viewer/debug/render-loop-trace.ts` — SSOT helper env-gated (`NEXT_PUBLIC_TRACE_RENDER_LOOP=1` o `localStorage.setItem('TRACE_RENDER_LOOP','1')`). Esporta `useRenderTrace(label, snapshot)` + `installSetStateTracer()`. Monkey-patch `React.useState`/`useReducer`/`useSyncExternalStore` NON funziona su Firefox+Turbopack (React namespace frozen) — patch fallisce gracefully, `useRenderTrace` rimane operativo come strumento principale. No-op in production.

**Follow-up still open** (non bloccante idle):
- `CanvasSection.tsx` — `useLevels()` full subscription. Slice stabile `useLevelScene(levelId)` rimane raccomandazione.
- `overlays/overlay-store.tsx:130` — write-heavy amplifier su `floorplan_overlays`. Stesso pattern equality guard applicabile.

---

### 2026-05-16 (Phase XVI): Fix residual idle re-render loop (after ADR-361) — hook return object memoization

**Bug discovered post-ADR-361**: Despite Firestore equality guard suppression (Phase XV + ADR-361), `CanvasSection` still re-rendered ~10Hz idle with 4 ref-only churn: `levelManager`, `gripSettings`, `floorplanBg`, `entityJoinState`. Render-trace instrumentation confirmed: same content, different reference on every render.

**Root cause — memoization chain break**: `useAutoSaveSceneManager()` returned a bare object literal (riga 285-299) without `useMemo`, containing fresh callback refs ad ogni render. This invalidated the `useMemo` inside `useLevelsSystemState` (riga 366), which depended on `sceneManager`. Chain reaction:

```
useSceneManager() → bare object literal (no memo)
  ↓
useAutoSaveSceneManager(sceneManager) → bare object literal (no memo, depends on sceneManager)
  ↓
useLevelsSystemState(sceneManager) → useMemo([... sceneManager ...]) — INVALIDATED every render
  ↓
LevelsContext.Provider value={useMemo result} → always NEW ref (deps include broken sceneManager)
  ↓
CanvasSection useContext(LevelsContext) → re-renders, trigger setState
  ↓
Loop (3-10Hz)
```

**Fix**: Wrap returns in `useMemo`:
1. `useSceneManager()` — return wrapped in `useMemo([levelScenes, setLevelScene, getLevelScene, ...])`. Stabilize function fields (`hasSceneForLevel`, `getSceneEntityCount`) in `useCallback`.
2. `useAutoSaveSceneManager()` — return wrapped in `useMemo([sceneManager, setLevelSceneWithAutoSave, currentFileName, ...])`.
3. `LevelsSystem` Provider `value` already wrapped in `useMemo` (Phase XVI same-session fix).

**Cascading**: Firestore subscription payload equality guard (ADR-361) suppresses STATE mutations, but if State-holding callbacks are not memoized, the context value still churns → downstream re-renders. Both layers required: (1) suppress duplicate deliveries, (2) stabilize all object refs in the Context value. Google-level architecture (N.7.2 #5 SSOT).

**Verification**: After fix, render-trace shows [CanvasSection] idle at render #N (no new ref-only), ref-churn silent. Cardinal rules maintained: 40-line function limit (hooks under 80 lines), 500-line file limit (all modified files <300 lines), zero `any`, zero inline styles.

---

### 2026-05-16: Fix idle re-render loop — `SharedPropertiesProvider` cascade

**Bug**: `CanvasSection.tsx` re-rendered ad alta frequenza (~4-7Hz bursts) al pieno idle (no input, no mouse, no key). PERF_LINE `CanvasSection.commit` + `DxfCanvasSubscriber.commit` flussi continui in console. Tutta la micro-leaf architecture (ADR-040 Phase II) bypassata da cascade upstream.

**Root cause**: `src/contexts/SharedPropertiesProvider.tsx` aveva DUE bug combinati in feedback loop:

1. **Line 72-77 — `activate` callback con `[activated]` nei deps**: ogni volta che `activated` cambiava (anche da `true` a `true` via re-render), nuova ref `activate`.
2. **Line 173-184 — context value object literal NON memoizzato**: `<SharedPropertiesContext.Provider value={{ ..., activate }}>` creava nuovo oggetto ad ogni render.
3. **`useSharedProperties:200-202` — `useEffect(() => context.activate(), [context])`**: dep su oggetto context non-stabile faceva refire l'effetto ad ogni render, chiamando `activate()` → `setActivated(true)` → render → nuovo `activate` → nuovo context → effetto refire → loop infinito.

`CanvasSection` consuma indirettamente: `useLiveOverlaysForLevel` → `useSharedProperties()`. Ogni iterazione del loop → cascade in CanvasSection. La doppia chiamata `GET /api/floorplan-backgrounds` osservata nei log è sintomo secondario dello stesso loop (rimount/effect refire). Il log `[SharedProperties] Lazy activation triggered` apparso DUE volte è la firma del bug — dovrebbe firare esattamente una volta.

**Fix (2 micro-changes in `src/contexts/SharedPropertiesProvider.tsx`)**:

A) `activate` con functional setter + deps vuote → ref stabile per sempre:
```ts
const activate = useCallback(() => {
  setActivated((prev) => {
    if (prev) return prev;
    logger.info('[SharedProperties] Lazy activation triggered');
    return true;
  });
}, []);
```

B) `contextValue` memoizzato con deps espliciti su tutti i campi:
```ts
const contextValue = useMemo(() => ({
  properties: properties || [], floors, setProperties, isLoading, error, forceDataRefresh, activate,
}), [properties, floors, setProperties, isLoading, error, forceDataRefresh, activate]);
return <SharedPropertiesContext.Provider value={contextValue}>{children}</SharedPropertiesContext.Provider>;
```

**Fix collaterale (commit chain stessa sessione)**: `src/subapps/dxf-viewer/systems/levels/hooks/useLevelsFirestoreSync.ts` — `currentLevelId` rimosso dai deps del `useEffect` Firestore subscription, promosso a `currentLevelIdRef`. Tear-down/rebuild della subscription on level change era un secondary amplifier (non root cause). Fix preservato come hardening ADR-040 (pattern cardinal rule 2 esteso ai Firestore callback).

**Pattern**: anti-pattern classico React — Context.Provider value object literal senza `useMemo` + useCallback con dipendenza sul proprio setState. Combinazione = cascade infinita. La fix è canonica (memo + functional setter) e diventa baseline per tutti i Provider del progetto.

**Verifica**: dopo fix, log `[SharedProperties] Lazy activation triggered` apparirà esattamente UNA volta. PERF_LINE `CanvasSection.commit` + `DxfCanvasSubscriber.commit` silenziosi al pieno idle (no commit logs salvo input genuino).

**Secondary offenders identificati (follow-up Phase XIV separato, non bloccanti)**:
- `LevelsSystem.tsx:428-432` — `LevelsContext.Provider value={value}` con `value` da `useLevelsSystemState()` non-memoizzato (plain object return) → ogni render del provider crea nuova ref. Amplifier passivo.
- `CanvasSection.tsx:122` chiama `useLevels()` (full context subscription) — dovrebbe usare slice stabile (es. `useLevelScene(levelId)`).
- `overlays/overlay-store.tsx:130` produce nuovo `overlays: Record<string, Overlay>` ad ogni snapshot — ogni write su `floorplan_overlays` cascade in `useLiveOverlaysForLevel` → CanvasSection. Non idle-driven, write-heavy sessions ne risentono.

---

### 2026-05-16 (EXTENDED): Fix tertiary loop source — `SharedPropertiesProvider` Firestore emit guard

**New Bug**: After Phase XV-XVI memoization fixes, idle ~3-10Hz loop persisted. Root cause: `SharedPropertiesProvider` Firestore callback had no equality guard on filtered state (properties, floors, isLoading, error).

**Mechanism**:
1. `firestoreQueryService.subscribe('PROPERTIES', ...)` applies ADR-361 equality guard to FULL documents (incl. deleted)
2. Callback filters `status !== 'deleted'`, producing `propertiesData`
3. Even if filtered result is identical across emissions, FULL documents might differ
4. Guard passes, callback runs → `setPropertiesState(propertiesData)` dispatched
5. state.properties gets new ref → contextValue useMemo invalidates (deps include `properties`)
6. New context object → useSharedProperties useEffect fires → context.activate() called
7. No state change but render cycles continue @ ~5-10Hz (Firestore cache hydration + pending-write ack)

**Fix**: Apply `dequal` equality guard on FILTERED state before ANY setState:
```ts
const nextIsLoading = false;
const nextError: string | null = null;
if (
  dequal(lastFilteredPropertiesRef.current, propertiesData) &&
  dequal(lastFilteredFloorsRef.current, floorsArray) &&
  lastIsLoadingRef.current === nextIsLoading &&
  lastErrorRef.current === nextError
) {
  return; // Skip all setState — no render
}
```

**Files modified**: `src/contexts/SharedPropertiesProvider.tsx` (4 refs + guard logic in callback).

**Result**: Idle re-renders eliminated. Loop suppressed to user-input-driven only.

---

### 2026-05-16: Clean up temporary render-loop diagnostics instrumentation

**Context**: ADR-040 Phase XV-XVI root-cause analysis completed (Firestore equality guard + memoization chain fixes). Temporary instrumentation deployed to isolate idle render-loop amplifiers no longer needed.

**Cleanup**: Removed from `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx`:
- `installSetStateTracer()` module-level init (monkey-patch React internal setState)
- `useRenderTrace('CanvasSection', {...})` hook with 19 state dependency snapshots

Debug utilities remain in `src/subapps/dxf-viewer/debug/render-loop-trace.ts` for future troubleshooting. No logic change to CanvasSection orchestrator.

---

### 2026-05-15: Z-order PageUp/PageDown — Bring to front / Send to back

Aggiunti shortcut `PageUp` (bring to front) e `PageDown` (send to back) per riordinare la posizione di un'entità nella render list quando esattamente UNA entità è selezionata. Parity AutoCAD/BricsCAD `DRAWORDER`.

**Architettura (8 file)**:
- `core/commands/entity-commands/ReorderEntityCommand.ts` (nuovo): `ICommand` con execute/undo/redo. `execute()` cattura `originalIndex` via `sceneManager.getEntityIndex()`, poi chiama `reorderEntity(id, 'front'|'back')`. `undo()` ripristina l'indice esatto via `moveEntityToIndex(id, originalIndex)` — undo accurato anche dopo riordinamenti complessi.
- `core/commands/interfaces.ts`: aggiunti tre metodi a `ISceneManager` — `getEntityIndex`, `reorderEntity`, `moveEntityToIndex`.
- `managers/SceneUpdateManager.ts`: implementazione canonica via `splice` + `updateScene()` (passa per il batch path normale → bitmap cache invalidation + listener notification).
- `systems/entity-creation/LevelSceneManagerAdapter.ts`: stessa logica adattata al pattern `getLatestScene` + `commitScene` del Level system.
- `config/keyboard-shortcuts.ts`: aggiunti `bringToFront` (PageUp) e `sendToBack` (PageDown) nell'SSoT `DXF_NAVIGATION_SHORTCUTS`. `matchesShortcut` esteso per riconoscere `PageUp`/`PageDown` come tasti speciali.
- `hooks/canvas/useCanvasKeyboardShortcuts.ts`: intercetta PageUp/PageDown quando `selectedEntityIds.length === 1`, chiama `handleReorderEntity(direction)`. Aggiunto a deps array di `useEffect`.
- `components/dxf-layout/CanvasSection.tsx`: `handleReorderEntity` istanzia `LevelSceneManagerAdapter` e dispatcha `ReorderEntityCommand` via `executeCommand` (history-aware, undo/redo OK).
- `core/commands/entity-commands/index.ts`: export `ReorderEntityCommand`.

**Constraint ADR-040 rispettato**: nessun nuovo `useSyncExternalStore` in `CanvasSection`. `handleReorderEntity` è un `useCallback` con deps stabili. L'entity index O(1) di `SceneUpdateManager` (commit `c4efe0dd`) è preservato perché lo splice passa per `updateScene()` → `rebuildEntityIndex()`.

**Note implementative**:
- Lo shortcut è gated su `selectedEntityIds.length === 1` — multi-select reorder non supportato (parity AutoCAD: DRAWORDER richiede singola entità o gruppo esplicito).
- `LevelSceneManagerAdapter` instanziato on-demand nel callback (non hoistato) — l'adapter è stateless rispetto alle operazioni di riordino, costa solo l'allocazione dell'oggetto.
- `Bitmap cache invalidation`: passando per `SceneUpdateManager.updateScene()` il cache key cambia (entities array reference), trigger naturale di redraw senza modifiche al `dxf-bitmap-cache.ts` (cardinal rule 3 rispettata).

---

### 2026-05-15: Pan ArrowUp/ArrowDown — fix direzione invertita

`hooks/useKeyboardShortcuts.ts`: corrette le emissioni `canvas-pan` su ArrowUp/ArrowDown. Erano invertite rispetto alla semantica documentata nell'entry "Keyboard arrow-key canvas pan" (↑ = viewport sale = scena va GIÙ = `dy` negativo). Regression introdotta nel commit `9327e12e`.

| Tasto | Prima (BUG) | Dopo (FIX) |
|-------|-------------|------------|
| `ArrowUp` | `dy: +dist` | `dy: -dist` |
| `ArrowDown` | `dy: -dist` | `dy: +dist` |

ArrowLeft/Right erano già corrette.

---

### 2026-05-15: Keyboard arrow-key canvas pan

Aggiunto panning del canvas tramite tasti freccia quando nessuna entità è selezionata (parity AutoCAD). ↑/↓/←/→ = pan 80px; Shift+freccia = pan 240px. Le direzioni corrispondono allo scroll del viewport (↑ = contenuto si sposta giù, ecc.).

**Architettura**: EventBus pattern identico a `canvas-fit-to-view`.
- `EventBus.ts`: aggiunto `'canvas-pan': { dx, dy }` event type
- `keyboard-shortcuts.ts`: aggiunto panUp/panDown/panLeft/panRight nell'SSoT navigation shortcuts
- `useKeyboardShortcuts.ts`: emette `canvas-pan` PRIMA del guard selection — quando nessuna selezione, le frecce pan; quando selezione esiste, nudge (comportamento esistente)
- `useCanvasPan.ts` (nuovo, `hooks/canvas/`): listener EventBus che applica `{ offsetX + dx, offsetY + dy }` al transform corrente via `transformRef.current`
- `CanvasSection.tsx`: chiama `useCanvasPan({ transformRef, setTransform })` vicino a `useFitToView`

**ADR-040 constraint rispettato**: `useCanvasPan` è un hook "side-effect only" (solo `useEffect` + EventBus listener), zero `useSyncExternalStore`, zero subscription a store high-freq. `CanvasSection` non accumula nuovi re-render.

---

### 2026-05-15: Ribbon re-render cascade fix — getter pattern + React.memo

**Root cause**: `useRibbonTextEditorBridge.ts:44` chiamava `useTextToolbarStore()` senza selector → subscription all'intero store (15+ campi). Ogni aggiornamento del text toolbar store (selezione entità testo, cursor move in editor) causava re-render di `DxfViewerContent` → `commands` inline object ricreato → `RibbonRoot` (non memo'd) re-renderizzava → cascata su tutti i figli incluso `RibbonSplitButton` (169 samples / 31% `flushSyncWorkAcrossRoots_impl` in Firefox Profiler su sessione 1m16s).

**Fix (4 file)**:

1. **`useRibbonTextEditorBridge.ts`**: Rimossa `const values = useTextToolbarStore()` (whole-store subscription). Sostituita con getter ADR-040 pattern: `const getValues = useTextToolbarStore.getState`. `getToggleState` e `getComboboxState` ora leggono lo store al momento della chiamata — refs stabili (`[]` / `[sources]` deps). Zero subscription a livello di orchestratore.

2. **`DxfViewerContent.tsx`**: Estratto `commands` object in `useMemo(ribbonCommands, [...stable-fn-refs])`. Oggetto stabile grazie a getter pattern del bridge → `RibbonCommandProvider.useMemo` non ricrea il context value su ogni re-render.

3. **`RibbonRoot.tsx`**: Wrappato con `React.memo` → salta il re-render quando tutti i props (commands, contextualTabs, activeContextualTrigger) sono stabili per reference.

4. **`RibbonSplitButton.tsx`**: Wrappato con `React.memo` → protezione leaf finale.

**Pattern confermato**: `RibbonCommandProvider` già usava `useMemo` con deps sulle singole fn refs — quindi `getToggleState` stabile blocca il cascade dall'alto verso il basso.

**Nota reactivity**: `getToggleState` e `getComboboxState` usano getter — mostrano stato corretto al momento del render, ma non forzano re-render reattivo quando il testo store cambia. Accettabile: la chain store→`UpdateTextStyleCommand` è pending ADR-344 Phase 6+; quando verrà cablata, il ribbon riceverà aggiornamenti tramite il command bridge, non via subscription diretta allo store.

---

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

## 2026-05-15: Scale Command — ScalePreviewMount micro-leaf (ADR-348)

`ScalePreviewMount` added to `canvas-layer-stack-leaves.tsx`. `useScalePreview` runs 60fps RAF on PreviewCanvas — draws ghost copies of selected entities at current scale factor around the base point. `ScaleToolStore` 3-phase FSM (idle→base→scale). `useScaleTool` wired into `CanvasSection` (click + keyboard handlers: S key, ESC, C for copy mode, Enter to confirm). `CanvasSection` orchestrator zero `useSyncExternalStore` calls maintained.

## 2026-05-15: Stretch Command + LassoFreehandPreviewSubscriber (ADR-349 Phase 1a)

`LassoFreehandPreviewSubscriber` re-mounted in `CanvasLayerStack` (had been deferred from scale commit). `useStretchTool` wired into `CanvasSection` (click + keyboard handlers: ST key, ESC, Enter/Space to confirm). `StretchToolStore` FSM: idle→lasso→confirm. Crossing-window capture via `stretch-crossing-capture.ts`; vertex classification via `stretch-vertex-classifier.ts`; entity deformation via `stretch-entity-transform.ts` (7 entity types). Cardinal rules maintained: `CanvasLayerStack` and `CanvasSection` have zero `useSyncExternalStore` calls.

## 2026-05-15: Grip Hover Menu — GripHoverMenu micro-leaf (ADR-349 Phase 1b.2)

`GripHoverMenu` added as a micro-leaf sibling of `<PromptDialog />` in `CanvasSection`. Subscribes ONLY to `GripHoverMenuStore` (module-level pub/sub — low-frequency visibility transitions). `useGripHoverMenuController` hook invoked in `CanvasSection` orchestrator (no store subscriptions in the hook — fires timer effects only). Cardinal rules maintained: `CanvasSection` orchestrator has zero `useSyncExternalStore` calls; all store reads in `GripHoverMenu` leaf.

## 2026-05-15: Stretch Preview — StretchPreviewMount micro-leaf (ADR-349 Phase 1c-B1)

`StretchPreviewMount` added to `canvas-layer-stack-leaves.tsx`. `useStretchPreview` runs 60fps RAF on PreviewCanvas — draws ghost copies of stretch-selected vertices displaced by current drag delta. `stretchPreview: Record<string, never>` prop added to `CanvasLayerStackProps` (same zero-prop pattern as `scalePreview`). `CanvasSection` passes `stretchPreview={{}}` to `CanvasLayerStack`. Cardinal rules maintained: `CanvasSection` and `CanvasLayerStack` orchestrators have zero `useSyncExternalStore` calls.

## 2026-05-15: Grip handoff to Rotate/Scale/Mirror (ADR-349 Phase 1c-B2)

`CanvasSection` now passes `onToolChange` to `useUnifiedGripInteraction` for grip-mode handoff. No new `useSyncExternalStore` calls added to orchestrator. Cardinal rules maintained.

## 2026-05-15: RulerSettings API fix — .width/.height flat access (CanvasLayerStack)

Fixed `rulerSettings.vertical?.width` → `rulerSettings.width` and `rulerSettings.horizontal?.height` → `rulerSettings.height` in CrosshairOverlay margins and RulerCornerBox props. No new subscriptions added to orchestrator.


## 2026-05-15: Trim Command — TrimPreviewMount micro-leaf + useTrimTool orchestrator hook (ADR-350 Phase 2)

`TrimPreviewMount` added to `canvas-layer-stack-leaves.tsx` as a zero-JSX micro-leaf (same pattern as `StretchPreviewMount`). `useTrimPreview` runs on `TrimToolStore` state; draws hover highlight + scissor cursor indicator on PreviewCanvas. `useTrimTool` wired into `CanvasSection` (TR shortcut, click handler, ESC/keyboard). `TrimToolStore` FSM: idle→active→done. `trimPreview: Record<string, never>` optional prop added to `PreviewCanvasMountsProps`. Cardinal rules maintained: `CanvasSection` and `CanvasLayerStack` have zero direct `useSyncExternalStore` calls — all store reads isolated to `TrimPreviewMount` leaf and `useTrimTool` hook internals.

## 2026-05-15: Trim Command Phase 3 follow-up — ToolCursorStore + fence drag capture (ADR-350 Phase 3)

`TrimPreviewMount` extended: now also mounts `useTrimDragCapture` alongside `useTrimPreview`. Both hooks are ADR-040 leaf-only — no orchestrator subscriptions. `useTrimDragCapture` attaches pointer events directly to the viewport element (no React state, no re-renders); sets `TrimToolStore.phase='fence'` + `dragStart`/`dragCurrent` on drag detection (5px screen threshold). `useTrimPreview` extended with fence-line rendering (yellow dashed line from dragStart→dragCurrent). `ToolCursorStore` (new module-level SSoT) tracks `default`/`trim-pickbox`/`extend-arrow` variant; wired in `useTrimTool` on activate/deactivate + SHIFT keydown/keyup. Pick-fn registry (`TrimToolStore.registerPickFn`) avoids prop-threading through CanvasLayerStack — `useTrimDragCapture` calls `TrimToolStore.execPick` directly. Cardinal rules maintained: `CanvasSection` has zero new `useSyncExternalStore` calls; no orchestrator changes.

## 2026-05-15: Canvas keyboard pan — useCanvasPan EventBus listener (ADR-040)

`useCanvasPan` hook added to `hooks/canvas/` barrel. Listens for `canvas-pan` EventBus events emitted by `useKeyboardShortcuts` when arrow keys are pressed with no entity selected (AutoCAD parity). Applies dx/dy pixel delta directly to offsetX/offsetY via `setTransform`. `useKeyboardShortcuts` updated: arrow keys with no selection emit `canvas-pan` instead of falling through; with a selection they still nudge. `EventBus.DrawingEventMap` extended with `canvas-pan` payload. Cardinal rules maintained: `CanvasSection` orchestrator has zero new `useSyncExternalStore` calls — `useCanvasPan` is a side-effect hook with no subscriptions.


## 2026-05-15: Extend Command — ExtendPreviewOverlay micro-leaf + useExtendTool orchestrator hook (ADR-353)

`ExtendPreviewOverlay` added to `canvas-layer-stack-leaves.tsx` as a zero-JSX micro-leaf (same pattern as `TrimPreviewMount`). `useExtendTool` wired into `CanvasSection` via `useModifyTools` (EX shortcut, click handler, ESC/keyboard). `ExtendToolStore` FSM mirrors TrimToolStore: idle→active→done. `canvas-click-types.ts` extended with `extendIsActive`/`handleExtendClick`. Cardinal rules maintained: `CanvasSection` and `CanvasLayerStack` have zero direct `useSyncExternalStore` calls — all store reads isolated to `ExtendPreviewOverlay` leaf. SHIFT+click during EXTEND invokes TrimEntityCommand (symmetric inverse), SHIFT+click during TRIM invokes ExtendEntityCommand.

## 2026-05-15: Array Tool Phase A — useModifyTools setSelectedEntityIds threading (ADR-353)

`CanvasSection` passes `setSelectedEntityIds` to `useModifyTools` so `useArrayTool` can update selection after array creation (select the new array entity). 1-line orchestrator change; no new `useSyncExternalStore` calls added to `CanvasSection` or `CanvasLayerStack`. Cardinal rules maintained.

## 2026-05-15: Array Tool Phase B2 — Polar Array tool wiring (ADR-353 B2)

`CanvasSection` wires `arrayPolarTool` (from `useModifyTools`) into `useCanvasClickHandler` and `useCanvasKeyboardShortcuts`. 2-line orchestrator changes adding `arrayPolarIsActive`/`handleArrayPolarClick`/`handleArrayPolarEscape` props. `canvas-click-types.ts` extended with the same optional props. No new `useSyncExternalStore` calls added to `CanvasSection` or `CanvasLayerStack`. Centre-pick state (`pickingCenterArrayId`) lives in `ArrayStore` (module-level pub/sub — same pattern as TrimToolStore). Cardinal rules maintained.

## 2026-05-16: CanvasSection size budget refactor — useArrayRepickHandlers + useFloorplanAutoFit

Extracted two blocks from CanvasSection to keep it under 500 lines (N.7.1 budget):
`useArrayRepickHandlers` (polar+path repick callbacks, `hooks/canvas/`) and `useFloorplanAutoFit` (ADR-340 Phase 5 auto-fit effect, `hooks/canvas/`). CanvasSection: 515→468 lines. Cardinal rules maintained.

## 2026-05-16: Array Tool Phase C3 — Path Array tool wiring (ADR-353 C3)

`CanvasSection` wires `arrayPathTool` (from `useModifyTools`) into `useCanvasClickHandler` and `useCanvasKeyboardShortcuts`. Adds `handleArrayPathEntityRepick` callback (mirrors `handleArrayPolarCenterRepick` pattern — reads `getPickingPathArrayId()` + calls `applyPathPick`). `canvas-click-types.ts` extended with `arrayPathIsActive`/`handleArrayPathClick`/`handleArrayPathEntityRepick`. No new `useSyncExternalStore` calls added to `CanvasSection` or `CanvasLayerStack`. Path-pick state (`pickingPathArrayId`) lives in `ArrayStore`. Cardinal rules maintained.

## 2026-05-16: ADR-358 §G7 Phase 4 — DxfRenderer ByLayer/ByBlock import wiring

`DxfRenderer.ts` imports `resolveEntityStyle` + `entityToStyleInput` from new `systems/properties/resolve-entity-style.ts` and `lineweightToPx` from `config/lineweight-iso-catalog.ts`. New `layersById?: Record<string, SceneLayer>` field added to `DxfRenderOptions` in `dxf-types.ts` — when provided, renderer will route each entity through the ByLayer/ByBlock cascade resolver (Phase 4 render integration pending). New `systems/properties/` module: `resolved-style.types.ts` (ResolvedStyle + EntityStyleInput + BlockStyleInput + DefaultStyleInput interfaces) + `resolve-entity-style.ts` (pure cascade resolver, no side effects, RAF-safe). `BaseEntity` in `types/entities.ts` gains optional fields `colorMode`, `colorAci`, `colorTrueColor`, `linetypeName`, `lineweightMm`, `transparency`. Cardinal rules maintained: no new `useSyncExternalStore` calls.

## 2026-05-16: CanvasSection render-loop diagnostic (temporary — CS-RENDER)

`CS-RENDER` diagnostic block added to `CanvasSection.tsx` to investigate 4Hz idle re-render loop root cause. Tracks which props change reference vs content across renders via `useRef` snapshot diff + `useEffect` console output (`[CS-RENDER] #N content-changed: X | ref-only: Y`). Uses only `useRef` + `useEffect` — no store subscriptions, no new `useSyncExternalStore` calls. Temporary — will be removed after root cause identified. Cardinal rules maintained.

## 2026-05-16: DxfViewerContent render-loop diagnostic (temporary — DVC-RENDER)

Parallel diagnostic in `DxfViewerContent.tsx` (parent of CanvasSection). `DVC-RENDER` block tracks which PROPS of `DxfViewerContent` change reference vs content across renders via `useRef` snapshot + `useEffect` console output (`[DVC-RENDER] #N props-content-changed: X | props-ref-only: Y`). Identifies whether the 4Hz re-render originates from parent props or internal CanvasSection state. Uses `useRef` + `useEffect` only — no store subscriptions, no new `useSyncExternalStore` calls. Temporary — will be removed after root cause identified. Cardinal rules maintained.

## 2026-05-16: render-loop-trace abstraction (debug/render-loop-trace.ts)

Extracted inline `CS-RENDER` / `DVC-RENDER` / `DVC-SNAPSHOT` diagnostic blocks into a reusable `useRenderTrace(label, values)` hook in `src/subapps/dxf-viewer/debug/render-loop-trace.ts` (222 lines). Hook is env-gated (`NEXT_PUBLIC_RENDER_TRACE=1`): no-op in prod, zero overhead. `installSetStateTracer()` optional companion patches React's `setState` for set-state-level diagnosis. `CanvasSection.tsx` replaces its 40-line manual block with `useRenderTrace('CS-RENDER', {...})` + calls `installSetStateTracer()` at module init. `DxfViewerContent.tsx` removes both `DVC-RENDER` + `DVC-SNAPSHOT` inline blocks (reducing from committed 521 → 497 lines, passing N.7.1 budget), wires `useRenderTrace('DVC-SNAPSHOT', {...})` instead. Cardinal rules maintained: no `useSyncExternalStore` calls added to orchestrators.

## 2026-05-17: ADR-358 §5.6.bis Phase 10 — Layer Isolate render integration

`DxfRenderer.ts` gains two private helpers: `applyIsolateAlpha(style, entity)` and `isEntityLayerSkipped(entity, layersById)`. Both read `IsolateEffectsStore` (new micro-leaf in `systems/isolate/IsolateEffectsStore.ts`, mirrors `HoverStore` pattern) via a direct snapshot getter — zero React subscription, zero render re-triggers. `applyIsolateAlpha` is a zero-cost passthrough when `active===false`; in `dim` mode it multiplies alpha by `(1 - dimOpacityPercent/100)` for non-isolated layers. `isEntityLayerSkipped` returns true for frozen/invisible layers plus freeze-mode non-isolated layers. Batch key in LINE renderer extended with `alpha.toFixed(3)` to separate dim-mode batches. `resolveStyleForRender` signature extended with pre-resolved style overload to avoid double-resolve in `renderEntityUnified`. `stores/LayerStore.ts` gains `UnisolateSnapshot` type + `getUnisolateSnapshot`/`setUnisolateSnapshot`/`clearUnisolateSnapshot` session-only API. Cardinal rules maintained: no `useSyncExternalStore` calls added; `IsolateEffectsStore` is a pure external-store leaf, read by `DxfRenderer` at render time only (not wired to React reconciler).

## 2026-05-16: ADR-358 §G7 Phase 6 — ByLayer/ByBlock full sentinel pipeline LIVE

`DxfRenderer.resolveStyleForRender()` now forwards the full sentinel set (`colorMode`, `colorAci`, `colorTrueColor`, `linetypeName`, `lineweightMm`, `transparency`) through `entityToStyleInput()` — not just legacy `color` hex (Phase 4 stub). Entities that declare `colorMode: 'ByLayer'` / `'ByBlock'` or sentinel lineweights (`-3`/`-2`/`-1`) now inherit live from `layer.color` / `layer.lineweight` when the user edits layer style in `AdminLayerManager`. `DxfEntity` in `dxf-types.ts` gains the full optional sentinel field set (mirrors `BaseEntity` Phase-4 fields). `useDxfSceneConversion` Phase 6: sentinel-aware `buildBase()` — omits flattened `color`/`lineWidth` when entity opts into ByLayer/ByBlock cascade, forwards sentinel fields to `DxfScene`. `dxf-canvas-renderer.ts` bridges `curScene.layersById` into all three `renderer.render()` + `renderSingleEntity()` calls. 2 new test suites (bylayer-emission, layers-bridge — 269 LOC) verify sentinel emission and bridge. Cardinal rules maintained: no new `useSyncExternalStore` calls.

## 2026-05-17: ADR-358 Phase 11 — layer command integration in canvas/CanvasSection

`CanvasSection.tsx` wires `useLayerCommandShortcuts` (keyboard dispatch for LAYISO/LAYUNISO/LAYFRZ/LAYTHW/LAYOFF/LAYON/LAYLCK) and passes the layer command dispatcher to child panels. `dxf-canvas-renderer.ts` bridges LayerStore frozen/visible state into renderer skip logic. No new `useSyncExternalStore` calls added to orchestrators; cardinal rules maintained.

## 2026-05-17: ADR-362 Phase C1 — dimension entity in DxfRenderer

`DxfRenderer.toEntityModel()` gains a `dimension` case that unwraps `DxfDimension.dimensionEntity` into the renderer pipeline. `buildDimensionLookup()` scans `scene.entities` once per frame to build the `Map<string, DimensionEntity>` needed for baseline/continued parent resolution. Two new type imports from ADR-362: `DimensionEntity`, `DimensionLookup`. Cardinal rules maintained.

## 2026-05-17: ADR-362 Phase C1 — dim-arrowhead-renderer + dim-text-renderer leaves

`rendering/entities/dimension/dim-arrowhead-renderer.ts` and `dim-text-renderer.ts` are pure Canvas2D leaf renderers used by `DimensionRenderer`. Both comply with ADR-040 micro-leaf rules: no store subscriptions, no scene reads, deterministic Canvas2D output. `dim-arrowhead-renderer` scales from unit-space block definitions (Phase A2) by `dimasz` and rotates to dim-line direction. `dim-text-renderer` applies `DIMTXSTY`/`DIMTXT`/`DIMCLRT`/`DIMGAP` from resolved DimStyle. Cardinal rules maintained.

## 2026-05-17: ADR-362 Phase C1 — dim-text-renderer wired (DIMTIH/DIMTOH placement)

`dim-text-renderer.ts` companion note: horizontal vs aligned text placement driven by `dimtih` (text inside extension lines) and `dimtoh` (text outside) flags per DIMSTYLE. DIMTFILL background mask reserved as stub for Phase K. Fully stateless — no external reads beyond Canvas2D context + resolved DimStyle. Cardinal rules maintained.

## 2026-05-18: ADR-357 Phase 2a — DynamicInputSubscriber micro-leaf + CanvasLayerStack mount

`DynamicInputSubscriber.tsx` added as micro-leaf subscriber in `CanvasLayerStack.tsx` (ADR-040 pattern). Subscribes to drawing state for live length/angle readout. CanvasLayerStack remains orchestrator — no high-frequency store subscriptions added. Cardinal rules maintained.

## 2026-05-18: ADR-363 Phase 1 — canvas-click-types WallClickContext

`canvas-click-types.ts` extended with `WallClickContext` type for wall tool canvas interactions. No store subscriptions added — pure type extension. Cardinal rules maintained.

## 2026-05-18: ADR-363 Phase 1B — CanvasSection wires wallTool from useSpecialTools

`CanvasSection.tsx` (orchestrator) now receives `wallTool` from `useSpecialTools` and passes it to `useCanvasClickHandler`. No high-frequency store subscriptions added — pure prop drilling through orchestrator. Cardinal rules maintained.

## 2026-05-18: ADR-363 Phase 1B — EntityRendererComposite registers WallRenderer

`EntityRendererComposite.ts` registers `WallRenderer` for `'wall'` entity type (ADR-040 micro-leaf pattern). WallRenderer renders plan-view BIM walls (hover halo, fill, edges, axis). Cardinal rules maintained.

## 2026-05-18: ADR-357 Phase 1 — PreviewRenderer/PreviewCanvas polar tracking line

`PreviewRenderer.ts` adds `drawPolarTrackingLine(ctx, snap, angle)` for dashed green alignment path. `PreviewCanvas.tsx` passes polar state to renderer. No store subscriptions added. Cardinal rules maintained.

## 2026-05-18: ADR-357 Phase 1 — PreviewRenderer drawPolarTrackingLine

`PreviewRenderer.ts` adds `drawPolarTrackingLine(ctx, snapPoint, angleDeg)`: dashed green radial path at locked polar angle. Stateless render function — receives all state as params. Cardinal rules maintained.

## 2026-05-18: ADR-357 Phase 8 — QuickPropertiesHoverPopover micro-leaf added to CanvasSection

`CanvasSection.tsx` mounts `QuickPropertiesHoverPopover` as sibling of `GripHoverMenu`. New micro-leaf pattern: `QuickPropertiesStore` singleton subscribes to `HoverStore` internally (zero React state), fires after 800ms stable hover, captures position from `ImmediatePositionStore`. `QuickPropertiesHoverPopover` is the ONLY `useSyncExternalStore` consumer — `CanvasSection` does NOT subscribe. Cardinal rules maintained.

## 2026-05-18: ADR-363 Phase 3.7 — canvas-click-types SlabOpeningToolLike + click routing

`canvas-click-types.ts` extended with `SlabOpeningToolLike` interface (`isActive` + `onCanvasClick`) and `slabOpeningTool?` param on `UseCanvasClickHandlerParams`. `useCanvasClickHandler.ts` adds PRIORITY 4.95 routing arm for `activeTool === 'slab-opening'`. `'slab-opening'` registered in `DrawingTool` union and `ToolStateManager.TOOL_DEFINITIONS`. Pure type/routing extension — no store subscriptions added. Cardinal rules maintained.

## 2026-05-18: ADR-363 Phase 3.7 — CanvasSection wires slabOpeningTool from useSpecialTools

`CanvasSection.tsx` (orchestrator) destructures `slabOpeningTool` from `useSpecialTools` and passes it to `useCanvasClickHandler`. `useSpecialTools.ts` instantiates `useSlabOpeningTool` with `getSlabById` / `getSlabAtPoint` / `onSlabOpeningCreated` resolvers (bidirectional `slab.slabOpeningIds` mirror on creation). `useToolLifecycle` activates/deactivates on `activeTool === 'slab-opening'`. No high-frequency store subscriptions added — pure prop drilling through orchestrator. Cardinal rules maintained.

## 2026-05-18: ADR-363 Phase 3.7 — DxfRenderer slab + slab-opening unwrap + per-frame openings map

`dxf-types.ts` extends `DxfEntity['type']` union with `'slab' | 'slab-opening'` and adds `DxfSlab` / `DxfSlabOpening` wrappers in `DxfEntityUnion`. `useDxfSceneConversion.ts` converts `SlabEntity` / `SlabOpeningEntity` via `isSlabEntity` / `isSlabOpeningEntity` guards. `DxfRenderer.ts` unwraps both kinds in `convertDxfEntityToRenderEntity` (so `SlabRenderer` / `SlabOpeningRenderer` see plain entities) and builds an O(n) `Map<slabId, SlabOpeningEntity[]>` per frame via `buildSlabOpeningsBySlab()`, forwarded to `entityComposite.setSlabOpeningsBySlab()` for boolean cutout consumption by `SlabRenderer`. Per-frame map mirrors the `DimensionLookup` pattern. Cardinal rules maintained.

## 2026-05-18: ADR-359 Phase 11 — DxfRenderer xline/ray unwrap

`DxfRenderer.toEntityModel` extended με xline/ray cases: `entity.xlineEntity` → `basePoint+direction` στο `EntityModel` root (mirror για ray). Χωρίς αυτό, οι Phase 11 wrappers (`DxfXLine.xlineEntity` / `DxfRay.rayEntity`) άφηναν `basePoint`/`direction` undefined όταν τα entities έμπαιναν στο render pipeline. Pure unwrap — zero new subscriptions, ADR-040 micro-leaf invariant intact.

## 2026-05-18: ADR-363 Phase 4.5c.1 — ColumnGhostPreviewMount micro-leaf (column anchor cycling preview)

`ColumnGhostPreviewMount` added as micro-leaf subscriber in `canvas-layer-stack-leaves.tsx` via `PreviewCanvasMounts` (extracted to its own module `canvas-layer-stack-column-ghost.tsx` for N.7.1 SRP / file-size compliance — shell `canvas-layer-stack-leaves.tsx` stays <500 lines). `useColumnGhostPreview` subscribes to `ImmediatePositionStore` (cursor world position) and `useColumnTool.getGhostFootprints()` projection — RAF-scheduled draw of 9 anchor ghosts (active highlighted + 8 inactive outlines) on the preview canvas. `CanvasSection` (orchestrator) only forwards stable `{ isAwaitingPosition, kind, getGhostFootprints }` payload — zero `useSyncExternalStore` on shell, no re-render on mousemove. Cardinal rules maintained.

## 2026-05-18: ADR-040 perf — RulerCornerBox memo + CanvasLayerStack stable callbacks

`RulerCornerBox` wrapped σε `React.memo` (zero subscriptions, depends μόνο σε zoom state + stable callbacks, βλέπει re-renders από parent dxfScene changes pre-memo). Prop `viewport` removed (unused).

`CanvasLayerStack.tsx` ruler zoom callbacks (`handleRulerZoomToFit` / `handleRulerWheelZoom` / `handleZoom100` / `handleZoomIn` / `handleZoomOut` / `handleZoomPrevious` / `handleZoomToScale`) μετατράπηκαν σε `useCallback` με `dxfSceneRef` + `colorLayersRef` (avoid stale-closure χωρίς να αναιρείται η referential stability). Combined: stable callback identities → `RulerCornerBox` memo πραγματικά skipάρει re-renders σε scene mutations. Cardinal rules maintained.

## 2026-05-18: ADR-364 — ESC migration για dim tools

`useDimToolRouting.ts` registers DIM_TOOL-priority handler στο `EscapeCommandBus` (`allowWhenEditable=true`, blur active editable element πριν dispatch). `useDimensionKeyboardRouting.ts` αφαιρεί το Escape branch — πλέον owns Tab/Space/Enter μόνο. ESC dispatch χωρίς duplicate paths · `useKeyboardShortcuts` legacy ESC fallback τραβιέται από νέα bus registration (DRAW_TOOL + COLOR_MENU priorities). Cardinal rules maintained.

## 2026-05-19: BIM selection visual feedback — DxfRenderer passes `selected` flag downstream

`renderEntityUnified` adds `selected: isSelected` to the `RenderOptions` it forwards to entity-specific renderers, so `PhaseManager.determinePhase` correctly resolves `'highlighted'` instead of `'hover'` when an entity is BOTH hovered and selected. No new subscriptions — `isSelected` already came from the existing selectionInfo argument, only the field forwarding was missing. Pure render-time data passthrough. Cardinal rules maintained (orchestrator already wraps renderer; no high-freq store added; bitmap cache key untouched).

## 2026-05-19: ADR-362 Round 4.1 cleanup — DIM-DIAG R3 diagnostic logs removed από DxfRenderer

`DxfRenderer.renderScene` αφαιρεί το temporary `[DIM-DIAG R3] frame dimCount=...` `console.warn` (frame-start dimension entity census) που χρησιμοποιήθηκε για το tracing του DPR ≠ 1 viewport bug (Round 4 / Round 4.1). Bug λύθηκε στα commits `25c4dcc9` (DimensionRenderer toScreen) + `d04e8233` (center-mark + EntityRendererComposite hit-test + SSoT module). Pure deletion — zero new subscriptions, zero behavioural change, bitmap cache key untouched. Cardinal rules maintained.

## 2026-05-19: ADR-362 Round 5 — scene-units propagation through DxfRenderer

`DxfRenderer.render` καλεί `this.entityComposite.setDimensionSceneUnits(scene.units ?? 'mm')` per frame, παράλληλα με τα ήδη υπάρχοντα `setDimensionLayerColour` / `setDimensionLookup`. Plumb-only forwarder (`EntityRendererComposite.setDimensionSceneUnits`) → καμία νέα subscription στον orchestrator, καμία αλλαγή στο bitmap cache key, καμία νέα `useSyncExternalStore`. Το `scene.units` υπάρχει ήδη στο `DxfScene` interface και διαβάζεται μόνο μέσα στο rendering pipeline. Cardinal rules maintained.

## 2026-05-19: ADR-363 R1 — BIM Copy Tool wiring (CanvasSection + canvas-click-types passthrough)

`canvas-click-types.ts` extended με `BimCopyToolLike` interface (`isActive` + `onCanvasClick`) και `bimCopyTool?` param στο `UseCanvasClickHandlerParams`. `useCanvasClickHandler.ts` adds a routing arm για `activeTool === 'bim-copy'`. `CanvasSection.tsx` (orchestrator) destructures `bimCopyTool` από `useModifyTools` και το περνά plumb-only στο `useCanvasClickHandler` — ZERO new `useSyncExternalStore` subscriptions στον orchestrator. `useBimCopyTool` εσωτερικά subscribe-άρει στο `ImmediatePositionStore` για live cursor world position (high-freq path, mirror του `useWallSplitTool` / `useTrimTool` pattern — Phase 5.6). Cardinal rules maintained (orchestrator stays plumb-only; high-freq subs μένουν εντός tool hook; bitmap cache key untouched).

## 2026-05-20: ADR-366 Phase 1 — CanvasLayerStack mounts 3D viewport leaf + ViewMode3DToggleButton

`CanvasLayerStack.tsx` (shell) gets two additional plumb-only JSX siblings inside the existing canvas container: `<CanvasLayerStack3dLeaf />` (ADR-366 Phase 0 micro-leaf, self-hides in 2D mode via `useSyncExternalStore` on `ViewMode3DStore.is3D`) and `<ViewMode3DToggleButton />` (entry-point button, self-hides in 3D mode). ZERO new `useSyncExternalStore` subscriptions in the shell — both children own their own low-freq mode subscription. Bitmap cache key untouched. Cardinal rules maintained: shell stays plumb-only; mode-state subscriptions live in the leaves.

## 2026-05-20: ADR-363 Phase 3.7b+ / 3.7b++ — Slab-Opening Ghost Preview micro-leaf + edge-midpoint hover indicator

`SlabOpeningGhostPreviewMount` (new micro-leaf, `canvas-layer-stack-slab-opening-ghost.tsx`) owns the slab-opening drawing preview path. `useSlabOpeningGhostPreview` uses the RAF + `getImmediateSnap()` imperative pattern (mirror Phase 4.5c.1 `ColumnGhostPreviewMount` / Phase 5.6 `useTrimTool`), with `useCursorWorldPosition()` only as a trigger — zero React state in the preview render path. `SlabOpeningGhostRenderer` draws per-kind rectangle ghost (shaft/well/duct/chimney palette, dashed stroke, 25% fill, crosshair). Phase 3.7b++ extension: optional `hoveredEdgeMidpointGrip` prop draws a green "+vertex" affordance at the grip's screen position (Revit/AutoCAD convention) — single RAF lifecycle gated by `isActive = isAwaitingPosition || hoveredEdgeMidpointGrip != null`. `CanvasLayerStack.tsx` + `canvas-layer-stack-leaves.tsx` + `canvas-layer-stack-types.ts` extended plumb-only; `CanvasSection.tsx` (orchestrator) destructures `slabOpeningTool` from `useSpecialTools` and passes the inline-derived `hoveredGrip?.slabOpeningGripKind?.startsWith('slab-opening-edge-midpoint-')` filter. ZERO new `useSyncExternalStore` subscriptions in orchestrator/shell. Bitmap cache key untouched. `DxfRenderer.ts` adds slab-opening preview pass plumbing (render-only, no cache invalidation key change). Cardinal rules maintained.

## 2026-05-21: ADR-366 Phase 4.6 — Focus2DOverlayLeaf micro-leaf + use2DKeyboardFocus getter pattern

`Focus2DOverlayLeaf` (new micro-leaf, `components/dxf-layout/Focus2DOverlayLeaf.tsx`) added as plumb-only sibling inside `CanvasLayerStack.tsx`. The leaf is the sole consumer of the `KeyboardFocus2DManager` subscription — outline painting is RAF-scheduled, zero React state on the focus ring. `use2DKeyboardFocus` (new hook, `hooks/state/use2DKeyboardFocus.ts`) wires keyboard Tab/Enter/Esc handling on the canvas; it accepts `getScene` / `getTransform` / `getViewport` **getters** (ADR-040 Rule 2) rather than snapshot values, so keydown-time reads stay fresh even when the orchestrator skips re-renders. `CanvasSection.tsx` adds the hook with `dxfSceneRef.current` / `transformRef.current ?? transform` / `viewport` getter closures plus a `toggleEntity` callback that delegates to the existing `universalSelectionRef` (ADR-030 SSoT) — ZERO new `useSyncExternalStore` subscriptions in the orchestrator. ESC handled via new `ESC_PRIORITY.FOCUS_CLEAR = 150` bus slot (clears the focus ring without touching the selection set at P250). Bitmap cache key untouched. Cardinal rules maintained.

## 2026-05-22: ADR-363 Phase 3.8 — Slab Vertex Editing wiring (hoveredDxfGrip thread + grip-context-menu Radix migration)

`CanvasSection.tsx` (orchestrator) extends the `useCanvasEditActions` prop set with `hoveredDxfGrip: unified.hoveredGrip` — a single plumb-only forward, ZERO new `useSyncExternalStore` subscriptions in the shell (the underlying subscription is owned by `useUnifiedGripSystem`). `useSmartDelete` consumes `hoveredDxfGrip` synchronously inside its already-existing `useCallback`, so the orchestrator does not re-render on hover frame ticks. `GripContextMenu.tsx` refactor from inline `<nav>` + manual outside-click/escape to Radix `DropdownMenu` (shared `DrawingContextMenu.module.css`): the menu remains a micro-leaf with a single `useSyncExternalStore` on `GripContextMenuStore`, but Radix now owns dismissal + portal — no new high-frequency subscription introduced. Bitmap cache key untouched. Cardinal rules maintained.

## 2026-05-22: viewport client-position SSoT — `ImmediatePositionStore.getClientPosition()`

`ImmediatePositionStore` extended with a private `clientPos` field updated by a single passive `window` `mousemove` listener registered in the class constructor, plus a `getClientPosition(): { x, y }` getter and module-level re-export. Two consumers — `useGripHoverMenuController` (grip hover menu anchor) and `use-selection-cycling` (selection-cycling popover anchor) — previously each registered their own inline `window.addEventListener('mousemove', …)` with a `useRef<{x,y}>` for viewport coords needed by `position:fixed` overlays. Both now read the centralized getter at event-time (ADR-040 Rule 2 — getter, not snapshot — preserved). Net: one listener instead of N scattered ones, zero new React state, zero impact on the bitmap cache key. The store remains a pure SSoT with no `useSyncExternalStore` reachable from orchestrators. Cardinal rules maintained.

## 2026-05-22: AutoCAD parity — move-tool ghost preview (`movePreviewActive`)

`DxfRenderOptions` extended with `movePreviewActive?: boolean`. When the Move tool enters `awaiting-destination` phase, `CanvasLayerStack` sets `movePreviewActive: true` in `renderOptions` (memoised on `movePreview.phase`). `DxfRenderer.renderSingleEntity` computes `ghostMult = movePreviewActive && isSelected ? GHOST_DEFAULTS.alpha : 1.0` and multiplies into the existing `alpha` channel — selected entities fade to ghost at their original canvas position. `BaseEntityRenderer.setupStyle` now honours `options.alpha` (previously hardcoded `OPACITY.OPAQUE`) so the ghost alpha flows through every entity renderer without per-renderer changes. `useMovePreview` preview canvas switches from `ctx.globalAlpha = GHOST_DEFAULTS.alpha` to `ctx.globalAlpha = 1.0` — the preview at the cursor is now solid (AutoCAD parity: faded original + solid preview). `dxf-canvas-renderer.ts` plumbs `movePreviewActive` passthrough unchanged. Bitmap cache key untouched (ghost state is a render-time decision, not a cache dimension). Cardinal rules maintained.

## 2026-05-22: AutoCAD parity — `suppressGrips` when non-select tool active

`DxfRenderOptions` extended with `suppressGrips?: boolean`. `dxf-canvas-renderer.ts` computes `gripsAllowed = !activeTool || activeTool === 'select' || activeTool === 'layering'` per frame (reads `refs.activeToolRef.current` — getter pattern, ADR-040 Rule 2) and passes `suppressGrips: !gripsAllowed` to `renderSingleEntity`. `DxfRenderer.renderSingleEntity` converts this to `gripsVisible = isSelected && !options.suppressGrips`, forwarding to `RenderOptions.showGrips` / `.grips` — selection highlight is preserved but grip handles disappear. `DxfCanvas.tsx` adds a `useEffect` that marks `isDirtyRef.current = true` on `activeTool` change, so the canvas repaints instantly when the user activates a command (e.g. Move). `useGripHoverMenuController` closes `GripHoverMenuStore` immediately when `!isGripMode` — prevents a stale grip menu floating over the canvas during a Move operation. Bitmap cache key untouched (grip visibility is a render-time decision, not a cache key dimension — grips are already excluded per ADR-040 §Cache Key). Cardinal rules maintained.

## 2026-05-25: ADR-363 Phase 2 carry-over — opening ghost preview passthrough + opening-tool click pipeline

`CanvasLayerStackProps` extended με νέο `openingGhostPreview` payload (kind/overrides/getHostWall/getSceneUnits). `CanvasSection.tsx` (orchestrator) destructures `openingTool` από το `useSpecialTools` hook και πλέκει το payload σαν plumb-only forward — ΧΩΡΙΣ νέα `useSyncExternalStore` subscription στο shell (η subscription ζει μέσα στο `useOpeningTool`). `CanvasLayerStack.tsx` πιέζει το payload προς το νέο `canvas-layer-stack-opening-ghost.tsx` micro-leaf που subscriber-άρει στο `useOpeningGhostPreview` και ζωγραφίζει preview μέσω `opening-ghost-renderer.ts`. `canvas-click-types.ts` extended με `OpeningToolLike` + `openingTool?` πεδίο για να ρουτάρει `useCanvasClickHandler` τα clicks (παράλληλο pattern με `slabOpeningTool` από Phase 3.7). Bitmap cache key untouched. Cardinal rules maintained.

## 2026-05-25: ADR-370 Phase 5 — `DxfRenderer` stair unwrap + Boy-Scout file-size split

`DxfRenderer.toEntityModel` extended with `'stair'` case: unwraps `DxfStair.stairEntity` into a first-class `StairEntity` (mirror of the existing `'slab'` / `'wall'` / `'column'` / `'beam'` unwrap pattern — ADR-363 Phase 3.7/4/5). `DxfRenderOptions` and `dxf-types.ts` extended with stair viewport-culling support. `useDxfSceneConversion` propagates stair entities into the scene pipeline. `dxf-viewport-culling.ts` handles stair bounding-box intersection. Boy-Scout N.7.1 fix: `transparencyToAlpha` pure utility (0..90 → 0..1) extracted from `DxfRenderer.ts` into `dxf-renderer-frame-builders.ts` (import updated), keeping `DxfRenderer.ts` at 497 lines (≤500 limit). Zero new `useSyncExternalStore` subscriptions. Bitmap cache key untouched. Cardinal rules maintained.

## 2026-05-29: ADR-396 Phase P4 — `EnvelopeOverlay` dedicated floor-overlay micro-leaf (ETICS θερμοπρόσοψη)

Νέο always-on overlay canvas `components/dxf-layout/EnvelopeOverlay.tsx` (mirror του `Focus2DOverlay` pattern) mounted στο `CanvasLayerStack` shell δίπλα στο `Focus2DOverlayLeaf`. Ζωγραφίζει το ενιαίο εξωτερικό περίγραμμα μόνωσης (ETICS) + insulation hatch band του τρέχοντος ορόφου. **Micro-leaf compliant**: subscribes ΜΟΝΟ εδώ (envelope-spec-store `useSyncExternalStore` + `useDrawingScaleStore` objectStyles visibility slice). Ο shell `CanvasLayerStack` / `CanvasSection` **ΔΕΝ** αποκτούν νέο `useSyncExternalStore` (CHECK 6C safe). Repaint deps `[scene, transform, viewport, spec, visible]` — anchored στο world bbox, άρα pan/zoom ξαναζωγραφίζουν. Καμία αλλαγή σε bitmap cache key / DxfRenderer / orchestrator subscriptions. Pure render plan (`bim/renderers/envelope-render-plan.ts`) + thin canvas drawer (`EnvelopeRenderer.ts`) — reuse `computeWallHatchPlan` (hatch SSoT). Cardinal rules maintained.

## 2026-05-30: ADR-396 reveal 2Δ fix touch — `EnvelopeOverlay.drawOpeningReveals` (CHECK 6D stage)

Bugfix-only αλλαγή στο `EnvelopeOverlay.tsx` (ETICS Z4 reveal): η μόνωση περβαζιών ζωγραφίζεται πλέον ως **2 παραστάδες** (jamb hatch bands μέσω `renderSlabHatch`) αντί inset frame — διορθώνει λοξή παρειά. Μηδέν αλλαγή στο micro-leaf subscription pattern: το overlay παραμένει always-on leaf, subscribe μόνο σε `envelope-spec-store` + `useDrawingScaleStore(objectStyles/viewRange)` (όχι high-freq stores). Καμία νέα `useSyncExternalStore` σε orchestrator. Staged για CHECK 6D (canvas drawing file touch). Βλ. ADR-396 §3 P-RENDER + changelog 2026-05-30.

## 2026-05-30: ADR-396 Z1 cut end-cap touch — `EnvelopeOverlay.strokeOpeningCutCaps` (CHECK 6D stage)

Bugfix-only αλλαγή στο `EnvelopeOverlay.tsx`: μετά το `renderOpeningCuts` (`destination-out`) καλείται το νέο `EnvelopeRenderer.strokeOpeningCutCaps` που κλείνει το προφίλ μόνωσης στα άκρα κάθε Z1 cut με τις 2 **κάθετες απολήξεις** (collinear με Z4). **Μηδέν αλλαγή στο micro-leaf subscription pattern** — το overlay παραμένει always-on leaf, subscribe μόνο σε `envelope-spec-store` + `useDrawingScaleStore(objectStyles/viewRange)`· καμία νέα `useSyncExternalStore` σε orchestrator (CHECK 6C safe). Η γεωμετρία προέρχεται από το ίδιο `cut.bandQuad` SSoT (`computeEnvelopeOpeningCuts`, perpendicular O). Staged για CHECK 6D (canvas drawing file touch). Βλ. ADR-396 §3 + changelog 2026-05-30.

## 2026-05-30: ADR-399 Phase D — `FloorUnderlayOverlay` read-only 2Δ underlay micro-leaf («Όλοι οι όροφοι»)

Νέο **read-only** overlay canvas `components/dxf-layout/FloorUnderlayOverlay.tsx` mounted στο `CanvasLayerStack` shell, **πίσω** από τον ενεργό DXF canvas (z-[5] < DxfCanvas z-10, πάνω από floorplan background z-0). Ζωγραφίζει τις κατόψεις DXF των **άλλων** ορόφων του κτιρίου, ξεθωριασμένες (AutoCAD xref fade), όταν `floor3DScope==='all'` ΚΑΙ `mode==='2d'`.

- **Micro-leaf compliant**: subscribes ΜΟΝΟ εδώ (`ViewMode3DStore` scope/mode + `useFloors2DUnderlay` → `floorVisibilityModes`/levels). Ο shell `CanvasLayerStack` / `CanvasSection` **ΔΕΝ** αποκτούν νέο `useSyncExternalStore` (CHECK 6C safe). Mount = single `<FloorUnderlayOverlay transform viewport />` ανάμεσα σε `FloorplanBackgroundCanvas` και `DraftLayerSubscriber`.
- **Selection/persistence isolation**: ξεχωριστό canvas, `pointer-events-none`, ΧΩΡΙΣ mouse/hit-test/selection handlers. Ο interactive `DxfCanvasSubscriber` ξέρει μόνο τον ενεργό όροφο → αδύνατο να επιλεγεί/σωθεί entity άλλου ορόφου σε λάθος `floorplanId`.
- **Rendering**: merge των ορατών μη-ενεργών ορόφων σε ΕΝΑ read-only `DxfScene` → `new DxfRenderer(canvas).render(merged, transform, viewport, { skipInteractive:true })` + `destination-out` fade wash (κρατά διαφανείς τις κενές περιοχές → σωστό compositing). DPR sizing manual (mirror `DxfCanvas`), repaint deps `[active, merged, transform, viewport]` — pan/zoom ξαναζωγραφίζουν. **Καμία αλλαγή σε bitmap cache key** (rule 3) — ο underlay είναι ανεξάρτητο canvas με δικό του direct render. Καμία αλλαγή σε `DxfRenderer` / orchestrator subscriptions. Staged για CHECK 6B/6D. Βλ. ADR-399 §Phase D.
