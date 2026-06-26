# ADR-452 — Cut-Plane Slider (Revit View Range UI for the 2D plan)

**Status:** 🟢 Implemented (v2.11 — … + slider-drag draft-on-drag + **slider RAF/pointermove violations eliminated: persistent cut-plane fast path + deferred edge-trim**) — pending browser-verify + commit
**Date:** 2026-06-13
**Builds on:** ADR-375 (View Range / cut state), ADR-448/450 (storey elevations & datum), ADR-040 (micro-leaf architecture)

---

## 1. Context / Problem

ADR-375 introduced the full Revit **View Range** model (`topMm / cutPlaneMm / bottomMm /
viewDepthMm`) plus `resolveCutState()`, and every structural BIM renderer already computes
its cut state from the entity's Z-extents. **But that result was only ever used for line-weight
/ fill styling — never to hide anything.** There was no UI, and `cutPlaneMm` was frozen at its
1200 mm default (Phase A). So the 2D plan always drew every entity regardless of elevation.

Giorgio asked for a **right-edge vertical slider on the 2D canvas** that controls the cut
elevation along Z and re-renders the plan in real time — a live horizontal section. Example:
a 3 m storey shown with the cut at 3 m displays everything (walls, columns, beams, ceiling
slab); dropping the cut to 2 m hides the ceiling slab and beams (their base ≈ 2.7–2.9 m sits
above the plane) while walls/columns remain (cut at the plane).

## 2. Decision

Activate ADR-375's dormant hide capability behind an explicit per-view toggle, and add the
Phase-C slider UI.

1. **Hide rule (single-plane simplification of View Range):** an entity is hidden ⇔
   `cutPlaneActive && entity.zBottomMm > viewRange.cutPlaneMm`. Everything at/below the plane
   stays visible (cut at the plane, projection below). This matches Giorgio's mental model and
   is simpler than the full 4-plane Revit logic (deferred).

2. **SSoT extent extraction** — `bim/visibility/entity-z-extents.ts`:
   - `getEntityZExtents(entity): { zBottomMm, zTopMm } | null` — one switch over BIM types
     (wall, column, beam, slab, slab-opening, stair, opening, foundation), mirroring the
     per-renderer `resolveCutState()` inputs. Raw DXF and un-gated types (roof/railing/MEP) →
     `null` ⇒ never hidden.
   - `isHiddenByCutPlane(entity, viewRange, active)` — pure, side-effect-free.

3. **One render-loop choke point** — the gate lives in `DxfRenderer.isEntityLayerSkipped()`
   (after the isolate checks). A single `return true` there removes the entity from BOTH the
   live paint and the bitmap-cache layer. No per-renderer edits.

4. **Default OFF** — new persisted boolean `BimRenderSettings.cutPlaneActive` (default `false`).
   With the gate off the plan looks exactly as before; turning it on (or first slider drag)
   engages the section. This avoids silently hiding ceilings/beams in every existing view (the
   1200 mm default would otherwise cut at 1.2 m). On enable, the slider seeds `cutPlaneMm` to
   the active storey **ceiling** so the plan starts complete, then the user slides down.

5. **2D-only UI** — `CutPlaneSliderLeaf` (ADR-040 micro-leaf): self-gated to `ViewMode3DStore`
   `mode === '2d'`, subscribes to the low-freq render-settings store, reuses the Radix
   `Slider` (made orientation-aware). Slider drag → `setViewRangeField('cutPlaneMm', mm)` (500 ms
   debounced Firestore persist via the existing store). Range/ticks from the building's floor
   list (`useFloorsByBuilding` + datum helpers).

## 3. Units

`viewRange.cutPlaneMm` and the renderer Z-extents are **mm above project origin**; the
comparison is mm-vs-mm and therefore independent of DXF scene units. Floor data
(`elevation`/`height`) is in **metres** → ×1000 for the slider's mm range (datum-relative,
ground = 0, via `resolveBuildingDatumElevationM` / `resolveFloorDatumRelativeElevationMm`).

## 4. Cache invalidation

`cutPlaneMm` lives in `viewRange`, already part of `DxfBitmapCache.bimSettingsHash` → slider
drag busts the cache. The new `cutPlaneActive` toggle is added to that hash (`cpa`) so on/off
also invalidates.

## 5. Files

| Type | Path |
|------|------|
| NEW | `bim/visibility/entity-z-extents.ts` (SSoT extents + hide gate) |
| NEW | `components/dxf-layout/cut-plane-range.ts` (pure slider range/ticks) |
| NEW | `components/dxf-layout/useCutPlaneRange.ts` (reactive hook) |
| NEW | `components/dxf-layout/CutPlaneSliderLeaf.tsx` (2D-gated micro-leaf) |
| MOD | `config/bim-render-settings-types.ts` (+`cutPlaneActive`, resolver) |
| MOD | `state/bim-render-settings-store-types.ts` (+`setCutPlaneActive`) |
| MOD | `state/bim-render-settings-store.ts` (setter + buildRaw/loadForLevel/commit) |
| MOD | `canvas-v2/dxf-canvas/DxfRenderer.ts` (hide gate in `isEntityLayerSkipped`) |
| MOD | `canvas-v2/dxf-canvas/dxf-bitmap-cache.ts` (`cpa` in hash) |
| MOD | `components/dxf-layout/CanvasLayerStack.tsx` (mount leaf) |
| MOD | `components/ui/slider.tsx` (orientation-aware, additive) |
| MOD | `i18n/locales/{el,en}/dxf-viewer-panels.json` (`cutPlane.*`) |
| TEST | `bim/visibility/__tests__/entity-z-extents.test.ts` (12) |
| TEST | `components/dxf-layout/__tests__/useCutPlaneRange.test.ts` (6) |

## 6. Verification

1. `npm test` on the two new suites — 18/18 green.
2. Browser `/dxf/viewer` (hard refresh), open a storey with BIM, 2D mode:
   - Slider appears on the right ONLY in 2D.
   - Default OFF → plan unchanged.
   - Power on → seeds at ceiling (full plan); drag to 2 m → ceiling slab & beams vanish; back
     to 3 m → reappear.
   - Reload → `cutPlaneMm` + `cutPlaneActive` persist (per-Level Firestore).

## 7. Out of scope (DEFER)

- Hit-test/selection suppression of cut-hidden entities (still selectable via the spatial index).
- Full 4-plane View Range UI (top/bottom/view depth).
- Floor-aligned pixel-accurate tick labels on the slider track (avoided to honour the
  no-inline-style rule; current UI shows a live metre readout + min/max bounds).
