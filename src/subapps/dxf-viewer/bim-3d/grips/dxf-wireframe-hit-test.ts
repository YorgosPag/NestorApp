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
 * Scope (ADR-537 v1): single active floor, mm-unit scenes (the shared `dxfPlanToWorld`
 * projector is mm-based — a non-mm scene's wireframe is unit-scaled while the grips are
 * not, so picking is gated to mm to avoid misalignment; non-mm is a documented follow-up).
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
 * Nearest raw DXF entity id whose geometry is within `tolMm` of plan point `p`, or null.
 * Pure (no THREE) — the core unit-test target. Skips invisible entities + unsupported types.
 */
export function nearestDxfEntityWithin(
  entities: readonly DxfEntityUnion[],
  p: Point2D,
  tolMm: number,
): string | null {
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
  return bestId;
}

/**
 * Pick the raw DXF entity under the cursor in the 3D viewport, or null. Projects the
 * cursor onto the DXF floor plane (Y=0), converts to plan-mm, derives a zoom-scaled
 * tolerance, and runs the proximity test. Gated to mm-unit scenes (see file header).
 */
export function pickDxfEntityAt(
  dxfScene: DxfScene | null,
  camera: THREE.Camera,
  dom: HTMLElement,
  clientX: number,
  clientY: number,
): string | null {
  if (!dxfScene || dxfScene.entities.length === 0) return null;
  if (dxfScene.units && dxfScene.units !== 'mm') return null; // v1: mm scenes only
  const ndc = clientToNdc(dom, clientX, clientY);
  if (!ndc) return null;
  _raycaster.setFromCamera(ndc, camera);
  if (!_raycaster.ray.intersectPlane(_floorPlane, _hit)) return null;
  const plan = worldToDxfPlan(_hit);
  const dist = camera.position.distanceTo(_hit);
  const mmPerPx = getPixelWorldSize(dist, camera, dom) * 1000; // metres/px → mm/px
  const tolMm = (mmPerPx > 0 ? mmPerPx : 1) * PICK_RADIUS_PX;
  return nearestDxfEntityWithin(dxfScene.entities, { x: plan.x, y: plan.y }, tolMm);
}
