/**
 * ADR-366 Phase 9 / C.1.a — Turntable Path Builder (pure)
 *
 * Builds a 360° orbit waypoint list around the scene-bbox-center.
 * Industry defaults: 8s @ 30fps = 240 samples, Y-up axis, CCW from above.
 *
 * Output = ReadonlyArray<Waypoint> ready για WaypointPathBuilder consumption
 * ή direct preview in viewport-camera. Sample count = `durationSec * fps`.
 *
 * Pure function — deterministic given identical inputs. No randomness.
 */

import {
  TURNTABLE_DEFAULTS,
} from '../presets/animation-presets';
import type {
  AnimationAxis,
  AnimationDirection,
  AnimationFps,
  Vec3,
  Waypoint,
} from '../animation-types';

export interface SceneBbox {
  readonly min: Vec3;
  readonly max: Vec3;
}

export interface TurntableBuildOptions {
  readonly durationSec: number;
  readonly fps: AnimationFps;
  readonly axis: AnimationAxis;
  readonly direction: AnimationDirection;
  /** Optional FOV override (default 50° matching viewport-constants). */
  readonly fov?: number;
  /** Optional distance multiplier (default 2.5× bbox diagonal). */
  readonly distanceMultiplier?: number;
}

const DEFAULT_FOV = 50;
const DEFAULT_DISTANCE_MULTIPLIER = 2.5;

function bboxCenter(bbox: SceneBbox): Vec3 {
  return {
    x: (bbox.min.x + bbox.max.x) / 2,
    y: (bbox.min.y + bbox.max.y) / 2,
    z: (bbox.min.z + bbox.max.z) / 2,
  };
}

function bboxDiagonalLength(bbox: SceneBbox): number {
  const dx = bbox.max.x - bbox.min.x;
  const dy = bbox.max.y - bbox.min.y;
  const dz = bbox.max.z - bbox.min.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Compute orbit position on a circle perpendicular to the rotation axis. */
function orbitPosition(
  center: Vec3,
  radius: number,
  theta: number,
  axis: AnimationAxis,
): Vec3 {
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  switch (axis) {
    case 'x':
      return { x: center.x, y: center.y + radius * cosT, z: center.z + radius * sinT };
    case 'z':
      return { x: center.x + radius * cosT, y: center.y + radius * sinT, z: center.z };
    case 'y':
    default:
      return { x: center.x + radius * cosT, y: center.y, z: center.z + radius * sinT };
  }
}

/**
 * Build turntable waypoints. One sample per frame; first sample at θ=0 and
 * last sample loops back to (close to) θ=2π — but NOT inclusive of the
 * duplicate endpoint, ώστε ο combined path να loops cleanly όταν repeated.
 *
 * Sample count = durationSec * fps. Defaults: 8 × 30 = 240 samples.
 */
export function buildTurntablePath(
  sceneBbox: SceneBbox,
  options: Partial<TurntableBuildOptions> = {},
): ReadonlyArray<Waypoint> {
  const durationSec = options.durationSec ?? TURNTABLE_DEFAULTS.durationSec;
  const fps = options.fps ?? TURNTABLE_DEFAULTS.fps;
  const axis = options.axis ?? TURNTABLE_DEFAULTS.axis;
  const direction = options.direction ?? TURNTABLE_DEFAULTS.direction;
  const fov = options.fov ?? DEFAULT_FOV;
  const distanceMultiplier = options.distanceMultiplier ?? DEFAULT_DISTANCE_MULTIPLIER;

  const sampleCount = Math.max(2, Math.round(durationSec * fps));
  const center = bboxCenter(sceneBbox);
  const diagonal = bboxDiagonalLength(sceneBbox);
  const radius = Math.max(0.001, diagonal * 0.5 * distanceMultiplier);
  const directionSign = direction === 'ccw' ? 1 : -1;

  const waypoints: Waypoint[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const theta = directionSign * (2 * Math.PI * (i / sampleCount));
    waypoints.push({
      position: orbitPosition(center, radius, theta, axis),
      target: center,
      fov,
      easingToNext: TURNTABLE_DEFAULTS.easingToNext,
    });
  }
  return waypoints;
}