- 3D section box.

## 9. v2 — 3D horizontal section (Revit-grade) + reference-frame unify

The same slider now also drives a **real horizontal section in 3D** (geometry clip + solid cut
faces), and the cut elevation is unified to a single FFL-relative frame across 2D and 3D.

1. **Reference frame fix (FFL-relative).** v1's slider range was datum-relative across the whole
   building (0/3000/6000…), but `cutPlaneMm` and the 2D entity Z-extents are **FFL-relative**
   (floor base = 0). It only worked on the ground floor (datum = 0) and silently hid nothing on
   upper floors. Fixed: `useCutPlaneRange` is now `0 … storeyHeightMm` of the active storey
   (`useActiveStoreyContext().storeyHeightMm`), matching Revit's per-level View Range. This is the
   single frame both 2D and 3D use.

2. **3D = the existing Section pipeline, extended (full SSoT).** The 3D view already had a mature
   Section system whose `SectionSceneController` is the SINGLE owner of the scene's clipping planes
   (section box + crop, ≤6 planes, `renderer.localClippingEnabled`, stencil caps for solid cut
   faces). The cut plane is composed there as a **third clip source** — no parallel clip mechanism:
   - `bim-3d/scene/cut-plane-3d-math.ts` — pure `computeCutPlaneWorldY(floorElevationMm, cutPlaneMm,
     buildingBaseElevationM)` = `(floorElevationMm + cutPlaneMm)·0.001 + baseM` (Y-up metres) +
     `buildCutPlane(worldY)` = `Plane((0,-1,0), worldY)` (keeps everything ≤ worldY).
   - `bim-3d/scene/cut-plane-3d.ts` — `resolveCutPlane()` reads the cut-plane SSoT + active storey
     FFL + active building base (`useBim3DEntitiesStore`).
   - `SectionSceneController.applyState()` prepends the cut plane (survives the 6-plane slice),
     stays active even when the Section Box is off, marks the scene dirty (`markDirty` dep) so the
     on-demand renderer repaints during slider drag. `isStencilActive()` now also fires for the cut
     plane → solid Revit-style cut faces.

3. **Cross-mode slider.** `CutPlaneSliderControl` is the shared presentational control; mounted by
   `CutPlaneSliderLeaf` (2D, mode-gated) and `CutPlaneSlider3DLeaf` (inside `BimViewport3D`, `z-[60]`).
   One SSoT → the slider position carries across 2D ↔ 3D.

**v2 files:** NEW `cut-plane-3d-math.ts`, `cut-plane-3d.ts`, `CutPlaneSliderControl.tsx`,
`CutPlaneSlider3DLeaf.tsx`; MOD `cut-plane-range.ts`, `useCutPlaneRange.ts`, `CutPlaneSliderLeaf.tsx`,
`section-scene-controller.ts`, `ThreeJsSceneManager.ts`, `BimViewport3D.tsx`. Tests: `cut-plane-3d-math`
+ updated `useCutPlaneRange`.

## 8. Changelog

- **2026-06-19** — v2.19 (Giorgio «slab/structural two-tone», 4 ανεξάρτητα z-fight/render bugs που
  φάνηκαν μαζί στις πάνω παρειές — όλα browser-verified):
  1. **Coplanar core z-fight** (κύρια αιτία· *όχι* στο cut path): τα δομικά είναι μοντελοποιημένα
     flush (κορυφή πλάκας ≡ δοκαριού ≡ κολώνας στο ίδιο Y) κι ΟΛΑ τα υλικά είχαν ίδιο
     `polygonOffset(1,1)` → κανένα δεν κέρδιζε το depth test → τρεμόπαιγμα/μίξη με orbit. Fix:
     per-category depth-priority `polygonOffsetUnits` στο **`MaterialCatalog3D`** (`STRUCTURAL_DEPTH_OFFSET_UNITS`:
     finish/σοβάς 1 < slab 2 < beam 3 < column 4 < foundation 5-7· ακμές 0 νικούν όλα — ADR-375 contract). Εφαρμογή σε `getMaterial3D` + `getElementMaterial3D` (`withDepthPriority`).
  2. **Clip-boundary flicker στην κορυφή** (μόνο με cut ON, slider στο max): οι όψεις στο `worldY`
     έπεφταν στο όριο `dot==0` → floating-point flicker. Fix: 1 mm `CUT_PLANE_KEEP_EPSILON_M` upward
     bias στο `resolveCutPlaneWorldY` (**`cut-plane-3d.ts`**) → οριακές όψεις κρατιούνται σταθερά.
  3. **M/V/N διαγράμματα/ετικέτες αλλάζαν χρώμα με cut ON**: τα always-on-top overlays
     (`depthTest:false` Mesh + `Sprite` labels) έγραφαν stray stencil στα cut-parity passes → phantom
     cap recolour. Fix: `isSectionParityOverlay` (depthTest:false **ή** isSprite **ή** `bimEdgeOverlay`)
     εξαιρεί overlays από ΟΛΑ τα parity passes (**`section-stencil-renderer.ts`**, μαζί με τα edges).
  4. **Cut-slider drag έδειχνε hollow/grey draft** (Giorgio ήθελε live χρωματιστές όψεις): ο drag
     παίρνει πλέον quality `'colors'` + τα caps τρέχουν ΚΑΘΕ frame (όχι skip· **`section-scene-controller.ts`** v2.10→v2.19)· hatch/emphasis refine στο settle. ⚠️ βαρύτερο σε πυκνό όροφο (N.17).
- **2026-06-13** — v1: SSoT extents + hide gate (default OFF) + 2D cut-plane slider. 18 jest.
- **2026-06-13** — v1.1 UX fix: the leaf clears the SSoT crosshair on `onMouseEnter`
  (`setImmediatePosition(null)`, mirroring `ViewMode3DToggleButton`) so the crosshair no longer
  freezes over the overlay; explicit `cursor-pointer` / `cursor-grab` classes restore a visible
  grab cursor over the canvas's `cursor-none` region.
- **2026-06-13** — v2: real 3D horizontal section via the existing Section clip pipeline (single
  clip owner), FFL-relative frame unify (fixes upper-floor 2D bug), cross-mode slider. 20 jest.
- **2026-06-13** — v2.1 fix: `section-clip-applicator.writeClippingPlanes` now skips `LineMaterial`
  (fat-line edges `Line2`/`LineSegments2` extend `Mesh`, so `isMesh` caught them) — injecting clipping
  planes there threw `THREE.WebGLProgram: Shader Error … Fragment shader is not compiled`. Solid faces
  still cut + cap; edge overlay stays unclipped (cosmetic). Benefits the Section Box too. DEFER: clip
  the edge overlay above the cut.
