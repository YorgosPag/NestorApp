/**
 * Tick-based camera animation manager.
 * ADR-366 Phase 4.2 — single RAF coordination (ADR-040 compliant).
 *
 * Has NO internal requestAnimationFrame — caller drives via tick(nowMs).
 * Designed to be ticked by ThreeJsSceneManager's main scene loop.
 *
 * Capabilities:
 *   - Position + target lerp (THREE.Vector3)
 *   - Zoom lerp (number)
 *   - FOV lerp (perspective camera interpolation)
 *   - Quaternion slerp (smooth orientation interpolation)
 *   - Smooth interruption: new startTransition() blends from current
 *     interpolated state instead of snapping to original `from`.
 */

import * as THREE from 'three';
import { easeInOutCubic } from './easing-functions';

// ── Public types ──────────────────────────────────────────────────────────────

export interface ExtendedCameraState {
  readonly position: THREE.Vector3;
  readonly target: THREE.Vector3;
  readonly zoom: number;
  /** Optional FOV (degrees) for perspective camera interpolation. */
  readonly fov?: number;
  /** Optional orientation for quaternion slerp. */
  readonly orientation?: THREE.Quaternion;
}

/** Tick callback — receives current interpolated camera state. */
export type ManagedTickCallback = (
  position: THREE.Vector3,
  target: THREE.Vector3,
  zoom: number,
  fov: number | undefined,
  orientation: THREE.Quaternion | undefined,
  progress: number,
) => void;

export interface AnimationTransitionParams {
  readonly from: ExtendedCameraState;
  readonly to: ExtendedCameraState;
  /** Duration in milliseconds. Must be > 0. */
  readonly durationMs: number;
  readonly onTick: ManagedTickCallback;
  readonly onComplete?: () => void;
  /** Override easing curve. Defaults to easeInOutCubic (A.4.Q1). */
  readonly easing?: (t: number) => number;
}

export interface AnimationManager {
  /**
   * Start a new transition.
   * If a transition is already running, blends from the current
   * interpolated position instead of snapping to params.from.
   */
  readonly startTransition: (params: AnimationTransitionParams) => void;
  /** Cancel active transition without calling onComplete. */
  readonly cancel: () => void;
  /**
   * Advance all active animations to `nowMs`.
   * Must be called every frame from the main RAF loop.
   */
  readonly tick: (nowMs: number) => void;
  readonly isAnimating: boolean;
  readonly dispose: () => void;
}

// ── Internal ──────────────────────────────────────────────────────────────────

interface ActiveTransition {
  from: ExtendedCameraState;
  to: ExtendedCameraState;
  durationMs: number;
  onTick: ManagedTickCallback;
  onComplete?: () => void;
  easing: (t: number) => number;
  /** -1 = not started; set to nowMs on first tick. */
  startTime: number;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createAnimationManager(): AnimationManager {
  // Reusable vectors — safe because JS is single-threaded.
  const _pos = new THREE.Vector3();
  const _tgt = new THREE.Vector3();
  const _q = new THREE.Quaternion();

  // Last interpolated state for smooth interruption blend.
  let lastPos = new THREE.Vector3();
  let lastTgt = new THREE.Vector3();
  let lastZoom = 1.0;
  let lastFov: number | undefined;
  let hasLastState = false;

  let active: ActiveTransition | null = null;
  let disposed = false;

  function startTransition(params: AnimationTransitionParams): void {
    if (disposed) return;

    const easeFn = params.easing ?? easeInOutCubic;

    if (active !== null && hasLastState) {
      // Smooth blend: start from current interpolated position, not params.from.
      active = {
        from: {
          position: lastPos.clone(),
          target: lastTgt.clone(),
          zoom: lastZoom,
          fov: lastFov,
        },
        to: params.to,
        durationMs: params.durationMs,
        onTick: params.onTick,
        onComplete: params.onComplete,
        easing: easeFn,
        startTime: -1,
      };
    } else {
      active = {
        from: params.from,
        to: params.to,
        durationMs: params.durationMs,
        onTick: params.onTick,
        onComplete: params.onComplete,
        easing: easeFn,
        startTime: -1,
      };
    }
  }

  function cancel(): void {
    active = null;
    hasLastState = false;
  }

  function tick(nowMs: number): void {
    if (!active || disposed) return;

    // Set start time on first tick (-1 = sentinel for "not started yet").
    if (active.startTime < 0) active.startTime = nowMs;

    const elapsed = nowMs - active.startTime;
    const rawProgress = Math.min(elapsed / Math.max(active.durationMs, 1), 1.0);
    const t = active.easing(rawProgress);

    // Position + target lerp.
    _pos.lerpVectors(active.from.position, active.to.position, t);
    _tgt.lerpVectors(active.from.target, active.to.target, t);
    const zoom = active.from.zoom + (active.to.zoom - active.from.zoom) * t;

    // Optional FOV lerp (perspective zoom interpolation).
    let fov: number | undefined;
    if (active.from.fov !== undefined && active.to.fov !== undefined) {
      fov = active.from.fov + (active.to.fov - active.from.fov) * t;
    }

    // Optional quaternion slerp (orientation interpolation).
    let orientation: THREE.Quaternion | undefined;
    if (active.from.orientation !== undefined && active.to.orientation !== undefined) {
      _q.slerpQuaternions(active.from.orientation, active.to.orientation, t);
      orientation = _q;
    }

    // Track interpolated state for next potential interruption blend.
    lastPos.copy(_pos);
    lastTgt.copy(_tgt);
    lastZoom = zoom;
    lastFov = fov;
    hasLastState = true;

    active.onTick(_pos, _tgt, zoom, fov, orientation, rawProgress);

    if (rawProgress >= 1.0) {
      const cb = active.onComplete;
      active = null;
      cb?.();
    }
  }

  function dispose(): void {
    disposed = true;
    active = null;
  }

  return {
    startTransition,
    cancel,
    tick,
    get isAnimating() { return active !== null; },
    dispose,
  };
}
