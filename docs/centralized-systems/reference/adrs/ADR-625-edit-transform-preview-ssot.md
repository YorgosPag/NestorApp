# ADR-625: Edit/transform preview draw-skeleton SSoT — ghost-overlay base + 3 paint primitives

## Status
✅ **ACTIVE — 2026-07-10** — De-duplication of the **edit-tool / transform preview** hook family in `src/subapps/dxf-viewer/hooks/tools/` (the `use*Preview` overlays for EXTEND/TRIM, CHAMFER/FILLET, SCALE/STRETCH). After ADR-398 §4 lifted the RAF/clear/viewport/cursor scaffolding into `useCanvasGhostPreview`, six preview hooks still repeated three distinct paint skeletons byte-for-byte between each twin. Collapsed onto one harness-consumption base + three per-family paint primitives + two draw utilities — every hook keeps its **identical public API**.

**Related:**
- **ADR-398 §4** — `useCanvasGhostPreview` harness: owns the cursor-gate + RAF lifecycle + DPR-clear + canonical viewport/transform + snapped cursor. Unchanged; the new base sits directly on top of it.
- **ADR-350 / ADR-353** — TRIM / EXTEND overlays (fence-path preview twins).
- **ADR-510 Φ4e/Φ4f** — FILLET / CHAMFER corner overlays (bevel vs tangent-arc twins).
- **ADR-348 / ADR-349** — SCALE / STRETCH overlays; **ADR-550** — WYSIWYG copies render through the REAL entity renderer (`drawRealEntityPreview`), shared by both transform previews.
- **ADR-624** — cluster #15 (WYSIWYG *placement*-ghost SSoT) in the same directory; this ADR (cluster #16) targets the sibling *edit/transform* preview family the #15 residual left adjacent.
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28 / N.18) — gated the sibling-clone iteration; the skeleton clones are folded to zero (jscpd:diff clean on all 11 touched files, no `SKIP_JSCPD_DIFF` needed).
- **ADR-605…624** — the same multi-day jscpd sweep; ADR-625 is cluster #16.

---

## Context

A real SSoT audit (fresh jscpd pass grouping `hooks/tools` at **738 cloned lines / 58 intra-dir pairs**, plus full reads of both members of every twin + the existing `systems/extend`/`systems/trim` SSoT) found three independent sibling-clone families, each two overlays sharing an identical `draw` skeleton with only leaf variance:

1. **Fence-path preview (EXTEND ⇄ TRIM)** — ~85 near-byte-identical `draw` lines (hover-path + fence multi-preview + fence rubber line + pickbox). The ONLY variance: the store, and which colour maps to «add» vs «remove» (the two tools are colour-inverses, SHIFT flips the mode).
2. **Corner preview (CHAMFER ⇄ FILLET)** — ~105 lines. Same paint skeleton (hover hit-test → recompute ghost → dashed-green stroke + value label + pickbox) and **identical** polyline-mode / same-polyline-corner branches; only the two-line geometry differs (bevel line vs tangent arc + a fillet-curve fallback) — the case the sweep explicitly must NOT force into one shape.
3. **Transform ghost (SCALE ⇄ STRETCH)** — the base-point crosshair + rubber-band + tooltip + WYSIWYG real-entity loop scaffold. Variance: the value shown (×factor vs Δx,Δy) and the per-copy transform (`scaleEntity` vs anchor/vertex displacement).

Across the three families every hook also re-implemented the same **harness-consumption idiom** (`useSyncExternalStore(store.phase)` + `toScreen` closure + `useCanvasGhostPreview` wiring) and the same low-level **polyline trace** (`moveTo` first + `lineTo` loop).

---

## Decision

Big-player layering (Revit/Maxon-C4D/Figma expose a shared manipulator-preview primitive; each tool supplies only colour + geometry closures), applied to the edit/transform preview family. All `use*Preview` hook names, prop shapes and exported types (`UseExtendPreviewProps`, `UseScalePreviewProps`, …) are preserved; the leaf mounts (`ExtendPreviewOverlay`, `TrimPreviewMount`, `ChamferPreviewMount`, `FilletPreviewMount`, `canvas-layer-stack-tool-preview-mounts`, ADR-040) are untouched.

### Four-layer stack (harness → base → primitive → binding)

**Layer 1 — `use-ghost-overlay.ts` → `useGhostOverlay<S>(config)`** — the harness-consumption idiom every store-driven overlay repeats: subscribe the store's `phase`, resolve `isActive`, build the canonical `toScreen`, and hand `(frame, state, toScreen)` to a stable draw callback. Sits between `useCanvasGhostPreview` and the paint primitives.

**Layer 1 utils — `overlay-draw-primitives.ts`** — `tracePolyline(ctx, path, toScreen)` (screen-space `moveTo`/`lineTo`; caller owns save/stroke/dash), shared by the fence + corner strokes.

