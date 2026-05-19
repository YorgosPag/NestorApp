/**
 * BIM Mirror Geometry — axis-aware reflection per BIM kind (SSoT).
 *
 * ADR-363 Phase 7.2 — Transform BIM (Mirror / Rotate / Copy).
 *
 * Mirrors the structure of `bim/utils/bim-move-geometry.ts`: every params
 * mutation is paired with a `compute<Kind>Geometry()` re-run so the cached
 * `bbox`/footprint/outline stays consistent with the parametric SSoT after
 * the transform. Without recomputing geometry here the renderer would draw
 * the reflected entity at the OLD bbox and spatial-index broad-phase would
 * return the wrong cell.
 *
 * Per-kind semantics (Phase 7.2):
 *
 *   - Wall: `params.start` + `params.end` reflected (+ `polylineVertices` for
 *     the polyline kind). Hosted openings follow automatically because
 *     `computeOpeningGeometry` derives their world position from the wall.
 *
 *   - Opening: handing flip (`'left'` ↔ `'right'`) for hinged kinds
 *     (door / french-door). World position is wall-derived — no XY change
 *     here. Glazed kinds (window / fixed / sliding) are pure no-ops because
 *     they have no handedness.
 *
 *   - Slab / Slab-opening: every vertex of `params.outline` reflected.
 *     Slab-openings have INDEPENDENT world vertices, so they must appear
 *     in the same selection (cascade-resolver responsibility, not here).
 *
 *   - Column: `position` reflected, `rotation` reflected via
 *     `mirrorAngle(rotation, axisAngle)`, `anchor` re-snapped by reflecting
 *     its `(dx, dy)` offset across the axis. L-shape / T-shape arm
 *     handedness is flipped via `lshape.flipY` / `tshape.flipY` toggle.
 *     Proof: local transform T = R(-θ') × M × R(θ) always has T[1][1] = -1
 *     regardless of axisAngle or column rotation — zero runtime computation.
 *
 *   - Beam: `startPoint`, `endPoint`, and `curveControl` (if present)
 *     reflected.
 *
 *   - Stair: `basePoint` reflected, `direction` reflected via
 *     `mirrorAngle(direction, axisAngle)`. The stair's internal walkline,
 *     treads, stringers are all derived from these two fields by
 *     `computeStairGeometry`, so no per-tread reflection is needed.
 *
 * Pure function — no React, no store reads, no IO. Imported by
 * `MirrorEntityCommand` to extend its BIM coverage from no-op
 * (`mirrorEntity()` returns `{}` for BIM kinds) to full atomic patch.
 *
 * @see bim/utils/bim-move-geometry.ts — sibling SSoT, Phase 7.1
 * @see utils/mirror-math.ts — non-BIM mirror primitives (axis/angle helpers)
 */
import type { SceneEntity } from '../../core/commands/interfaces';
import type { Entity } from '../../types/entities';
import type {
  WallEntity,
  WallParams,
  WallKind,
} from '../types/wall-types';
import type {
  OpeningEntity,
  OpeningHanding,
  OpeningParams,
} from '../types/opening-types';
import type { SlabEntity, SlabParams } from '../types/slab-types';
import type {
  SlabOpeningEntity,
  SlabOpeningParams,
} from '../types/slab-opening-types';
import {
  ANCHOR_OFFSETS,
  type ColumnAnchor,
  type ColumnEntity,
  type ColumnParams,
} from '../types/column-types';
import type { BeamEntity, BeamParams } from '../types/beam-types';
import type { StairEntity, StairParams } from '../types/stair-types';
import type { Point3D as BimPoint3D, Polygon3D as BimPolygon3D } from '../types/bim-base';
import type { Point3D as RenderPoint3D } from '../../rendering/types/Types';
import { computeWallGeometry } from '../geometry/wall-geometry';
import { computeSlabGeometry } from '../geometry/slab-geometry';
import { computeSlabOpeningGeometry } from '../geometry/slab-opening-geometry';
import { computeColumnGeometry } from '../geometry/column-geometry';
import { computeBeamGeometry } from '../geometry/beam-geometry';
import { computeStairGeometry } from '../geometry/stairs/StairGeometryService';
import {
  getAxisAngleDeg,
  mirrorAngle,
  mirrorPoint,
  type MirrorAxis,
} from '../../utils/mirror-math';

