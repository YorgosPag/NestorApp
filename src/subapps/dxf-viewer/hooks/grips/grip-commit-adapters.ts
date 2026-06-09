/**
 * ADR-183: Unified Grip System — Commit Adapters
 *
 * Adapters that know how to COMMIT a grip drag for each source system.
 * Extracted from useDxfGripInteraction (DXF) and useCanvasMouse (overlay).
 *
 * Pattern: Strategy — the unified hook delegates commit to the right adapter
 * based on `grip.source`.
 *
 * @see useDxfGripInteraction.ts — original DXF commit (commitGripDelta, createSceneManagerAdapter)
 * @see useCanvasMouse.ts — original overlay commit (handleContainerMouseUp)
 * @see grip-scene-manager-adapter.ts — ISceneManager adapter (split for N.7.1 file-size compliance)
 */
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import type { VertexMovement } from '../../core/commands';
import type { SceneModel } from '../../types/scene';
import type { useOverlayStore } from '../../overlays/overlay-store';
import type { UnifiedGripInfo } from './unified-grip-types';
import { type GripMode } from '../../systems/grip/grip-mode-cycle';
import { GripHandoffStore } from '../../systems/grip/GripHandoffStore';
import { gripToVertexRefs } from '../../systems/grip/grip-to-vertex-refs';
import { StretchEntityCommand, type StretchParams } from '../../core/commands/entity-commands/StretchEntityCommand';
import { CopyEntityCommand, type CopyEntityParams } from '../../core/commands/entity-commands/CopyEntityCommand';
import { GripCopyModeStore } from '../../systems/grip/GripCopyModeStore';
import { AltKeyTracker } from '../../keyboard/AltKeyTracker';
import { CtrlKeyTracker } from '../../keyboard/CtrlKeyTracker';
import type { Entity } from '../../types/entities';
export type { DxfCommitDeps, OverlayCommitDeps } from './unified-grip-types';
import type { DxfCommitDeps, OverlayCommitDeps } from './unified-grip-types';
// ISceneManager adapter extracted to sibling module (N.7.1 file-size compliance)
export { createSceneManagerAdapter } from './grip-scene-manager-adapter';
import { createSceneManagerAdapter } from './grip-scene-manager-adapter';
// ============================================================================
// DXF GRIP COMMIT
// ============================================================================
/** ADR-349 Phase 1c-B3 — commit via StretchEntityCommand (vertex refs or anchor moves). */
export function commitDxfGripDragViaStretchCommand(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (delta.x === 0 && delta.y === 0) return;
  if (!grip.entityId) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const entity = sceneManager.getEntity(grip.entityId);
  if (!entity) return;
  const refs = gripToVertexRefs(entity as unknown as Entity, grip);
  const vertexMoves = refs.length > 0 ? [{ entityId: grip.entityId, refs }] : [];
  const anchorMoves = refs.length === 0 && grip.movesEntity ? [grip.entityId] : [];
  if (vertexMoves.length === 0 && anchorMoves.length === 0) return;

  // ADR-357 Phase 12 — when the grip-context-menu "Copy" toggle is ON, route
  // through `CopyEntityCommand` so the source entity is preserved and a fresh
  // clone receives the displacement. Same vertex / anchor split as Stretch.
  if (GripCopyModeStore.getSnapshot().enabled) {
    const params: CopyEntityParams = { vertexMoves, anchorMoves, displacement: delta };
    const command = new CopyEntityCommand(params, sceneManager);
    if (command.validate() !== null) return;
    deps.execute(command);
    GripCopyModeStore.bumpCount();
    return;
  }

  const params: StretchParams = { vertexMoves, anchorMoves, displacement: delta };
  const command = new StretchEntityCommand(params, sceneManager);
  if (command.validate() !== null) return;
  deps.execute(command);
}
// Parametric commit handlers moved to ./grip-parametric-commits.ts
import {
  commitStairGripDrag,
  commitWallGripDrag,
  commitOpeningGripDrag,
  commitSlabGripDrag,
  commitSlabOpeningGripDrag,
  commitRoofGripDrag,
  commitBeamGripDrag,
  commitColumnGripDrag,
  commitMepFixtureGripDrag,
  commitElectricalPanelGripDrag,
  commitMepManifoldGripDrag,
  commitMepManifoldOutletCountGrip,
  commitMepRadiatorGripDrag,
  commitMepBoilerGripDrag,
  commitMepWaterHeaterGripDrag,
  commitMepSegmentGripDrag,
  commitFurnitureGripDrag,
  commitFloorplanSymbolGripDrag,
  commitFloorFinishGripDrag,
  commitMepUnderfloorGripDrag,
  commitXLineGripDrag,
  commitRayGripDrag,
  commitDimensionGripDrag,
} from './grip-parametric-commits';
/**
 * ADR-363 Phase 1G.5 — whole-entity "move from characteristic point" (AutoCAD
 * base-point move). Translates the ENTIRE entity by `delta` via
 * `deps.moveEntities` (→ MoveEntityCommand → `calculateBimMovedGeometry`), or
 * clones it with the same displacement when `copy` is set (CopyEntityCommand,
 * copy-with-base-point). Shared SSoT for the `mode === 'move'` branch AND the
 * Alt-modifier bypass so both routes stay byte-identical.
 */
