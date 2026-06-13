# ADR-452 — Cut-Plane Slider (Revit View Range UI for the 2D plan)

**Status:** 🟢 Implemented — pending browser-verify + commit
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