- **2026-06-13** — v2.2 — 3D solid cut faces fixed (Revit-grade), garbage eliminated.
  - **Root cause of the garbage:** `SectionStencilRenderer` was built for a CLOSED section box
    (6 planes). Its single-pass cap excludes the capped plane (`others = planes.filter(idx !== index)`)
    and derives parity from `depthTest` against the already-clipped depth buffer. For a LONE horizontal
    cut plane `others = []` → the parity pass drew the whole UNCLIPPED solid against a cut depth buffer,
    so back-faces above the cut (no depth occluder) polluted the stencil → the full-size grey cap quad
    smeared everywhere (the "garbage").
  - **Fix (single-plane cap, full SSoT — same renderer owns it):** new
    `SectionStencilRenderer.renderHorizontalCutCap()` uses the canonical lone-plane algorithm
    (Revit / three.js `webgl_clipping_stencil`): the cut plane stays ACTIVE in clipping (slices the
    solid open), two parity passes (BACK `IncrementWrap` / FRONT `DecrementWrap`) with **`depthTest`
    off** so parity is counted over the sliced solid independent of the depth buffer, then the grey cap
    quad (`NotEqual(0)`) bounded by the section/crop planes but NOT the cut plane. Reuses the existing
    cap quad/material (SSoT).
  - **Controller split:** `SectionSceneController` now tracks `cutPlane` + `sectionPlanes` (box/crop,
    cut excluded) separately. The visual clip still applies ALL planes; the box stencil loop runs on
    `sectionPlanes` only (zero box regression), and the cut plane caps via the single-plane path.
  - **Applicator hardened:** `writeClippingPlanes` now uses an allowlist (`isClippableMaterial`) of
    built-in mesh material types that ship clipping shader chunks; every other material (fat-line,
    `ShaderMaterial`, sprites, points) is skipped by default — future-proof, supersedes the
    `LineMaterial`-only skip. Material audit confirmed solid BIM faces are all `MeshStandardMaterial`.
  - **Rejected:** the handoff's global `renderer.clippingPlanes` idea — the audit showed only
    `LineMaterial` was fragile (already skipped), and global clipping cannot self-exclude the capped
    plane, which would break the very solid cut faces this delivers.
  - Tests: `section-clip-applicator.test.ts` (safelist + apply/clear). DEFER: per-material hatch
    poché for the cut plane (currently a flat grey cap); edge-overlay clipping above the cut.
- **2026-06-13** — v2.3 — "pentakathari" Revit poché (de-mud). Browser-verify showed the v2.2 cut faces
  rendered but **muddy**: `SECTION_CUT_SURFACE.opacity = 0.5` (a section-box token, lets you see inside)
  made the cap semi-transparent so geometry bled through, and a single flat grey gave no entity
  distinction. Fix:
  - NEW `createOpaqueCutCapMaterial()` — fully OPAQUE grey base poché for the View-Range cut (crisp, no
    bleed-through). The box keeps its semi-transparent cap (you look into a box; you don't look into a
    horizontal cut).
  - `renderHorizontalCutCap` now renders the **per-material hatch poché** (RC dots / steel / masonry /
    wood / insulation) on top of the opaque base, isolating each material group — full SSoT reuse of the
    box's `section-hatch-cap` + `resolveHatchKey`/`getHatchCapMaterial`. New private `capCutSection`
    shares the back/front parity pass between the base and each hatch group.
  - DEFER (next iteration if needed after verify): crisp dark cut-profile edges between adjacent
    same-material entities; hiding/clipping the fat-line edge overlay that floats above the cut.
- **2026-06-13** — v2.4 — clip the edge overlay + per-material-colour cut faces. Browser-verify of v2.3
  showed two real problems: (a) the fat-line **edge overlay was NOT clipped**, so the wireframe of
  everything above the cut floated as a phantom "cage" (and wall/column top rims stayed visible above
  the cut — Giorgio: "things flying", "edges always visible at top"); (b) the dotted RC hatch looked
  cheap and didn't separate multilayer build-ups (concrete core vs plaster finish both mapped to `rc`).
  - **Edge suppression above the cut (the key fix):** the fat-line edge overlay can't be clipped —
    injecting clip planes into `LineMaterial` throws `Fragment shader is not compiled` at RUNTIME on
    this build (confirmed; the source-level "it has clipping chunks" reasoning did NOT hold — `'LineMaterial'`
    was added to the allowlist then REVERTED). Instead `SectionSceneController.hideEdgesAboveCut()`
    geometrically hides, for the duration of each capped frame, every edge overlay whose cached world
    top-Y sits above the cut plane — then restores. No shader injection, no compile error: the phantom
    wireframe cage and the top rims disappear, while fully-below entities keep their projection edges.
  - **Per-material-colour faces:** replaced the dotted hatch poché on the cut with opaque caps painted
    in each cut mesh's own material colour (`collectColorGroups` + cached `getColorCapMaterial`), so
    core / finish layers read as distinct clean bands. The box keeps its hatch poché unchanged.
  - Tests: applicator still skips `LineMaterial` (clipping throws). DEFER: heavy multi-group cap passes
    during fast slider drag (throttle if needed); a stray/orphan object far from the model that can't be
    selected (likely a non-entity overlay / mis-placed data — under investigation, not the cut feature);
    crisp dark cut-profile edges between adjacent same-material entities.
  - **Lesson:** trust the runtime over source-reading for shader capability — `LineMaterial` *looks*
    clipping-capable in r0.170 source (chunks + `mvPosition`) but throws when clipped on this build.
