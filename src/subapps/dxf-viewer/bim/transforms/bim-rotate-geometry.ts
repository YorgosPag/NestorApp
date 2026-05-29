/**
 * BIM Rotate Geometry — pivot-aware rotation per BIM kind (SSoT).
 *
 * ADR-363 Phase 7.2 — Transform BIM (Mirror / Rotate / Copy).
 *
 * Mirrors the structure of `bim/utils/bim-move-geometry.ts` and
 * `bim/transforms/bim-mirror-geometry.ts`: every params mutation is paired
 * with a `compute<Kind>Geometry()` re-run so the renderer reads stay
 * consistent with the parametric SSoT after the rotation.
 *
 * Per-kind semantics (Phase 7.2):
 *
 *   - Wall: `params.start`, `params.end`, optional `polylineVertices`, and
 *     optional `curveControl` all rotated around the pivot. Hosted openings
 *     follow automatically via the wall's recomputed geometry.
 *
 *   - Opening: no-op. World position is derived from the host wall by
 *     `computeOpeningGeometry`; rotating the wall carries the opening with
 *     it. There is no standalone "rotation" of an opening — its orientation
 *     is the wall axis.
 *
 *   - Slab / Slab-opening: every vertex of `params.outline` rotated.
 *
 *   - Column: `position` rotated around pivot; `params.rotation` (the
 *     intrinsic column-shape rotation around its anchor) accumulates by
 *     `+angleDeg`. Anchor stays — anchor is a local reference within the
 *     shape, invariant under rotation.
 *
 *   - Beam: `startPoint`, `endPoint`, and `curveControl` (if present)
 *     rotated.
 *
 *   - Stair: `basePoint` rotated around pivot; `direction` (deg, 0 = +X)
 *     accumulates by `+angleDeg`. Treads/stringers/walkline derive from
 *     these two fields via `computeStairGeometry`.
 *
 * Pure function — no React, no store reads, no IO.
 *
 * @see bim/transforms/bim-mirror-geometry.ts — sibling SSoT, Phase 7.2
 * @see utils/rotation-math.ts — non-BIM rotation primitives
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
import type {
  ColumnEntity,
  ColumnParams,
} from '../types/column-types';
import type { BeamEntity, BeamParams } from '../types/beam-types';
import type { StairEntity, StairParams } from '../types/stair-types';
import type { Polygon3D as BimPolygon3D } from '../types/bim-base';
import type { Point3D as RenderPoint3D } from '../../rendering/types/Types';
import { computeWallGeometry } from '../geometry/wall-geometry';
import { computeSlabGeometry } from '../geometry/slab-geometry';
import { computeSlabOpeningGeometry } from '../geometry/slab-opening-geometry';
import { computeColumnGeometry } from '../geometry/column-geometry';
import { computeBeamGeometry } from '../geometry/beam-geometry';
import { computeStairGeometry } from '../geometry/stairs/StairGeometryService';
import { rotatePoint } from '../../utils/rotation-math';
import { normalizeAngleDeg } from '../../rendering/entities/shared/geometry-utils';

// ─── Point/Polygon rotate helpers (z preserved) ─────────────────────────────

/**
 * Rotate a 3D point around a 2D pivot in the plan view. The z component is
 * preserved verbatim — rotation is a horizontal operation and never affects
 * elevation. Works for both `bim-base` Point3D (z?: optional) and
 * `rendering/types/Types` Point3D (z: required) via generic preservation.
 */
function rotatePoint3D<P extends { x: number; y: number; z?: number }>(
  p: P,
  pivot: Point2D,
  angleDeg: number,
): P {
  const r = rotatePoint({ x: p.x, y: p.y }, pivot, angleDeg);
  return { ...p, x: r.x, y: r.y };
}

function rotatePolygon3D(
  poly: BimPolygon3D,
  pivot: Point2D,
  angleDeg: number,
): BimPolygon3D {
  return { vertices: poly.vertices.map((v) => rotatePoint3D(v, pivot, angleDeg)) };
}

// ─── Per-kind rotate ────────────────────────────────────────────────────────

