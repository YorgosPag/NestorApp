/**
 * ADR-040 Phase XXIII / ADR-366 Phase 4.2 — Scene-dirty predicate (pure SSoT).
 *
 * Single source of truth for "should the BIM 3D scene be redrawn this frame?"
 * Used by ThreeJsSceneManager.isSceneDirty() and unit-tested standalone (zero
 * Three.js dependency keeps tests fast + deterministic).
 *
 * Industry pattern alignment (4/4 convergence — Forge Viewer SDK / Three.js
 * Editor / iModel.js / AutoCAD Web): single master rAF + per-subsystem dirty
 * check + on-demand rendering.
 */

export interface SceneDirtyState {
  /** True while user actively drags/orbits/dollies the camera. */
  readonly isInteracting: boolean;
  /** True during canonical-view transitions and frame-bounds animations. */
  readonly viewportAnimating: boolean;
  /** True during turntable / render-queue / Bezier animations. */
  readonly animationManagerActive: boolean;
  /** True while path tracer renders progressive samples. */
  readonly pathTracerActive: boolean;
  /** Sticky flag set by mutation paths; cleared after a successful tick. */
  readonly explicitDirty: boolean;
}

/**
 * Returns true when the BIM 3D scene must be redrawn this frame.
 * Five-input OR — order chosen for short-circuit evaluation against the
 * most common case (user input).
 */
export function isSceneDirtyFromState(state: SceneDirtyState): boolean {
  return (
    state.isInteracting ||
    state.viewportAnimating ||
    state.animationManagerActive ||
    state.pathTracerActive ||
    state.explicitDirty
  );
}
