# ADR-452 — Cut-Plane Slider (Revit View Range UI for the 2D plan)

**Status:** 🟢 Implemented (v2.4 — clipped edges + per-material-colour cut faces) — pending browser-verify + commit
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
