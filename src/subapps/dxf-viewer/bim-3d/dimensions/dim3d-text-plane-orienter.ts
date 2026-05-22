/**
 * ADR-366 Phase 9 / C.3.Q5 — Text plane orientation resolver.
 *
 * Resolves the quaternion that orients the dimension text sprite/mesh:
 *  - 'billboard' → faces camera every frame (computed at render).
 *  - 'world'     → locks to the measured plane (computed once on placement).
 *
 * Both branches stay pure here — the renderer decides whether to re-apply per
 * frame (billboard) or per mutation (world-locked).
 */

import { Quaternion, Vector3 } from 'three';
import type { Dim3DAnchor, Dim3DTextPlane, Vec3 } from './dim3d-types';

const _tmpA = new Vector3();
const _tmpB = new Vector3();
const _tmpForward = new Vector3();
const _tmpUp = new Vector3();

/**
 * Compute world-plane lock quaternion. Aligns text X axis with measured segment
 * and text normal with the measurement plane normal.
 */
export function computeWorldPlaneQuaternion(
  anchor: Dim3DAnchor,
  planeNormal: Vec3,
): Quaternion {
  _tmpA.set(anchor.endpointA.x, anchor.endpointA.y, anchor.endpointA.z);
  _tmpB.set(anchor.endpointB.x, anchor.endpointB.y, anchor.endpointB.z);
  _tmpForward.subVectors(_tmpB, _tmpA);
  if (_tmpForward.lengthSq() === 0) {
    return new Quaternion();
  }
  _tmpForward.normalize();
  _tmpUp.set(planeNormal.x, planeNormal.y, planeNormal.z).normalize();
  const right = _tmpForward;
  const up = _tmpUp;
  const out = new Vector3().crossVectors(right, up).normalize();
  const m = [
    right.x, up.x, out.x,
    right.y, up.y, out.y,
    right.z, up.z, out.z,
  ];
  return matrixToQuaternion(m);
}

/**
 * Build billboard quaternion: text plane perpendicular to camera direction
 * (always faces user). Caller passes camera world position; sprite world
 * position determines forward vector.
 */
export function computeBillboardQuaternion(
  spritePosition: Vec3,
  cameraPosition: Vec3,
): Quaternion {
  _tmpForward
    .set(
      cameraPosition.x - spritePosition.x,
      cameraPosition.y - spritePosition.y,
      cameraPosition.z - spritePosition.z,
    );
  if (_tmpForward.lengthSq() === 0) return new Quaternion();
  _tmpForward.normalize();
  // World up reference. If camera is straight overhead, fall back to Z+.
  _tmpUp.set(0, 1, 0);
  if (Math.abs(_tmpForward.dot(_tmpUp)) > 0.999) _tmpUp.set(0, 0, 1);
  const right = new Vector3().crossVectors(_tmpUp, _tmpForward).normalize();
  const up = new Vector3().crossVectors(_tmpForward, right).normalize();
  return matrixToQuaternion([
    right.x, up.x, _tmpForward.x,
    right.y, up.y, _tmpForward.y,
    right.z, up.z, _tmpForward.z,
  ]);
}

/**
 * Resolve quaternion based on text plane mode. Caller signals billboard mode
 * by passing cameraPosition; world-lock mode by passing planeNormal.
 */
export function resolveTextPlaneQuaternion(
  mode: Dim3DTextPlane,
  anchor: Dim3DAnchor,
  context: { cameraPosition?: Vec3; planeNormal?: Vec3; spritePosition?: Vec3 },
): Quaternion {
  if (mode === 'billboard') {
    if (!context.cameraPosition || !context.spritePosition) {
      return new Quaternion();
    }
    return computeBillboardQuaternion(context.spritePosition, context.cameraPosition);
  }
  return computeWorldPlaneQuaternion(anchor, context.planeNormal ?? { x: 0, y: 1, z: 0 });
}

// ──────────────────────────────────────────────────────────────────────────────
// Internal: 3x3 rotation matrix → quaternion (Shepperd's method).
// ──────────────────────────────────────────────────────────────────────────────

function matrixToQuaternion(m: number[]): Quaternion {
  const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = m;
  const trace = m00 + m11 + m22;
  let qw = 0;
  let qx = 0;
  let qy = 0;
  let qz = 0;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1.0) * 2;
    qw = 0.25 * s;
    qx = (m21 - m12) / s;
    qy = (m02 - m20) / s;
    qz = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1.0 + m00 - m11 - m22) * 2;
    qw = (m21 - m12) / s;
    qx = 0.25 * s;
    qy = (m01 + m10) / s;
    qz = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1.0 + m11 - m00 - m22) * 2;
    qw = (m02 - m20) / s;
    qx = (m01 + m10) / s;
    qy = 0.25 * s;
    qz = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1.0 + m22 - m00 - m11) * 2;
    qw = (m10 - m01) / s;
    qx = (m02 + m20) / s;
    qy = (m12 + m21) / s;
    qz = 0.25 * s;
  }
  return new Quaternion(qx, qy, qz, qw);
}
