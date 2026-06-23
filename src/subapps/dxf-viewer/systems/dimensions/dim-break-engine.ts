/**
 * ADR-362 Phase K1 — DIMBREAK engine.
 *
 * Pure computation: given a `DimGeometry` and a set of scene entities that
 * cross the dimension's line segments, produces a `DimBreakResult` containing
 * the original segments split at every crossing with a gap of `DimStyle.breakGap`.
 *
 * Supported crossing entity types: LINE, LWPOLYLINE, POLYLINE (segments).
 * Circles and arcs are not yet supported (deferred — rare case for dimensions).
 * Angular arc-break is deferred to Phase K1+.
 *
 * Auto mode: computed entirely from geometry + scene entities at render time.
 * Manual mode: caller supplies explicit `manualBreakPoints` (world-space points
 *   along the respective segment); the engine converts them to `t` parameters
 *   and applies gaps — no scene-entity scan needed.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-362-enterprise-dimension-system.md §D12
 */

import type { DimGeometry, DimLineSegment } from './dim-geometry-builder';
import type { DimStyle, DimensionManualBreaks } from '../../types/dimension';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import {
  isLineEntity,
  isLWPolylineEntity,
  isPolylineEntity,
} from '../../types/entities';
import { GeometricCalculations } from '../../snapping/shared/GeometricCalculations';
import { getPolylineSegments } from '../../rendering/entities/shared/geometry-rendering-utils';

// ── Public types ─────────────────────────────────────────────────────────────

/** Segments produced after applying break gaps (one original → N split pieces). */
export interface DimBreakResult {
  /** dim line segments (linear/aligned/chained only; undefined for radial/angular). */
  readonly dimLineSegments?: readonly DimLineSegment[];
  /** First extension line segments (linear + angular). */
  readonly extLine1Segments?: readonly DimLineSegment[];
  /** Second extension line segments (linear + angular). */
  readonly extLine2Segments?: readonly DimLineSegment[];
  /** Radial leader path segments (radial kind only). */
  readonly leaderSegments?: readonly DimLineSegment[];
}

/**
 * Input for manual break mode — explicit world-space break points on a segment.
 * SSoT shape lives in `types/dimension.ts` (it is also the persisted entity
 * field `DimensionEntity.manualBreaks`); aliased here for the engine call sites.
 */
export type ManualBreakInput = DimensionManualBreaks;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Auto mode: scan crossing entities for intersections and apply gaps.
 *
 * @param geometry       - Geometry from `buildDimensionGeometry`.
 * @param crossingEntities - All scene entities except the dimension itself.
 * @param style          - Resolved DimStyle (`breakGap` field drives gap size).
 * @returns `DimBreakResult` with split segments, or the original segments unchanged
 *          when no intersections are found.
 */
export function computeAutoBreaks(
  geometry: DimGeometry,
  crossingEntities: readonly Entity[],
  style: DimStyle,
): DimBreakResult {
  const halfGap = style.breakGap / 2;
  if (halfGap <= 0) return {};

  const crossingSegments = extractEntitySegments(crossingEntities);

  if (geometry.kind === 'linear') {
    return {
      dimLineSegments: splitSegmentByEntities(
        geometry.dimLine, crossingSegments, halfGap,
      ),
      extLine1Segments: geometry.extLine1
        ? splitSegmentByEntities(geometry.extLine1, crossingSegments, halfGap)
        : undefined,
      extLine2Segments: geometry.extLine2
        ? splitSegmentByEntities(geometry.extLine2, crossingSegments, halfGap)
        : undefined,
    };
  }

  if (geometry.kind === 'angular') {
    return {
      extLine1Segments: geometry.extLine1
        ? splitSegmentByEntities(geometry.extLine1, crossingSegments, halfGap)
        : undefined,
      extLine2Segments: geometry.extLine2
        ? splitSegmentByEntities(geometry.extLine2, crossingSegments, halfGap)
        : undefined,
    };
  }

  if (geometry.kind === 'radial') {
    const leaderSegs = pathToSegments(geometry.leaderPath);
    const broken = leaderSegs.flatMap((s) =>
      splitSegmentByEntities(s, crossingSegments, halfGap),
    );
    return { leaderSegments: broken };
  }

  return {};
}

/**
 * Manual mode: apply gaps at caller-supplied world-space break points.
 *
 * @param geometry  - Geometry from `buildDimensionGeometry`.
 * @param manual    - Explicit break points per segment type.
 * @param style     - Resolved DimStyle (`breakGap` drives gap size).
 */
