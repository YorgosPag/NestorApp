/**
 * ADR-183 — Parametric BIM grip dispatch (extracted from grip-commit-adapters
 * for N.7.1 file-size compliance).
 *
 * Every params-driven entity kind (wall / slab / column / MEP / … ) recomputes
 * its geometry atomically inside a dedicated `UpdateXxxParamsCommand`, so its
 * grip commit BYPASSES the generic vertex-stretch path and routes straight to
 * the matching `commitXxxGripDrag`. This file is the single data-driven dispatch
 * of those mutually-exclusive kinds; the caller (`commitDxfGripDragModeAware`)
 * invokes it once and, on a miss, falls through to the primitive / whole-entity
 * paths that stay in `grip-commit-adapters.ts`.
 *
 * ADR-587 Φ7 (SEAM B) — the former 24-branch if-chain is now an introspectable,
 * type-keyed `Record` (key = `gripKind.on`, mirror of the Φ5 rotation seam).
 * Kinds are mutually exclusive (each carries a distinct `EntityGripKind` tag), so
 * a single map lookup is behaviorally identical to the ordered if-chain.
 *
 * @see grip-commit-adapters.ts — caller + primitive/whole-entity commits
 * @see grip-parametric-commits.ts — the individual commit handlers
 */
import type { Point2D } from '../../rendering/types/Types';
import type { UnifiedGripInfo, DxfCommitDeps } from './unified-grip-types';
import type { EntityGripKind } from '../grip-kinds';
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
  commitImportedMeshGripDrag,
  commitFloorplanSymbolGripDrag,
  commitFloorFinishGripDrag,
  commitHatchGripDrag,
  commitMepUnderfloorGripDrag,
  commitXLineGripDrag,
  commitRayGripDrag,
  commitDimensionGripDrag,
  commitScaleBarGripDrag,
  commitOpeningInfoTagGripDrag,
  commitImageGripDrag,
} from './grip-parametric-commits';

/** Commit-handler shape shared by every parametric kind (behavior-preserving). */
type ParametricCommitHandler = (
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
) => void;

/**
 * Introspectable dispatch table **entity grip-kind tag → parametric commit
 * handler** (ADR-587 Φ7 SEAM B). The key is `gripKind.on` (the `EntityGripKind`
 * discriminator tag); each params-driven entity recomputes its geometry
 * atomically inside a dedicated `UpdateXxxParamsCommand`, bypassing the generic
 * vertex-stretch path. `Partial` because only the 25 parametric kinds route here
 * — the 7 primitive / editor kinds (line / circle / arc / polyline / text /
 * group / annotation-symbol) fall through to `commitDxfGripDragModeAware`.
 *
 * Per-entry ADR anchors (preserved from the former if-chain):
 *   - stair            → ADR-358 Phase 5b (§5.12, 5 kinds)
 *   - dimension        → ADR-362 Phase I2 (defPoints / textMidpoint / rotation)
 *   - wall             → ADR-363 Phase 1C (endpoint / midpoint / thickness / curve / vertex)
 *   - opening          → ADR-363 Phase 2.5 (drag-along-wall, host-relative offset)
 *   - slab             → ADR-363 Phase 3.5 (per-vertex translate)
 *   - slab-opening     → ADR-363 Phase 3.7a (per-vertex translate + edge-midpoint insert)
 *   - roof             → ADR-417 Φ1-part-2 #2 (footprint outline + per-edge slopes)
 *   - beam             → ADR-363 Phase 5.5a (axis endpoints + curve control)
 *   - column           → ADR-363 Phase 4.5 (center + rotation + width/depth)
 *   - foundation       → ADR-436 Slice 1b (rotation + width/length + Alt-move)
 *   - mep-fixture      → ADR-406 (center + rotation + corner-anchored resize)
 *   - electrical-panel → ADR-408 Φ3
 *   - mep-manifold     → ADR-408 Φ12
 *   - mep-radiator     → ADR-408 Εύρος Β (re-seeds connectors)
 *   - mep-boiler       → ADR-408 Εύρος Β #2 (re-seeds connectors)
 *   - mep-water-heater → ADR-408 DHW (re-seeds connectors)
 *   - mep-segment      → ADR-408 Φ8/Φ15 (axis endpoints; riser = whole-entity move)
 *   - furniture        → ADR-410 (center + rotation + corner-anchored resize)
 *   - floorplan-symbol → ADR-415 (center + rotation + corner-anchored resize)
 *   - floor-finish     → ADR-419 (per-vertex translate + edge-midpoint insert)
 *   - hatch            → ADR-507 (per-vertex translate on boundaryPaths)
 *   - mep-underfloor   → ADR-408 Εύρος Β #3 (footprint + connector re-derivation)
 *   - xline            → ADR-359 Phase 11 (basePoint translate / direction rotate)
 *   - ray              → ADR-359 Phase 11 (basePoint translate / direction rotate)
 *   - scale-bar        → ADR-583 Φ2.4 (move / rotation / length; geometry DERIVED)
 */
