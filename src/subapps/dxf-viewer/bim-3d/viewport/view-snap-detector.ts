/**
 * Pure Smart View Snap detector — no side effects, safe to call every frame.
 * PORT_AS_IS from GenArc viewSnapDetector.ts (ADR-366 §8.2 SPEC-3D-004A).
 */

import * as THREE from 'three';
import type { CanonicalViewDef } from './viewport-types';
import { CANONICAL_VIEWS, SNAP_PROXIMITY_THRESHOLD } from './viewport-constants';

const _lookDir = new THREE.Vector3();

/**
 * Returns the nearest canonical view if camera look direction is within
 * SNAP_PROXIMITY_THRESHOLD (~23°) of a canonical direction, or null.
 */
export function detectSnapCandidate(
  cameraPos: THREE.Vector3,
  target: THREE.Vector3,
): CanonicalViewDef | null {
  _lookDir.subVectors(target, cameraPos).normalize();
  let best: CanonicalViewDef | null = null;
  let bestDot = SNAP_PROXIMITY_THRESHOLD;
  for (const view of CANONICAL_VIEWS) {
    const dot =
      _lookDir.x * view.lookDir[0] +
      _lookDir.y * view.lookDir[1] +
      _lookDir.z * view.lookDir[2];
    if (dot > bestDot) { bestDot = dot; best = view; }
  }
  return best;
}