export function computeManualBreaks(
  geometry: DimGeometry,
  manual: ManualBreakInput,
  style: DimStyle,
): DimBreakResult {
  const halfGap = style.breakGap / 2;
  if (halfGap <= 0) return {};

  const result: DimBreakResult = {};

  if (geometry.kind === 'linear') {
    const dimResult: DimBreakResult = {
      dimLineSegments: manual.dimLinePoints?.length
        ? splitSegmentAtPoints(geometry.dimLine, manual.dimLinePoints, halfGap)
        : undefined,
      extLine1Segments: (geometry.extLine1 && manual.extLine1Points?.length)
        ? splitSegmentAtPoints(geometry.extLine1, manual.extLine1Points, halfGap)
        : undefined,
      extLine2Segments: (geometry.extLine2 && manual.extLine2Points?.length)
        ? splitSegmentAtPoints(geometry.extLine2, manual.extLine2Points, halfGap)
        : undefined,
    };
    return dimResult;
  }

  if (geometry.kind === 'angular') {
    return {
      extLine1Segments: (geometry.extLine1 && manual.extLine1Points?.length)
        ? splitSegmentAtPoints(geometry.extLine1, manual.extLine1Points, halfGap)
        : undefined,
      extLine2Segments: (geometry.extLine2 && manual.extLine2Points?.length)
        ? splitSegmentAtPoints(geometry.extLine2, manual.extLine2Points, halfGap)
        : undefined,
    };
  }

  if (geometry.kind === 'radial' && manual.leaderPoints?.length) {
    const points = manual.leaderPoints;
    const broken = pathToSegments(geometry.leaderPath).flatMap((s) =>
      splitSegmentAtPoints(s, points, halfGap),
    );
    return { leaderSegments: broken };
  }

  return result;
}

/**
 * Compute the world-space break points where `crossingEntities` intersect the
 * dimension's rendered segments — the persistable input for `computeManualBreaks`
 * (and the `DimensionEntity.manualBreaks` field). Pure geometry, gap-independent:
 * the DIMSTYLE `breakGap` is applied later at render. Returns an empty object
 * when nothing crosses. Reuses the same `findIntersectionTs` SSoT as auto mode.
 *
 * @param geometry         - Geometry from `buildDimensionGeometry`.
 * @param crossingEntities - Scene entities except the dimension itself.
 */
export function computeAutoBreakPoints(
  geometry: DimGeometry,
  crossingEntities: readonly Entity[],
): DimensionManualBreaks {
  const crossingSegments = extractEntitySegments(crossingEntities);
  if (crossingSegments.length === 0) return {};

  const crossPoints = (seg: DimLineSegment): readonly Point2D[] | undefined => {
    const pts = findIntersectionTs(seg, crossingSegments).map((t) => pointAtT(seg, t));
    return pts.length > 0 ? pts : undefined;
  };

  if (geometry.kind === 'linear') {
    return {
      dimLinePoints: crossPoints(geometry.dimLine),
      extLine1Points: geometry.extLine1 ? crossPoints(geometry.extLine1) : undefined,
      extLine2Points: geometry.extLine2 ? crossPoints(geometry.extLine2) : undefined,
    };
  }

  if (geometry.kind === 'angular') {
    return {
      extLine1Points: geometry.extLine1 ? crossPoints(geometry.extLine1) : undefined,
      extLine2Points: geometry.extLine2 ? crossPoints(geometry.extLine2) : undefined,
    };
  }

  if (geometry.kind === 'radial') {
    const pts = pathToSegments(geometry.leaderPath).flatMap(
      (s) => findIntersectionTs(s, crossingSegments).map((t) => pointAtT(s, t)),
    );
    return { leaderPoints: pts.length > 0 ? pts : undefined };
  }

  return {};
}

