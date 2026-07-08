/**
 * ADR-183 — Parametric BIM grip dispatch (extracted from grip-commit-adapters
 * for N.7.1 file-size compliance).
 *
 * Every params-driven entity kind (wall / slab / column / MEP / … ) recomputes
 * its geometry atomically inside a dedicated `UpdateXxxParamsCommand`, so its
 * grip commit BYPASSES the generic vertex-stretch path and routes straight to
 * the matching `commitXxxGripDrag`. This file is the single ordered dispatch of
 * those mutually-exclusive kinds; the caller (`commitDxfGripDragModeAware`)
 * invokes it once and, on a miss, falls through to the primitive / whole-entity
 * paths that stay in `grip-commit-adapters.ts`.
 *
 * @see grip-commit-adapters.ts — caller + primitive/whole-entity commits
 * @see grip-parametric-commits.ts — the individual commit handlers
 */
import type { Point2D } from '../../rendering/types/Types';
import type { UnifiedGripInfo, DxfCommitDeps } from './unified-grip-types';
import {
  commitStairGripDrag,
  commitWallGripDrag,
  commitOpeningGripDrag,
  commitSlabGripDrag,
  commitSlabOpeningGripDrag,
  commitRoofGripDrag,
  commitBeamGripDrag,
  commitColumnGripDrag,
  commitFoundationGripDrag,
  commitMepFixtureGripDrag,
  commitElectricalPanelGripDrag,
  commitMepManifoldGripDrag,
  commitMepRadiatorGripDrag,
  commitMepBoilerGripDrag,
  commitMepWaterHeaterGripDrag,
  commitMepSegmentGripDrag,
  commitFurnitureGripDrag,
  commitFloorplanSymbolGripDrag,
  commitFloorFinishGripDrag,
  commitHatchGripDrag,
  commitMepUnderfloorGripDrag,
  commitXLineGripDrag,
  commitRayGripDrag,
  commitDimensionGripDrag,
} from './grip-parametric-commits';

/**
 * Route a params-driven BIM grip to its dedicated commit handler. Returns `true`
 * when `grip` matched a parametric kind (and was committed), `false` otherwise so
 * the caller continues to the primitive / whole-entity paths. Kinds are mutually
 * exclusive (each is a distinct optional field on `UnifiedGripInfo`), so order is
 * immaterial for correctness.
 */