- **2026-06-13** — v2.5 — GRADUAL edge clipping (CPU trim). The v2.4 per-frame "hide overlays whose top
  is above the cut" made an entity's edges vanish abruptly (and all-or-nothing). Giorgio asked for the
  edges to hide gradually, in lock-step with the faces. Since `LineMaterial` can't be GPU-clipped, the
  edge line geometry is trimmed on the CPU at the cut plane:
  - NEW `bim-3d/scene/edge-cut-trim.ts` — pure, transform-correct `clipLineSegmentsToCutY(positions,
    matrixWorld, worldCutY)` (keep below / drop above / trim crossing segments to the plane) + `worldYRange`.
    Unit-tested (`edge-cut-trim.test.ts`).
  - NEW `bim-3d/scene/edge-cut-applicator.ts` — `applyEdgeCutTrim(group, cutWorldY)` / `restoreEdgeCut`:
    caches each overlay's pristine positions + world-Y extent; fully-below keep geometry, fully-above
    hidden, **only crossing overlays re-trim + re-upload** (gated on a cached `appliedCutY` so redundant
    `applyState` calls are cheap). Driven from `SectionSceneController.applyState()` — once per cut
    change, NOT per frame; restored when the cut turns off.
  - Result: edges shrink exactly at the cut plane as the slider moves — no phantom cage, no top rims, and
    fully-below entities keep their projection edges. DEFER: throttle the trim if a dense storey (many
    crossing entities) lags during a fast drag.
  - **Stray "flying" object resolved (two causes at the world origin):**
    1. The leftover `THREE.AxesHelper(2)` in `scene-setup.createBimScene` (R/G/B lines at 0,0,0) — removed
       (dev helper, no production use). Always-on.
    2. The sliver that appeared ONLY with edges enabled and could not be picked = a DEGENERATE entity at
       the origin (a collapsed-axis / default solid): no real faces (so unpickable), but `EdgesGeometry`
       still emitted a thin outline. `buildEdgeOverlay` now returns null when any geometry axis collapses
       below 0.1 mm (a real BIM member is extruded in all three axes) — robust guard, not data-specific.
       Test added.

- **2026-06-13** — v2.6 — fix WebGL `clear() called with no buffers in bitmask` console flood + RAF jank.
  `SectionStencilRenderer.renderHorizontalCutCap` / `render` disable `autoClear*` (all false) for the cap
  parity passes, then render the **main scene** several times per frame. The main BIM scene carries a
  `THREE.Color` background (set by the envmap generator), so three.js' `WebGLBackground.render` sets
  `forceClear = true` and calls `renderer.clear(false, false, false)` → `gl.clear(0)` (zero bitmask) on
  **every** parity pass, every frame → console flood, "WebGL: too many errors", and 145–163 ms RAF stalls.
  Fix: the caller (`SectionSceneController.renderFrameWithCaps`) already paints the background in its
  `autoClear=true` pass, so the stencil renderer now nulls `mainScene.background` for the duration of the
  cap passes (saved/restored alongside the `autoClear*` flags) — the background path is skipped entirely,
  no `gl.clear(0)`. Applied to both the single-plane cut path and the box-mode loop. No behaviour change to
  the rendered image (background was already on screen). Localized to `section-stencil-renderer.ts`.

- **2026-06-13** — v2.7 — refine-on-idle for the stencil caps (RAF jank: ~145–163 ms → ~63–94 ms after the
  v2.6 flood fix, but still ~10–15 fps while dragging the cut slider / orbiting). Root: the cut/box cap
  passes re-render the whole BIM scene `2×(1 + N_material-colours)` times per frame (each per-colour group
  also does two scene traversals to isolate its meshes). Doing the full per-material poché on *every* drag
  frame is the cost. Fix (Revit-style refine-on-idle, mirrors the SSAO modulator):
  - `renderFrameWithCaps(camera, interacting)` now picks a `quality: 'fast' | 'full'`. `fast` when ANY of:
    (a) `interacting` (orbit/pan/tumble — the only gestures that set the OrbitControls `start`/`end` flag),
    (b) the cut-plane constant changed since the last rendered frame (slider-drag per-frame signal), or
    (c) **the camera pose changed** since the last rendered frame. (c) is essential: **wheel-zoom and
    animated camera moves call `onRenderNeeded` WITHOUT `onInteractionStart`** (`viewport-camera.ts`
    `onSurfaceWheel` / `setZoom` / `controls 'change'`), so without a pose check every zoom frame would hit
    the expensive full-quality cap path — which was the observed RAF jank (67–158 ms) on wheel-zoom over the
    3D canvas. Pose tracked via cached `position` + `quaternion` + `zoom` (NaN-seeded → first frame = moved).
  - `SectionStencilRenderer.renderHorizontalCutCap` / `render` take the `quality` flag: `fast` renders only
    the opaque grey base cap (2 passes) and skips the per-material-colour loop, the box hatch overlays, and
    the selection-emphasis pass; `full` renders everything as before.
  - After any `fast` frame the controller arms a one-shot ~150 ms timer that calls `markDirty()` once motion
    settles → a single `full` frame (not interacting + constant unchanged → `quality === 'full'`). The
    on-demand scheduler keeps that full frame on screen until the next change, so the steady-state image is
    unchanged — only the *draft* frames during motion are cheaper. Timer cleared on dispose.
  - Result: dragging the slider / orbiting now renders ~2 passes/frame instead of `2×(1+N)`; full per-layer
    detail snaps in ~150 ms after release. No change to the settled image. Localized to
    `section-stencil-renderer.ts` + `section-scene-controller.ts` (+ `scene-render-frame.ts` passes
    `interacting`). DEFER: if a single grey-base pass still lags on a very dense storey, cache the parity
    stencil between frames when only the camera (not the cut) moved.
  - **Wheel-zoom interaction pulse (the deeper root, `viewport-camera.ts`).** Investigating "jank on
    wheel-zoom / cursor over the 3D canvas" (67–158 ms, *independent of the slider*) revealed the real
    cause is broader than the caps: **wheel-zoom marks the scene dirty (`onRenderNeeded`) but NEVER flags
    interaction** (only orbit/pan/tumble fire OrbitControls `start`/`end`). So the `IdleDetector` sees
    `interacting === false` every zoom frame → `notifyIdle` → after the threshold it **turns SSAO back on**,
    and `scene-render-frame` runs the full `ssaoModulator.render()` composer on every zoom frame (heavy) —
    AND, when a section is active, the caps stay full-quality. Both expensive paths fire during a plain
    wheel-zoom. Fix: `onSurfaceWheel` now pulses `onInteractionStart()` on every wheel tick (before any
    early return, so it also covers the ortho / OrbitControls-fallback dolly) and debounces
    `onInteractionEnd()` by 220 ms. During the zoom gesture every "refine-on-idle" subsystem (SSAO →
    raster, section caps → grey-base draft, POI) runs its cheap navigation path; ~220 ms after the wheel
    goes quiet, interaction ends → SSAO + full caps refine once. This is the primary fix for the reported
    jank and is independent of whether a section is active; the cap `quality` work above still applies on
    top of it. Timer cleared on dispose.