// ─── Point/Polygon mirror helpers (z preserved) ─────────────────────────────

/**
 * Reflect a 3D point across the 2D `axis` (plan view). The z component is
 * preserved verbatim — mirror is a horizontal operation and never affects
 * elevation. Works for both `bim-base` Point3D (z?: optional) and
 * `rendering/types/Types` Point3D (z: required) via generic preservation.
 */
function mirrorPoint3D<P extends { x: number; y: number; z?: number }>(
  p: P,
  axis: MirrorAxis,
): P {
  const m = mirrorPoint({ x: p.x, y: p.y }, axis);
  return { ...p, x: m.x, y: m.y };
}

function mirrorPolygon3D(poly: BimPolygon3D, axis: MirrorAxis): BimPolygon3D {
  return { vertices: poly.vertices.map((v) => mirrorPoint3D(v, axis)) };
}

// ─── Column anchor reflection ───────────────────────────────────────────────

/**
 * Reflects a `ColumnAnchor` (discrete 9-position selector) across the mirror
 * axis. The anchor's unit-fraction offset `(dx, dy) ∈ {-0.5, 0, +0.5}²` is
 * reflected geometrically, then snapped back to the nearest discrete anchor.
 *
 *   - For axis-aligned mirrors (horizontal/vertical/45°), this is exact.
 *   - For arbitrary axes, the snap quantizes to the closest of 9 positions.
 *
 * `'center'` is invariant under every reflection.
 */
function mirrorColumnAnchor(anchor: ColumnAnchor, axisAngleDeg: number): ColumnAnchor {
  if (anchor === 'center') return 'center';
  const { dx, dy } = ANCHOR_OFFSETS[anchor];
  const rad = (axisAngleDeg * Math.PI) / 180;
  const ax = Math.cos(rad);
  const ay = Math.sin(rad);
  // Reflection of vector d across line through origin with direction n̂(ax, ay):
  //   d' = 2 (d · n̂) n̂ − d
  const dot = dx * ax + dy * ay;
  const rdx = 2 * dot * ax - dx;
  const rdy = 2 * dot * ay - dy;
  return snapAnchorOffset(rdx, rdy);
}

function snapAnchorOffset(dx: number, dy: number): ColumnAnchor {
  const sx: -1 | 0 | 1 = dx > 0.25 ? 1 : dx < -0.25 ? -1 : 0;
  const sy: -1 | 0 | 1 = dy > 0.25 ? 1 : dy < -0.25 ? -1 : 0;
  if (sx === 0 && sy === 0) return 'center';
  if (sx === 0 && sy === 1) return 'n';
  if (sx === 0 && sy === -1) return 's';
  if (sx === 1 && sy === 0) return 'e';
  if (sx === -1 && sy === 0) return 'w';
  if (sx === 1 && sy === 1) return 'ne';
  if (sx === -1 && sy === 1) return 'nw';
  if (sx === 1 && sy === -1) return 'se';
  return 'sw';
}

// ─── Per-kind mirror ────────────────────────────────────────────────────────

