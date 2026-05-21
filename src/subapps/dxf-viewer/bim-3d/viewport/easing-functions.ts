/**
 * Pure easing math for BIM 3D camera transitions.
 * ADR-366 Phase 4.2 — extracted for DRY reuse across animation systems.
 */

/** Cubic ease-in-out. f(0)=0, f(0.5)=0.5, f(1)=1. A.4.Q1 canonical curve. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Cubic ease-out — fast start, decelerates to stop. */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Cubic ease-in — slow start, accelerates to end. */
export function easeInCubic(t: number): number {
  return t * t * t;
}

/** Pass-through linear (no easing). */
export function easeLinear(t: number): number {
  return t;
}