- **2026-06-13** — v2.8 — **"flying garbage at the world origin" fixed for real (supersedes the v2.5 note
  above, which was wrong).** Browser-verified. The v2.5 hypotheses (remove `AxesHelper`; degenerate guard in
  `buildEdgeOverlay`) did NOT fix it — proven with a runtime probe (`origin-object-diagnostic.ts`,
  `window.__bimDiagnoseOrigin()`): scanning the main scene AND the section cap scenes with live-recomputed
  bounding boxes found NO `bimId`, NO `bimEdgeOverlay`, and NO `NaN`-positioned object near the origin, and
  nothing `effectivelyVisible` there except the cap meshes — so the source was the cut-cap stencil pipeline,
  not a scene-graph object.
  - **Root cause:** the fat-line edge overlays (ADR-375) are `LineSegments2`, which **extend `THREE.Mesh`**,
    so they pass every `instanceof THREE.Mesh` guard. The cut-cap stencil parity passes render the whole
    `mainScene` with a Mesh `overrideMaterial` (`createCutParityMaterial`: `colorWrite=false`,
    `depthTest=false`, stencil-only). Applied over a `LineSegmentsGeometry`, that material draws the
    geometry's base `position` template quad (instancing ignored) and writes **stray stencil**; the cap quad
    — positioned on the cut plane at `(0, cutY, 0)`, i.e. centred on the world origin in X/Z — then fills a
    **phantom sliver at the origin**. Visible ONLY with edges on (no overlays ⇒ clean stencil) AND a cut /
    section active (caps only render then) — exactly the reported symptom.
  - **Fix (Revit-grade, SSoT):** the stencil parity must only see closed solids. New
    `SectionStencilRenderer.hideEdgeOverlaysForParity(mainScene, hidden)` hides every `bimEdgeOverlay` for
    the parity render (restored after), applied to ALL four parity passes — `capCutSection` (cut base +
    per-colour), `renderCapForPlane` (box base), `renderEmphasisCapForPlane` (selection), and
    `renderHatchGroupForPlane` (box hatch). Each pass also gained a `|| !obj.visible` guard so it only hides
    currently-visible meshes — restoring sets `visible = true`, so pushing an overlay the edge-cut trim had
    already hidden (above the cut) would wrongly re-show it as a phantom cage.
  - **Lesson:** `LineSegments2 extends Mesh`, so fat-line edge overlays leak into every `instanceof Mesh`
    override/parity pass; a Mesh override material renders their base template quad, not the line. Exclude
    non-solids from any stencil-parity pass.
  - Localized to `section-stencil-renderer.ts`. The TEMP runtime probe used to pin this down
    (`origin-object-diagnostic.ts`, `ThreeJsSceneManager.diagnoseOriginObjects`,
    `SectionSceneController.getCapDiagnosticScenes`, `SectionStencilRenderer.getCapScenes` + cap-scene names,
    `BimViewport3D` `window.__bimDiagnoseOrigin` hook) has been **fully removed** — it did its job.

- **2026-06-13** — v2.8b — **"Consistent Colors" cut renders a black top — fixed.** Browser-verified.
  - **Root cause:** the «Consistent Colors» visual style (`getConsistentVariant` in `MaterialCatalog3D`) fakes
    an unlit flat look by moving the real colour into `material.emissive` and setting `material.color` to
    black. The per-material cut-cap grouping (`collectColorGroups`) read `material.color.getHex()` → every
    consistent-mode mesh grouped under black → the colour cap painted the whole section black (full-quality
    only, so it «vanished» while orbiting via the v2.7 fast path — masking the bug).
  - **Fix (SSoT):** new `displayColorHex(mat)` helper in `section-cut-cap-groups.ts` — when `color === 0x000000`
    and `emissive !== 0`, the emissive IS the display colour → use it; otherwise `.color` (shaded / realistic).
    `collectColorGroups` routes through it. The cut faces now match the colour the user sees on the solid.

- **2026-06-13** — v2.9 — **keep the coloured section visible during camera motion** (Giorgio: «κράτα τα
  χρώματα στην κίνηση»). The v2.7 ladder was binary (`fast` grey ↔ `full` colours), and **every** motion
  signal — including plain orbit / pan / wheel-zoom — dropped the cut to the grey draft, repainting colours
  only ~150 ms after motion settled. Giorgio wanted the per-material colours to persist while navigating.
  - **Three-tier quality ladder** (`SectionCapQuality = 'fast' | 'colors' | 'full'`):
    - `'fast'` — opaque grey base poché only. Used while the **cut slider drags** (`cutMoving`): the sliced
      geometry changes every frame, the heaviest parity case, so the per-colour loop stays off there.
    - `'colors'` — grey base **+ per-material colour cut faces**, but no hatch / selection emphasis. Used
      during **camera motion** (`interacting || camMoved` — orbit / pan / wheel-zoom). Keeps the Revit-grade
      coloured section on screen while navigating, paying the `2×N` colour-parity renders but skipping the
      hatch/emphasis passes.
    - `'full'` — everything (+ box hatch overlays + selection emphasis). Once all motion settles.
  - `cutMoving` wins over `camMoved` (a slider drag can nudge the camera too). The refine-on-idle timer now
    arms after **any** non-`full` frame (was: only `fast`), so hatch/emphasis — and, after a slider drag, the
    colours — snap back ~150 ms after motion stops even though the on-demand scheduler may not paint again.
  - **Trade-off (browser-verify on target HW):** this intentionally re-introduces the `2×N` colour-parity
    cost during camera navigation (which v2.7 had deferred to idle) — Giorgio's explicit call, since the grey
    flash during orbit was the bigger annoyance. The heaviest case (slider drag) stays on the cheap grey path,
    so the wheel-zoom interaction-pulse fix (v2.7) is preserved for SSAO and for the slider. If orbit FPS on a
    very dense storey is unacceptable, the fallback is the deferred parity-stencil cache (still open).
  - Localized to `section-stencil-renderer.ts` (`SectionCapQuality` type + `quality !== 'fast'` gate on the
    colour loop) + `section-scene-controller.ts` (three-tier decision + refine-arm condition).

