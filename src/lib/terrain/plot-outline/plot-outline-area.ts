/**
 * @fileoverview **The area of a plot outline in WORLD mm, in m²** (ADR-920 §14.11 Ζ1).
 *
 * ΕΓΣΑ'87 in canonical mm puts coordinates near 4·10⁹, where a raw shoelace loses ~256 mm² to float64 (measured: a
 * 100 m² square came out 99.999744 m²). Ζ1 cured it here by translating to the first vertex; since ADR-920 §14.11 (Α)
 * the shared `shoelaceArea` does that itself, for every caller — so this is only the mm² → m² step, not a second area.
 */

import { polygonArea, type PlanarPoint } from '@/lib/geometry/planar-polygon';

const MM2_PER_M2 = 1_000_000;

/** Plan area of a WORLD-mm ring, m². `0` for fewer than three points. */
export function ringAreaM2(ringWorldMm: readonly PlanarPoint[]): number {
  return polygonArea(ringWorldMm) / MM2_PER_M2;
}
