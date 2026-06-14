# ADR-455 — Vertical Section Cuts (X/Y) with «L» slider + direction arrow

**Status:** 🟢 Implemented (v1) — pending browser-verify + commit
**Date:** 2026-06-14
**Builds on:** ADR-452 (horizontal cut-plane / View Range), ADR-366/ADR-040 (section pipeline,
micro-leaf), ADR-358 (Isolate dim-alpha path reused for the 2D ghost)

---

## 1. Context / Problem

ADR-452 added ONE horizontal cut (Z height, Revit View Range): a right-edge slider that
clips the 3D scene with solid stencil caps and hides 2D-plan entities above the plane.
Giorgio asked for **two new VERTICAL section cuts** (along world DXF X and Y), driven by
sliders on the canvas BASE (above the horizontal ruler) and LEFT (right of the vertical
ruler), each an «L»-shaped control whose short branch is a **direction arrow** showing the
viewing side, easily **flippable**. The 3D sections must behave EXACTLY like the horizontal
cut (same clip + caps + perf ladder) — i.e. reuse the same mechanisms. In 2D, the cut-away
side must render as a **GHOST** (semi-transparent), NOT be hidden (explicit choice).

## 2. Decision

1. **SSoT for values** — extend `bim-render-settings-store` with `xAxisCut` / `yAxisCut`
   `{active, position, sign:+1|-1}` (`config/bim-render-settings-types.ts` + setters
   `setAxisCutActive/Position/Sign`), persisted per-Level like the Z cut (full 2D+3D parity).
   `position` is a world PLAN coordinate in **scene/canvas units** (metres for BIM scenes,
   used 1:1 in three.js — NOT mm; only the Z height cut is mm×0.001).

2. **SSoT for the 3D mechanism** — generalise the single `cutPlane` of
   `SectionSceneController` into ≤3 axis cut planes (Z existing + X + Y), all flowing through
   the SAME fast-path (mutate `plane.constant` in place when only positions move), per-axis
   stencil caps (`renderAxisCutCap`, renamed from `renderHorizontalCutCap` — `positionMesh`
   already orients the cap quad to any normal), refine-on-idle, and 6-plane clip composition
   (cuts FIRST). Pure helpers extracted to `axis-cut-composer.ts` (N.7.1). The plane math is
   one generic `buildAxisCutPlane(axis, worldCoordM, sign)` (`cut-plane-3d-math.ts`); the
   legacy `buildCutPlane` is now a thin `('z', y, +1)` wrapper.

3. **Coordinate handedness** — per `BimToThreeConverter`: DXF X → three.js X, DXF Y → three.js
   **−Z** (flip), DXF Z(height) → three.js Y. Encoded as `AXIS_FLIP` so a stored DXF position
   lands on the correct three.js half-space. `normal = u·(sign·flip)`, `constant = sign·coord`.

4. **2D = ghost, not hide** — a new alpha path in `DxfRenderer.resolveStyleForRender`/
   `renderEntityUnified` (and the line batch), mirroring the Isolate `dim` path: an entity
   fully on the cut-away side gets `alpha ×= AXIS_CUT_GHOST_ALPHA` (0.18). Classification via
   `axisCutGhostFactor` (`bim/visibility/axis-cut-plan-side.ts`) using `BoundsCalculator`
   plan bbox. Straddling entities stay solid (mirrors the 3D cross-section). Zero-cost
   passthrough when both cuts are off. `xc`/`yc` added to the bitmap-cache hash.

5. **2D section line** — `systems/axis-cut/axis-cut-line-renderer.ts` draws a full-viewport
   section line at each active cut + a direction arrow toward the KEPT side (mirrors
   `GuideRenderer.drawGuideLine`), wired into `dxf-canvas-renderer` step 2.7 (above entities,
   below rulers).

6. **UI + appearance SSoT** — a single shared `SectionSliderShell` owns the ONE appearance
   code path (the ViewCube-accent theme `.cut-plane-slider-accent` + `.cut-plane-slider`,
   toggle states, readout pill, slider, label) for BOTH the horizontal cut
   (`CutPlaneSliderControl`, refactored onto the shell) AND the X/Y cuts
   (`AxisCutSliderControl`). No hardcoded colours — every hue comes from the shared CSS
   tokens, so all sliders are visually identical (Giorgio feedback 2026-06-14). The 2D
   section-line colour reads the SAME `--viewcube-accent` token (no hex). `AxisCutSliderControl`
   adds only the «L» flip-arrow (rotates per axis+sign; click flips the kept side), mounted by
   `AxisCutSliderLeaf` (2D-gated): X horizontal along the base, Y vertical along the left.
   Range = model world extent (`scene.bounds`, `axis-cut-range.ts`).