export function tryCommitParametricGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): boolean {
  // ADR-358 Phase 5b — stair parametric grip path (5 kinds, §5.12).
  if (grip.stairGripKind) {
    commitStairGripDrag(grip, delta, deps);
    return true;
  }
  // ADR-362 Phase I2 — dimension grip path (defPoints / textMidpoint / rotation).
  if (grip.dimGripKind) {
    commitDimensionGripDrag(grip, delta, deps);
    return true;
  }
  // ADR-363 Phase 1C — wall parametric grip path (endpoint / midpoint /
  // thickness / curve / polyline-vertex). Bypasses stretch because walls are
  // params-driven (geometry recomputed atomically by UpdateWallParamsCommand).
  if (grip.wallGripKind) {
    commitWallGripDrag(grip, delta, deps);
    return true;
  }
  // ADR-363 Phase 2.5 — opening parametric grip path (drag-along-wall).
  // Bypasses stretch because openings are params-driven (offsetFromStart) and
  // their geometry is host-wall-relative; commit recomputes via
  // `UpdateOpeningParamsCommand` after axis projection + clamp.
  if (grip.openingGripKind) {
    commitOpeningGripDrag(grip, delta, deps);
    return true;
  }
  // ADR-363 Phase 3.5 — slab parametric grip path (per-vertex translate).
  // Bypasses stretch because slabs are params-driven (outline polygon) and
  // geometry (area / netArea / volume / perimeter / bbox) is recomputed
  // atomically by UpdateSlabParamsCommand.
  if (grip.slabGripKind) {
    commitSlabGripDrag(grip, delta, deps);
    return true;
  }
  // ADR-363 Phase 3.7a — slab-opening parametric grip path (per-vertex
  // translate + edge-midpoint insertion). Bypasses stretch because
  // slab-openings are params-driven (outline polygon) και geometry
  // (area / perimeter / bbox) is recomputed atomically by
  // UpdateSlabOpeningParamsCommand.
  if (grip.slabOpeningGripKind) {
    commitSlabOpeningGripDrag(grip, delta, deps);
    return true;
  }
  // ADR-417 Φ1-part-2 #2 — roof parametric grip path (per-vertex translate +
  // edge-midpoint insertion). Bypasses stretch because roofs are params-driven
  // (footprint outline + per-edge slopes) and geometry (faces / ridges / areas /
  // bbox) is recomputed atomically by UpdateRoofParamsCommand.
  if (grip.roofGripKind) {
    commitRoofGripDrag(grip, delta, deps);
    return true;
  }
  // ADR-363 Phase 5.5a — beam parametric grip path (start/end/midpoint
  // translate + curve control move). Bypasses stretch because beams are
  // params-driven (axis endpoints + optional Bezier control) και geometry
  // (axisPolyline / outline / length / area / volume / bbox) is recomputed
  // atomically by UpdateBeamParamsCommand.
  if (grip.beamGripKind) {
    commitBeamGripDrag(grip, delta, deps);
    return true;
  }
  // ADR-363 Phase 4.5 — column parametric grip path (center translate +
  // rotation + width/depth resize). Bypasses stretch because columns are
  // params-driven (position + kind + anchor + width/depth/height/rotation)
  // και geometry (footprint / bbox / area / volume) is recomputed atomically
  // by UpdateColumnParamsCommand.
  if (grip.columnGripKind) {
    commitColumnGripDrag(grip, delta, deps);
    return true;
  }
  // ADR-436 Slice 1b — foundation pad parametric grip path (rotation + width/length
  // resize + Alt-move). Bypasses stretch because the pad is params-driven; geometry
  // (footprint / bbox / area / volume) recomputed atomically by UpdateFoundationParamsCommand.
  if (grip.foundationGripKind) {
    commitFoundationGripDrag(grip, delta, deps);
    return true;
  }
  // ADR-406 — MEP fixture parametric grip path (center translate + rotation +
  // opposite-corner-anchored width/length resize). Bypasses stretch because the
  // fixture is params-driven; UpdateMepFixtureParamsCommand recomputes geometry.
  if (grip.mepFixtureGripKind) {
    commitMepFixtureGripDrag(grip, delta, deps);
    return true;
  }
  // ADR-408 Φ3 — electrical panel parametric grip path (center translate +
  // rotation + opposite-corner-anchored width/length resize). Bypasses stretch
  // because the panel is params-driven; UpdateElectricalPanelParamsCommand
  // recomputes geometry.
  if (grip.electricalPanelGripKind) {
    commitElectricalPanelGripDrag(grip, delta, deps);
    return true;
  }
  // ADR-408 Φ12 — MEP manifold parametric grip path (center translate +
  // rotation + opposite-corner-anchored width/length resize). Bypasses stretch
  // because the manifold is params-driven; UpdateMepManifoldParamsCommand
  // recomputes geometry.
  if (grip.mepManifoldGripKind) {
    commitMepManifoldGripDrag(grip, delta, deps);
    return true;
  }
  // ADR-408 Εύρος Β — heating radiator parametric grip path (center translate +
  // rotation + opposite-corner-anchored width/length resize). Bypasses stretch
  // because the radiator is params-driven; UpdateMepRadiatorParamsCommand
  // recomputes geometry + re-seeds connectors.
  if (grip.mepRadiatorGripKind) {
    commitMepRadiatorGripDrag(grip, delta, deps);
    return true;
  }
  // ADR-408 Εύρος Β #2 — heating boiler parametric grip path (center translate +
  // rotation + opposite-corner-anchored width/length resize). Bypasses stretch
  // because the boiler is params-driven; UpdateMepBoilerParamsCommand
  // recomputes geometry + re-seeds connectors.
  if (grip.mepBoilerGripKind) {
    commitMepBoilerGripDrag(grip, delta, deps);
    return true;
  }
  // ADR-408 DHW — domestic hot water heater parametric grip path (center translate +
  // rotation + opposite-corner-anchored width/length resize). Bypasses stretch
  // because the water heater is params-driven; UpdateMepWaterHeaterParamsCommand
  // recomputes geometry + re-seeds connectors.
  if (grip.mepWaterHeaterGripKind) {
    commitMepWaterHeaterGripDrag(grip, delta, deps);
    return true;
  }
  // ADR-408 Φ8/Φ15 — MEP segment parametric grip path (start/end/midpoint
  // translate + section resize + rotation; vertical riser = whole-entity move).
  // Bypasses stretch/move because segments are params-driven (axis endpoints);
  // UpdateMepSegmentParamsCommand recomputes geometry atomically.
  if (grip.mepSegmentGripKind) {
    commitMepSegmentGripDrag(grip, delta, deps);
    return true;
  }
  // ADR-410 — furniture parametric grip path (center translate + rotation +
  // opposite-corner-anchored width/depth resize). Bypasses stretch because the
  // furniture is params-driven; UpdateFurnitureParamsCommand recomputes geometry.
  if (grip.furnitureGripKind) {
    commitFurnitureGripDrag(grip, delta, deps);
    return true;
  }
  // ADR-415 — floorplan-symbol parametric grip path (center translate + rotation +
  // opposite-corner-anchored width/depth resize). Bypasses stretch because the
  // symbol is params-driven; UpdateFloorplanSymbolParamsCommand recomputes geometry.
  if (grip.floorplanSymbolGripKind) {
    commitFloorplanSymbolGripDrag(grip, delta, deps);
    return true;
  }
  // ADR-419 — floor-finish parametric grip path (per-vertex translate +
  // edge-midpoint insertion). Bypasses stretch because floor-finishes are
  // params-driven (footprint polygon); UpdateFloorFinishParamsCommand recomputes
  // geometry atomically. Mirrors slab/roof path.
  if (grip.floorFinishGripKind) {
    commitFloorFinishGripDrag(grip, delta, deps);
    return true;
  }
  // ADR-507 — hatch boundary parametric grip path (per-vertex translate on
  // boundaryPaths). Bypasses stretch; UpdateHatchBoundaryCommand patches the
  // outline + merges drag samples into one undo.
  if (grip.hatchGripKind) {
    commitHatchGripDrag(grip, delta, deps);
    return true;
  }
  // ADR-408 Εύρος Β #3 — underfloor heating loop parametric grip path (per-vertex
  // translate + edge-midpoint insertion). Bypasses stretch because the entity is
  // params-driven (footprint polygon + connector re-derivation);
  // UpdateMepUnderfloorParamsCommand recomputes geometry + connectors atomically.
  // Mirrors floor-finish path.
  if (grip.mepUnderfloorGripKind) {
    commitMepUnderfloorGripDrag(grip, delta, deps);
    return true;
  }
  // ADR-359 Phase 11 — XLine grip path (basePoint translate or direction rotate).
  // Bypasses stretch because XLine has no vertex array.
  if (grip.xlineGripKind) {
    commitXLineGripDrag(grip, delta, deps);
    return true;
  }
  // ADR-359 Phase 11 — Ray grip path (basePoint translate or direction rotate).
  if (grip.rayGripKind) {
    commitRayGripDrag(grip, delta, deps);
    return true;
  }
  return false;
}
