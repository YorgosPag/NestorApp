# ADR-692 — 3D Window/Crossing Marquee Selection

> Renumbered from ADR-691 (that number was taken by imported-mesh-embedded-material-extraction).

**Status:** Φ1 + Φ2 IMPLEMENTED (uncommitted, 🔴 browser-untested) · Φ3 PLANNED
**Date:** 2026-07-24
**Owner:** DXF Viewer / bim-3d
**Related:** ADR-040 (micro-leaf perf), ADR-402/532 (3D selection + cross-mode hydration), ADR-536 (selection outline), ADR-538 (hover), ADR-539 (Polygon Mode), ADR-408 (edit gizmo), ADR-680 (dist tool)

---

## 1. Context / Problem

The 2D DXF canvas has full AutoCAD-style **window vs crossing** marquee selection
(drag a rectangle: left→right selects only fully-enclosed entities; right→left selects
anything the box touches). The **3D viewport had none** — only single-click raycast picking.
`onMouseDown`/`onMouseUp` on the 3D root were `stopPropagation` no-ops, and a left-drag did
nothing (perspective: tumble is Alt-gated, OrbitControls rotate disabled) or panned (ortho).

Giorgio (2026-07-24): implement it at Revit/ArchiCAD/Cinema-4D/Figma level, no quality
compromises. Decisions taken with him:
- **Occlusion:** BOTH select-through (default) AND visible-only, via an X-ray toggle.
- **Scope:** BIM entities AND raw DXF wireframe entities (across floors).

## 2. Why not just reuse the 2D marquee

The 2D `UniversalMarqueeSelector` is coupled to the 2D affine `ViewTransform` (pan/zoom) and
flat DXF `Entity[]`. In 3D there is no such transform — geometry is `three` meshes viewed
through a perspective/ortho camera. What IS reusable (and is reused, not cloned — N.18):
- the **window/crossing verdict** (`start.x > end.x`), and
- the **screen-space intersection primitives** (`polygonIntersectsRectangle`,
  `isFullyInsideWithTolerance`).

The 3D-specific addition is projecting each entity's world geometry to screen space via the
live camera before running those primitives.

## 3. Decision — Architecture (SSoT)

New folder `bim-3d/systems/marquee/` + `bim-3d/viewport/` handlers/overlay:

| Module | Role |
|--------|------|
| `systems/selection/marquee-direction.ts` | **SSoT verdict** `getMarqueeSelectionType(startX,endX)` / `isCrossingDrag`. Extracted from the inline `UniversalMarqueeSelection` comparison so 2D + 3D share ONE rule (N.18). |
| `bim-3d/systems/marquee/Marquee3DStore.ts` | Zero-React drag state (client-px start/current + combine mode). Mirrors 2D `SelectionStore` (ADR-040 Φ III). |
| `bim-3d/systems/marquee/marquee-3d-hit-test.ts` | `collectBimMarqueeHits` — per-entity world-AABB → project 8 corners → WINDOW (all corners inside) / CROSSING (convex-hull ∩ rect). Calls the 2D primitives. |
| `bim-3d/viewport/use-bim3d-marquee-handlers.ts` | Pointer FSM: mousedown arms, threshold (4px) opens, mouseup resolves+applies. Suspends OrbitControls during drag (`viewport.setControlsEnabled`). Guards mirror `handleClick`. |
| `bim-3d/viewport/Marquee3DOverlay.tsx` | Thin DOM leaf: the rubber-band rect. Sole `Marquee3DStore` subscriber (ADR-040). |
| `scene-manager-actions.applyBimMarqueeSelection` + `ThreeJsSceneManager.applyBimMarqueeSelection` | Bulk apply a bimId set with combine mode → `Selection3DStore.setSelection` + highlighter; the 3D→universal bridge mirrors it. |

### Φ2 modules (2026-07-24)

