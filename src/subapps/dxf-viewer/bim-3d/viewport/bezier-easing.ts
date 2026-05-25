/**
 * ADR-366 §C.1.Q4 — Cubic Bezier easing (pure math SSoT).
 *
 * Industry-standard 4-point cubic bezier evaluator για animation curves.
 * P0 = (0,0) και P3 = (1,1) fixed. P1, P2 user-controlled.
 *
 * Algorithm mirror του Firefox `nsSMILKeySpline` / Blink `CubicBezier`:
 *  - X(t) lookup μέσω Newton-Raphson (4 iters) + bisection fallback.
 *  - Y(t) μέσω De Casteljau evaluation.
 *
 * Pure, side-effect-free, deterministic. Καμία dependency.
 * Mirror pattern με easing-functions.ts (same folder SSoT για curve math).
 */

const NEWTON_ITERATIONS = 4;
const NEWTON_MIN_SLOPE = 1e-3;
const SUBDIVISION_PRECISION = 1e-7;
const SUBDIVISION_MAX_ITERATIONS = 10;

function cubicBezierComponent(t: number, p1: number, p2: number): number {
  // Expanded form: 3(1-t)²t·p1 + 3(1-t)t²·p2 + t³
  // P0 = 0, P3 = 1 fixed → omit those terms.
  const oneMinusT = 1 - t;
  return (
    3 * oneMinusT * oneMinusT * t * p1 +
    3 * oneMinusT * t * t * p2 +
    t * t * t
  );
}

function cubicBezierSlope(t: number, p1: number, p2: number): number {
  // d/dt of cubicBezierComponent.
  const oneMinusT = 1 - t;
  return (
    3 * oneMinusT * oneMinusT * p1 +
    6 * oneMinusT * t * (p2 - p1) +
    3 * t * t * (1 - p2)
  );
}

function solveCurveX(x: number, p1x: number, p2x: number): number {
  // Newton-Raphson first.
  let t = x;
  for (let i = 0; i < NEWTON_ITERATIONS; i += 1) {
    const slope = cubicBezierSlope(t, p1x, p2x);
    if (Math.abs(slope) < NEWTON_MIN_SLOPE) break;
    const currentX = cubicBezierComponent(t, p1x, p2x) - x;
    t -= currentX / slope;
  }

  // Bisection fallback αν Newton apocalipta divergence.
  if (t < 0 || t > 1) {
    let lo = 0;
    let hi = 1;
    t = x;
    let iter = 0;
    while (iter < SUBDIVISION_MAX_ITERATIONS) {
      const currentX = cubicBezierComponent(t, p1x, p2x);
      if (Math.abs(currentX - x) < SUBDIVISION_PRECISION) break;
      if (currentX < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
      iter += 1;
    }
  }

  return t;
}

/**
 * Build a pure easing function from 4 control point coordinates.
 *
 * P0 = (0,0) και P3 = (1,1) implied. P1 = (p1x, p1y), P2 = (p2x, p2y).
 * X axis (time) clamp [0, 1]. Y axis (progress) free range (επιτρέπει overshoot).
 *
 * Identity case: linear curve (p1=p1=p2=p2=value) collapses σε `t => t` shortcut
 * για micro-optimization (avoids Newton on hot path).
 */
export function cubicBezier(
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
): (t: number) => number {
  const isLinear = p1x === p1y && p2x === p2y;

  return function easing(t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    if (isLinear) return t;
    const xt = solveCurveX(t, p1x, p2x);
    return cubicBezierComponent(xt, p1y, p2y);
  };
}

/** Convenience evaluator without builder allocation (rare path — prefer cached fn). */
export function bezierValueAt(
  t: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
): number {
  return cubicBezier(p1x, p1y, p2x, p2y)(t);
}
