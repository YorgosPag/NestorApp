# ADR-049: Unified Move Tool (DXF + Overlays)

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Last Updated** | 2026-05-12 |
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
- Ghost entities (blue, 40% opacity) translated by current delta

## Changelog

| Date | Change |
|------|--------|
| 2026-01-01 | Initial: overlay drag move (`MoveOverlayCommand`) |
| 2026-05-11 | Added AutoCAD-style 2-click DXF entity move: `useMoveTool` + `useMovePreview` |
| 2026-05-12 | Fix: pre-selected overlay ignored by Move tool. `useMoveTool` now accepts `selectedOverlayIds` + `executeOverlayMove` props. `hasAnySelected` includes overlays; state machine enters `awaiting-base-point` when overlay(s) pre-selected. `handleMoveClick` dispatches `MoveOverlayCommand`/`MoveMultipleOverlaysCommand` when no DXF entities selected. `CanvasSection` passes `universalSelection.getIdsByType('overlay')` + `executeOverlayMove` callback. |
| 2026-05-12 | Fix: mixed selection (DXF + overlay) — entrambi i tipi ora si muovono insieme. `useMoveTool` accetta `createOverlayMoveCommand` factory; selezione mista → `CompoundCommand([MoveEntityCommand, MoveOverlayCommand])` → unico undo con Ctrl+Z. `CanvasSection` espone `createOverlayMoveCommand` callback. |
| 2026-05-12 | Fix: overlay vertex grips now illuminate in Move mode. `useLayerCanvasMouseMove` `isGripMode` extended to include `'move'` tool. Snap engine now receives overlay vertices: `useGlobalSnapSceneSync` upgraded to accept `overlays: Overlay[]` (converts via `overlaysToRegions` + `regionsToSnapEntities` internally); `CanvasSection` passes `currentOverlays`. |
| 2026-06-21 | **Revit-grade move unification (Phase 0+1) — associative reactions live IN the command, not per entry point.** The pipeline was already ~90% unified (all plan moves → `Move(Multiple)EntityCommand` → `calculateMovedGeometry` → `bim:entities-moved` → undo + cascade). Closed 4 gaps/dups so EVERY gesture (move-tool / drag / nudge / 3D gizmo plan) inherits the full cascade: **(κενό 1)** slab→slab-opening cascade moved from a Move-Tool-only selection-expansion (`expandSelectionForMove`, deleted) INTO the command via NEW `cascadeMovedSlabOpenings` (`bim/cascade/slab-opening-move-cascade.ts`, mirror of `cascadeHostedOpeningsForWalls`); **(κενό 2)** MEP connected-pipe follow moved from 3D-gizmo-only (`withConnectedPipeFollow`) INTO the command via NEW `cascadeConnectedPipesByDelta` (`bim/mep-segments/cascade-connected-pipes-by-delta.ts`, reuses `resolve*ConnectedPipePatches`); the 3D plan-move branch no longer wraps `withConnectedPipeFollow` (avoids double-follow; rotate/vertical still wrap it); **(κενό 4)** `useMoveEntities` inline `ISceneManager` adapter now delegates to the canonical `LevelSceneManagerAdapter` (gains the `pendingScene` batch-cache); the two grip adapters (`useGripMovement`, `grip-scene-manager-adapter`) documented as deliberate grip-specialized siblings (circle-radius/arc/rectangle vertex semantics the canonical doesn't model); **(κενό 5)** the two identical grid-snap helpers (`snapToGrid`/`snapDeltaToGrid`) unified into NEW leaf `systems/grid/grid-snap.ts`. The shared forward/undo cascade ORDERING (pipes→updates→wall-openings→slab-openings→reframe+emit / emit-first→reverse) extracted into NEW SSoT `move-entity-cascade.ts` (`runMoveForwardCascade`/`runMoveUndoCascade`) so both commands stay byte-for-byte in sync. Persistence verified: slab-openings + pipes persist via the per-type `useBimEntityMovedPersistEffect` (`bim:entities-moved`). tsc clean; jest green (+NEW suites for both cascade helpers). 🔴 PENDING: browser-verify (drag slab → openings follow in 1 undo; 2D move MEP → pipe follows) + commit. Phase 2 (true 3D vertical unification — `MoveElement(dx,dy,dz)`) deferred to its own gated step. |
