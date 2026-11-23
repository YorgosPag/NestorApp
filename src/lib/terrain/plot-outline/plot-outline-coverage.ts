/**
 * @fileoverview **Π6 — do the plot outline and the relief live in the same place?** (ADR-920 §14.11 Π6)
 * @related ../tin-clip-to-boundary (the ONE «surface ∩ ring» — reused, not re-derived)
 *
 * The outline comes from one file (a DXF or a PDF table), the relief from another (the surveyor's points). If they
 * are not in the same coordinate system or not the same place, drawing one on the other would be a lie. The test is
 * the AREA of the outline that the relief actually covers — not a bounding-box guess:
 *
 *   covered   — the relief covers the whole outline (up to float noise) ⇒ merge.
 *   partial   — merge, and SAY which share of the plot the relief does not cover (Π6).
 *   disjoint  — not one square millimetre in common ⇒ a NAMED refusal («different system or area»). Never a shift:
 *               moving the outline until it «fits» would invent a georeference (the ADR-718 trap).
 *
 * The covered area is the area of `clipTinToBoundary(relief, outline)` — the same clip the plot crop uses, exact for
 * a concave outline (convex pieces, ADR-920 Β4.8 Τ). Units: WORLD canonical mm in, m² out.
 */

import { shoelaceArea, type PlanarPoint } from '@/lib/geometry/planar-polygon';

import type { TinSurface } from '../terrain-types';
import { clipTinToBoundary } from '../tin-clip-to-boundary';
import { ringAreaM2 } from './plot-outline-area';
import { PLOT_COVERAGE_FULL_FRACTION } from './plot-outline-config';

const MM2_PER_M2 = 1_000_000;

export type PlotOutlineCoverageVerdict = 'covered' | 'partial' | 'disjoint';

export interface PlotOutlineCoverage {
  readonly verdict: PlotOutlineCoverageVerdict;
  readonly outlineAreaM2: number;
  readonly coveredAreaM2: number;
  /** covered / outline, in [0, 1]. */
  readonly coveredFraction: number;
}

/** Plan area of a TIN, LOCAL-frame mm². */
function tinPlanAreaMm2(tin: TinSurface): number {
  let sum = 0;
  for (const [i, j, k] of tin.triangles) {
    const a = tin.positions[i];
    const b = tin.positions[j];
    const c = tin.positions[k];
    sum += Math.abs(shoelaceArea([{ x: a[0], y: a[1] }, { x: b[0], y: b[1] }, { x: c[0], y: c[1] }]));
  }
  return sum;
}

/** Cheap first answer: boxes that do not touch cannot share area (the usual «wrong system» case: kilometres apart). */
function boxesApart(relief: TinSurface, ringWorldMm: readonly PlanarPoint[]): boolean {
  const { bounds, origin } = relief;
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const p of ringWorldMm) {
    minX = Math.min(minX, p.x - origin.x); maxX = Math.max(maxX, p.x - origin.x);
    minY = Math.min(minY, p.y - origin.y); maxY = Math.max(maxY, p.y - origin.y);
  }
  return maxX < bounds.minX || minX > bounds.maxX || maxY < bounds.minY || minY > bounds.maxY;
}

function verdictOf(fraction: number): PlotOutlineCoverageVerdict {
  if (fraction <= 0) return 'disjoint';
  return fraction >= PLOT_COVERAGE_FULL_FRACTION ? 'covered' : 'partial';
}

/** How much of the outline (WORLD mm ring) the relief covers. An empty relief or a degenerate ring ⇒ `disjoint`. */
export function plotOutlineCoverage(relief: TinSurface, ringWorldMm: readonly PlanarPoint[]): PlotOutlineCoverage {
  const outlineAreaM2 = ringAreaM2(ringWorldMm);
  const none: PlotOutlineCoverage = { verdict: 'disjoint', outlineAreaM2, coveredAreaM2: 0, coveredFraction: 0 };
  if (outlineAreaM2 <= 0 || relief.triangles.length === 0 || boxesApart(relief, ringWorldMm)) return none;

  const coveredAreaM2 = tinPlanAreaMm2(clipTinToBoundary(relief, ringWorldMm)) / MM2_PER_M2;
  const coveredFraction = Math.min(1, Math.max(0, coveredAreaM2 / outlineAreaM2));
  return { verdict: verdictOf(coveredFraction), outlineAreaM2, coveredAreaM2, coveredFraction };
}
