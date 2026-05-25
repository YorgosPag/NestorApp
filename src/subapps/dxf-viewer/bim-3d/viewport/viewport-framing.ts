/**
 * Zoom-to-fit calculations for perspective and orthographic cameras.
 * PORT_AS_IS from GenArc viewportFraming.ts (ADR-366 §8.2 SPEC-3D-004A).
 * Phase 4.1: computeFramingForView convenience wrapper for canonical views.
 */

import * as THREE from 'three';
import { DEFAULT_ORTHO_SIZE, FRAME_PADDING_FACTOR, ORTHO_CAMERA_UP } from './viewport-constants';
import type { CanonicalViewId } from './viewport-types';
import { getCanonicalViewDef } from './canonical-views';

export interface FramingResult {
  readonly position: THREE.Vector3;
  readonly target: THREE.Vector3;
  readonly orthoZoom: number;
}

const _center = new THREE.Vector3();
const _size = new THREE.Vector3();

export function computePerspectiveFraming(
  min: THREE.Vector3,
  max: THREE.Vector3,
  viewDir: THREE.Vector3,
  aspect: number,
  fovDeg: number,
): FramingResult {
  _center.addVectors(min, max).multiplyScalar(0.5);
  _size.subVectors(max, min);
  const radius = _size.length() * 0.5;
  const fovRad = THREE.MathUtils.degToRad(fovDeg);
  const effectiveFov = aspect >= 1
    ? fovRad
    : 2 * Math.atan(Math.tan(fovRad / 2) * aspect);
  const distance = (radius / Math.tan(effectiveFov / 2)) * FRAME_PADDING_FACTOR;
  const position = new THREE.Vector3().copy(_center).addScaledVector(viewDir, -distance);
  // DEBUG — remove after fix confirmed
  console.log('[3D-DEBUG][computePerspectiveFraming]', {
    min: min.toArray().map(v => +v.toFixed(2)).join(','),
    max: max.toArray().map(v => +v.toFixed(2)).join(','),
    radius: +radius.toFixed(2),
    distance: +distance.toFixed(2),
    camPos: position.toArray().map(v => +v.toFixed(2)).join(','),
    withinFar: distance < 1000,
  });
  return { position, target: _center.clone(), orthoZoom: 1 };
}

/** Scene bounding box (world space). */
export interface SceneBounds {
  readonly min: THREE.Vector3;
  readonly max: THREE.Vector3;
}

/**
 * Compute framing for a canonical view ID given scene bounds.
 * Ortho views use computeOrthoFraming; iso/perspective use computePerspectiveFraming.
 * Phase 4.1 — used by CanonicalViewService.snapTo with frame-to-fit (Phase 4.4+).
 */
export function computeFramingForView(
  viewId: CanonicalViewId,
  bounds: SceneBounds,
  aspect: number,
  fovDeg: number,
): FramingResult {
  const def = getCanonicalViewDef(viewId);
  if (!def) {
    const fallbackDir = new THREE.Vector3(1, 0, 0);
    return computePerspectiveFraming(bounds.min, bounds.max, fallbackDir, aspect, fovDeg);
  }
  const viewDir = new THREE.Vector3(def.lookDir[0], def.lookDir[1], def.lookDir[2]).normalize();
  if (def.type === 'ortho' && def.projectionMode) {
    const upArr = ORTHO_CAMERA_UP[def.projectionMode] ?? [0, 1, 0];
    const up = new THREE.Vector3(upArr[0], upArr[1], upArr[2]);
    return computeOrthoFraming(bounds.min, bounds.max, viewDir, up, aspect);
  }
  return computePerspectiveFraming(bounds.min, bounds.max, viewDir, aspect, fovDeg);
}

export function computeOrthoFraming(
  min: THREE.Vector3,
  max: THREE.Vector3,
  viewDir: THREE.Vector3,
  cameraUp: THREE.Vector3,
  aspect: number,
): FramingResult {
  _center.addVectors(min, max).multiplyScalar(0.5);
  _size.subVectors(max, min);
  const right = new THREE.Vector3().crossVectors(viewDir, cameraUp).normalize();
  const up = new THREE.Vector3().crossVectors(right, viewDir).normalize();
  const halfX = Math.abs(_size.dot(right)) * 0.5;
  const halfY = Math.abs(_size.dot(up)) * 0.5;
  const zoomX = aspect > 0 ? DEFAULT_ORTHO_SIZE / (halfX * FRAME_PADDING_FACTOR) : 1;
  const zoomY = DEFAULT_ORTHO_SIZE / (halfY * FRAME_PADDING_FACTOR);
  const orthoZoom = Math.min(zoomX, zoomY);
  const position = new THREE.Vector3().copy(_center).addScaledVector(viewDir, -50);
  return { position, target: _center.clone(), orthoZoom: Math.max(orthoZoom, 0.01) };
}