export const PARAMETRIC_COMMIT_HANDLERS: Partial<
  Record<EntityGripKind['on'], ParametricCommitHandler>
> = {
  stair: commitStairGripDrag,
  dimension: commitDimensionGripDrag,
  wall: commitWallGripDrag,
  opening: commitOpeningGripDrag,
  slab: commitSlabGripDrag,
  'slab-opening': commitSlabOpeningGripDrag,
  roof: commitRoofGripDrag,
  beam: commitBeamGripDrag,
  column: commitColumnGripDrag,
  foundation: commitFoundationGripDrag,
  'mep-fixture': commitMepFixtureGripDrag,
  'electrical-panel': commitElectricalPanelGripDrag,
  'mep-manifold': commitMepManifoldGripDrag,
  'mep-radiator': commitMepRadiatorGripDrag,
  'mep-boiler': commitMepBoilerGripDrag,
  'mep-water-heater': commitMepWaterHeaterGripDrag,
  'mep-segment': commitMepSegmentGripDrag,
  furniture: commitFurnitureGripDrag,
  // ADR-683 Φ3 — εισαγόμενο πλέγμα (move / rotation ΜΟΝΟ· καμία διαδρομή resize).
  'imported-mesh': commitImportedMeshGripDrag,
  'floorplan-symbol': commitFloorplanSymbolGripDrag,
  'floor-finish': commitFloorFinishGripDrag,
  hatch: commitHatchGripDrag,
  'mep-underfloor': commitMepUnderfloorGripDrag,
  xline: commitXLineGripDrag,
  ray: commitRayGripDrag,
  // ADR-583 Φ2.4 — graphic scale-bar (move / rotation / length; geometry DERIVED).
  'scale-bar': commitScaleBarGripDrag,
  // ADR-612 — opening-info-tag (move / rotation / size; geometry DERIVED).
  'opening-info-tag': commitOpeningInfoTagGripDrag,
  // ADR-654 — raster image (move / rotation / 4 corner resize; flat params, no geometry cache).
  image: commitImageGripDrag,
};

/**
 * Runtime completeness anchor — the 25 parametric-commit kinds routed by
 * `PARAMETRIC_COMMIT_HANDLERS`. Bound to the grip discriminator domain
 * (`GRIP_KIND_ENTITIES`, 32) by `grip-parametric-dispatch-coverage.test.ts`, so
 * the seam cannot silently diverge from the descriptor domain (ADR-587 Φ7).
 */
export const PARAMETRIC_COMMIT_SUPPORTED_KINDS = Object.keys(
  PARAMETRIC_COMMIT_HANDLERS,
) as EntityGripKind['on'][];

/**
 * Route a params-driven BIM grip to its dedicated commit handler. Returns `true`
 * when `grip` matched a parametric kind (and was committed), `false` otherwise so
 * the caller continues to the primitive / whole-entity paths. Kinds are mutually
 * exclusive (the `gripKind.on` tag is unique), so a single map lookup is
 * behaviorally identical to the former ordered if-chain.
 */
export function tryCommitParametricGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): boolean {
  const on = grip.gripKind?.on;
  const handler = on ? PARAMETRIC_COMMIT_HANDLERS[on] : undefined;
  if (handler) {
    handler(grip, delta, deps);
    return true;
  }
  return false;
}
