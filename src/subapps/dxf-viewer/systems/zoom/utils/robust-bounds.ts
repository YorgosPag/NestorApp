/**
 * robust-bounds — outlier-tolerant zoom-extents bounds (Giorgio 2026-07-12).
 *
 * WHY: a handful of corrupted/stray entities (e.g. an import that placed 7 R12
 * hatches at raw block-local coords ~8.5 km from the real drawing, y≈x) blow the
 * union bounding box up to ~17 km × 17 km, so `fit-to-view` frames the garbage and
 * the real 74 m plan collapses to a sub-pixel dot. Big-CAD zoom-extents (Revit /
 * AutoCAD «Zoom Extents» after an AUDIT, Figma «Zoom to fit») frames the CONTENT,
 * not lone flyaways.
 *
 * The rejection is DELIBERATELY conservative — it must NEVER hide legitimate spread
 * (a site plan with a far north-arrow, a real xref). Two gates BOTH must hold before
 * any entity is dropped:
 *   1. the flyaways are a tiny minority (`≤ MAX_OUTLIER_FRACTION` of entities), AND
 *   2. dropping them shrinks the diagonal by a large factor (`≥ MIN_SHRINK_RATIO`),
 * i.e. they are provably far from the mass, not just the tail of a wide drawing.
 * Otherwise the FULL union is returned unchanged (no opinion).
 *
 * Outlier test = per-axis median ± `MAD_K` × MAD (median absolute deviation — the
 * robust-statistics analogue of mean ± Kσ, immune to the very flyaways we hunt).
 *
 * @see systems/zoom/utils/bounds.ts — `createBoundsFromDxfScene` consumer (SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-399-dxf-floor-navigation-tabs.md
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { BoundingBox2D } from '../../../rendering/hitTesting/entity-bounds-ssot';

/** An entity is an outlier when its center is > this many MADs from the median. */
const MAD_K = 12;
/** Drop outliers only when they are at most this fraction of all entities. */
const MAX_OUTLIER_FRACTION = 0.1;
/**
 * Drop outliers only when doing so shrinks the bbox diagonal by at least this factor.
 *
 * ADR-635 Φ C.13 — this is the LAST, decisive gate and MUST correspond to the actual
 * pathology: a flyaway drops content to a **sub-pixel dot** only when it makes the fit
 * ~100× too big (content < ~1–2 % of the view). The old value `4` fired at a 4× shrink —
 * content still 25 % of the view, fully visible — so it wrongly rejected legitimate
 * nearby content: a lone HATCH (bigger than, and only ~11 units from, a 2-unit block that
 * flattened to 28 dense entities) passed the MAD + minority gates and was dropped from the
 * fit → «φαίνεται μόνο το μπλοκ» (ΓΡΑΜΜΟΣΚΙΑΣΗ_ΜΕ_ΜΠΛΟΚ). Raised so only a true dot-causing
 * flyaway (the ~130× KADOS 8.5 km import garbage this feature exists for) is rejected.
 */
const MIN_SHRINK_RATIO = 50;

export interface RobustBoundsResult {
  bounds: { min: Point2D; max: Point2D } | null;
  /** How many entities were rejected as flyaways (0 ⇒ full union used as-is). */
  dropped: number;
}

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = n >> 1;
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Median absolute deviation about `med` (robust spread; 0 ⇒ axis is degenerate). */
function mad(values: number[], med: number): number {
  const dev = values.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
  return median(dev);
}

function unionOf(boxes: BoundingBox2D[]): { min: Point2D; max: Point2D } | null {
  if (boxes.length === 0) return null;
  let miX = Infinity, miY = Infinity, maX = -Infinity, maY = -Infinity;
  for (const b of boxes) {
    if (b.minX < miX) miX = b.minX;
    if (b.minY < miY) miY = b.minY;
    if (b.maxX > maX) maX = b.maxX;
    if (b.maxY > maY) maY = b.maxY;
  }
  return { min: { x: miX, y: miY }, max: { x: maX, y: maY } };
}

function diagonal(b: { min: Point2D; max: Point2D }): number {
  return Math.hypot(b.max.x - b.min.x, b.max.y - b.min.y);
}

/**
 * Robust zoom-extents bounds from per-entity 2D boxes. Returns the FULL union
 * unless a tiny minority of provably-far flyaways can be dropped (both gates hold),
 * in which case it returns the tightened bounds + the dropped count.
 */