/** World point at parameter `t` (0..1) along a segment. */
function pointAtT(seg: DimLineSegment, t: number): Point2D {
  return {
    x: seg.start.x + t * (seg.end.x - seg.start.x),
    y: seg.start.y + t * (seg.end.y - seg.start.y),
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Extract all line segments from a mixed entity array. */
function extractEntitySegments(entities: readonly Entity[]): DimLineSegment[] {
  const out: DimLineSegment[] = [];
  for (const e of entities) {
    if (isLineEntity(e)) {
      out.push({ start: e.start, end: e.end });
      continue;
    }
    if (isLWPolylineEntity(e) && e.vertices.length >= 2) {
      const segs = getPolylineSegments(e.vertices, e.closed ?? false);
      for (const s of segs) out.push({ start: s.start, end: s.end });
      continue;
    }
    if (isPolylineEntity(e) && e.vertices.length >= 2) {
      const segs = getPolylineSegments(e.vertices, e.closed ?? false);
      for (const s of segs) out.push({ start: s.start, end: s.end });
    }
  }
  return out;
}

/** Find all intersection t-values of `target` segment against a set of crossing segments. */
function findIntersectionTs(
  target: DimLineSegment,
  crossings: readonly DimLineSegment[],
): number[] {
  const ts: number[] = [];
  const dx = target.end.x - target.start.x;
  const dy = target.end.y - target.start.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return ts;

  for (const c of crossings) {
    const pt = GeometricCalculations.getLineIntersection(
      target.start, target.end, c.start, c.end,
    );
    if (!pt) continue;
    const t = ((pt.x - target.start.x) * dx + (pt.y - target.start.y) * dy) / len2;
    if (t > 0 && t < 1) ts.push(t);
  }

  ts.sort((a, b) => a - b);
  return deduplicateTs(ts);
}

/** Remove t values that are within ε of each other (same crossing). */
function deduplicateTs(sorted: number[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0 || sorted[i] - sorted[i - 1] > 1e-6) result.push(sorted[i]);
  }
  return result;
}

/**
 * Split a segment into sub-segments by applying a gap around each `t` value.
 * Uses interval arithmetic: compute gap spans [max(0,t-halfT), min(1,t+halfT)],
 * merge overlapping gaps, then emit the complement as drawable segments.
 * `halfGap` is in world units; segment length scales t.
 */
function splitAtTs(
  seg: DimLineSegment,
  ts: readonly number[],
  halfGap: number,
): DimLineSegment[] {
  if (ts.length === 0) return [seg];

  const dx = seg.end.x - seg.start.x;
  const dy = seg.end.y - seg.start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-9) return [seg];

  const halfT = halfGap / len;

  // Build gap intervals clamped to [0,1].
  const gaps: Array<[number, number]> = ts.map((t) => [
    Math.max(0, t - halfT),
    Math.min(1, t + halfT),
  ]);

  // Sort + merge overlapping gaps.
  gaps.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const gap of gaps) {
    if (merged.length > 0 && gap[0] <= merged[merged.length - 1][1] + 1e-9) {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], gap[1]);
    } else {
      merged.push([gap[0], gap[1]]);
    }
  }

  // Emit segments in the complement of the merged gaps.
  const result: DimLineSegment[] = [];
  let cursor = 0;
  for (const [gapStart, gapEnd] of merged) {
    if (gapStart - cursor > 1e-6) {
      result.push(interpolateSegment(seg, cursor, gapStart));
    }
    cursor = gapEnd;
  }
  if (1 - cursor > 1e-6) {
    result.push(interpolateSegment(seg, cursor, 1));
  }

  return result;
}

function interpolateSegment(seg: DimLineSegment, t0: number, t1: number): DimLineSegment {
  return { start: pointAtT(seg, t0), end: pointAtT(seg, t1) };
}

function splitSegmentByEntities(
  seg: DimLineSegment,
  crossings: readonly DimLineSegment[],
  halfGap: number,
): DimLineSegment[] {
  const ts = findIntersectionTs(seg, crossings);
  return splitAtTs(seg, ts, halfGap);
}

function splitSegmentAtPoints(
  seg: DimLineSegment,
  points: readonly Point2D[],
  halfGap: number,
): DimLineSegment[] {
  const dx = seg.end.x - seg.start.x;
  const dy = seg.end.y - seg.start.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return [seg];

  const ts = points.map((p) =>
    ((p.x - seg.start.x) * dx + (p.y - seg.start.y) * dy) / len2,
  ).filter((t) => t > 0 && t < 1).sort((a, b) => a - b);

  return splitAtTs(seg, deduplicateTs(ts), halfGap);
}

function pathToSegments(path: readonly Point2D[]): DimLineSegment[] {
  const segs: DimLineSegment[] = [];
  for (let i = 0; i + 1 < path.length; i++) {
    segs.push({ start: path[i], end: path[i + 1] });
  }
  return segs;
}
