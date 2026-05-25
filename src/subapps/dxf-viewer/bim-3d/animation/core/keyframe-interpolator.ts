/**
 * ADR-366 Phase 9 / C.1.a — Keyframe Interpolator (pure)
 *
 * Interpolates a single frame between two adjacent waypoints.
 *
 *  - Linked mode (default, 95% architectural walkthroughs): single easing
 *    applied uniformly to position + target + fov.
 *  - Split-tracks mode (advanced, Blender-style): 3 independent F-curves.
 *    C.1.a placeholder: per-channel uses same easing — full bezier editor
 *    arrives σε C.1.b advanced expander.
 *
 * Pure function — no Three.js dependency. Vec3-based.
 */

import { getEasingFunction } from '../presets/animation-presets';
import type {
  InterpolatedFrame,
  Vec3,
  Waypoint,
} from '../animation-types';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
}

export interface InterpolateFrameInput {
  readonly from: Waypoint;
  readonly to: Waypoint;
  /** Normalized progress 0..1 between `from` and `to`. */
  readonly t: number;
  /** Absolute time in seconds (used για outputted timeSec). */
  readonly timeSec: number;
  /** Linked (single easing) vs split-tracks (independent — placeholder C.1.a). */
  readonly splitTracks: boolean;
}

export function interpolateFrame(input: InterpolateFrameInput): InterpolatedFrame {
  const clampedT = Math.max(0, Math.min(1, input.t));
  const easing = getEasingFunction(input.from.easingToNext);

  if (!input.splitTracks) {
    const eased = easing(clampedT);
    return {
      position: lerpVec3(input.from.position, input.to.position, eased),
      target: lerpVec3(input.from.target, input.to.target, eased),
      fov: lerp(input.from.fov, input.to.fov, eased),
      timeSec: input.timeSec,
    };
  }

  // Split-tracks placeholder: same easing each channel (C.1.b will expose
  // independent F-curves via bezier editor advanced expander).
  const easedPos = easing(clampedT);
  const easedTarget = easing(clampedT);
  const easedFov = easing(clampedT);
  return {
    position: lerpVec3(input.from.position, input.to.position, easedPos),
    target: lerpVec3(input.from.target, input.to.target, easedTarget),
    fov: lerp(input.from.fov, input.to.fov, easedFov),
    timeSec: input.timeSec,
  };
}