| Module | Role |
|--------|------|
| `systems/selection/marquee-combine.ts` | **SSoT** `MarqueeCombineMode` + `combineMarqueeSelection(current, hits, mode)`. The add/subtract/replace math lived inline in `applyBimMarqueeSelection`; Φ2's raw-DXF path needed the SAME math on a different store — extracted before it could become a sibling clone (N.18). `Marquee3DStore` re-exports the type for back-compat. |
| `systems/selection/resolve-dxf-marquee-selection.ts` | Pure ops-based applier for raw DXF ids (sibling of `resolve-dxf-entity-click`). Takes `previousIds` **explicitly** — see «ordering» below. |
| `bim-3d/systems/marquee/marquee-screen-geometry.ts` | Shared screen-space primitives: `screenRectFromPoints`, `screenBounds`, `polylineIntersectsRect(points, closed, rect)`, `isClosedPolyline`. Owns ONE decision the 2D SSoT does not model: an **open** polyline is not a polygon (no containment branch) — otherwise an L-shaped line would falsely swallow a rect sitting in its concavity. |
| `bim-3d/systems/marquee/dxf-marquee-3d-hit-test.ts` | `collectDxfMarqueeHits` — per raw DXF entity: `dxfEntityOutlineSegments` (the SAME plan-mm outline the wireframe + hover glow draw, incl. per-scene `unitToMm`, ADR-537 γ) → `dxfPlanToWorld(floorElevationMm)` → project → window/crossing. Also returns `scopeIds` (see «ordering»). Honours the active floor scope (ADR-537 δ). |
| `bim-3d/systems/marquee/marquee-gpu-id-pass.ts` | `collectVisibleBimIdsInRect` — 24-bit RGB id-pass into a `WebGLRenderTarget`, `camera.setViewOffset` restricted to the marquee rect, sync `readRenderTargetPixels`, decode → visible bimIds. On-demand at mouseup ONLY (ADR-040). |
| `bim-3d/systems/marquee/marquee-3d-apply.ts` | The ONE orchestrator: collect BIM + DXF, apply the X-ray filter, apply both selections **in order**. Keeps the pointer hook thin. |
| `ui/ribbon/components/MarqueeSelectThroughToggle.tsx` | «Διαμπερής Επιλογή» toggle (View tab → «Εμφάνιση»), thin reader/writer of `ViewMode3DStore.marqueeSelectThrough`. |
| `viewport/coordinate-transforms.createWorldToScreenProjector` | Bulk projector: captures the canvas rect + scratch vector ONCE. `worldToScreen` now delegates to the same `ndcToScreenPx` — one math home, but the DXF pass no longer forces a layout flush per vertex. |

### Φ2 ordering (the non-obvious part)

BIM ids and raw DXF ids both live in the universal selection as `dxf-entity`. Writing the 3D
selection fires the 3D→universal bridge, which does `replaceEntitySelection([bimIds])` and
therefore **wipes the whole `dxf-entity` bucket**. So `marquee-3d-apply`:
1. snapshots the previously-selected raw-DXF ids (filtered by `scopeIds`, so BIM ids sharing
   the bucket never leak into the DXF add/subtract math),
2. applies **BIM first**,
3. applies **DXF additively** on top.

Reverse the order and step 2 silently erases step 3. This is why `applyDxfMarqueeSelection`
takes `previousIds` as a parameter instead of reading the store itself.

### Semantics
- **WINDOW (L→R):** every projected AABB corner inside the rect ⇒ the convex silhouette is
  fully enclosed. Blue solid rectangle.
- **CROSSING (R→L):** convex hull of the projected corners intersects the rect. Green dashed.
- **Combine modes** (frozen at mousedown): plain = replace, Shift = add, Ctrl/Cmd = subtract.
  Alt is reserved (tumble / orbit-pivot). Escape cancels without changing selection.
- **Occlusion:** select-through (occlusion-agnostic projection) is the default — the CAD
  convention (Revit/AutoCAD select behind-objects in a box). Φ2 adds the opposite mode behind
  the «Διαμπερής Επιλογή» toggle: the CPU result is **intersected** with the GPU id-pass set,
  so the two axes never contaminate each other. If the id-pass cannot decide (unsupported
  camera, degenerate rect) the code falls **back to select-through** — never to an empty
  selection.
- **Raw DXF (Φ2):** the marquee also collects raw DXF wireframe entities across the active
  floor scope, in the same gesture, producing a mixed BIM+DXF selection.

