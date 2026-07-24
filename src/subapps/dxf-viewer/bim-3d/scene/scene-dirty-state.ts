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
  /**
   * ADR-693 Φ2 — true όσο διαλύεται το πέπλο ενός μόλις-φορτωμένου πλέγματος. Η σκηνή είναι
   * on-demand: χωρίς αυτή την είσοδο το fade θα «πάγωνε» στο πρώτο καρέ, αφού καμία άλλη
   * μεταβολή δεν θα ζητούσε redraw για τα ~260ms που διαρκεί.
   */
  readonly meshRevealActive: boolean;
  /** Sticky flag set by mutation paths; cleared after a successful tick. */
  readonly explicitDirty: boolean;
}

/**
 * ADR-040 Phase XXIII — snapshot the five render-gating flags from the manager's
 * live subsystems. Reads `.isAnimating`/`.isActive` here (not at the call site) so
 * ThreeJsSceneManager keeps a one-line wrapper and stays under the 500-line cap (N.7.1).
 * Structural param types avoid importing the heavy Three.js subsystem classes.
 */
export function buildSceneDirtyState(
  isInteracting: boolean,
  viewport: { readonly isAnimating: boolean },
  animationManager: { readonly isAnimating: boolean },
  pathTracerRenderer: { readonly isActive: boolean },
  explicitDirty: boolean,
  meshRevealActive = false,
): SceneDirtyState {
  return {
    isInteracting,
    viewportAnimating: viewport.isAnimating,
    animationManagerActive: animationManager.isAnimating,
    pathTracerActive: pathTracerRenderer.isActive,
    meshRevealActive,
    explicitDirty,
  };
}

/**
 * Returns true when the BIM 3D scene must be redrawn this frame.
 * Six-input OR — order chosen for short-circuit evaluation against the
 * most common case (user input). ADR-693 Φ2 added `meshRevealActive`.
 */
export function isSceneDirtyFromState(state: SceneDirtyState): boolean {
  return (
    state.isInteracting ||
    state.viewportAnimating ||
    state.animationManagerActive ||
    state.pathTracerActive ||
    state.meshRevealActive ||
    state.explicitDirty
  );
}