**Layer 2 — three per-family paint primitives:**
- **`use-edit-fence-preview.ts` → `useEditFencePreview<S>({ store, colors, … })`** — the EXTEND/TRIM fence skeleton. `EditFencePreviewColors = { path, pickbox, showArrow }`, each a `(inverseMode) => …` policy.
- **`use-corner-tool-preview.ts` → `useCornerToolPreview<S>({ store, activeToolId, getScene, computeStrokes, buildLabel, pathFn })`** — the CHAMFER/FILLET skeleton (Template-Method). The **identical** polyline branches are hoisted here (`buildCornerPolylineStrokes` + `resolveCornerStrokes`); only the genuinely divergent two-line dispatch stays in the caller's `computeStrokes` (a `twoLines` closure). Also exports `nearestEntityMatching`.
- **`use-transform-ghost-preview.ts` → `useTransformGhostPreview<S>({ store, levelManager, isActivePhase, isDrawPhase, getBasePoint, buildTooltip, renderCopies, matrixGhost? })`** — the base-point crosshair + rubber-band + tooltip scaffold; owns the WYSIWYG renderer wiring (`useBimPreviewRenderer` + `useLevelLayersById`) and hands a ready `bimPreview` + `layers` into `renderCopies`. **ADR-646 Φ6 — optional `matrixGhost` capability:** an affine-about-base tool (scale/move/rotate/mirror) supplies `{ getIds, getWorldAffine }`; the primitive then renders the selection ONCE into an offscreen raster and blits it under ONE composed affine per frame (**O(1)/frame**, independent of entity count) via `transform-ghost-matrix-cache.ts` (`TransformGhostMatrixCache` + `runMatrixGhost`; pure math in `transform-ghost-matrix.ts`). Omitting it (or `getWorldAffine → null`) keeps the tool on `renderCopies` — the correct choice for per-vertex `stretch` and the automatic fallback for oversize/degenerate selections. Wired for `useScalePreview`; ready for move/rotate.

**Layer 3 — six thin bindings** — each `use*Preview.ts` keeps its exported hook + Props type and supplies only its colour policy / geometry closures / transform loop.

Divergence is respected, not forced: the bevel-vs-arc two-line geometry stays as two honest bespoke `chamferTwoLines` / `filletTwoLines` closures (N.1 — no corner-shop unification of semantically different math).

---

## Consequences

- **6 preview hooks re-based + 5 new SSoT modules** (1 base + 3 primitives + 1 util). Extend/Trim previews drop 135 → ~35 lines each; Chamfer/Fillet from 169/200 → ~95; Scale/Stretch shed the crosshair/rubber-band/tooltip + WYSIWYG-setup scaffold. `hooks/tools` clones drop and the full-scan ratchet falls **3339 → 3299 working-tree** (`3299/3494` vs the committed baseline; **−195 cumulative** with #12–#15).
- **jscpd:diff clean** on all 11 touched files — the three skeleton twins are fully folded and the newly-introduced sibling clones (the low-level trace / harness idiom / corner dispatch) were each extracted rather than shipped; **no `SKIP_JSCPD_DIFF` needed**.
- **Identical public API** — verified by a new suite (`__tests__/preview-ssot-cluster16.test.tsx`, 22 tests): `tracePolyline` + `nearestEntityMatching` units, `resolveCornerStrokes` dispatch routing (polyline vs two-line), `useEditFencePreview` isActive-gate + colour-driven paint through the real `useGhostOverlay` stack, and a module-load smoke over all 6 bindings + 3 primitives. The existing `useCanvasGhostPreview` harness suite still passes.
- **Not touched:** the tool-side hooks (`useExtendTool`/`useTrimTool`/`useChamferTool`/`useFilletTool`/`useScaleTool`/`useStretchTool`) and their divergent pointer drag-captures — out of scope for this preview-only cluster.

### Changelog
- **2026-07-13** — **ADR-646 Φ6: matrix-ghost capability added to the shared skeleton.** `useTransformGhostPreview` gained an opt-in `matrixGhost` config → render-once-offscreen + O(1)/frame affine blit for affine-about-base transforms (the definitive fix for the thousand-entity scale freeze; ADR-040/646). NEW `transform-ghost-matrix.ts` (pure affine SSoT, 11 jest) + `transform-ghost-matrix-cache.ts` (`TransformGhostMatrixCache` mirrors ADR-516 `DxfBackdropCache`). `useScalePreview` wired (`renderCopies` = Φ.5 LOD fallback); `useStretchPreview` untouched (per-vertex → no matrix). No second rAF loop (reuses this cluster's harness). 52 jest pass, jscpd:diff clean.
- **2026-07-10** — Cluster #16 implemented. `useGhostOverlay` base + `overlay-draw-primitives` + `useEditFencePreview` / `useCornerToolPreview` / `useTransformGhostPreview` primitives; 6 bindings (`useExtendPreview`/`useTrimPreview`/`useChamferPreview`/`useFilletPreview`/`useScalePreview`/`useStretchPreview`) re-based to thin config. Full-scan 3339 → 3299 (working-tree; baseline relock pending Giorgio). 22 jest pass. jscpd:diff clean, no SKIP.
