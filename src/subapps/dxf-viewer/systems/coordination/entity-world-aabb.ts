/**
 * ADR-435 — Entity → ClashEntity normaliser (SSoT, Slice 0).
 *
 * The cached `entity.geometry.bbox` is NOT directly usable for 3D collision:
 *   - XY is in **canvas/scene units**, Z is already in **metres** (mixed).
 *   - `column` / `mep-fixture` / `mep-radiator` / `mep-boiler` / `mep-water-heater`
 *     store `bbox.z = 0` (footprint only) — the real vertical extent lives in
 *     params (`height`, or `mountingElevationMm ± bodyHeightMm/2`).
 *
 * This module is the ONE place that reconciles all of that into a single
 * consistent metric space: `(planX_m, planY_m, elevation_m)`. MEP segments also
 * yield an exact capsule (axis + radius) for the narrow-phase. THREE-free → the
 * whole engine stays pure/headless/testable.
 *
 * @see ./clash-types.ts
 * @see ../../utils/scene-units.ts (sceneUnitsToMeters)
 */

import type { Entity } from '../../types/entities';
import {
  isMepSegmentEntity, isMepFittingEntity, isBeamEntity, isColumnEntity,
  isWallEntity, isSlabEntity, isMepFixtureEntity, isMepRadiatorEntity,
  isMepBoilerEntity, isMepWaterHeaterEntity,
} from '../../types/entities';
import type { SceneUnits } from '../../utils/scene-units';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import type { BoundingBox3D } from '../../bim/types/bim-base';
import type { MepSegmentEntity } from '../../bim/types/mep-segment-types';
import { resolveSegmentSection, resolveSegmentEndpointElevationsMm } from '../../bim/types/mep-segment-types';
import type { Aabb3, ClashEntity, Vec3 } from './clash-types';
import { aabbFromPoints } from './aabb';

const MM_TO_M = 0.001;

/** Inflate an AABB by `r` metres on every side (Minkowski radius). */
function inflate(box: Aabb3, r: number): Aabb3 {
  return {
    min: { x: box.min.x - r, y: box.min.y - r, z: box.min.z - r },
    max: { x: box.max.x + r, y: box.max.y + r, z: box.max.z + r },
  };
}

/** Cached bbox → metres, taking XY from the (canvas-unit) bbox and Z from caller. */
function bboxToAabb(bbox: BoundingBox3D, sceneToM: number, zMinM: number, zMaxM: number): Aabb3 {
  return {
    min: { x: bbox.min.x * sceneToM, y: bbox.min.y * sceneToM, z: zMinM },
    max: { x: bbox.max.x * sceneToM, y: bbox.max.y * sceneToM, z: zMaxM },
  };
}

/** A linear MEP segment → capsule-derived AABB + exact capsule. */
function segmentEntity(e: MepSegmentEntity, sceneToM: number, systemIds: readonly string[]): ClashEntity {
  const p = e.params;
  const elev = resolveSegmentEndpointElevationsMm(p);
  const a: Vec3 = { x: p.startPoint.x * sceneToM, y: p.startPoint.y * sceneToM, z: elev.startMm * MM_TO_M };
  const b: Vec3 = { x: p.endPoint.x * sceneToM, y: p.endPoint.y * sceneToM, z: elev.endMm * MM_TO_M };
  const section = resolveSegmentSection(p);
  const radiusM = (Math.max(section.widthMm, section.heightMm) / 2) * MM_TO_M;
  return {
    id: e.id,
    kind: 'mep-segment',
    aabb: inflate(aabbFromPoints(a, b), radiusM),
    capsule: { a, b, radiusM },
    discipline: p.classification,
    systemIds,
  };
}

/**
 * Resolve the elevation span (metres) of a point-mounted equipment box whose
 * cached bbox carries z=0. Convention (shared by fixture/radiator/boiler/heater):
 * the box spans `mountingElevationMm ± bodyHeightMm/2`.
 */
function mountedSpanM(mountingElevationMm: number, bodyHeightMm: number): readonly [number, number] {
  return [(mountingElevationMm - bodyHeightMm / 2) * MM_TO_M, (mountingElevationMm + bodyHeightMm / 2) * MM_TO_M];
}

/**
 * Normalise any scene `Entity` into a {@link ClashEntity}, or `null` when the kind
 * carries no clash-relevant 3D solid. `systemIds` (MepSystem memberships) come from
 * the orchestrator's membership map (legit-connection filtering).
 */
export function entityWorldAABB(
  entity: Entity,
  sceneUnits: SceneUnits,
  systemIds: readonly string[],
): ClashEntity | null {
  const sceneToM = sceneUnitsToMeters(sceneUnits);

  if (isMepSegmentEntity(entity)) return segmentEntity(entity, sceneToM, systemIds);

  if (isBeamEntity(entity) || isWallEntity(entity) || isSlabEntity(entity) || isMepFittingEntity(entity)) {
    const bbox = entity.geometry.bbox; // Z already in metres for these kinds
    return { id: entity.id, kind: entity.type, aabb: bboxToAabb(bbox, sceneToM, bbox.min.z, bbox.max.z), systemIds };
  }

  if (isColumnEntity(entity)) {
    const bbox = entity.geometry.bbox; // z=0 footprint → column rises floor→height
    const aabb = bboxToAabb(bbox, sceneToM, 0, entity.params.height * MM_TO_M);
    return { id: entity.id, kind: 'column', aabb, systemIds };
  }

  if (isMepFixtureEntity(entity) || isMepRadiatorEntity(entity) || isMepBoilerEntity(entity) || isMepWaterHeaterEntity(entity)) {
    const bbox = entity.geometry.bbox; // z=0 footprint → vertical span from params
    const [zMin, zMax] = mountedSpanM(entity.params.mountingElevationMm, entity.params.bodyHeightMm);
    return { id: entity.id, kind: entity.type, aabb: bboxToAabb(bbox, sceneToM, zMin, zMax), systemIds };
  }

  return null;
}
