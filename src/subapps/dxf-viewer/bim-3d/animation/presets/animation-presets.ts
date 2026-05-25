/**
 * ADR-366 Phase 9 / C.1.a — Animation Presets Registry (SSoT)
 *
 * Read-only registry για:
 *  1. 8 easing functions (mapped από EasingPresetId → curve)
 *  2. Turntable defaults (industry convention 8s/30fps/CCW Y-axis)
 *  3. AnimationConfig factory defaults
 *
 * Reuses `viewport/easing-functions.ts` SSoT — no duplication.
 */

import {
  easeLinear,
  easeInCubic,
  easeOutCubic,
  easeInOutCubic,
  easeInQuart,
  easeOutQuart,
  smoothStep,
  easeOutElastic,
} from '../../viewport/easing-functions';
import type {
  AnimationAxis,
  AnimationConfig,
  AnimationDirection,
  AnimationFps,
  EasingPresetId,
} from '../animation-types';

export type EasingFunction = (t: number) => number;

/** Single SSoT mapping EasingPresetId → pure curve. */
export const EASING_PRESETS: Readonly<Record<EasingPresetId, EasingFunction>> =
  Object.freeze({
    'linear': easeLinear,
    'ease-in': easeInCubic,
    'ease-out': easeOutCubic,
    'ease-in-out': easeInOutCubic,
    'ease-in-quart': easeInQuart,
    'ease-out-quart': easeOutQuart,
    'smooth-step': smoothStep,
    'elastic': easeOutElastic,
  });

/** Turntable industry defaults (ADR-366 §C.1.Q1).
 * 4/7 industry convergence: 8s @ 30fps linear CCW Y-axis. */
export const TURNTABLE_DEFAULTS = Object.freeze({
  durationSec: 8 as number,
  fps: 30 as AnimationFps,
  axis: 'y' as AnimationAxis,
  direction: 'ccw' as AnimationDirection,
  easingToNext: 'linear' as EasingPresetId,
});

/** Range bounds για user override panel. */
export const ANIMATION_LIMITS = Object.freeze({
  durationSecMin: 2,
  durationSecMax: 60,
  fpsOptions: [24, 30, 60] as readonly AnimationFps[],
});

/** Factory: empty config for a fresh AnimationStore mount. */
export function createDefaultAnimationConfig(): AnimationConfig {
  return {
    waypoints: [],
    durationSec: TURNTABLE_DEFAULTS.durationSec,
    fps: TURNTABLE_DEFAULTS.fps,
    axis: TURNTABLE_DEFAULTS.axis,
    direction: TURNTABLE_DEFAULTS.direction,
    splitTracks: false,
  };
}

/** Resolve a curve by preset id. Returns linear for unknown ids (defensive). */
export function getEasingFunction(id: EasingPresetId): EasingFunction {
  return EASING_PRESETS[id] ?? easeLinear;
}
