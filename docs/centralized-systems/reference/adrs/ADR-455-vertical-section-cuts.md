# ADR-455 — Vertical Section Cuts (X/Y) with «L» slider + direction arrow

**Status:** 🟢 Implemented (v2 — transform-synced handle + 2D fade-rect) — pending browser-verify + commit
**Date:** 2026-06-14
**Builds on:** ADR-452 (horizontal cut-plane / View Range), ADR-366/ADR-040 (section pipeline,
micro-leaf)

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

4. **2D = ghost via a fade-rect, not per-entity** (v2 redesign) — `axis-cut-line-renderer`
   draws ONE translucent rectangle (canvas-bg colour `--canvas-background-dxf` at α=0.82) over
   the whole cut-away half-plane, clipped to the drawing area (inside the left + bottom rulers).
   So the entire sectioned side (grid + DXF + BIM, **including entities that straddle the line**)
   reads uniformly as a ghost — a clean section look with zero per-entity logic. This **replaced**
   the v1 per-entity ghost (`axis-cut-plan-side.ts` + the `DxfRenderer` alpha path + the `xc`/`yc`
   bitmap-cache key — all removed). The rect lives ABOVE the bitmap, so cut moves no longer
   rebuild the (expensive) entity bitmap; the bim-render-settings subscription marks the canvas
   dirty → only the overlay repaints.

5. **2D section line + transform-synced handle** (v2) — `systems/axis-cut/axis-cut-line-renderer.ts`
   draws a full-viewport section line at each active cut + a direction arrow toward the KEPT side,
   PLUS a draggable **handle tab** on the line at the canvas edge (`axis-cut-grip.ts` = the SSoT
   for its screen rect, shared by the renderer draw + the pointer hit-test). The handle is
   world-anchored (`worldToScreen(position)`), so it tracks pan/zoom. Drag pipeline: the mouse
   handlers (`useCentralizedMouseHandlers` down, `mouse-handler-move`, `mouse-handler-up`) check
   `hitTestAxisCutGrip` on pointer-down, claim the gesture into `axis-cut-drag-store`, then on
   move convert `screenToWorld` → `setAxisCutPosition`. This **replaced** the v1 Radix normalized
   slider for X/Y, whose thumb could never align with a world-anchored line.

6. **UI + appearance SSoT** — a single shared `SectionSliderShell` owns the ONE appearance
   code path (the ViewCube-accent theme `.cut-plane-slider-accent` + `.cut-plane-slider`,
   toggle states, readout pill, slider, label) for BOTH the horizontal cut
   (`CutPlaneSliderControl`, refactored onto the shell) AND the X/Y cuts
   (`AxisCutSliderControl`). No hardcoded colours — every hue comes from the shared CSS
   tokens, so all sliders are visually identical (Giorgio feedback 2026-06-14). The 2D
   section-line colour reads the SAME `--viewcube-accent` token (no hex). In v2 the X/Y controls
   use the shell in **`compact` mode** (toggle + flip arrow + readout, no Radix track — the drag
   moved to the on-canvas handle); the horizontal cut keeps its slider. `AxisCutSliderControl`
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
| DEL | `bim/visibility/axis-cut-plan-side.ts` (+ test) — v1 per-entity ghost, replaced by the v2 fade-rect |
| MOD | `canvas-v2/dxf-canvas/DxfRenderer.ts` (v2: REMOVED ghost alpha path + `resolveActiveAxisCuts`) |
| MOD | `canvas-v2/dxf-canvas/dxf-bitmap-cache.ts` (v2: REMOVED `xc`/`yc` — fade is overlay, not baked) |
| NEW | `systems/axis-cut/axis-cut-grip.ts` (v2 — handle screen-rect SSoT + `hitTestAxisCutGrip`) |
| NEW | `systems/axis-cut/axis-cut-drag-store.ts` (v2 — imperative handle-drag state, zero React) |
| MOD | `systems/axis-cut/axis-cut-line-renderer.ts` (v2: + cut-away fade-rect + handle draw) + MOD `dxf-canvas-renderer.ts` (step 2.7) |
| MOD | `systems/cursor/useCentralizedMouseHandlers.ts` + `mouse-handler-move.ts` + `mouse-handler-up.ts` (v2 — handle drag claim/move/release) |
| NEW | `components/dxf-layout/axis-cut-range.ts`, `AxisCutSliderControl.tsx` (v2: compact), `AxisCutSliderLeaf.tsx` (v2: corner widgets) |
| MOD | `components/dxf-layout/SectionSliderShell.tsx` (shared appearance SSoT; v2: + `compact` mode) |
| MOD | `components/dxf-layout/CutPlaneSliderControl.tsx` (refactored onto the shared shell) |
| MOD | `components/dxf-layout/CanvasLayerStack.tsx` (mount leaf) |
| MOD | `i18n/locales/{el,en}/dxf-viewer-panels.json` (`axisCut.*`) |
| TEST | `cut-plane-3d-math.test.ts` (+axis combos), `axis-cut-composer.test.ts`, `axis-cut-range.test.ts`, `axis-cut-plan-side.test.ts` |

