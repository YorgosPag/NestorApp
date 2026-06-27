/**
 * dxf-wireframe-hit-test.ts — pick a RAW DXF entity under the cursor in the 3D
 * viewport (ADR-537). The DXF wireframe is batched into per-colour `THREE.LineSegments`
 * with NO per-entity `userData` → it is not raycastable per entity. Instead we project
 * the cursor onto the DXF floor plane (Y=0, where `DxfToThreeConverter` lays the mm
 * wireframe) and run a PLAN-SPACE proximity test over `dxfScene.entities`, reusing the
 * 2D distance SSoT (`pointToLineDistance` / `pointToArcDistance`). Nearest-within-
 * tolerance wins; the tolerance is the cursor pick radius (px) converted to plan-mm at
 * the hit depth via `getPixelWorldSize` (so it scales with the 3D zoom).
 *
 * Scope (ADR-537): single OR stacked floors (`pickDxfEntityAcrossFloors`, ADR-537 δ); ALL
 * scene units (ADR-537 γ). The shared
 * `dxfPlanToWorld` projector is mm-based, while `dxfScene.entities` carry NATIVE DXF
 * coordinates (the wireframe group is unit-scaled to metres). We therefore convert the
 * cursor's plan-mm point + tolerance back to entity units via `dxfSceneUnitToMm` before the
 * entity-space proximity test — one factor at the boundary, no second projector.
 * Types: line / polyline / circle / arc (text has no 3D wireframe).
 *
 * The proximity core is pure (no THREE) → Jest-friendly; the wrapper does the ray/plane
 * projection + tolerance derivation.
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import type { DxfScene, DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import { pointToLineDistance } from '../../rendering/entities/shared/geometry-utils';
import { calculateDistance } from '../../rendering/entities/shared/geometry-vector-utils';
import { pointToArcDistance } from '../../utils/angle-entity-math';
import { clientToNdc } from '../systems/raycaster/BimEntityRaycaster';
import { getPixelWorldSize, worldToDxfPlan } from '../viewport/coordinate-transforms';
import { dxfSceneUnitToMm } from '../../utils/scene-units';

/** Cursor pick radius in screen pixels (generous, mirror the 2D pickbox). */
const PICK_RADIUS_PX = 8;

/** Module-level singletons (avoid per-call allocation, mirror BimEntityRaycaster). */
const _raycaster = new THREE.Raycaster();
const _floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // y = 0
const _hit = new THREE.Vector3();

/**
 * Plan-mm distance from `p` to a raw DXF entity's geometry, or null when the entity type
 * has no editable wireframe (text / BIM wrapper). Reuses the 2D distance SSoT.
 */
export function distanceToDxfEntityMm(entity: DxfEntityUnion, p: Point2D): number | null {
  switch (entity.type) {
    case 'line':
      return pointToLineDistance(p, entity.start, entity.end);
    case 'polyline': {
      const v = entity.vertices;
      if (v.length < 2) return v.length === 1 ? calculateDistance(p, v[0]) : null;
      let min = Infinity;
      const segCount = entity.closed ? v.length : v.length - 1;
      for (let i = 0; i < segCount; i++) {
        const d = pointToLineDistance(p, v[i], v[(i + 1) % v.length]);
        if (d < min) min = d;
      }
      return min;
    }
    case 'circle':
      return Math.abs(calculateDistance(p, entity.center) - entity.radius);
    case 'arc':
      return pointToArcDistance(p, entity);
    default:
      return null;
  }
}

/**
 * Nearest raw DXF entity (id + its distance) within `tolMm` of plan point `p`, or null.
 * Pure (no THREE). The distance is returned so the multi-floor pick can compare hits across
 * vertically-stacked floors (ADR-537 δ). Skips invisible entities + unsupported types.
 */
export function nearestDxfEntityDetailed(
  entities: readonly DxfEntityUnion[],
  p: Point2D,
  tolMm: number,
): { id: string; dist: number } | null {
  let bestId: string | null = null;
  let bestDist = tolMm;
  for (const entity of entities) {
    if (entity.visible === false) continue;
    const d = distanceToDxfEntityMm(entity, p);
    if (d !== null && d <= bestDist) {
      bestDist = d;
      bestId = entity.id;
    }
  }
  return bestId === null ? null : { id: bestId, dist: bestDist };
}

