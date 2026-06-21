/**
 * BIM Move Geometry — apply a 2D delta to a BIM entity's params and recompute
 * its `geometry` cache atomically (single source of truth wrapper).
 *
 * ADR-363 Phase 7A — Multi-Element Selection & Bulk Edit.
 *
 * Mirrors the pattern of `UpdateWallParamsCommand.applyPatch`: every params
 * mutation goes through `compute<Kind>Geometry()` so renderer reads never
 * diverge from the parametric source of truth. Without recomputing geometry
 * here the cached `bbox` becomes stale after a multi-entity move → marquee
 * picks the OLD location and spatial-index broad-phase returns the wrong cell.
 *
 * Move-cascade semantics (decided in Q1 Giorgio 2026-05-19):
 *
 *   - Wall: `params.start` + `params.end` shifted. Openings hosted on the wall
 *     do NOT need their own delta — their world geometry derives from
 *     `wall.params.start + offsetFromStart × axisDir`, so they follow the
 *     wall axis automatically through `computeOpeningGeometry()` re-runs.
 *     `case 'opening'` therefore returns `{}` (no-op) — the cascade resolver
 *     does NOT include openings in the move set.
 *
 *   - Slab: every vertex of `params.outline` shifted. Slab-openings have
 *     INDEPENDENT world vertices (`SlabOpeningParams.outline.vertices`), so
 *     they DO need their own delta applied. The cascade resolver MUST include
 *     hosted slab-openings in the move set.
 *
 *   - Column / Beam / Stair: shift the single anchor point (position /
 *     startPoint+endPoint / basePoint). No hosted children with world coords.
 *
 * Pure function — no React, no store reads, no IO. Imported by
 * `move-entity-geometry.ts` to extend `calculateMovedGeometry()` for the
 * Entity union's BIM variants.
 */
import type { SceneEntity } from '../../core/commands/interfaces';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type {
  WallEntity,
  WallParams,
  WallKind,
} from '../types/wall-types';
import type { SlabEntity, SlabParams } from '../types/slab-types';
import type {
  SlabOpeningEntity,
  SlabOpeningParams,
} from '../types/slab-opening-types';
import type { ColumnEntity, ColumnParams } from '../types/column-types';
import type { FoundationEntity, FoundationParams } from '../types/foundation-types';
import type { BeamEntity, BeamParams } from '../types/beam-types';
import type { StairEntity, StairParams } from '../types/stair-types';
import type { MepFixtureEntity, MepFixtureParams } from '../types/mep-fixture-types';
import type { MepSegmentEntity, MepSegmentParams } from '../types/mep-segment-types';
import type { ElectricalPanelEntity, ElectricalPanelParams } from '../types/electrical-panel-types';
import type { MepManifoldEntity, MepManifoldParams } from '../types/mep-manifold-types';
import type { FurnitureEntity, FurnitureParams } from '../types/furniture-types';
import type { FloorFinishEntity, FloorFinishParams } from '../types/floor-finish-types';
import { computeFloorFinishGeometry } from '../types/floor-finish-types';
import type { SpaceSeparatorEntity, SpaceSeparatorParams } from '../types/space-separator-types';
import { computeSpaceSeparatorGeometry } from '../types/space-separator-types';
import type { MepRadiatorEntity, MepRadiatorParams } from '../types/mep-radiator-types';
import type { MepBoilerEntity, MepBoilerParams } from '../types/mep-boiler-types';
import type { MepWaterHeaterEntity, MepWaterHeaterParams } from '../types/mep-water-heater-types';
import type { RoofEntity, RoofParams } from '../types/roof-types';
import type { MepUnderfloorEntity, MepUnderfloorParams } from '../types/mep-underfloor-types';
import type { Point3D, Polygon3D } from '../types/bim-base';
import { computeWallGeometry } from '../geometry/wall-geometry';
import { translateWallParams } from '../walls/wall-grip-transforms';
import { computeSlabGeometry } from '../geometry/slab-geometry';
import { computeSlabOpeningGeometry } from '../geometry/slab-opening-geometry';
import { computeColumnGeometry } from '../geometry/column-geometry';
import { computeFoundationGeometry } from '../geometry/foundation-geometry';
import { computeBeamGeometry } from '../geometry/beam-geometry';
import { computeStairGeometry } from '../geometry/stairs/StairGeometryService';
import { computeMepFixtureGeometry } from '../mep-fixtures/mep-fixture-geometry';
import { computeElectricalPanelGeometry } from '../electrical-panels/electrical-panel-geometry';
import { computeMepManifoldGeometry } from '../mep-manifolds/mep-manifold-geometry';
import { computeMepSegmentGeometry } from '../geometry/mep-segment-geometry';
import { computeFurnitureGeometry } from '../furniture/furniture-geometry';
import { computeMepRadiatorGeometry } from '../mep-radiators/mep-radiator-geometry';
import { computeMepBoilerGeometry } from '../mep-boilers/mep-boiler-geometry';
import { computeMepWaterHeaterGeometry } from '../mep-water-heaters/mep-water-heater-geometry';
import { computeRoofGeometry } from '../geometry/roof-geometry';
import { computeMepUnderfloorGeometry } from '../mep-underfloor/mep-underfloor-geometry';
// ADR-049 Phase 2 — the per-type vertical (elevation) computers. The unified move's
// `delta.z` (elevation delta in mm) dispatches here, reusing the SAME SSoT the 3D
// gizmo vertical handle used to call through `Update*ParamsCommand` (zero duplication).
import {
  computeWallVerticalMove,
  computeColumnVerticalMove,
  computeBeamVerticalMove,
  computeSlabVerticalMove,
  computeStairVerticalMove,
  computeMepHostVerticalMove,
  computeMepSegmentVerticalMove,
} from './bim-vertical-move';