## 3. Files

| Type | Path |
|------|------|
| MOD | `config/bim-render-settings-types.ts` (`AxisCutSetting`, x/yAxisCut, `resolveAxisCut`) |
| MOD | `state/bim-render-settings-store{,-types}.ts` (3 setters, buildRaw, loadForLevel) |
| MOD | `bim-3d/scene/cut-plane-3d-math.ts` (`buildAxisCutPlane`, `AXIS_FLIP`) |
| MOD | `bim-3d/scene/cut-plane-3d.ts` (`resolveAxisCut`, `resolveAllAxisCuts`, `ResolvedAxisCut`) |
| NEW | `bim-3d/scene/axis-cut-composer.ts` (compose/key/detectMoving/clip — pure) |
| MOD | `bim-3d/scene/section-scene-controller.ts` (single→N axis cuts; fast path + cap loop) |
| MOD | `bim-3d/systems/section/section-stencil-renderer.ts` (rename → `renderAxisCutCap`) |
| NEW | `bim/visibility/axis-cut-plan-side.ts` (2D ghost classification SSoT) |
| MOD | `canvas-v2/dxf-canvas/DxfRenderer.ts` (ghost alpha path, line batch + entity loop) |
| MOD | `canvas-v2/dxf-canvas/dxf-bitmap-cache.ts` (`xc`/`yc` hash) |
| NEW | `systems/axis-cut/axis-cut-line-renderer.ts` + MOD `dxf-canvas-renderer.ts` (step 2.7) |
| NEW | `components/dxf-layout/axis-cut-range.ts`, `AxisCutSliderControl.tsx`, `AxisCutSliderLeaf.tsx` |
| NEW | `components/dxf-layout/SectionSliderShell.tsx` (shared appearance SSoT for ALL cut sliders) |
| MOD | `components/dxf-layout/CutPlaneSliderControl.tsx` (refactored onto the shared shell) |
| MOD | `components/dxf-layout/CanvasLayerStack.tsx` (mount leaf) |
| MOD | `i18n/locales/{el,en}/dxf-viewer-panels.json` (`axisCut.*`) |
| TEST | `cut-plane-3d-math.test.ts` (+axis combos), `axis-cut-composer.test.ts`, `axis-cut-range.test.ts`, `axis-cut-plan-side.test.ts` |

## 4. Verification

1. `npm test` on the four suites — green (26 axis/composer/range/plan-side + math combos).
2. `tsc --noEmit` clean for the touched files.
3. Browser `/dxf/viewer`, BIM storey: 2D shows X (base) + Y (left) «L» sliders; drag → section
   line moves + cut-away side ghosts; flip arrow → swaps kept/ghost. 3D → vertical clip with
   solid caps like the horizontal cut; Z+X+Y simultaneously, no slider-drag jank (fast path).
   Reload → active/position/sign persist per-Level.

## 5. Out of scope (DEFER)

- **X/Y fat-line edge trim**: only the Z cut runs `applyEdgeCutTrim`. Without it, edge overlays
  spanning a vertical plane stay drawn into the clipped half (solid faces clip correctly). The
  `edge-cut-applicator` is world-Y-specific; generalising to an arbitrary axis (or a three.js
  GPU `LineMaterial` clip after upgrade) is a follow-up.
- **3D-viewport X/Y sliders**: v1 mounts the controls in 2D only (per the user's ruler-relative
  placement); the 3D SECTION fully works via the shared SSoT. A 3D-viewport mount (parity with
  the horizontal cut's `CutPlaneSlider3DLeaf`) needs canvas-unit bounds threaded into
  `BimViewport3D` — follow-up.
- 6-plane limit when 3 axis cuts + a full 6-plane section box coexist → box/crop surplus
  dropped (cuts kept first); a dev `console.warn` surfaces it.
- 2D hit-test suppression of the ghosted side (stays selectable).

## 6. Changelog

- **v1 (2026-06-14)** — initial implementation (slices: SSoT, 3D generalisation, 2D ghost +
  section line, «L» UI, tests). ADR number is **455** (453/454 taken by the concurrent
  print-export work).
- **v1.1 (2026-06-14)** — appearance SSoT unification (Giorgio: the X/Y sliders hardcoded their
  look instead of reusing the horizontal cut's). Extracted `SectionSliderShell` as the single
  chrome/theme path; refactored `CutPlaneSliderControl` onto it; the section line now reads the
  shared `--viewcube-accent` token (removed the hardcoded `#0ea5e9`). Zero behaviour change.