/**
 * Nearest raw DXF entity id whose geometry is within `tolMm` of plan point `p`, or null.
 * Pure (no THREE) — the core unit-test target. Skips invisible entities + unsupported types.
 */
export function nearestDxfEntityWithin(
  entities: readonly DxfEntityUnion[],
  p: Point2D,
  tolMm: number,
): string | null {
  return nearestDxfEntityDetailed(entities, p, tolMm)?.id ?? null;
}

/**
/** Metres-per-mm (Three.js world is metres, DXF plan is mm). */
const MM_TO_M = 0.001;

/** One DXF floor plane the pick can hit: its scene + datum-relative elevation (mm). */
export interface DxfPickFloor {
  readonly scene: DxfScene;
  readonly floorElevationMm: number;
}

/**
 * Pick the raw DXF entity under the cursor across a vertical stack of floor planes
 * (ADR-537 δ). Each floor's plan lies on the horizontal plane `Y = floorElevationMm × 0.001`;
 * the cursor ray is intersected with each plane, the per-floor proximity test runs in that
 * scene's native units (ADR-537 γ), and the globally nearest entity wins — smallest plan-mm
 * perpendicular distance, ties broken by camera proximity (the front-most floor). Returns the
 * hit entity id + its floor elevation (so the caller can seat grips / glow at the right Y), or
 * null. A single-floor scene at elevation 0 reproduces the legacy behaviour exactly.
 */
export function pickDxfEntityAcrossFloors(
  floors: readonly DxfPickFloor[],
  camera: THREE.Camera,
  dom: HTMLElement,
  clientX: number,
  clientY: number,
): { entityId: string; floorElevationMm: number } | null {
  if (floors.length === 0) return null;
  const ndc = clientToNdc(dom, clientX, clientY);
  if (!ndc) return null;
  _raycaster.setFromCamera(ndc, camera);

  let best: { entityId: string; floorElevationMm: number; distMm: number; camDist: number } | null = null;
  for (const floor of floors) {
    if (floor.scene.entities.length === 0) continue;
    _floorPlane.constant = -(floor.floorElevationMm * MM_TO_M); // horizontal plane y = elevation
    if (!_raycaster.ray.intersectPlane(_floorPlane, _hit)) continue;
    const plan = worldToDxfPlan(_hit);
    const camDist = camera.position.distanceTo(_hit);
    const mmPerPx = getPixelWorldSize(camDist, camera, dom) * 1000; // metres/px → mm/px
    const tolMm = (mmPerPx > 0 ? mmPerPx : 1) * PICK_RADIUS_PX;
    // Entities carry native DXF units; cursor/tolerance are in mm → convert to entity units.
    const unitToMm = dxfSceneUnitToMm(floor.scene);
    const planEntity = { x: plan.x / unitToMm, y: plan.y / unitToMm };
    const hit = nearestDxfEntityDetailed(floor.scene.entities, planEntity, tolMm / unitToMm);
    if (!hit) continue;
    const distMm = hit.dist * unitToMm; // back to mm for a cross-floor comparison
    if (
      !best ||
      distMm < best.distMm - 1e-6 ||
      (Math.abs(distMm - best.distMm) <= 1e-6 && camDist < best.camDist)
    ) {
      best = { entityId: hit.id, floorElevationMm: floor.floorElevationMm, distMm, camDist };
    }
  }
  return best ? { entityId: best.entityId, floorElevationMm: best.floorElevationMm } : null;
}

/**
 * Single-floor convenience wrapper over {@link pickDxfEntityAcrossFloors} (floor plane Y=0).
 * Returns the hit entity id, or null. Preserved for the single-scope path + back-compat.
 */
export function pickDxfEntityAt(
  dxfScene: DxfScene | null,
  camera: THREE.Camera,
  dom: HTMLElement,
  clientX: number,
  clientY: number,
): string | null {
  if (!dxfScene) return null;
  return pickDxfEntityAcrossFloors(
    [{ scene: dxfScene, floorElevationMm: 0 }], camera, dom, clientX, clientY,
  )?.entityId ?? null;
}
