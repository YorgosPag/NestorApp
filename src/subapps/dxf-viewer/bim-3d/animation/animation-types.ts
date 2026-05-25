/**
 * ADR-366 Phase 9 / C.1.a — Animation Domain Types
 *
 * Pure type declarations για το animation system. Καμία dependency εκτός
 * από Firestore Timestamp + Three.js Vector3. Καταναλώνεται από
 * AnimationStore, path builders, keyframe interpolator, και
 * bim-animations.service.
 */

import type { Vector3 } from 'three';
import type { Timestamp } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Easing Presets — 8 curves (ADR-366 §C.1.Q4)
// ---------------------------------------------------------------------------

export type EasingPresetId =
  | 'linear'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'ease-in-quart'
  | 'ease-out-quart'
  | 'smooth-step'
  | 'elastic';

export const EASING_PRESET_IDS: readonly EasingPresetId[] = [
  'linear',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'ease-in-quart',
  'ease-out-quart',
  'smooth-step',
  'elastic',
] as const;

// ---------------------------------------------------------------------------
// Bezier control points — advanced easing override (ADR-366 §C.1.Q4)
// P0 = (0,0) και P3 = (1,1) implied σταθερά. P1, P2 editable.
// ---------------------------------------------------------------------------

export interface BezierControlPoints {
  readonly p1: readonly [number, number];
  readonly p2: readonly [number, number];
}

/** UI clamp/range guidance για bezier editor. X clamped, Y allows overshoot. */
export const BEZIER_RANGES = Object.freeze({
  xMin: 0,
  xMax: 1,
  yMin: -1,
  yMax: 2,
  step: 0.01,
  stepCoarse: 0.1,
});

// ---------------------------------------------------------------------------
// Geometry primitives (mirror Three.js Vector3 shape, no instance dependency)
// ---------------------------------------------------------------------------

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export function vec3FromVector3(v: Vector3): Vec3 {
  return { x: v.x, y: v.y, z: v.z };
}

// ---------------------------------------------------------------------------
// Turntable axis / direction
// ---------------------------------------------------------------------------

export type AnimationAxis = 'x' | 'y' | 'z';
export type AnimationDirection = 'cw' | 'ccw';
export type AnimationFps = 24 | 30 | 60;

// ---------------------------------------------------------------------------
// Waypoint — single keyframe (position + target + fov + easing-to-next)
// ---------------------------------------------------------------------------

export interface Waypoint {
  readonly position: Vec3;
  readonly target: Vec3;
  readonly fov: number;
  readonly easingToNext: EasingPresetId;
  /** ADR-366 §C.1.Q4 — optional advanced override. Αν undefined, easingToNext wins. */
  readonly customBezier?: BezierControlPoints;
}

// ---------------------------------------------------------------------------
// AnimationConfig — runtime state (consumed by AnimationStore)
// ---------------------------------------------------------------------------

export interface AnimationConfig {
  readonly waypoints: ReadonlyArray<Waypoint>;
  readonly durationSec: number;
  readonly fps: AnimationFps;
  readonly axis: AnimationAxis;
  readonly direction: AnimationDirection;
  readonly splitTracks: boolean;
}

// ---------------------------------------------------------------------------
// Interpolated frame — output of path builders + keyframe interpolator
// ---------------------------------------------------------------------------

export interface InterpolatedFrame {
  readonly position: Vec3;
  readonly target: Vec3;
  readonly fov: number;
  readonly timeSec: number;
}

// ---------------------------------------------------------------------------
// Codec discriminator — H.264 primary, VP9 fallback (ADR-366 §C.1.Q6)
// ---------------------------------------------------------------------------

export type AnimationCodec = 'h264' | 'vp9';

// ---------------------------------------------------------------------------
// Render config — basic shape για C.1.a, C.1.c θα επεκτείνει
// ---------------------------------------------------------------------------

export interface RenderConfig {
  readonly width: number;
  readonly height: number;
  readonly qualityPreset: 'draft' | 'standard' | 'high';
}

// ---------------------------------------------------------------------------
// Persisted document (Firestore)
// ---------------------------------------------------------------------------

export interface BimAnimationDoc extends AnimationConfig {
  readonly id: string;
  readonly projectId: string;
  readonly companyId: string;
  readonly name: string;
  readonly codec: AnimationCodec;
  readonly renderConfig: RenderConfig;
  readonly createdBy: string;
  readonly createdAt: Timestamp;
  readonly updatedBy: string;
  readonly updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Render job (subcollection bim_animations/{id}/render_jobs/{jobId})
// ---------------------------------------------------------------------------

export type RenderJobStatus =
  | 'queued'
  | 'rendering'
  | 'done'
  | 'failed'
  | 'cancelled'
  | 'cancelled-resumable';

export interface RenderJobDoc {
  readonly id: string;
  readonly animationId: string;
  readonly companyId: string;
  readonly status: RenderJobStatus;
  readonly progress: number;
  readonly lastSampleCount?: number;
  readonly lastWaypointIndex?: number;
  readonly outputAssetId?: string;
  readonly errorMessage?: string;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}