export function computeRobustBounds(boxes: BoundingBox2D[]): RobustBoundsResult {
  const full = unionOf(boxes);
  if (!full || boxes.length < 8) return { bounds: full, dropped: 0 };

  // Per-entity centers → robust center + spread on each axis.
  const cxs = boxes.map((b) => (b.minX + b.maxX) / 2);
  const cys = boxes.map((b) => (b.minY + b.maxY) / 2);
  const medX = median([...cxs].sort((a, b) => a - b));
  const medY = median([...cys].sort((a, b) => a - b));
  const madX = mad(cxs, medX);
  const madY = mad(cys, medY);
  // Both axes degenerate (all centers coincident) ⇒ nothing to reject.
  if (madX === 0 && madY === 0) return { bounds: full, dropped: 0 };

  // An axis with MAD 0 gives no room on that axis — guard against div-by-zero by
  // treating "0 MAD" as "no outlier gate on this axis" (thrX/thrY = Infinity).
  const thrX = madX > 0 ? MAD_K * madX : Infinity;
  const thrY = madY > 0 ? MAD_K * madY : Infinity;

  const kept: BoundingBox2D[] = [];
  let dropped = 0;
  for (let i = 0; i < boxes.length; i++) {
    const isOutlier = Math.abs(cxs[i] - medX) > thrX || Math.abs(cys[i] - medY) > thrY;
    if (isOutlier) dropped++;
    else kept.push(boxes[i]);
  }

  // Gate 1 — outliers must be a tiny minority (else it's legit spread, keep full).
  if (dropped === 0 || dropped > boxes.length * MAX_OUTLIER_FRACTION) {
    return { bounds: full, dropped: 0 };
  }

  const robust = unionOf(kept);
  if (!robust) return { bounds: full, dropped: 0 };

  // Gate 2 — dropping must SHRINK the diagonal a lot (else the flyaways were near
  // the mass anyway → not worth diverging from a true zoom-extents).
  const robustDiag = diagonal(robust);
  if (robustDiag <= 0 || diagonal(full) / robustDiag < MIN_SHRINK_RATIO) {
    return { bounds: full, dropped: 0 };
  }

  return { bounds: robust, dropped };
}

// ─── Robust CENTER (ADR-650 M10 auto-align, Εύρημα #1) ────────────────────────
//
// `computeRobustBounds` above is deliberately conservative — tuned to reject ONLY a
// lone ~130× flyaway for zoom-extents (≤10 % minority, ≥50× shrink), so it keeps a
// large secondary cluster. Geo-referencing auto-align needs the OPPOSITE: the robust
// CENTER of the real content when the drawing has TWO clusters (the building near the
// origin + a ~17 km legend/stamp cluster in ΕΓΣΑ) plus far outliers. The median has a
// 50 % breakdown point, so per-axis median lands inside the dominant (building)
// cluster; a looser MAD gate then trims the far cluster + outliers before the content
// box is measured. Big-CAD robust estimation (Revit «Audit», Civil 3D) works the same.

/** An entity/point is off the content when > this many MADs from the per-axis median. */
const ROBUST_CENTER_MAD_K = 6;

export interface RobustCenterResult {
  /** Median-of-survivors center (the auto-align anchor). */
  readonly center: Point2D;
  /** Tight content bounds from the survivors (far cluster + outliers trimmed). */
  readonly bounds: { min: Point2D; max: Point2D };
  readonly kept: number;
  readonly rejected: number;
}

/**
 * Robust content center + tight bounds from a raw point set, immune to a minority
 * secondary cluster and to far outliers (Εύρημα #1). Returns `null` for an empty set.
 *
 * @param points raw coordinates (any single mm/world frame)
 * @param madK   MAD multiplier for the reject gate (default {@link ROBUST_CENTER_MAD_K})
 */
export function computeRobustCenter(
  points: readonly Point2D[],
  madK = ROBUST_CENTER_MAD_K,
): RobustCenterResult | null {
  if (points.length === 0) return null;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const medX = median([...xs].sort((a, b) => a - b));
  const medY = median([...ys].sort((a, b) => a - b));
  const madX = mad(xs, medX);
  const madY = mad(ys, medY);
  const thrX = madX > 0 ? madK * madX : Infinity;
  const thrY = madY > 0 ? madK * madY : Infinity;

  const kept: Point2D[] = [];
  for (const p of points) {
    if (Math.abs(p.x - medX) <= thrX && Math.abs(p.y - medY) <= thrY) kept.push(p);
  }
  // Degenerate gate (all points coincident, or K too tight) — fall back to all points.
  const survivors = kept.length > 0 ? kept : [...points];

  let miX = Infinity, miY = Infinity, maX = -Infinity, maY = -Infinity;
  const kxs: number[] = [];
  const kys: number[] = [];
  for (const p of survivors) {
    kxs.push(p.x); kys.push(p.y);
    if (p.x < miX) miX = p.x;
    if (p.y < miY) miY = p.y;
    if (p.x > maX) maX = p.x;
    if (p.y > maY) maY = p.y;
  }
  const center: Point2D = {
    x: median(kxs.sort((a, b) => a - b)),
    y: median(kys.sort((a, b) => a - b)),
  };
  return {
    center,
    bounds: { min: { x: miX, y: miY }, max: { x: maX, y: maY } },
    kept: survivors.length,
    rejected: points.length - survivors.length,
  };
}
