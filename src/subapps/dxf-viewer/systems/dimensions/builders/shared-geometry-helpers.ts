/**
 * ADR-362 Phase B2 — Shared geometry helpers for dimension builders.
 *
 * Extracted from `linear-aligned-builder.ts` (Boy Scout when a third consumer —
 * `angular-builder.ts` + `radial-builder.ts` — appeared). Pure functions, no
 * imports beyond `Point2D` and the vector-utils SSoT.
 */

import type { Point2D } from '../../../rendering/types/Types';

/** Below this magnitude the line-line intersection denominator is treated as zero. */
export const COLINEAR_EPSILON = 1e-12;

const HALF_PI = Math.PI / 2;

/** Rotate a 2D vector by `angleRad` (CCW). */
export function rotateVector(v: Point2D, angleRad: number): Point2D {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

/**
 * Intersection of two infinite lines, each given by a point + direction vector.
 * Returns `null` when lines are parallel/colinear (denominator below epsilon).
 */
export function intersectLines(
  p1: Point2D,
  d1: Point2D,
  p2: Point2D,
  d2: Point2D,
): Point2D | null {
  const denom = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(denom) < COLINEAR_EPSILON) return null;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const t = (dx * d2.y - dy * d2.x) / denom;
  return { x: p1.x + t * d1.x, y: p1.y + t * d1.y };
}

/** Standard perpendicular to an axis vector (CCW 90°). */
export function perpendicularOf(axis: Point2D): Point2D {
  return { x: -axis.y, y: axis.x };
}

/** Default text anchor = midpoint of `(start, end)`; entity may override. */
export function computeTextAnchor(
  start: Point2D,
  end: Point2D,
  override: Point2D | undefined,
): Point2D {
  if (override) return override;
  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
}

/**
 * Text rotation rule (universal across dim variants):
 *   - DIMTIH=true (text always horizontal) → 0
 *   - DIMTIH=false (text aligned with reference angle) → reference angle,
 *     flipped by π when it would otherwise read upside-down (|angle| > π/2).
 */
export function computeTextRotation(referenceAngleRad: number, dimtih: boolean): number {
  if (dimtih) return 0;
  let a = referenceAngleRad;
  if (a > HALF_PI) a -= Math.PI;
  else if (a <= -HALF_PI) a += Math.PI;
  return a;
}