- **2026-06-13** — v2.10 — **slider-drag draft = clipped scene only, zero cap passes.** Browser test on
  Giorgio's (weak) machine: even the `'fast'` grey-base tier left the **cut-slider drag** at ~61–324 ms/frame
  (≈8–12 fps), because `'fast'` is still `renderer.render(scene)` + the two stencil-parity scene renders +
  the cap quad ≈ 3–4 full-scene renders every frame. Since the geometry **already slices live** via the clip
  plane, the cap fill is not essential *during the drag motion*. Fix (`section-scene-controller.ts`
  `renderFrameWithCaps`): when `cutMoving`, skip BOTH `stencilRenderer.render` and `renderHorizontalCutCap`
  entirely — render only the clipped scene (1 render/frame). The solid/coloured cut faces refine the instant
  the slider settles (the `armRefine` one-shot already fires for any draft frame; the condition now includes
  `cutMoving`). Visual effect: the cut face reads hollow/open *only while actively dragging the slider*, then
  snaps to the full opaque + per-material-colour poché ~150 ms after release — the standard CAD draft-on-drag
  trade-off, chosen because the slider drag is the single heaviest case and Giorgio's "keep colours in motion"
  preference (v2.9) was about **camera** motion (still served by the `'colors'` tier), not the slider.
- **2026-06-13** — v2.11 — **slider-drag `requestAnimationFrame` violations (`UnifiedFrameScheduler` 50–157 ms)
  + `pointermove` 357 ms eliminated.** v2.10 trimmed only the *cap passes*; profiling on Giorgio's machine showed
  the real cost was **two synchronous ops re-run on EVERY slider tick** inside `applyState()` (the Radix slider
  fires `onValueChange` many times per frame):
  1. **`applyClippingPlanes` → `material.needsUpdate = true` on every mesh.** Each tick built fresh `THREE.Plane`
     objects and re-applied them, flipping `needsUpdate` scene-wide → the WebGLRenderer re-set-up every material's
     program per frame (the 50–157 ms RAF spike). But the renderer reads `plane.constant` as a **uniform** every
     frame — `needsUpdate` is only required when the plane **count** changes (`#define NUM_CLIPPING_PLANES`).
  2. **`applyEdgeCutTrim` → CPU re-clip + GPU geometry re-upload** of every crossing fat-line overlay, per tick
     (the 357 ms `pointermove`).
  **Fix (`section-scene-controller.ts` + `edge-cut-applicator.ts`):**
  - **Persistent cut-plane + composition fast path.** The controller keeps ONE `THREE.Plane` instance and a cheap
    `clipCompositionKey(cutActive)` string of which clip sources are active + their geometry, **excluding** the cut
    elevation. Identical key across ticks ⇒ only the cut constant moved ⇒ **mutate `cutPlane.constant` in place and
    return** — no `applyClippingPlanes`, no `needsUpdate`, no traverse. Box drag / crop / mode / enable change ⇒ new
    key ⇒ full re-apply (rare, correct). The materials keep referencing the same plane object, so the uniform update
    is automatic.
  - **Edge trim deferred from `applyState` to the render frame.** While `cutMoving` (drag) → new
    `cullEdgeCutVisibility()`: a **visibility-only** cull (hide overlays fully above the cut, keep pristine geometry,
    zero re-upload) — a drag frame now costs a traverse + a boolean per overlay. Once the slider **settles**, the
    exact `applyEdgeCutTrim` runs **once** (guarded by `lastSettledEdgeCutY`; the cull nulls it so a re-trim is
    forced even if the slider lands on the previous elevation). Camera-only frames (cut value unchanged) skip edges
    entirely. The gradual "edges shrink at the plane" result is unchanged — it just lands on release instead of
    fighting every tick. Tests: `edge-cut-cull.test.ts` (6) + existing `edge-cut-trim` (5) green.
- **2026-06-13** — v2.12 / v2.13 — **slider colour de-hardcoded → unified with the ViewCube orange.**
  The slider looked black because it inherited the app `--primary` token (`222.2 47.4% 11.2%`, near-black
  navy) — not a hardcoded value, but an unwanted one. The mechanism: a `.cut-plane-slider-accent` utility
  (mirrors the `.dialog-brand` scoping pattern) maps `--primary`/`--primary-foreground`/`--ring` onto a
  central accent token ONLY within the cut-plane `<aside>`, so the shared `Slider` primitive + toggle
  button recolour with **zero** change to any other slider in the app and **zero** hardcoded hex / inline
  style (N.3-safe). **v2.13 colour decision (Giorgio):** over the light-blue 3D background a teal/cyan did
  not stand out → use the **same AutoCAD orange (`#ff8c00`) as the 3D ViewCube hover** and *unify* the two.
  The TS SSoT `VIEWCUBE_HOVER_COLOR_HEX = 0xff8c00` (`view-cube-highlight.ts`) is mirrored on the CSS side
  as the token `--viewcube-accent: 33 100% 50%` (globals `:root` + `.dark`, identical in both modes like
  the cube), with cross-reference comments on both sides ("keep in sync"). Files: `globals.css` (token ×2 +
  utility), `CutPlaneSliderControl.tsx` (one class), `view-cube-highlight.ts` (sync comment). Drives both
  2D + 3D mounts (single shared control).
- **2026-06-13** — v2.14 — **3D slider no longer overlaps the ViewCube.** The toggle button + readout sat
  at `top-14` (56px), inside the 160px ViewCube canvas (`top:12px` → 172px), covering the cube and its
  compass rings. Fix: the `top-*` offset is now owned by each mount (it was hardcoded in the shared control)
  because only 3D has a ViewCube. `CutPlaneSlider3DLeaf` → `top-44` (176px, just below the cube canvas);
  `CutPlaneSliderLeaf` (2D) keeps `top-14`. Side effect (as Giorgio asked): the 3D track is shorter at the
  top. Files: `CutPlaneSliderControl.tsx` (top removed from base, prop-driven), `CutPlaneSlider3DLeaf.tsx`,
  `CutPlaneSliderLeaf.tsx`.
- **2026-06-13** — v2.15 — **toggle icon redrawn for legibility** (Giorgio: "I can't tell what it is").
  The old `CutPlaneIcon` was a faint isometric prism (`strokeOpacity 0.6`) — unreadable at 16px. Replaced
  with a "plan cut" glyph: a box whose lower half is filled (poché kept below the cut), an empty outline
  above, and a bold cut line through the middle overshooting both sides. `CutPlaneSliderControl.tsx` only.
- **2026-06-13** — v2.16 — **vertical Slider thumb off-centre fix (shared primitive).** Giorgio noticed the
  drag thumb sat off to one side. Root cause in `src/components/ui/slider.tsx`: the horizontal variant has
  `items-center` but the **vertical** variant only had `flex-col justify-center` — missing the cross-axis
  `items-center`, so the `w-5` (20px) thumb and the `w-2` (8px) track both aligned to flex-start (left) →
  the thumb overshot ~6px right. Added `data-[orientation=vertical]:items-center`. ⚠️ Shared component —
  the fix is unambiguously correct (no vertical slider wants an off-centre thumb) and the horizontal path
  is untouched (separate `data-orientation` selector).
