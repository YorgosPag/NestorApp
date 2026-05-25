/**
 * ADR-366 Phase 9 / C.1.a — Waypoint Path Builder (pure)
 *
 * Converts a user-authored waypoint list (κάθε segment έχει own easing-to-next)
 * to a frame-by-frame InterpolatedFrame sequence. Sample count derived από
 * durationSec * fps. Time is evenly distributed across segments by waypoint
 * count (uniform time per segment, NOT distance-based — matches Twinmotion
 * / Lumion convention).
 *
 * Delegates per-segment interpolation στο keyframe-interpolator (linked vs
 * split-tracks aware via the splitTracks flag).
 *
 * Pure function — deterministic.
 */

import { interpolateFrame } from './keyframe-interpolator';
import type {
  AnimationConfig,
  InterpolatedFrame,
  Waypoint,
} from '../animation-types';

export type WaypointPathBuildConfig = Pick<
  AnimationConfig,
  'durationSec' | 'fps' | 'splitTracks'
>;

/**
 * Build frame samples across waypoints. Edge cases:
 *  - 0 waypoints → empty array
 *  - 1 waypoint → array of 1 static frame at t=0
 *  - N waypoints → durationSec * fps frames distributed uniformly
 */
export function buildWaypointPath(
  waypoints: ReadonlyArray<Waypoint>,
  config: WaypointPathBuildConfig,
): ReadonlyArray<InterpolatedFrame> {
  if (waypoints.length === 0) return [];

  if (waypoints.length === 1) {
    const wp = waypoints[0]!;
    return [{
      position: wp.position,
      target: wp.target,
      fov: wp.fov,
      timeSec: 0,
    }];
  }

  const totalFrames = Math.max(2, Math.round(config.durationSec * config.fps));
  const segmentCount = waypoints.length - 1;
  const frames: InterpolatedFrame[] = new Array(totalFrames);

  for (let i = 0; i < totalFrames; i++) {
    // Global progress 0..1 across the entire path.
    const globalT = i / (totalFrames - 1);
    const timeSec = globalT * config.durationSec;

    // Locate segment + local t within segment.
    const segmentFloat = globalT * segmentCount;
    let segmentIdx = Math.floor(segmentFloat);
    let localT = segmentFloat - segmentIdx;

    // Clamp last frame to last segment (avoid index overflow).
    if (segmentIdx >= segmentCount) {
      segmentIdx = segmentCount - 1;
      localT = 1;
    }

    const from = waypoints[segmentIdx]!;
    const to = waypoints[segmentIdx + 1]!;

    frames[i] = interpolateFrame({
      from,
      to,
      t: localT,
      timeSec,
      splitTracks: config.splitTracks,
    });
  }

  return frames;
}
