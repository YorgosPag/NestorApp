# ADR-049: Unified Move Tool (DXF + Overlays)

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Last Updated** | 2026-06-21 |
| **Category** | Drawing System |
| **Canonical Location** | `MoveOverlayCommand.ts` + `hooks/tools/useMoveTool.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Overlay move**: `MoveOverlayCommand.ts` (380+ lines) — drag-based, Priority 7 click handler
- **DXF entity move**: `hooks/tools/useMoveTool.ts` — AutoCAD-style 2-click state machine
- **Pattern**: Command Pattern with undo/redo (`MoveEntityCommand`, `MoveMultipleEntitiesCommand`)

## Architecture — DXF Entity Move Tool (2026-05-11)

### State Machine

```
idle → awaiting-entity → awaiting-base-point → awaiting-destination → execute → awaiting-base-point
```

- **awaiting-entity**: no entities selected; clicks pass through for normal entity selection
- **awaiting-base-point**: entities selected; next click sets the anchor point
- **awaiting-destination**: rubber band + ghost preview active; next click applies move
- On execute: `MoveEntityCommand` (single) or `MoveMultipleEntitiesCommand` (batch)
- On Escape: clear preview, switch to 'select' tool
- Continuous mode: after execute, loops back to `awaiting-base-point`

### Files

| File | Role |
|------|------|
| `hooks/tools/useMoveTool.ts` | State machine hook — phases, click handler, ESC |
| `hooks/tools/useMovePreview.ts` | RAF ghost preview on PreviewCanvas — rubber band + ghost entities |
| `components/dxf-layout/canvas-layer-stack-leaves.tsx` | `MovePreviewMount` — ADR-040 micro-leaf subscriber |
| `core/commands/entity-commands/MoveEntityCommand.ts` | Single entity move command (existing) |
| `core/commands/entity-commands/MoveMultipleEntitiesCommand.ts` | Batch entity move command (existing) |

### Click Priority

Priority 1.55 in `useCanvasClickHandler.ts` — between rotation (1.5) and guides (1.6).

### Preview (ADR-040 compliant)

`MovePreviewMount` renders as a React micro-leaf in `CanvasLayerStack`. It calls `useMovePreview`
which draws directly on the `PreviewCanvas` element via RAF — zero React re-renders from mousemove.

Draws:
- Base point crosshair (red)
- Rubber band line: base → cursor (dashed gold)
- Displacement tooltip: `Δx, Δy` near cursor
- **SOLID, real-colour moving copy** translated by the current delta (AutoCAD/Revit
  parity — the copy that follows the cursor is the live entity), while the copy left
  at the original position is the translucent ghost.

### Inverted ghost model (which copy is the ghost) — SSoT

Both move flows obey ONE rule: **the moving copy is solid + real-colour; the copy at the
original position is the ghost** (`GHOST_DEFAULTS.alpha`).

- **Real-render SSoT (ADR-550)**: the moving copy is rendered by the REAL `EntityRendererComposite`
  (via `BimPreviewRenderer` → `rendering/ghost/draw-real-entity-preview.ts` `drawRealEntityPreview`),
  so it shows the full committed appearance (wall thickness+fill+hatch, column footprint+fill), not a
  silhouette. Style is resolved through the SAME `resolveEntityRenderStyle` SSoT the canvas uses
  (`canvas-v2/dxf-canvas/dxf-renderer-style-resolve.ts`) → byte-identical colour/lineweight/dash.
  Shared by `useMovePreview` + `useGripGhostPreview` (+ `useBimPreviewRenderer` for the ctx-bound
  renderer). The interim `ghost-solid-color.ts` was deleted (superseded by the real renderer).
- **2-click Move tool**: dims ALL selected originals via `movePreviewActive`
  (`movePreview.phase === 'awaiting-destination'`); solid copies on PreviewCanvas (`useMovePreview`).
- **Grip drag**: dims ONLY the single grabbed entity via `gripDraggedEntityId`
  (`dxfGripInteraction.dragPreview?.entityId`); its solid moving copy is on PreviewCanvas
  (`useGripGhostPreview`). Distinct from `movePreviewActive` because a grip drag moves one
  entity, not the whole selection. Followers (connected pipes / co-move partners) stay
  translucent ghosts — their originals are not dimmed, so a solid copy would double-image.
- The dim is applied at the single live-render choke point `dxf-canvas-renderer.ts` selected-
  entity loop (`movePreviewActive || selId === gripDraggedEntityId`) — the dragged entity is
  drawn live (not in the bitmap cache), so dimming costs no bitmap rebuild (ADR-040). The
  main canvas re-renders only on drag start/end (the id is a stable string through the drag).

## Changelog

| Date | Change |
|------|--------|
| 2026-01-01 | Initial: overlay drag move (`MoveOverlayCommand`) |
| 2026-05-11 | Added AutoCAD-style 2-click DXF entity move: `useMoveTool` + `useMovePreview` |
| 2026-05-12 | Fix: pre-selected overlay ignored by Move tool. `useMoveTool` now accepts `selectedOverlayIds` + `executeOverlayMove` props. `hasAnySelected` includes overlays; state machine enters `awaiting-base-point` when overlay(s) pre-selected. `handleMoveClick` dispatches `MoveOverlayCommand`/`MoveMultipleOverlaysCommand` when no DXF entities selected. `CanvasSection` passes `universalSelection.getIdsByType('overlay')` + `executeOverlayMove` callback. |
| 2026-05-12 | Fix: mixed selection (DXF + overlay) — entrambi i tipi ora si muovono insieme. `useMoveTool` accetta `createOverlayMoveCommand` factory; selezione mista → `CompoundCommand([MoveEntityCommand, MoveOverlayCommand])` → unico undo con Ctrl+Z. `CanvasSection` espone `createOverlayMoveCommand` callback. |
| 2026-05-12 | Fix: overlay vertex grips now illuminate in Move mode. `useLayerCanvasMouseMove` `isGripMode` extended to include `'move'` tool. Snap engine now receives overlay vertices: `useGlobalSnapSceneSync` upgraded to accept `overlays: Overlay[]` (converts via `overlaysToRegions` + `regionsToSnapEntities` internally); `CanvasSection` passes `currentOverlays`. |
| 2026-06-21 | **Phase 2 — True 3D vertical move unification (Revit `MoveElement(dx,dy,dz)`).** The 3D gizmo axis-Y (vertical) drag is no longer a separate `Update*ParamsCommand` path: it becomes the **z-component of the ONE `Move(Multiple)EntityCommand`**. (a) `MoveEntityCommand`/`MoveMultiple` `delta` widened `Point2D → Point3D` (optional `z` = ELEVATION delta in **raw mm**; plan x/y stay native canvas units). `reverseDelta`/`mergeWith`/`validate` (pure-vertical x=y=0,z≠0 now valid)/`getDelta` all carry z; the shared cascade signatures (`move-entity-cascade`, `cascade-connected-pipes-by-delta`, `slab-opening-move-cascade`) widened to `Point3D` so connected pipes follow a vertical host move too. (b) **z-branch in the polymorphic geometry SSoT** `calculateBimMovedGeometry`: after the plan move, vertical-capable types (wall/column `baseOffset`, beam `topElevation`, slab `levelElevation`, stair `basePoint.z` via drawing-unit factor, MEP point-hosts `mountingElevationMm`, MEP segment endpoint z's) apply their per-type elevation computer — **REUSING** the 6+1 existing computers (zero duplication). (c) **Re-home (boy-scout):** the computers moved `bim-3d/gizmo/bim3d-vertical-move.ts → bim/utils/bim-vertical-move.ts` (re-export shim kept) and `mmToEntityUnitFactor` extracted to NEW Three-free `bim/utils/entity-unit-factor.ts` (re-exported from `bim3d-edit-math`) so the pure command/geometry path never pulls Three.js. (d) **Builders unified:** `buildEditCommand`'s move branch now builds ONE `Move(Multiple)EntityCommand{dx,dy,dz}` for plan / pure-vertical / combined-plane drags alike; deleted `buildVerticalMoveCommand` + `verticalCommandForEntity` + `buildMepCombinedMoveCommand` + the now-dead `bim3d-edit-mep-commands.ts`. The Move command self-emits `bim:entities-moved` (∈ ORGANISM + AUTO_DESIGN events) → `emitStructuralChangeAfterEdit` correctly SKIPS the per-kind `params-updated` (no double announce); persistence covered for wall/column/beam/slab/MEP via `useBimEntityMovedPersistEffect`, for stair via its selection-watch auto-save (unchanged). tsc clean; jest green (+NEW z-branch + 3D-delta suites). 🔴 PENDING: browser-verify (3D gizmo axis-Y on wall/column/beam/slab/stair/MEP → elevation persists reload-survives; combined plane drag → 1 undo; Ctrl+Z one step) + commit. |
| 2026-06-21 | **Revit-grade move unification (Phase 0+1) — associative reactions live IN the command, not per entry point.** The pipeline was already ~90% unified (all plan moves → `Move(Multiple)EntityCommand` → `calculateMovedGeometry` → `bim:entities-moved` → undo + cascade). Closed 4 gaps/dups so EVERY gesture (move-tool / drag / nudge / 3D gizmo plan) inherits the full cascade: **(κενό 1)** slab→slab-opening cascade moved from a Move-Tool-only selection-expansion (`expandSelectionForMove`, deleted) INTO the command via NEW `cascadeMovedSlabOpenings` (`bim/cascade/slab-opening-move-cascade.ts`, mirror of `cascadeHostedOpeningsForWalls`); **(κενό 2)** MEP connected-pipe follow moved from 3D-gizmo-only (`withConnectedPipeFollow`) INTO the command via NEW `cascadeConnectedPipesByDelta` (`bim/mep-segments/cascade-connected-pipes-by-delta.ts`, reuses `resolve*ConnectedPipePatches`); the 3D plan-move branch no longer wraps `withConnectedPipeFollow` (avoids double-follow; rotate/vertical still wrap it); **(κενό 4)** `useMoveEntities` inline `ISceneManager` adapter now delegates to the canonical `LevelSceneManagerAdapter` (gains the `pendingScene` batch-cache); the two grip adapters (`useGripMovement`, `grip-scene-manager-adapter`) documented as deliberate grip-specialized siblings (circle-radius/arc/rectangle vertex semantics the canonical doesn't model); **(κενό 5)** the two identical grid-snap helpers (`snapToGrid`/`snapDeltaToGrid`) unified into NEW leaf `systems/grid/grid-snap.ts`. The shared forward/undo cascade ORDERING (pipes→updates→wall-openings→slab-openings→reframe+emit / emit-first→reverse) extracted into NEW SSoT `move-entity-cascade.ts` (`runMoveForwardCascade`/`runMoveUndoCascade`) so both commands stay byte-for-byte in sync. Persistence verified: slab-openings + pipes persist via the per-type `useBimEntityMovedPersistEffect` (`bim:entities-moved`). tsc clean; jest green (+NEW suites for both cascade helpers). 🔴 PENDING: browser-verify (drag slab → openings follow in 1 undo; 2D move MEP → pipe follows) + commit. Phase 2 (true 3D vertical unification — `MoveElement(dx,dy,dz)`) deferred to its own gated step. |
| 2026-06-24 | **Snap/round helper consolidation (FULL-SSoT snap unification, Step 3).** Three remaining byte-identical round/snap duplicates that bypassed existing SSoTs were eliminated — all pure reuse, zero new code: (1) `bim/columns/column-adjacency-detector.ts` private `snapToGrid(poly,tol)` → reuses the ADR-049 `systems/grid/grid-snap.ts` `snapToGrid` per-vertex (same path `structural-finish-silhouette.ts` already uses for weld-quantization); (2) the two identical private `snapToIncrement(value,increment)` in `hooks/tools/useOpeningGhostPreview.ts` + `hooks/drawing/opening-completion.ts` → reuse the scalar SSoT `quantizeMagnitude` (`systems/tracking/adaptive-distance-snap.ts`, ADR-357 — same `round(v/step)*step` with a more robust non-positive guard); (3) the two identical private `quantizeToDominantAxis(delta)` in `bim/roofs/roof-grips.ts` + `bim/mep-underfloor/mep-underfloor-grips.ts` → reuse the ORTHO/F8 SSoT `constrainDeltaToDominantAxis` (`bim/grips/ortho-delta.ts`, ADR-294). tsc clean on touched files. 🔴 PENDING: browser-verify (column adjacency merge; opening 50mm increment ghost+commit; roof/underfloor rectilinear grip drag) + commit. |
| 2026-06-24 | **Shift fine 1 cm step — extended to WALL DRAWING (Giorgio).** The same Shift increment now also drives the **new-wall draw** endpoint, not just the move of an existing member. New point-form of the SSoT in `bim/grips/grip-move-constraints.ts` → `applyMoveFineStepAboutAnchor(point, anchor)` (quantizes `point − anchor` to 1 cm; reuses `applyMoveFineStep`). The wall precedence gate lives once in `bim/walls/wall-endpoint-snap.ts` → `resolveWallEndpointWithFineStep(snap, start)`: **face-snap wins** (when the end flush-snapped to a member face, `snap.faceFrame` set → flush point verbatim), otherwise (free space) the endpoint steps in 1 cm relative to the start (no-op when Shift up). The ONE helper is called by BOTH the preview (`wall-preview-helpers.ts generateWallPreview` awaiting-end branch) and the commit (`useWallTool.ts` awaitingEnd) → preview ≡ commit. Precedence overall: length/angle lock (Δαχτυλίδι) > face-snap > Shift-1cm-step. 4 new jest in `wall-endpoint-snap.test.ts` + 1 in `grip-move-constraints.test.ts` GREEN. ⚠️ CHECK 6D (wall drawing path touched) → stage ADR-040 alongside at commit. 🔴 PENDING: browser-verify (Shift-draw new wall in free space → 1 cm steps; near a face → flush wins) + commit. |
| 2026-06-24 | **Shift fine 1 cm move-increment (Giorgio) — Revit «move snap increment».** While **Shift** is held during a whole-entity move DRAG (wall / column / beam / any `movesEntity` grip / Alt move-from-base / wall "move" hot-grip), the move **delta** is quantized to multiples of **1 cm** (Option Α — step of the displacement, so a wall at 1003 mm steps 1013→1023→…, keeping its sub-grid offset). Implemented as ONE pure layer **inside the existing move-delta SSoT** `bim/grips/grip-move-constraints.ts` → `applyMoveFineStep` + `isMoveFineStepActive` (reads the live `ShiftKeyTracker`), composed last in `applyMoveConstraints` (ORTHO → F9-step → Shift-1cm). Because both the preview ghost (`grip-projections.ts buildDxfDragPreview`) and the commit (`grip-mouseup-handler.ts runGripMouseUp`) already funnel whole-entity moves through `applyMoveConstraints`, the step is WYSIWYG everywhere with **zero new wiring**. **Full SSoT reuse:** `quantizeDeltaToStep` (grip-step-quantize core) + `immediateSceneScale.getMmToScene()` (mm→scene) — no new rounding helper, no hardcoded unit factor. **Conflict resolved (Giorgio):** Alt is unavailable (it IS the `GripAltMoveStore` move-from-base-point trigger); Shift was free on the whole-entity DRAG path (its `ShiftKeyTracker` rectilinear/arm roles are parametric-resize / <4px click only). The Shift layer lives in the move-only module, NOT in the parametric-shared `applyGripStepSnap`. 7 new jest (+18 existing in the suite) GREEN. 🔴 PENDING: browser-verify (Shift-drag wall/column/beam → clean 1 cm steps; release → free) + commit. |
| 2026-06-21 | **Phase 3 — associative followers in EVERY transform, not just move (cross-ref ADR-507 §8 / ADR-408 Φ-C).** Phase 0+1 brought pipe-follow + slab-opening-follow INTO the Move command; Phase 3 closes the same gap for **rotate/scale/mirror**: the delta-based cascade helpers were generalised into transform-agnostic engines — `cascadeConnectedPipesByDelta` → NEW `bim/mep-segments/cascade-connected-pipes.ts` (`cascadeConnectedPipes(ids, sm, computeNextParams)`), `cascadeMovedSlabOpenings` → NEW `bim/cascade/cascade-transformed-slab-openings.ts` (both keep the move file as a thin delta wrapper). The `SnapshotTransformCommand` spine now self-cascades both followers via `runForwardFollowerCascades()` (feeding `computeUpdates`, OLD→NEW before the host patch, snapshot-symmetric undo), so 2D rotate/scale/mirror of an MEP host follows its pipes and a transformed slab carries its openings — in EVERY gesture (2D + 3D). The 3D builder's rotate `withConnectedPipeFollow` wrap was removed (the command self-cascades now; only `endpoint-move` still wraps). The pose-based resolver (`resolve*ConnectedPipePatches`, «rotation covered for free») is reused verbatim — zero new geometry math. 18 jest GREEN (engines + spine wiring) + 149 existing cascade/transform GREEN. 🔴 PENDING: browser-verify (2D+3D rotate/scale/mirror MEP host → pipes follow; rotate slab → openings follow; persist reload; Ctrl+Z one step) + commit. |
| 2026-06-29 | **Inverted ghost (Giorgio) — moving copy SOLID, original-position copy GHOST (AutoCAD/Revit parity), for the GRIP-DRAG flow.** Before: dragging a selected entity's grip painted a translucent cyan ghost at the cursor while the REAL entity stayed full-colour at the origin — the inverse of the big players. The 2-click Move tool was already correct (solid destination + dimmed origin via `movePreviewActive`); only the grip-drag flow was inverted. Fix mirrors the Move tool with ZERO new mechanism: (1) NEW thin SSoT `rendering/ghost/ghost-solid-color.ts` → `resolveGhostSolidColor(entity)` that **delegates to the canonical `resolveEntityColorHex`** (`systems/selection/select-similar-by-color.ts`, the effective-rendered-hex resolver already used by Select-Similar + column-batch-fill + DXF export) against `getLayersById()` — so the moving copy gets the EXACT canvas colour for ByLayer/ByBlock/ACI/TrueColor/BIM, not a simplified approximation. This replaced `useMovePreview`'s inline simplified `!color||ByLayer||ByBlock?layer.color:color` idiom (a mini-duplicate of that resolver) so BOTH preview hooks now share ONE colour rule (removed the dup + the now-dead `getLayer` import in `useMovePreview`); (2) `useGripGhostPreview` moving copy → `globalAlpha = 1.0` + `resolveGhostSolidColor` (was `GHOST_DEFAULTS.alpha` + cyan); followers (connected pipes / co-move partners) stay translucent ghosts (their originals are not dimmed → solid would double-image); (3) NEW `DxfRenderOptions.gripDraggedEntityId` (`= dxfGripInteraction.dragPreview?.entityId`, a stable STRING through the drag) plumbed `CanvasLayerStack → canvas-layer-stack-leaves → dxf-canvas-renderer`; the selected-entity live-render loop dims the origin via `movePreviewActive || selId === gripDraggedEntityId` — reusing the EXISTING ghost-dim path (DxfRenderer untouched). Dragged entity is drawn live (not bitmap-cached) → no bitmap rebuild; main canvas re-renders only on drag start/end (ADR-040 static-main-canvas preserved). One field dims ONLY the grabbed entity (not the whole selection — a grip drag moves one entity). 6 new jest (`ghost-solid-color.test.ts`) GREEN. ⚠️ CHECK 6B/6D (`dxf-canvas-renderer.ts` + `CanvasLayerStack.tsx` touched) → stage ADR-040 alongside. 🔴 PENDING: browser-verify (grip-drag any entity → solid real-colour copy follows cursor, dimmed ghost stays at origin; multi-select grip-drag → only the grabbed one dims; pipe/partner followers translucent) + commit. |
| 2026-06-29 | **WYSIWYG moving copy — real renderer supersedes the interim solid-colour ghost (ADR-550 §Φ-Preview2D).** Evolution of the row above: instead of the simplified `drawGhostEntity` (silhouette) coloured by `resolveGhostSolidColor`, the moving copy of BOTH flows now renders through the REAL `EntityRendererComposite` via `BimPreviewRenderer` → NEW `rendering/ghost/draw-real-entity-preview.ts` (`drawRealEntityPreview`), so the preview shows the entity's FULL committed appearance (wall thickness+fill+poché+material hatch, column footprint+fill) — universal for all types (the composite dispatches). Style resolved via NEW exported SSoT `resolveEntityRenderStyle` (extracted verbatim from the private `DxfRenderer.resolveStyleForRender`) so preview ≡ canvas (ByLayer/ACI/TrueColor). NEW shared `hooks/tools/useBimPreviewRenderer.ts` (lazy ctx-bound renderer, dedup of the per-hook boilerplate). `apply-entity-preview.ts` now recomputes geometry for slab/slab-opening/roof/floor-finish (real renderer reads `.geometry`). **Deleted** the now-dead `ghost-solid-color.ts` (+test). Followers stay translucent `drawGhostEntity`. Out of scope (flagged): Stretch/Scale/Rotate tool hooks keep their own simplified ghost. 60 jest GREEN; tsc clean on touched files. ⚠️ CHECK 6B/6D → stage ADR-040+550. 🔴 PENDING: browser-verify (wall reshape → real body tracks cursor; roof perf; raw DXF ByLayer colour; MOVE multi-select) + commit. |