## 4. Verification

1. `npm test` on the axis-cut suites — green (grip geometry/hit-test + drag-store + composer +
   range). The v1 `axis-cut-plan-side` suite was removed with its feature.
2. `tsc --noEmit` clean for the touched files.
3. Browser `/dxf/viewer`, BIM storey: 2D shows compact X (base) + Y (left) widgets (toggle + flip
   + readout). Each active cut draws a section line with a **handle** on it; drag the handle →
   the line + the uniform cut-away fade follow the cursor at every zoom/pan; flip arrow → swaps
   kept/ghost side. 3D → vertical clip with solid caps like the horizontal cut; Z+X+Y
   simultaneously, no slider-drag jank (fast path). Reload → active/position/sign persist per-Level.

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
- 2D hit-test suppression of the ghosted (faded) side (stays selectable).
- Range-clamping the handle drag (currently free — the line follows the cursor past the model
  extent; harmless, the cut just removes everything / nothing).

## 6. Changelog

- **v1.1 (2026-07-19)** — **Έντονη ένδειξη «ΕΝΕΡΓΗ» στο `SectionSliderShell`** (discoverability, αίτημα
  Giorgio). Αφορμή: χρήστης τοποθέτησε τοίχο+κολώνα και «εξαφανίστηκαν», ενώ έπιπλο+γραμμή φαίνονταν.
  Αιτία (ADR-452): το cut-plane slider ήταν στο τέρμα κάτω (~-0.01m) → ο κανόνας `isHiddenByCutPlane`
  κρύβει κάθε **δομικό** BIM με base πάνω από την τομή (`getEntityZExtents`: wall/column/beam/slab έχουν
  z-extents· έπιπλο/raw DXF → `null` → ποτέ δεν κόβονται). Δεν ήταν bug — **αόρατη κατάσταση χωρίς
  feedback**. Το active state του shell ήταν **dimmed 60%** (ViewCube-face rest) → περνούσε απαρατήρητο.
  FIX (κοινό shell, SSoT για ΟΛΟΥΣ τους cut sliders — cut-plane + Χ/Ψ): active → **πλήρες opacity +
  primary ring-halo** στο toggle, **πορτοκαλί readout pill**, και νέο optional `activeLabel` που
  αντικαθιστά το muted label με loud primary caption (cut-plane περνά `cutPlane.activeBadge` = «Τομή
  ενεργή» / «Cut active», el+en). Μηδέν hardcoded χρώμα (tokens). N.18 jscpd καθαρό. 🔴 browser-verify + commit.
- **v1 (2026-06-14)** — initial implementation (slices: SSoT, 3D generalisation, 2D ghost +
  section line, «L» UI, tests). ADR number is **455** (453/454 taken by the concurrent
  print-export work).
- **v1.1 (2026-06-14)** — appearance SSoT unification (Giorgio: the X/Y sliders hardcoded their
  look instead of reusing the horizontal cut's). Extracted `SectionSliderShell` as the single
  chrome/theme path; refactored `CutPlaneSliderControl` onto it; the section line now reads the
  shared `--viewcube-accent` token (removed the hardcoded `#0ea5e9`). Zero behaviour change.
- **v2 (2026-06-14)** — transform-synced handle + 2D fade-rect (fixes the two browser-verified v1
  problems). (A) The X/Y Radix normalized slider is replaced by a **drag handle on the section
  line** (`axis-cut-grip.ts` SSoT rect + `axis-cut-drag-store.ts` + claims in the three mouse
  handlers); the thumb now IS the line, so it aligns at every pan/zoom. The corner widget stays as
  a compact toggle/flip/readout (`SectionSliderShell` gained a `compact` mode). (B) The per-entity
  2D ghost is replaced by a single **cut-away fade rectangle** in `axis-cut-line-renderer`, so a
  straddling entity's cut-away part also dims — a clean section read. Removed: `axis-cut-plan-side.ts`
  (+ test), the `DxfRenderer` per-entity/line-batch ghost path + `resolveActiveAxisCuts`, and the
  `xc`/`yc` bitmap-cache key (cut moves no longer rebuild the entity bitmap → faster drag).
  Discoverability: the handle tab is 34×16 px and the WHOLE section line is grabbable
  (`nearSectionLine`, ±7 px — Revit-style), not just the tab. **Zoom/pan-aware handle**: the tab's
  along-line coordinate is **clamped to the visible drawing area** (`getAxisCutGripRect`), so the
  control stays reachable at any zoom even when the world-anchored line scrolls off-screen — grab
  the edge-pinned tab and drag to pull the cut back into view (absolute `screenToWorld` mapping).
  Note: the renderer runs inside a RAF callback captured once at mount, so HMR keeps the old
  module — a FULL reload is needed to pick up renderer changes during dev.
