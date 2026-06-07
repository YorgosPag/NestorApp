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
import type { BeamEntity, BeamParams } from '../types/beam-types';
import type { StairEntity, StairParams } from '../types/stair-types';
import type { MepFixtureEntity, MepFixtureParams } from '../types/mep-fixture-types';
import type { MepSegmentEntity, MepSegmentParams } from '../types/mep-segment-types';
import type { ElectricalPanelEntity, ElectricalPanelParams } from '../types/electrical-panel-types';
import type { MepManifoldEntity, MepManifoldParams } from '../types/mep-manifold-types';
import type { FurnitureEntity, FurnitureParams } from '../types/furniture-types';
import type { Point3D, Polygon3D } from '../types/bim-base';
import { computeWallGeometry } from '../geometry/wall-geometry';
import { translateWallParams } from '../walls/wall-grip-transforms';
import { computeSlabGeometry } from '../geometry/slab-geometry';
import { computeSlabOpeningGeometry } from '../geometry/slab-opening-geometry';
import { computeColumnGeometry } from '../geometry/column-geometry';
import { computeBeamGeometry } from '../geometry/beam-geometry';
import { computeStairGeometry } from '../geometry/stairs/StairGeometryService';
import { computeMepFixtureGeometry } from '../mep-fixtures/mep-fixture-geometry';
import { computeElectricalPanelGeometry } from '../electrical-panels/electrical-panel-geometry';
import { computeMepManifoldGeometry } from '../mep-manifolds/mep-manifold-geometry';
import { computeMepSegmentGeometry } from '../geometry/mep-segment-geometry';
import { computeFurnitureGeometry } from '../furniture/furniture-geometry';

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

function moveWall(entity: WallEntity, delta: Point2D): Partial<SceneEntity> {
  const newParams: WallParams = translateWallParams(entity.params, delta);
  const geometry = computeWallGeometry(newParams, entity.kind);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

function moveSlab(entity: SlabEntity, delta: Point2D): Partial<SceneEntity> {
  const newParams: SlabParams = {
    ...entity.params,
    outline: shiftPolygon3D(entity.params.outline, delta),
  };
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

function moveColumn(entity: ColumnEntity, delta: Point2D): Partial<SceneEntity> {
  const newParams: ColumnParams = {
    ...entity.params,
    position: shiftPoint3D(entity.params.position, delta),
  };
  const geometry = computeColumnGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

function moveBeam(entity: BeamEntity, delta: Point2D): Partial<SceneEntity> {
  const newParams: BeamParams = {
    ...entity.params,
    startPoint: shiftPoint3D(entity.params.startPoint, delta),
    endPoint: shiftPoint3D(entity.params.endPoint, delta),
    curveControl: entity.params.curveControl
      ? shiftPoint3D(entity.params.curveControl, delta)
      : undefined,
  };
  const geometry = computeBeamGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

function moveStair(entity: StairEntity, delta: Point2D): Partial<SceneEntity> {
  const shifted = shiftPoint3D(entity.params.basePoint, delta);
  const newParams: StairParams = {
    ...entity.params,
    basePoint: { x: shifted.x, y: shifted.y, z: shifted.z ?? 0 },
  };
  const geometry = computeStairGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

// ADR-406 / ADR-408 Φ3 — point-based MEP hosts: shift the single `position`
// anchor (same shape as the column). Connectors are host-local → they follow for
// free; the embedded home-run wire is recomputed at render time (ADR-408 Φ7).
function moveMepFixture(entity: MepFixtureEntity, delta: Point2D): Partial<SceneEntity> {
  const newParams: MepFixtureParams = {
    ...entity.params,
    position: shiftPoint3D(entity.params.position, delta),
  };
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
function moveMepManifold(entity: MepManifoldEntity, delta: Point2D): Partial<SceneEntity> {
  const newParams: MepManifoldParams = {
    ...entity.params,
    position: shiftPoint3D(entity.params.position, delta),
  };
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

// ADR-408 Φ8 — linear MEP segment: shift both axis endpoints (mirror beam).
function moveMepSegment(entity: MepSegmentEntity, delta: Point2D): Partial<SceneEntity> {
  const newParams: MepSegmentParams = {
    ...entity.params,
    startPoint: shiftPoint3D(entity.params.startPoint, delta),
    endPoint: shiftPoint3D(entity.params.endPoint, delta),
  };
  const geometry = computeMepSegmentGeometry(newParams);
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
  delta: Point2D,
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
    case 'mep-segment':
      return moveMepSegment(entity, delta);
    default:
      return null;
  }
}