### OrbitControls coordination
Left-drag is claimed for the marquee, so controls are suspended for the gesture's lifetime
(same `setControlsEnabled(false/true)` pattern as `use-bim3d-opening-move`). This makes the
gesture identical in perspective and ortho; pan stays on middle/right per OrbitControls.

## 4. Phasing

- **Φ1 (this ADR, implemented):** foundation + select-through CPU marquee for BIM entities;
  rubber-band overlay; window/crossing; add/subtract/replace; escape; controls coordination.
- **Φ2 (implemented):** raw-DXF wireframe inclusion (across floors) + **GPU id-picking pass**
  for pixel-exact **visible-only** mode and the **«Διαμπερής Επιλογή» toggle**. Built on
  `scene/sized-render-target.ts` + the `SelectionOutlinePass` RT pattern. Readback is
  **synchronous** — one stall per gesture, deliberately accepted; async PBO/`fenceSync` is Φ3.
- **Φ3 (planned):** polish/perf — auto-pan at viewport edges, live selection-count HUD, BVH
  broad-phase for tens-of-thousands of meshes, async readback, throttling.

## 5. Consequences
- 3D viewport gains professional multi-select. No change to 2D.
- `ThreeJsSceneManager` grows one public method (watch the 500-line cap, N.7.1). Φ2 added
  **nothing** to it — the DXF + GPU work lives in `bim-3d/systems/marquee/`.
- Window/crossing precision for BIM is AABB-corner based (a diagonal beam's AABB over-reports
  in crossing mode). Per-mesh silhouette precision is NOT solved by the Φ2 GPU pass — that
  pass answers «is it visible», not «is its silhouette in the box».
- **Known Φ2 bounds (documented, not silent):**
  1. the raw DXF wireframe is NOT part of the id-pass — 1px lines neither occlude nor get
     occluded reliably in an id buffer, so DXF stays select-through even with X-ray off;
  2. per-material section clipping planes are not copied onto the id materials, so geometry
     cut away by a section plane still counts as visible;
  3. the id target is capped at 1024 px/axis, so a very large drag downsamples and can miss an
     entity thinner than one target pixel.

## 6. Changelog
- **2026-07-24** — Φ1 implemented (uncommitted): 6 new modules + wiring in `BimViewport3D`,
  `scene-manager-actions`, `ThreeJsSceneManager`. SSoT verdict extracted; 2D path now consumes it.
- **2026-07-24** — **Φ2 implemented** (uncommitted): 6 new modules (`marquee-combine`,
  `resolve-dxf-marquee-selection`, `marquee-screen-geometry`, `dxf-marquee-3d-hit-test`,
  `marquee-gpu-id-pass`, `marquee-3d-apply`) + `MarqueeSelectThroughToggle` widget +
  `ViewMode3DStore.marqueeSelectThrough` + i18n (el/en) + View-tab «Εμφάνιση» entry.
  `applyBimMarqueeSelection` now delegates its combine math to the shared SSoT; the BIM
  crossing test now uses the shared `polylineIntersectsRect`; `worldToScreen` refactored onto
  a shared `ndcToScreenPx` + new bulk `createWorldToScreenProjector`. jest 29 new (marquee
  folder) / 203 in the touched areas ✓, jscpd:diff clean. 🔴 browser-untested.

## 7. Browser verification checklist (Φ2)
1. 3D + DXF underlay loaded → drag L→R around a group of plan lines ⇒ only fully-enclosed
   lines selected; R→L ⇒ everything the box touches.
2. Mixed drag over walls AND plan lines ⇒ both survive in the selection (grips + outline).
3. Shift+drag adds to an existing DXF selection; Ctrl+drag subtracts. Escape mid-drag = no change.
4. «Όλοι οι όροφοι» scope ⇒ lines from every visible floor are caught.
5. View tab → «Εμφάνιση» → «Διαμπερής Επιλογή» OFF ⇒ a wall fully hidden behind another wall is
   NOT selected by a box over it; ON ⇒ it is.
6. With the toggle OFF, confirm the viewport image does not flicker after the drag (the id pass
   renders to an off-screen target and restores the previous render target).