function mirrorWall(entity: WallEntity, axis: MirrorAxis): Partial<SceneEntity> {
  const newParams: WallParams = {
    ...entity.params,
    start: mirrorPoint3D(entity.params.start, axis),
    end: mirrorPoint3D(entity.params.end, axis),
    polylineVertices: entity.params.polylineVertices?.map((v) => mirrorPoint3D(v, axis)),
    curveControl: entity.params.curveControl
      ? mirrorPoint3D(entity.params.curveControl, axis)
      : undefined,
  };
  const kind: WallKind = entity.kind;
  const geometry = computeWallGeometry(newParams, kind);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

function mirrorOpening(entity: OpeningEntity): Partial<SceneEntity> {
  // Hinged kinds: flip handing in place. World position derives from host
  // wall, which carries the positional reflection through its own mirror.
  if (entity.kind !== 'door' && entity.kind !== 'french-door') return {};
  const handing = entity.params.handing;
  if (!handing) return {};
  const flipped: OpeningHanding = handing === 'left' ? 'right' : 'left';
  const newParams: OpeningParams = { ...entity.params, handing: flipped };
  // Geometry intentionally not recomputed here — `computeOpeningGeometry`
  // requires the host wall, which the persistence layer re-feeds on the
  // next subscribe roundtrip. The `hingeArc` re-derives correctly then.
  return { params: newParams } as unknown as Partial<SceneEntity>;
}

function mirrorSlab(entity: SlabEntity, axis: MirrorAxis): Partial<SceneEntity> {
  const newParams: SlabParams = {
    ...entity.params,
    outline: mirrorPolygon3D(entity.params.outline, axis),
  };
  const geometry = computeSlabGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

function mirrorSlabOpening(entity: SlabOpeningEntity, axis: MirrorAxis): Partial<SceneEntity> {
  const newParams: SlabOpeningParams = {
    ...entity.params,
    outline: mirrorPolygon3D(entity.params.outline, axis),
  };
  const geometry = computeSlabOpeningGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

function mirrorColumn(entity: ColumnEntity, axis: MirrorAxis): Partial<SceneEntity> {
  const axisAngle = getAxisAngleDeg(axis);
  const base: ColumnParams = {
    ...entity.params,
    position: mirrorPoint3D(entity.params.position, axis),
    rotation: mirrorAngle(entity.params.rotation, axisAngle),
    anchor: mirrorColumnAnchor(entity.params.anchor, axisAngle),
  };

  let newParams: ColumnParams = base;
  if (entity.params.kind === 'L-shape') {
    newParams = {
      ...base,
      lshape: { ...entity.params.lshape, flipY: !(entity.params.lshape?.flipY ?? false) },
    };
  } else if (entity.params.kind === 'T-shape') {
    newParams = {
      ...base,
      tshape: { ...entity.params.tshape, flipY: !(entity.params.tshape?.flipY ?? false) },
    };
  }

  const geometry = computeColumnGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

function mirrorBeam(entity: BeamEntity, axis: MirrorAxis): Partial<SceneEntity> {
  const newParams: BeamParams = {
    ...entity.params,
    startPoint: mirrorPoint3D(entity.params.startPoint, axis),
    endPoint: mirrorPoint3D(entity.params.endPoint, axis),
    curveControl: entity.params.curveControl
      ? mirrorPoint3D(entity.params.curveControl, axis)
      : undefined,
  };
  const geometry = computeBeamGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

function mirrorStair(entity: StairEntity, axis: MirrorAxis): Partial<SceneEntity> {
  const axisAngle = getAxisAngleDeg(axis);
  const newBasePoint: RenderPoint3D = mirrorPoint3D(entity.params.basePoint, axis);
  const newParams: StairParams = {
    ...entity.params,
    basePoint: newBasePoint,
    direction: mirrorAngle(entity.params.direction, axisAngle),
  };
  const geometry = computeStairGeometry(newParams);
  return { params: newParams, geometry } as unknown as Partial<SceneEntity>;
}

// ─── Top-level dispatcher ───────────────────────────────────────────────────

/**
 * Returns the partial entity patch (`{params, geometry}` — or just `{params}`
 * for openings) for mirroring a BIM entity across the given 2D axis. Returns
 * `null` if the entity is not a BIM type (caller falls through to non-BIM
 * mirror logic via `mirrorEntity()` in `utils/mirror-math.ts`).
 *
 * Returns `{}` (empty patch, applied as no-op) for non-hinged openings — their
 * world position derives from the host wall and they have no handedness to
 * flip.
 */
export function calculateBimMirroredGeometry(
  entity: Entity,
  axis: MirrorAxis,
): Partial<SceneEntity> | null {
  switch (entity.type) {
    case 'wall':
      return mirrorWall(entity, axis);
    case 'opening':
      return mirrorOpening(entity);
    case 'slab':
      return mirrorSlab(entity, axis);
    case 'slab-opening':
      return mirrorSlabOpening(entity, axis);
    case 'column':
      return mirrorColumn(entity, axis);
    case 'beam':
      return mirrorBeam(entity, axis);
    case 'stair':
      return mirrorStair(entity, axis);
    default:
      return null;
  }
}

// ─── Internal exports for tests ─────────────────────────────────────────────

export const __testing = {
  mirrorColumnAnchor,
  snapAnchorOffset,
};