function rotateWall(
  entity: WallEntity,
  pivot: Point2D,
  angleDeg: number,
): Partial<SceneEntity> {
  const newParams: WallParams = {
    ...entity.params,
    start: rotatePoint3D(entity.params.start, pivot, angleDeg),
    end: rotatePoint3D(entity.params.end, pivot, angleDeg),
    polylineVertices: entity.params.polylineVertices?.map((v) =>
      rotatePoint3D(v, pivot, angleDeg),
    ),
    curveControl: entity.params.curveControl
      ? rotatePoint3D(entity.params.curveControl, pivot, angleDeg)
      : undefined,
  };
  const kind: WallKind = entity.kind;
  const geometry = computeWallGeometry(newParams, kind);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

function rotateSlab(
  entity: SlabEntity,
  pivot: Point2D,
  angleDeg: number,
): Partial<SceneEntity> {
  const newParams: SlabParams = {
    ...entity.params,
    outline: rotatePolygon3D(entity.params.outline, pivot, angleDeg),
  };
  const geometry = computeSlabGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

function rotateSlabOpening(
  entity: SlabOpeningEntity,
  pivot: Point2D,
  angleDeg: number,
): Partial<SceneEntity> {
  const newParams: SlabOpeningParams = {
    ...entity.params,
    outline: rotatePolygon3D(entity.params.outline, pivot, angleDeg),
  };
  const geometry = computeSlabOpeningGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

function rotateColumn(
  entity: ColumnEntity,
  pivot: Point2D,
  angleDeg: number,
): Partial<SceneEntity> {
  const newParams: ColumnParams = {
    ...entity.params,
    position: rotatePoint3D(entity.params.position, pivot, angleDeg),
    rotation: normalizeAngleDeg(entity.params.rotation + angleDeg),
  };
  const geometry = computeColumnGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

function rotateBeam(
  entity: BeamEntity,
  pivot: Point2D,
  angleDeg: number,
): Partial<SceneEntity> {
  const newParams: BeamParams = {
    ...entity.params,
    startPoint: rotatePoint3D(entity.params.startPoint, pivot, angleDeg),
    endPoint: rotatePoint3D(entity.params.endPoint, pivot, angleDeg),
    curveControl: entity.params.curveControl
      ? rotatePoint3D(entity.params.curveControl, pivot, angleDeg)
      : undefined,
  };
  const geometry = computeBeamGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

function rotateStair(
  entity: StairEntity,
  pivot: Point2D,
  angleDeg: number,
): Partial<SceneEntity> {
  const newBasePoint: RenderPoint3D = rotatePoint3D(
    entity.params.basePoint,
    pivot,
    angleDeg,
  );
  const newParams: StairParams = {
    ...entity.params,
    basePoint: newBasePoint,
    direction: normalizeAngleDeg(entity.params.direction + angleDeg),
  };
  const geometry = computeStairGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

// ─── Top-level dispatcher ───────────────────────────────────────────────────

/**
 * Returns the partial entity patch (`{params, geometry}`) for rotating a BIM
 * entity around a 2D pivot by `angleDeg` (CCW positive, AutoCAD/DXF
 * convention).
 *
 * Returns `null` for non-BIM types (caller falls through to the generic
 * `rotateEntity()` path in `utils/rotation-math.ts`).
 *
 * Returns `{}` for openings — they follow their host wall automatically.
 */
export function calculateBimRotatedGeometry(
  entity: Entity,
  pivot: Point2D,
  angleDeg: number,
): Partial<SceneEntity> | null {
  switch (entity.type) {
    case 'wall':
      return rotateWall(entity, pivot, angleDeg);
    case 'opening':
      // Hosted-derived — no own params change. The opening follows via the
      // ADR-363 §5.4 cascade: RotateEntityCommand calls
      // `cascadeHostedOpeningsForWalls(entityIds)` after rotating the wall.
      return {};
    case 'slab':
      return rotateSlab(entity, pivot, angleDeg);
    case 'slab-opening':
      return rotateSlabOpening(entity, pivot, angleDeg);
    case 'column':
      return rotateColumn(entity, pivot, angleDeg);
    case 'beam':
      return rotateBeam(entity, pivot, angleDeg);
    case 'stair':
      return rotateStair(entity, pivot, angleDeg);
    default:
      return null;
  }
}
