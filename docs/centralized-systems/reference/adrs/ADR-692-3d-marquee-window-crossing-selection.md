# ADR-692 — 3D Window/Crossing Marquee Selection

> Renumbered from ADR-691 (that number was taken by imported-mesh-embedded-material-extraction).

**Status:** Φ1 IMPLEMENTED (uncommitted) · Φ2/Φ3 PLANNED
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

### Semantics
- **WINDOW (L→R):** every projected AABB corner inside the rect ⇒ the convex silhouette is
  fully enclosed. Blue solid rectangle.
- **CROSSING (R→L):** convex hull of the projected corners intersects the rect. Green dashed.
- **Combine modes** (frozen at mousedown): plain = replace, Shift = add, Ctrl/Cmd = subtract.
  Alt is reserved (tumble / orbit-pivot). Escape cancels without changing selection.
- **Occlusion (Φ1):** select-through (occlusion-agnostic projection). This is the CAD default
  (Revit/AutoCAD select behind-objects in a box).

### OrbitControls coordination
Left-drag is claimed for the marquee, so controls are suspended for the gesture's lifetime
(same `setControlsEnabled(false/true)` pattern as `use-bim3d-opening-move`). This makes the
gesture identical in perspective and ortho; pan stays on middle/right per OrbitControls.

## 4. Phasing

- **Φ1 (this ADR, implemented):** foundation + select-through CPU marquee for BIM entities;
  rubber-band overlay; window/crossing; add/subtract/replace; escape; controls coordination.
- **Φ2 (planned):** DXF-wireframe hit inclusion (across floors) + **GPU id-picking pass** for
  pixel-exact **visible-only** mode and the **X-ray toggle** (select-through ↔ visible-only).
  Scaffold on `scene/sized-render-target.ts` + the `SelectionOutlinePass` RT pattern; async
  readback (PBO/`fenceSync`) to avoid `readPixels` stalls.
- **Φ3 (planned):** polish/perf — auto-pan at viewport edges, live selection-count HUD, BVH
  broad-phase for tens-of-thousands of meshes, throttling, i18n, jest coverage for hit-test.

## 5. Consequences
- 3D viewport gains professional multi-select. No change to 2D.
- `ThreeJsSceneManager` grows one public method (watch the 500-line cap, N.7.1).
- Φ1 window/crossing precision is AABB-corner based; true per-mesh silhouette / occlusion
  arrives with the Φ2 GPU pass. Documented as a known Φ1 bound, not a defect.

## 6. Changelog
- **2026-07-24** — Φ1 implemented (uncommitted): 6 new modules + wiring in `BimViewport3D`,
  `scene-manager-actions`, `ThreeJsSceneManager`. SSoT verdict extracted; 2D path now consumes it.