// ─── Point3D delta helpers ──────────────────────────────────────────────────

function shiftPoint3D(p: Point3D, delta: Point2D): Point3D {
  // z preserved — 2D plan-view move never affects elevation.
  return p.z !== undefined
    ? { x: p.x + delta.x, y: p.y + delta.y, z: p.z }
    : { x: p.x + delta.x, y: p.y + delta.y };
}

function shiftPolygon3D(poly: Polygon3D, delta: Point2D): Polygon3D {
  return { vertices: poly.vertices.map((v) => shiftPoint3D(v, delta)) };
}

// ─── Per-kind move ──────────────────────────────────────────────────────────

function moveWall(entity: WallEntity, delta: Point3D): Partial<SceneEntity> {
  let newParams: WallParams = translateWallParams(entity.params, delta);
  // ADR-049 Phase 2 — vertical component (gizmo axis-Y): bump `baseOffset` AFTER the
  // plan translate, reusing the elevation SSoT. `delta.z` truthy skips 0 / undefined.
  if (delta.z) newParams = computeWallVerticalMove(newParams, delta.z) ?? newParams;
  const geometry = computeWallGeometry(newParams, entity.kind);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

function moveSlab(entity: SlabEntity, delta: Point3D): Partial<SceneEntity> {
  let newParams: SlabParams = {
    ...entity.params,
    outline: shiftPolygon3D(entity.params.outline, delta),
  };
  // ADR-049 Phase 2 — vertical: bump `levelElevation` (top face) after the plan move.
  if (delta.z) newParams = computeSlabVerticalMove(newParams, delta.z) ?? newParams;
  // Slab-openings are NOT passed here — moveSlabOpening() handles them
  // independently via the cascade resolver. Their geometry stays in sync
  // because they appear in the same atomic `updateEntities()` batch.
  const geometry = computeSlabGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

function moveSlabOpening(entity: SlabOpeningEntity, delta: Point2D): Partial<SceneEntity> {
  const newParams: SlabOpeningParams = {
    ...entity.params,
    outline: shiftPolygon3D(entity.params.outline, delta),
  };
  const geometry = computeSlabOpeningGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

function moveColumn(entity: ColumnEntity, delta: Point3D): Partial<SceneEntity> {
  let newParams: ColumnParams = {
    ...entity.params,
    position: shiftPoint3D(entity.params.position, delta),
  };
  // ADR-049 Phase 2 — vertical: bump `baseOffset` (mirror wall) after the plan move.
  if (delta.z) newParams = computeColumnVerticalMove(newParams, delta.z) ?? newParams;
  const geometry = computeColumnGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

// ADR-436 Slice 1b — Alt+drag whole-entity move. pad shifts `position`; the
// line-based kinds (strip / tie-beam, Slice 2) shift both axis endpoints.
function moveFoundation(entity: FoundationEntity, delta: Point2D): Partial<SceneEntity> {
  const p = entity.params;
  const newParams: FoundationParams = p.kind === 'pad'
    ? { ...p, position: shiftPoint3D(p.position, delta) }
    : { ...p, start: shiftPoint3D(p.start, delta), end: shiftPoint3D(p.end, delta) };
  const geometry = computeFoundationGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

function moveBeam(entity: BeamEntity, delta: Point3D): Partial<SceneEntity> {
  // `curveControl` is OMITTED from the base spread and re-added only when present:
  // a straight beam has no control point, and Firestore `updateDoc` REJECTS explicit
  // `undefined` field values ("Unsupported field value: undefined") → the per-entity
  // beam write failed on EVERY straight-beam move, so the move never persisted
  // (reverted on reload). Destructuring it out also scrubs a stale `curveControl:
  // undefined` key left in-memory by a prior (buggy) move. Only a curved beam carries
  // the shifted control point.
  const { curveControl, ...rest } = entity.params;
  let newParams: BeamParams = {
    ...rest,
    startPoint: shiftPoint3D(entity.params.startPoint, delta),
    endPoint: shiftPoint3D(entity.params.endPoint, delta),
    ...(curveControl ? { curveControl: shiftPoint3D(curveControl, delta) } : {}),
  };
  // ADR-049 Phase 2 — vertical: bump `topElevation` (depth fixed) after the plan move.
  if (delta.z) newParams = computeBeamVerticalMove(newParams, delta.z) ?? newParams;
  const geometry = computeBeamGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

function moveStair(entity: StairEntity, delta: Point3D): Partial<SceneEntity> {
  const shifted = shiftPoint3D(entity.params.basePoint, delta);
  let newParams: StairParams = {
    ...entity.params,
    basePoint: { x: shifted.x, y: shifted.y, z: shifted.z ?? 0 },
  };
  // ADR-049 Phase 2 — vertical: bump `basePoint.z`. The stair stores `basePoint` in
  // inferred DRAWING units (ADR-358), so the computer converts the mm `delta.z` with
  // `mmToEntityUnitFactor`. Pass the PLAN-MOVED params (width unchanged → same factor).
  if (delta.z) {
    newParams = computeStairVerticalMove({ ...entity, params: newParams }, delta.z) ?? newParams;
  }
  const geometry = computeStairGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

// ADR-406 / ADR-408 Φ3 — point-based MEP hosts: shift the single `position`
// anchor (same shape as the column). Connectors are host-local → they follow for
// free; the embedded home-run wire is recomputed at render time (ADR-408 Φ7).
function moveMepFixture(entity: MepFixtureEntity, delta: Point3D): Partial<SceneEntity> {
  let newParams: MepFixtureParams = {
    ...entity.params,
    position: shiftPoint3D(entity.params.position, delta),
  };
  // ADR-049 Phase 2 — vertical: bump `mountingElevationMm` (host body + connectors rise).
  if (delta.z) newParams = computeMepHostVerticalMove(newParams, delta.z) ?? newParams;
  const geometry = computeMepFixtureGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

function moveElectricalPanel(entity: ElectricalPanelEntity, delta: Point2D): Partial<SceneEntity> {
  const newParams: ElectricalPanelParams = {
    ...entity.params,
    position: shiftPoint3D(entity.params.position, delta),
  };
  const geometry = computeElectricalPanelGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

// ADR-408 Φ12 — point-based plumbing manifold: shift the single `position` anchor (same shape as panel).
function moveMepManifold(entity: MepManifoldEntity, delta: Point3D): Partial<SceneEntity> {
  let newParams: MepManifoldParams = {
    ...entity.params,
    position: shiftPoint3D(entity.params.position, delta),
  };
  // ADR-049 Phase 2 — vertical: bump `mountingElevationMm` (mirror fixture).
  if (delta.z) newParams = computeMepHostVerticalMove(newParams, delta.z) ?? newParams;
  const geometry = computeMepManifoldGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

// ADR-410 — point-based furniture: shift the single `position` anchor (same shape as column).
function moveFurniture(entity: FurnitureEntity, delta: Point2D): Partial<SceneEntity> {
  const newParams: FurnitureParams = {
    ...entity.params,
    position: shiftPoint3D(entity.params.position, delta),
  };
  const geometry = computeFurnitureGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

// ADR-419 — polygon floor-finish: shift all footprint vertices (mirror slab outline).
function moveFloorFinish(entity: FloorFinishEntity, delta: Point2D): Partial<SceneEntity> {
  const newParams: FloorFinishParams = {
    ...entity.params,
    footprint: shiftPolygon3D(entity.params.footprint, delta),
  };
  const geometry = computeFloorFinishGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

// ADR-437 — linear space separator: shift both endpoints (mirror mep-segment).
function moveSpaceSeparator(entity: SpaceSeparatorEntity, delta: Point2D): Partial<SceneEntity> {
  const newParams: SpaceSeparatorParams = {
    ...entity.params,
    start: shiftPoint3D(entity.params.start, delta),
    end: shiftPoint3D(entity.params.end, delta),
  };
  const geometry = computeSpaceSeparatorGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

// ADR-408 Φ8 — linear MEP segment: shift both axis endpoints (mirror beam).
function moveMepSegment(entity: MepSegmentEntity, delta: Point3D): Partial<SceneEntity> {
  let newParams: MepSegmentParams = {
    ...entity.params,
    startPoint: shiftPoint3D(entity.params.startPoint, delta),
    endPoint: shiftPoint3D(entity.params.endPoint, delta),
  };
  // ADR-049 Phase 2 — vertical: shift both endpoint z's by `delta.z` (slope preserved),
  // re-derive `centerlineElevationMm`. Runs on the plan-moved endpoints.
  if (delta.z) newParams = computeMepSegmentVerticalMove(newParams, delta.z) ?? newParams;
  const geometry = computeMepSegmentGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

// ADR-408 Εύρος Β — point-based heating radiator: shift the single `position`
// anchor (same shape as the fixture). Connectors are host-local → they follow
// for free (recomputed by `computeMepRadiatorGeometry` from the moved params).
function moveMepRadiator(entity: MepRadiatorEntity, delta: Point3D): Partial<SceneEntity> {
  let newParams: MepRadiatorParams = {
    ...entity.params,
    position: shiftPoint3D(entity.params.position, delta),
  };
  // ADR-049 Phase 2 — vertical: bump `mountingElevationMm` (mirror fixture).
  if (delta.z) newParams = computeMepHostVerticalMove(newParams, delta.z) ?? newParams;
  const geometry = computeMepRadiatorGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

// ADR-408 Εύρος Β #2 — point-based heating boiler: shift the single `position` anchor (mirror radiator).
function moveMepBoiler(entity: MepBoilerEntity, delta: Point3D): Partial<SceneEntity> {
  let newParams: MepBoilerParams = {
    ...entity.params,
    position: shiftPoint3D(entity.params.position, delta),
  };
  // ADR-049 Phase 2 — vertical: bump `mountingElevationMm` (mirror radiator).
  if (delta.z) newParams = computeMepHostVerticalMove(newParams, delta.z) ?? newParams;
  const geometry = computeMepBoilerGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

// ADR-408 DHW — point-based domestic hot water heater: shift the single `position` anchor (mirror radiator).
function moveMepWaterHeater(entity: MepWaterHeaterEntity, delta: Point3D): Partial<SceneEntity> {
  let newParams: MepWaterHeaterParams = {
    ...entity.params,
    position: shiftPoint3D(entity.params.position, delta),
  };
  // ADR-049 Phase 2 — vertical: bump `mountingElevationMm` (mirror radiator).
  if (delta.z) newParams = computeMepHostVerticalMove(newParams, delta.z) ?? newParams;
  const geometry = computeMepWaterHeaterGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

// ADR-417 — polygon roof: shift every `outline` vertex (mirror slab outline). Per-edge
// slope flags are positional-invariant → unchanged; geometry recomputes from moved outline.
function moveRoof(entity: RoofEntity, delta: Point2D): Partial<SceneEntity> {
  const newParams: RoofParams = {
    ...entity.params,
    outline: shiftPolygon3D(entity.params.outline, delta),
  };
  const geometry = computeRoofGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

// ADR-408 Εύρος Β #3 — polygon underfloor loop: shift every `footprint` vertex (mirror
// floor-finish). The serpentine loop + both connector positions re-derive from the moved
// footprint inside `computeMepUnderfloorGeometry`.
function moveMepUnderfloor(entity: MepUnderfloorEntity, delta: Point2D): Partial<SceneEntity> {
  const newParams: MepUnderfloorParams = {
    ...entity.params,
    footprint: shiftPolygon3D(entity.params.footprint, delta),
  };
  const geometry = computeMepUnderfloorGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

/**
 * Returns the partial entity patch (`{params, geometry}`) for moving a BIM
 * entity by a 2D delta. Returns `null` if the entity is not a BIM type
 * (caller falls through to non-BIM logic).
 *
 * Returns `{}` (empty partial, applied as no-op) for `opening` — openings
 * derive their world geometry from the host wall and follow it automatically.
 * The move cascade resolver therefore does not include openings in the move
 * set; they re-render correctly once the wall's params land.
 */
export function calculateBimMovedGeometry(
  entity: Entity,
  // ADR-049 Phase 2 — `delta.x`/`delta.y` = plan move in the entity's native canvas
  // units; optional `delta.z` = ELEVATION delta in raw mm (Revit `MoveElement(dx,dy,dz)`).
  // Vertical-capable types apply their per-type elevation computer after the plan move;
  // types without a vertical field (opening, foundation, panel, furniture, roof,
  // floor-finish, separator, underfloor, slab-opening) ignore `z` — same coverage as
  // the old 3D-gizmo `verticalCommandForEntity`.
  delta: Point3D,
): Partial<SceneEntity> | null {
  switch (entity.type) {
    case 'wall':
      return moveWall(entity, delta);
    case 'opening':
      // Hosted-derived geometry — no direct delta here. The opening follows its
      // host wall via the ADR-363 §5.4 cascade: the move command calls
      // `cascadeHostedOpeningsForWalls(entityIds)` AFTER applying wall deltas,
      // which recomputes `computeOpeningGeometry(opening.params, movedWall)`.
      return {};
    case 'slab':
      return moveSlab(entity, delta);
    case 'slab-opening':
      return moveSlabOpening(entity, delta);
    case 'column':
      return moveColumn(entity, delta);
    case 'foundation':
      return moveFoundation(entity, delta);
    case 'beam':
      return moveBeam(entity, delta);
    case 'stair':
      return moveStair(entity, delta);
    case 'mep-fixture':
      return moveMepFixture(entity, delta);
    case 'electrical-panel':
      return moveElectricalPanel(entity, delta);
    case 'mep-manifold':
      return moveMepManifold(entity, delta);
    case 'furniture':
      return moveFurniture(entity, delta);
    case 'floor-finish':
      return moveFloorFinish(entity, delta);
    case 'space-separator':
      return moveSpaceSeparator(entity, delta);
    case 'mep-segment':
      return moveMepSegment(entity, delta);
    case 'mep-radiator':
      return moveMepRadiator(entity, delta);
    case 'mep-boiler':
      return moveMepBoiler(entity, delta);
    case 'mep-water-heater':
      return moveMepWaterHeater(entity, delta);
    case 'roof':
      return moveRoof(entity, delta);
    case 'mep-underfloor':
      return moveMepUnderfloor(entity, delta);
    default:
      return null;
  }
}
