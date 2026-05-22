// ============================================================================
// REDUCED MOTION CONFIG — Animation registry SSoT (ADR-366 Phase 9 / C.5.Q5)
// ============================================================================
//
// Single source of truth: which animations respect prefers-reduced-motion.
// Callsites use getAnimationDuration() to snap to 0ms when reduced motion active.
// ThreeJsSceneManager passes duration via reduced-motion guard when calling
// AnimationManager.startTransition() — animation-manager itself stays pure.
// ============================================================================

export type ReducedMotionTarget =
  | 'camera'
  | 'section'
  | 'pt-transition'
  | 'shadow-fade'
  | 'hover-bob'
  | 'viewcube-hop'
  | 'panel-collapse';

/** Normal animation durations (ms) per target when motion is not reduced. */
export const NORMAL_DURATIONS: Record<ReducedMotionTarget, number> = {
  camera: 300,
  section: 200,
  'pt-transition': 400,
  'shadow-fade': 300,
  'hover-bob': 150,
  'viewcube-hop': 120,
  'panel-collapse': 200,
};

/**
 * Returns animation duration for `target`.
 * When reducedMotion=true → 0 (instant snap, WCAG 2.3.3).
 * Pass normalMs to override the registry default for one-off durations.
 */
export function getAnimationDuration(
  target: ReducedMotionTarget,
  reducedMotion: boolean,
  normalMs?: number,
): number {
  if (reducedMotion) return 0;
  return normalMs ?? NORMAL_DURATIONS[target];
}