- **2026-06-13** — v2.17 — **edge overlays trim gradually DURING the drag + stop reappearing after release**
  (Giorgio: «όσο κατεβάζω τον slider εξακολουθούν να φαίνονται οι ακμές· μόλις αφήσω εξαφανίζονται, αλλά
  μετά από λίγο επανεμφανίζονται ΟΛΕΣ μέχρι την κορυφή»). Two coupled defects in the v2.11 edge pipeline:
  1. **During-drag "cage".** v2.11 ran only the cheap `cullEdgeCutVisibility` while dragging — it hides
     overlays fully **above** the cut but keeps **crossing** overlays (columns/walls spanning the plane)
     pristine and full-height, so their wireframe pokes above the cut until release.
  2. **Post-release reappearance (~150 ms).** After settle, a cap parity pass / refine frame restores an
     overlay's visibility/geometry toward pristine; the exact re-trim was gated by `lastSettledEdgeCutY`,
     so once `cutY === lastSettledEdgeCutY` the trim was **skipped** and the restored-pristine overlays
     showed full-height again — "ΟΛΕΣ μέχρι την κορυφή".
  **Fix (`section-scene-controller.ts`):** `renderFrameWithCaps` now runs the EXACT `applyEdgeCutTrim` on
  **every frame the cut is live** (drag AND settled), replacing the cull-then-guarded-settle split. The
  per-overlay `bimEdgeAppliedCutY` guard inside `applyEdgeCutTrim` skips redundant GPU re-uploads, so this
  is (a) **gradual during drag** — crossing edges shrink live to the plane — and (b) **self-healing** — any
  overlay a cap parity pass / rebuild restores is re-trimmed the very next frame → no reappearance. The old
  357 ms `pointermove` jank does NOT return because this runs once per FRAME, not per slider `onValueChange`.
  **Revit-style regen throttle:** while actively dragging (`cutMoving`), the exact trim is capped to once per
  `EDGE_TRIM_THROTTLE_MS = 50 ms` (≤50 ms edge lag, imperceptible on normal scenes, bounds GPU uploads on a
  dense floor); settled/static frames are never throttled (final exact trim + self-healing stay immediate).
  Removed the now-superseded `cullEdgeCutVisibility` + `lastSettledEdgeCutY` guard + `edge-cut-cull.test.ts`
  (dead-code ratchet). `edge-cut-trim` (5) + `cut-plane-3d-math` + `section-clip-applicator` green. *(touched
  the ADR-452 controller after the concurrent agent stopped — Giorgio reassigned; browser-verified «λύθηκε»)*
