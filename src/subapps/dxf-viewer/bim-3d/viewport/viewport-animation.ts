/**
 * Cubic ease-in-out camera animation engine.
 * PORT_AS_IS from GenArc viewportAnimation.ts (ADR-366 §8.2 SPEC-3D-004A).
 *
 * Phase 4.2 adaptation:
 *   - No internal requestAnimationFrame — caller drives via tick(nowMs).
 *   - Easing extracted to easing-functions.ts (DRY).
 *   - startTime set on first tick (not in start()).
 */

import * as THREE from 'three';
import { easeInOutCubic } from './easing-functions';
import type { CameraKeyframe, AnimationTickCallback } from './viewport-types';

export interface ViewportAnimation {
  readonly start: (
    from: CameraKeyframe,
    to: CameraKeyframe,
    durationMs: number,
    onTick: AnimationTickCallback,
    onComplete: () => void,
  ) => void;
  readonly cancel: () => void;
  /** Advance animation to nowMs. Call each frame from the main RAF loop. */
  readonly tick: (nowMs: number) => void;
  readonly isAnimating: boolean;
  readonly dispose: () => void;
}

export function createViewportAnimation(): ViewportAnimation {
  const _pos = new THREE.Vector3();
  const _tgt = new THREE.Vector3();

  let startTime = -1;
  let duration = 0;
  let fromKf: CameraKeyframe | null = null;
  let toKf: CameraKeyframe | null = null;
  let tickCb: AnimationTickCallback | null = null;
  let completeCb: (() => void) | null = null;
  let running = false;

  function tick(nowMs: number): void {
    if (!running || !fromKf || !toKf || !tickCb) return;
    // startTime=-1 sentinel → set on first tick.
    if (startTime < 0) startTime = nowMs;
    const elapsed = nowMs - startTime;
    const rawProgress = Math.min(elapsed / duration, 1);
    const progress = easeInOutCubic(rawProgress);
    _pos.lerpVectors(fromKf.position, toKf.position, progress);
    _tgt.lerpVectors(fromKf.target, toKf.target, progress);
    const zoom = fromKf.zoom + (toKf.zoom - fromKf.zoom) * progress;
    tickCb(_pos, _tgt, zoom, progress);
    if (rawProgress >= 1) { finish(); }
  }

  function finish(): void {
    running = false;
    startTime = -1;
    const cb = completeCb;
    fromKf = null; toKf = null; tickCb = null; completeCb = null;
    cb?.();
  }

  function cancel(): void {
    if (!running) return;
    running = false;
    startTime = -1;
    fromKf = null; toKf = null; tickCb = null; completeCb = null;
  }

  function start(
    from: CameraKeyframe,
    to: CameraKeyframe,
    durationMs: number,
    onTick: AnimationTickCallback,
    onComplete: () => void,
  ): void {
    cancel();
    fromKf = from; toKf = to;
    duration = Math.max(durationMs, 1);
    tickCb = onTick; completeCb = onComplete;
    running = true;
    startTime = -1; // sentinel: set to nowMs on first tick
  }

  return {
    start, cancel, tick,
    get isAnimating() { return running; },
    dispose: cancel,
  };
}
