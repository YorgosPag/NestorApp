/**
 * gizmo-projection.ts — pure projection math for constrained gizmo drag.
 *
 * PORTED from GenArc ADR-022 (Gizmo System) — no Three.js scene dependency.
 * @related ADR-402 (3D Viewport BIM Element Editing) — GenArc gizmo port.
 */

import * as THREE from 'three';
import type { GizmoDragConstraint } from './gizmo-types';
import { Y_AXIS_TOP_DOWN_THRESHOLD } from './gizmo-constants';

// Reusable temp vectors to avoid GC pressure
const _w = new THREE.Vector3();
const _d = new THREE.Vector3();
const _e = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _normal = new THREE.Vector3();

const PARALLEL_EPSILON = 1e-6;

const AXIS_DIRS: Record<string, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

const PLANE_NORMALS: Record<string, THREE.Vector3> = {
  xy: new THREE.Vector3(0, 0, 1),
  xz: new THREE.Vector3(0, 1, 0),
  yz: new THREE.Vector3(1, 0, 0),
};

/** Closest point on `axis` line to the mouse `ray` (two-line closest-point). */
export function projectOntoAxis(
  rayOrigin: THREE.Vector3,
  rayDir: THREE.Vector3,
  axisOrigin: THREE.Vector3,
  axisDir: THREE.Vector3,
): THREE.Vector3 {
  _d.copy(rayDir);
  _e.copy(axisDir);
  _w.copy(rayOrigin).sub(axisOrigin);

  const a = _d.dot(_d);
  const b = _d.dot(_e);
  const c = _e.dot(_e);
  const D = _d.dot(_w);
  const E = _e.dot(_w);
  const denom = a * c - b * b;

  if (Math.abs(denom) < PARALLEL_EPSILON) return axisOrigin.clone();

  const t = (a * E - b * D) / denom;
  return _tmp.copy(axisDir).multiplyScalar(t).add(axisOrigin).clone();
}

/** Standard ray-plane intersection. Returns `null` if parallel or behind camera. */
export function projectOntoPlane(
  rayOrigin: THREE.Vector3,
  rayDir: THREE.Vector3,
  planeOrigin: THREE.Vector3,
  planeNormal: THREE.Vector3,
): THREE.Vector3 | null {
  const denom = rayDir.dot(planeNormal);
  if (Math.abs(denom) < PARALLEL_EPSILON) return null;

  const t = _tmp.copy(planeOrigin).sub(rayOrigin).dot(planeNormal) / denom;
  if (t < 0) return null;

  return _tmp.copy(rayDir).multiplyScalar(t).add(rayOrigin).clone();
}

/** Fallback for Y-axis when camera looks nearly straight down. */
export function projectVerticalScreenDrag(
  rayOrigin: THREE.Vector3,
  rayDir: THREE.Vector3,
  axisOrigin: THREE.Vector3,
  cameraDir: THREE.Vector3,
): THREE.Vector3 {
  _normal.set(cameraDir.x, 0, cameraDir.z);
  if (_normal.lengthSq() < PARALLEL_EPSILON) _normal.set(1, 0, 0);
  else _normal.normalize();

  const hit = projectOntoPlane(rayOrigin, rayDir, axisOrigin, _normal);
  if (!hit) return axisOrigin.clone();

  return new THREE.Vector3(axisOrigin.x, hit.y, axisOrigin.z);
}

/** Main dispatcher — projects mouse ray according to the active constraint. */
export function projectConstrained(
  rayOrigin: THREE.Vector3,
  rayDir: THREE.Vector3,
  gizmoOrigin: THREE.Vector3,
  constraint: GizmoDragConstraint,
  cameraDir: THREE.Vector3,
): THREE.Vector3 {
  // 'resize' projects along its axis exactly like 'axis' — the handle is offset
  // along the stem but the drag still slides on the axis line through the origin
  // (ADR-402 Phase B). The resize MAGNITUDE is derived downstream from this slide.
  if (constraint.kind === 'axis' || constraint.kind === 'resize') {
    const axisDir = AXIS_DIRS[constraint.axis];

    if (constraint.axis === 'y' && Math.abs(cameraDir.y) > Y_AXIS_TOP_DOWN_THRESHOLD) {
      return projectVerticalScreenDrag(rayOrigin, rayDir, gizmoOrigin, cameraDir);
    }
    return projectOntoAxis(rayOrigin, rayDir, gizmoOrigin, axisDir);
  }

  if (constraint.kind === 'plane') {
    const planeNormal = PLANE_NORMALS[constraint.plane];
    return projectOntoPlane(rayOrigin, rayDir, gizmoOrigin, planeNormal) ?? gizmoOrigin.clone();
  }

  // ADR-408 Φ-D/Φ1 'endpoint' — move ONE node in a plane through the endpoint.
  //   `'free-3d'` (σωλήνες): the CAMERA-FACING plane → yields BOTH plan (κάτοψη) and
  //     elevation (υψόμετρο) in one drag (Revit / SketchUp "move in view plane"). Top
  //     view → pure plan; a side/front view → elevation.
  //   `'horizontal'` (τοίχος/δοκός): the GROUND plane (normal world-Y) → καθαρά plan,
  //     το Y μένει σταθερό (το μήκος είναι plan dimension· το ύψος = ξεχωριστή λαβή/Τύπος).
  // The downstream bridge splits the world delta into a DXF-plan delta + a vertical
  // (world-Y) mm delta — which is ≈0 for the horizontal mode by construction.
  if (constraint.kind === 'endpoint') {
    const planeNormal = constraint.mode === 'horizontal' ? AXIS_DIRS.y : cameraDir;
    return projectOntoPlane(rayOrigin, rayDir, gizmoOrigin, planeNormal) ?? gizmoOrigin.clone();
  }

  // 'free' — project onto ground plane (xz), keep current Y
  return projectOntoPlane(rayOrigin, rayDir, gizmoOrigin, AXIS_DIRS.y) ?? gizmoOrigin.clone();
}