- **2026-06-14** — v2.18 — **slider intensity softened to match the ViewCube** (Giorgio: the slider's orange
  was much stronger than the cube/compass-ring even though it's the same `#ff8c00`). Cause: the slider paints
  the hue **solid at opacity 1.0**, whereas the ViewCube is semi-transparent (cube faces `opacity 0.5→1.0`,
  compass ring `0.4→0.8` and grey `#8899aa` at rest, orange only on hover) — same hue, different alpha/state.
  Fix: an `opacity-80` class on the `<Slider>` only (track/range/thumb), leaving the toggle button at full
  opacity so the ON/OFF state stays crisp. Scoped to `CutPlaneSliderControl.tsx`; the shared `Slider` and all
  other sliders are untouched.
- **2026-06-14** — v2.19 — **horizontal cut cap is now depth-occluded (stops floating in the foreground)**
  (Giorgio: cut through the roof slab → "η οροφή φαίνεται πάντα σε πρώτο πλάνο, και από πάνω και από κάτω·
  από κάτω θα έπρεπε να την καλύπτουν τοίχοι/κολόνες/δοκάρια"). **Root cause:** the VISIBLE cut-cap quad
  materials (`createOpaqueCutCapMaterial` opaque base + `getColorCapMaterial` per-material colour caps) were
  created with **`depthTest: false`** — copied from the parity-pass pattern where it is required, but wrong for
  the *final visible fill*. With depth-test off the cap drew on top of everything regardless of the camera, so
  a cut slicing the roof kept the whole roof poché in the foreground; from below it covered the geometry that
  should occlude it. **Fix:** `depthTest: true` on those two VISIBLE cap materials only — the cap passes keep
  the main-scene depth buffer (`autoClearDepth = false`), so depth-testing the cap against the clipped scene
  makes nearer walls/columns/beams hide it correctly (standard three.js `webgl_clipping_stencil` cap, which is
  a normal depth-tested mesh). `depthWrite` stays false (decorative final fill, must not pollute Z). **Untouched
  (deliberately):** the parity materials `createCutParityMaterial` (need depthTest off to count faces over the
  whole sliced solid), the Section **Box** cap `createCapMaterial`, and the box hatch. Files:
  `section-stencil-materials.ts`, `section-cut-cap-groups.ts`. Section suite green; browser-verified «λειτουργεί
  σωστά» (from below the roof is occluded by the framing). *(ADR-452 reassigned to me after the concurrent agent
  stopped — Giorgio.)*
- **2026-06-14** — v2.20 — **slider + toggle made hover-driven, mirroring the ViewCube** (Giorgio: make the
  slider behave like the compass ring and the toggle like the cube — i.e. light up on hover). Supersedes the
  flat `opacity-80` of v2.18. (a) **Slider = compass ring:** a `cut-plane-slider` class drives a local
  `--primary` that rests at grey-blue `210 17% 60%` (= the ring's `COMPASS_RING_DEFAULT_COLOR` #8899aa) and
  swaps to `--viewcube-accent` (orange) on `:hover`, with a 160ms colour transition on the track/range/thumb
  (the ring lerps similarly). The override is local to the slider so the toggle keeps the orange accent.
  (b) **Toggle = cube faces:** the active state rests at `opacity-60` and lifts to `opacity-100` on hover
  (the cube faces go 0.5 → 1.0); `transition-all` animates it. Files: `globals.css` (hover rules under the
  scoped utility), `CutPlaneSliderControl.tsx` (class + button opacity). Shared `Slider` untouched.
- **2026-06-20** — v2.21 — **«Όλοι οι όροφοι»: ο cut-plane slider ακούει ολόκληρο το occupied envelope
  (incl. θεμελίωση)** (Giorgio: σε «Όλοι οι όροφοι» 3Δ, το slider της οριζόντιας τομής να καλύπτει ΟΛΟΥΣ
  τους ορόφους με DXF/BIM οντότητες — χαμηλότερο γεμάτο → υψηλότερο γεμάτο· ενδιάμεσοι κενοί μέσα, εξωτερικοί
  έξω). **Ρίζα Α (scope):** range (`computeCutPlaneRange`=`0…storeyHeight`) + world-Y (`resolveCutPlaneWorldY`
  =`activeFloorElevationMm+cutPlaneMm`) ήταν **κλειδωμένα στον ΕΝΕΡΓΟ όροφο** (Revit per-level View Range) →
  σε all-floors το slider «άκουγε» μόνο 1 όροφο. **Ρίζα Β (foundation, Giorgio follow-up «δεν αντιλαμβάνεται
  τη θεμελίωση»):** πρώτη εκδοχή χρησιμοποίησε floor FFL band `[floorElevationMm, ceiling]` — αλλά τα πέδιλα
  έχουν `topElevationMm` **αρνητικό** και κρέμονται ΚΑΤΩ από το FFL → εκτός band. **Λύση (scope-aware, FULL
  SSoT, entity-envelope):** (1) NEW pure `multi-floor-cut-range.ts` (`computeMultiFloorCutRange`) — ένωση των
  πραγματικών material envelopes `[minMm,maxMm]` (datum-relative) όλων των γεμάτων ορόφων → συνεχές band.
  (2) `useCutPlaneRange` scope-aware: `is3D && floor3DScope==='all'` → διαβάζει τα ΥΠΑΡΧΟΝΤΑ stacks
  (`multi-floor-3d-source` BIM + `multi-floor-dxf-source` DXF· μηδέν νέα aggregation)· per-entity Z κάνει
  **reuse το render-path SSoT `getEntityZExtents`** (το `DxfEntityUnion` περιλαμβάνει τα raw BIM entities →
  μηδέν διπλό Z-math) lifted στο datum frame με `+ floorElevationMm`· storey band `[ffl,ceiling]` ως seed
  (DXF-only floors + null-extent entities). (3) `resolveCutPlaneWorldY` σε all-floors ΔΕΝ προσθέτει το
  active-FFL offset (το `cutPlaneMm` ήδη datum-relative). Το 2Δ path (`isHiddenByCutPlane`, FFL-relative)
  αμετάβλητο. **ΜΑΘΗΜΑ:** το vertical envelope ΔΕΝ ταυτίζεται με το storey FFL band — πέδιλα/foundations
  κρέμονται κάτω· χρησιμοποίησε πραγματικά entity Z-extents. 6 νέα jest (Giorgio 1ος+3ος→1-3, FOUNDATION
  below-datum, degenerate), 44 cut/axis-cut GREEN. Files: NEW `multi-floor-cut-range.ts` + test, MOD
  `useCutPlaneRange.ts` + `cut-plane-3d.ts`. UNCOMMITTED — 🔴 browser-verify + commit (tsc=Giorgio).
- **2026-06-26 (perf — cap-quality tiering split)** — Στο `renderFrameWithCaps` η quality κατά την
  **κίνηση κάμερας** (`interacting || camMoved`, χωρίς `cutMoving`) έγινε **`'fast'`** (γκρι base) αντί
  `'colors'`: το per-material poché re-render-άρει ΟΛΗ τη BIM σκηνή `~2×(1+N_colours)` φορές/frame →
  ήταν ο κύριος section-nav lag. Πλέον μόνο το **cut-slider drag** (`cutMoving`) κρατά `'colors'` live
  (Giorgio 19/6)· settle → `'full'` μέσω `armRefine` (τα χρώματα γυρίζουν ακαριαία). Giorgio 26/6 ζήτησε
  «γκρι στην περιστροφή για ταχύτητα». 1-line αλλαγή στο `section-scene-controller.ts`. UNCOMMITTED —
  commit=Giorgio. (σχετικό: ADR-536 perf, ADR-535 grip motion-hide.)
- **2026-06-26 (perf v2.20 — SINGLE-PASS axis-cut parity)** — Giorgio «ομαλό zoom/orbit επιπέδου
  Revit/Maxon με ενεργό cut». **SSoT audit εύρημα:** το wheel→`'fast'` debounce που υποψιαζόταν το
  handoff ΥΠΑΡΧΕΙ ΗΔΗ (`viewport-camera.ts pulseWheelInteraction`, `WHEEL_IDLE=220ms`) → η ροδέλα
  ΕΙΝΑΙ ήδη `'fast'`· ο profiler (`renderObjects→renderBufferDirect→setProgram`) είναι **draw-call-bound**,
  άρα reduced-res RT θα βοηθούσε λίγο. **Η ρίζα:** το lone axis-cut cap (`capCutSection`) μετρούσε
  parity με **ΔΥΟ** πλήρη scene περάσματα (BackSide IncrementWrap + FrontSide DecrementWrap), ενώ το
  box path (`renderCapForPlane`) είχε ΗΔΗ τεχνική **1-περάσματος** (warmup seed + `gl.stencilOpSeparate(FRONT→DECR)`
  cache trick). **FIX:** `createSinglePassCutParityMaterial` (DoubleSide, `depthTest=false` για το
  lone-plane rule) αντικαθιστά τα 2 παλιά parity materials· το `capCutSection` κάνει πλέον **1** scene
  render (warmup + stencilOpSeparate + 1 DoubleSide pass). Η parity (Σ back-INCR − Σ front-DECR, depth
  off) είναι ανεξάρτητη σειράς → bit-for-bit ίδιο αποτέλεσμα στο μισό κόστος. Όφελος σε **ΚΑΘΕ** frame
  (drag/κίνηση/settle) ΚΑΙ στο per-colour loop (`'colors'`/`'full'`: 2×N→N renders). ΕΝΑΣ parity
  μηχανισμός πλέον (σβήστηκε το `createCutParityMaterial` 2-pass διπλότυπο). 3 νέα jest
  (`section-stencil-renderer.test.ts`: material config + single main-scene render + FRONT→DECR override),
  section/cut/scene suites GREEN. Files: `section-stencil-materials.ts`, `section-stencil-renderer.ts`
  (+test). tsc SKIP (N.17 — verified με ts-jest). UNCOMMITTED — 🔴 browser-verify (zoom/orbit ομαλότητα +
  η τομή ίδια οπτικά) + commit=Giorgio. (σχετικό: ADR-366 §A.3 stencil, ADR-455 axis cuts, ADR-040.)