function commitWholeEntityMove(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
  copy: boolean,
): void {
  if (!grip.entityId) return;
  if (copy) {
    const sceneManager = createSceneManagerAdapter(deps);
    if (!sceneManager) return;
    const params: CopyEntityParams = { vertexMoves: [], anchorMoves: [grip.entityId], displacement: delta };
    const command = new CopyEntityCommand(params, sceneManager);
    if (command.validate() !== null) return;
    deps.execute(command);
    GripCopyModeStore.bumpCount();
    return;
  }
  deps.moveEntities([grip.entityId], delta, { isDragging: false });
}

/** ADR-349 Phase 1c-A/B2/B3 — mode-aware DXF grip commit (stretch/move/rotate/scale/mirror). */
export function commitDxfGripDragModeAware(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
  mode: GripMode,
): void {
  // Opening flip actions (Revit-style «Flip Hand» + «Flip Facing») are click-to-toggle
  // — they must fire even on zero delta (no drag), so they precede the zero-delta guard.
  if (grip.openingGripKind === 'opening-rotation' || grip.openingGripKind === 'opening-facing') {
    commitOpeningGripDrag(grip, delta, deps);
    return;
  }
  // ADR-408 Φ12 — manifold outlet add/remove are single-click ACTION grips (Revit
  // "array control" ▲/▼): they bump `outletCount` ±1 and must fire even on zero
  // delta (no drag), so they also precede the zero-delta guard.
  if (
    grip.mepManifoldGripKind === 'mep-manifold-outlet-add' ||
    grip.mepManifoldGripKind === 'mep-manifold-outlet-remove'
  ) {
    commitMepManifoldOutletCountGrip(grip, deps);
    return;
  }
  if (delta.x === 0 && delta.y === 0) return;
  if (!grip.entityId) return;
  // ADR-363 Phase 1G.5 — Alt held → whole-entity "move from characteristic
  // point" (AutoCAD base-point move). Bypasses EVERY parametric grip path
  // below: the grabbed grip (corner / endpoint / midpoint / thickness / corner-
  // resize) becomes the base point — `delta` is already measured from
  // `grip.position` upstream (`runGripMouseUp`) — so the WHOLE entity
  // translates instead of reshaping. Alt+Ctrl (or the right-click Copy toggle)
  // clones with the same base point. This is the SOLE move-from-point path for
  // params-driven BIM entities, whose parametric returns otherwise pre-empt the
  // `mode === 'move'` branch far below.
  if (AltKeyTracker.getSnapshot()) {
    const copy = GripCopyModeStore.getSnapshot().enabled || CtrlKeyTracker.getSnapshot();
    commitWholeEntityMove(grip, delta, deps, copy);
    return;
  }
  // ADR-358 Phase 5b — stair parametric grip path (5 kinds, §5.12).
  if (grip.stairGripKind) {
    commitStairGripDrag(grip, delta, deps);
    return;
  }
  // ADR-362 Phase I2 — dimension grip path (defPoints / textMidpoint / rotation).
  if (grip.dimGripKind) {
    commitDimensionGripDrag(grip, delta, deps);
    return;
  }
  // ADR-363 Phase 1C — wall parametric grip path (endpoint / midpoint /
  // thickness / curve / polyline-vertex). Bypasses stretch because walls are
  // params-driven (geometry recomputed atomically by UpdateWallParamsCommand).
  if (grip.wallGripKind) {
    commitWallGripDrag(grip, delta, deps);
    return;
  }
  // ADR-363 Phase 2.5 — opening parametric grip path (drag-along-wall).
  // Bypasses stretch because openings are params-driven (offsetFromStart) and
  // their geometry is host-wall-relative; commit recomputes via
  // `UpdateOpeningParamsCommand` after axis projection + clamp.
  if (grip.openingGripKind) {
    commitOpeningGripDrag(grip, delta, deps);
    return;
  }
  // ADR-363 Phase 3.5 — slab parametric grip path (per-vertex translate).
  // Bypasses stretch because slabs are params-driven (outline polygon) and
  // geometry (area / netArea / volume / perimeter / bbox) is recomputed
  // atomically by UpdateSlabParamsCommand.
  if (grip.slabGripKind) {
    commitSlabGripDrag(grip, delta, deps);
    return;
  }
  // ADR-363 Phase 3.7a — slab-opening parametric grip path (per-vertex
  // translate + edge-midpoint insertion). Bypasses stretch because
  // slab-openings are params-driven (outline polygon) και geometry
  // (area / perimeter / bbox) is recomputed atomically by
  // UpdateSlabOpeningParamsCommand.
  if (grip.slabOpeningGripKind) {
    commitSlabOpeningGripDrag(grip, delta, deps);
    return;
  }
  // ADR-417 Φ1-part-2 #2 — roof parametric grip path (per-vertex translate +
  // edge-midpoint insertion). Bypasses stretch because roofs are params-driven
  // (footprint outline + per-edge slopes) and geometry (faces / ridges / areas /
  // bbox) is recomputed atomically by UpdateRoofParamsCommand.
  if (grip.roofGripKind) {
    commitRoofGripDrag(grip, delta, deps);
    return;
  }
  // ADR-363 Phase 5.5a — beam parametric grip path (start/end/midpoint
  // translate + curve control move). Bypasses stretch because beams are
  // params-driven (axis endpoints + optional Bezier control) και geometry
  // (axisPolyline / outline / length / area / volume / bbox) is recomputed
  // atomically by UpdateBeamParamsCommand.
  if (grip.beamGripKind) {
    commitBeamGripDrag(grip, delta, deps);
    return;
  }
  // ADR-363 Phase 4.5 — column parametric grip path (center translate +
  // rotation + width/depth resize). Bypasses stretch because columns are
  // params-driven (position + kind + anchor + width/depth/height/rotation)
  // και geometry (footprint / bbox / area / volume) is recomputed atomically
  // by UpdateColumnParamsCommand.
  if (grip.columnGripKind) {
    commitColumnGripDrag(grip, delta, deps);
    return;
  }
  // ADR-406 — MEP fixture parametric grip path (center translate + rotation +
  // opposite-corner-anchored width/length resize). Bypasses stretch because the
  // fixture is params-driven; UpdateMepFixtureParamsCommand recomputes geometry.
  if (grip.mepFixtureGripKind) {
    commitMepFixtureGripDrag(grip, delta, deps);
    return;
  }
  // ADR-408 Φ3 — electrical panel parametric grip path (center translate +
  // rotation + opposite-corner-anchored width/length resize). Bypasses stretch
  // because the panel is params-driven; UpdateElectricalPanelParamsCommand
  // recomputes geometry.
  if (grip.electricalPanelGripKind) {
    commitElectricalPanelGripDrag(grip, delta, deps);
    return;
  }
  // ADR-408 Φ12 — MEP manifold parametric grip path (center translate +
  // rotation + opposite-corner-anchored width/length resize). Bypasses stretch
  // because the manifold is params-driven; UpdateMepManifoldParamsCommand
  // recomputes geometry.
  if (grip.mepManifoldGripKind) {
    commitMepManifoldGripDrag(grip, delta, deps);
    return;
  }
  // ADR-408 Εύρος Β — heating radiator parametric grip path (center translate +
  // rotation + opposite-corner-anchored width/length resize). Bypasses stretch
  // because the radiator is params-driven; UpdateMepRadiatorParamsCommand
  // recomputes geometry + re-seeds connectors.
  if (grip.mepRadiatorGripKind) {
    commitMepRadiatorGripDrag(grip, delta, deps);
    return;
  }
  // ADR-408 Εύρος Β #2 — heating boiler parametric grip path (center translate +
  // rotation + opposite-corner-anchored width/length resize). Bypasses stretch
  // because the boiler is params-driven; UpdateMepBoilerParamsCommand
  // recomputes geometry + re-seeds connectors.
  if (grip.mepBoilerGripKind) {
    commitMepBoilerGripDrag(grip, delta, deps);
    return;
  }
  // ADR-408 DHW — domestic hot water heater parametric grip path (center translate +
  // rotation + opposite-corner-anchored width/length resize). Bypasses stretch
  // because the water heater is params-driven; UpdateMepWaterHeaterParamsCommand
  // recomputes geometry + re-seeds connectors.
  if (grip.mepWaterHeaterGripKind) {
    commitMepWaterHeaterGripDrag(grip, delta, deps);
    return;
  }
  // ADR-408 Φ8/Φ15 — MEP segment parametric grip path (start/end/midpoint
  // translate + section resize + rotation; vertical riser = whole-entity move).
  // Bypasses stretch/move because segments are params-driven (axis endpoints);
  // UpdateMepSegmentParamsCommand recomputes geometry atomically.
  if (grip.mepSegmentGripKind) {
    commitMepSegmentGripDrag(grip, delta, deps);
    return;
  }
  // ADR-410 — furniture parametric grip path (center translate + rotation +
  // opposite-corner-anchored width/depth resize). Bypasses stretch because the
  // furniture is params-driven; UpdateFurnitureParamsCommand recomputes geometry.
  if (grip.furnitureGripKind) {
    commitFurnitureGripDrag(grip, delta, deps);
    return;
  }
  // ADR-415 — floorplan-symbol parametric grip path (center translate + rotation +
  // opposite-corner-anchored width/depth resize). Bypasses stretch because the
  // symbol is params-driven; UpdateFloorplanSymbolParamsCommand recomputes geometry.
  if (grip.floorplanSymbolGripKind) {
    commitFloorplanSymbolGripDrag(grip, delta, deps);
    return;
  }
  // ADR-419 — floor-finish parametric grip path (per-vertex translate +
  // edge-midpoint insertion). Bypasses stretch because floor-finishes are
  // params-driven (footprint polygon); UpdateFloorFinishParamsCommand recomputes
  // geometry atomically. Mirrors slab/roof path.
  if (grip.floorFinishGripKind) {
    commitFloorFinishGripDrag(grip, delta, deps);
    return;
  }
  // ADR-408 Εύρος Β #3 — underfloor heating loop parametric grip path (per-vertex
  // translate + edge-midpoint insertion). Bypasses stretch because the entity is
  // params-driven (footprint polygon + connector re-derivation);
  // UpdateMepUnderfloorParamsCommand recomputes geometry + connectors atomically.
  // Mirrors floor-finish path.
  if (grip.mepUnderfloorGripKind) {
    commitMepUnderfloorGripDrag(grip, delta, deps);
    return;
  }
  // ADR-359 Phase 11 — XLine grip path (basePoint translate or direction rotate).
  // Bypasses stretch because XLine has no vertex array.
  if (grip.xlineGripKind) {
    commitXLineGripDrag(grip, delta, deps);
    return;
  }
  // ADR-359 Phase 11 — Ray grip path (basePoint translate or direction rotate).
  if (grip.rayGripKind) {
    commitRayGripDrag(grip, delta, deps);
    return;
  }
  // ADR-357 Phase 12 — copy toggle gates routing for every mode.
  const copyOn = GripCopyModeStore.getSnapshot().enabled;

  if (mode === 'move') {
    // Copy + Move = clone-with-anchor-translation; plain Move = whole-entity
    // translate. Shared with the Alt base-point bypass (single SSoT).
    commitWholeEntityMove(grip, delta, deps, copyOn);
    return;
  }
  if (mode === 'rotate' || mode === 'scale' || mode === 'mirror') {
    // Phase 12 — forward the copy flag through the handoff so the downstream
    // tool starts with its native copyMode / keepOriginals path armed.
    GripHandoffStore.set(mode, grip.position, copyOn ? { copyMode: true } : undefined);
    deps.onToolChange(mode);
    return;
  }
  // mode === 'stretch' (default): unified StretchEntityCommand path
  // (Copy toggle is handled inside `commitDxfGripDragViaStretchCommand`).
  commitDxfGripDragViaStretchCommand(grip, delta, deps);
}
// Overlay commit adapters live in `overlay-grip-commit-adapters.ts`
// (split for N.7.1 file-size compliance — re-exported via grips/index.ts).
