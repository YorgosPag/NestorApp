/**
 * Cubic ease-in-out camera animation engine.
 * PORT_AS_IS from GenArc viewportAnimation.ts (ADR-366 §8.2 SPEC-3D-004A).
 */

import * as THREE from 'three';
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
  readonly isAnimating: boolean;
  readonly dispose: () => void;
}

function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function createViewportAnimation(): ViewportAnimation {
  const _pos = new THREE.Vector3();
  const _tgt = new THREE.Vector3();

  let rafId = 0;
  let startTime = 0;
  let duration = 0;
  let fromKf: CameraKeyframe | null = null;
  let toKf: CameraKeyframe | null = null;
  let tickCb: AnimationTickCallback | null = null;
  let completeCb: (() => void) | null = null;
  let running = false;

  function tick(): void {
    if (!running || !fromKf || !toKf || !tickCb) return;
    const elapsed = performance.now() - startTime;
    const rawProgress = Math.min(elapsed / duration, 1);
    const progress = easeInOutCubic(rawProgress);
    _pos.lerpVectors(fromKf.position, toKf.position, progress);
    _tgt.lerpVectors(fromKf.target, toKf.target, progress);
    const zoom = fromKf.zoom + (toKf.zoom - fromKf.zoom) * progress;
    tickCb(_pos, _tgt, zoom, progress);
    if (rawProgress >= 1) { finish(); return; }
    rafId = requestAnimationFrame(tick);
  }

  function finish(): void {
    running = false;
    rafId = 0;
    const cb = completeCb;
    fromKf = null; toKf = null; tickCb = null; completeCb = null;
    cb?.();
  }

  function cancel(): void {
    if (!running) return;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    running = false;
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
    startTime = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  return {
    start, cancel,
    get isAnimating() { return running; },
    dispose: cancel,
  };
}
