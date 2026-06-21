/**
 * Axis-aligned hatch geometry helpers (SSoT, extracted from polygon-utils.ts).
 *
 * Parallel hatch lines clipped to a bbox, generalised to an arbitrary unit
 * direction. Extracted (verbatim) from `bim/beams/beam-hatch-patterns.ts` where
 * it was module-private — promoted here so the radiant-floor serpentine generator
 * (ADR-408 Εύρος Β #3) and the beam material hatch share ONE implementation
 * (N.12 dedup). `beam-hatch-patterns.ts` now re-imports these.
 *
 * All coordinates are in mm world coords.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { BoundingBox3D } from '../../types/bim-base';

/** 2D point used by the hatch helpers (XY plane). */
export interface HatchPoint2D {
  readonly x: number;
  readonly y: number;
}

/** Unit direction the hatch lines run along. */
export interface HatchDirection {
  readonly ux: number;
  readonly uy: number;
}

/** One clipped hatch line segment (world coords). */
export interface HatchLineSegment {
  readonly start: HatchPoint2D;
  readonly end: HatchPoint2D;
}

const HATCH_DEGENERATE_EPS = 1e-6;
/** Safety cap for degenerate / huge bbox — avoids busy loops. */
const MAX_HATCH_STEPS = 4000;

/**
 * Εύρος `[kMin, kMax]` της κάθετης συντεταγμένης `k = -uy·x + ux·y` πάνω στις 4
 * γωνίες του bbox. SSoT για την προβολή «bbox → perpendicular range» — το μοιράζονται
 * `buildAxisAlignedHatch` (user-defined) ΚΑΙ `buildPredefinedHatchLines` (PAT), ώστε
 * να μην ξαναγράφεται το ίδιο corner-loop (N.12 dedup).
 */
export function perpendicularRangeOverBbox(
  bbox: BoundingBox3D, u: HatchDirection,
): { kMin: number; kMax: number } {
  const corners: ReadonlyArray<readonly [number, number]> = [
    [bbox.min.x, bbox.min.y],
    [bbox.max.x, bbox.min.y],
    [bbox.max.x, bbox.max.y],
    [bbox.min.x, bbox.max.y],
  ];
  let kMin = Number.POSITIVE_INFINITY;
  let kMax = Number.NEGATIVE_INFINITY;
  for (const [x, y] of corners) {
    const k = -u.uy * x + u.ux * y;
    if (k < kMin) kMin = k;
    if (k > kMax) kMax = k;
  }
  return { kMin, kMax };
}

/**
 * Build parallel hatch segments running along the unit direction `u`. Spacing is
 * measured perpendicular to the lines (orthogonal mm). Iterate over the
 * perpendicular offset `k = -uy·x + ux·y`, then clip each infinite line to the
 * bbox rectangle. Degenerate bbox (min ≥ max) → empty list.
 */
export function buildAxisAlignedHatch(
  bbox: BoundingBox3D,
  spacingMm: number,
  u: HatchDirection,
): HatchLineSegment[] {
  if (spacingMm <= 0) return [];
  const { kMin, kMax } = perpendicularRangeOverBbox(bbox, u);
  const startK = Math.ceil(kMin / spacingMm) * spacingMm;
  const out: HatchLineSegment[] = [];
  let steps = 0;
  for (let k = startK; k <= kMax; k += spacingMm) {
    const seg = clipLineToBbox(u, k, bbox);
    if (seg) out.push(seg);
    if (++steps > MAX_HATCH_STEPS) return out;
  }
  return out;
}

/**
 * Clip the infinite line `{ p : -uy·p.x + ux·p.y = k }` to the bbox. Parameterised
 * as `p(t) = p0 + t · u` where `p0 = k · n` (n = (-uy, ux) is the closest point on
 * the line to the origin). Returns `null` when the line misses the bbox.
 */
export function clipLineToBbox(
  u: HatchDirection,
  k: number,
  bbox: BoundingBox3D,
): HatchLineSegment | null {
  const p0x = -u.uy * k;
  const p0y = u.ux * k;
  let tMin = Number.NEGATIVE_INFINITY;
  let tMax = Number.POSITIVE_INFINITY;
  if (Math.abs(u.ux) > HATCH_DEGENERATE_EPS) {
    const t1 = (bbox.min.x - p0x) / u.ux;
    const t2 = (bbox.max.x - p0x) / u.ux;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
  } else if (p0x < bbox.min.x - HATCH_DEGENERATE_EPS || p0x > bbox.max.x + HATCH_DEGENERATE_EPS) {
    return null;
  }
  if (Math.abs(u.uy) > HATCH_DEGENERATE_EPS) {
    const t1 = (bbox.min.y - p0y) / u.uy;
    const t2 = (bbox.max.y - p0y) / u.uy;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
  } else if (p0y < bbox.min.y - HATCH_DEGENERATE_EPS || p0y > bbox.max.y + HATCH_DEGENERATE_EPS) {
    return null;
  }
  if (tMax - tMin <= HATCH_DEGENERATE_EPS) return null;
  return {
    start: { x: p0x + tMin * u.ux, y: p0y + tMin * u.uy },
    end:   { x: p0x + tMax * u.ux, y: p0y + tMax * u.uy },
  };
}
