/**
 * Zoom-to-fit calculations for perspective and orthographic cameras.
 * PORT_AS_IS from GenArc viewportFraming.ts (ADR-366 §8.2 SPEC-3D-004A).
 */

import * as THREE from 'three';
import { DEFAULT_ORTHO_SIZE, FRAME_PADDING_FACTOR } from './viewport-constants';

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
  return { position, target: _center.clone(), orthoZoom: 1 };
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
