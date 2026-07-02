/**
 * ADR-563 (Auto-Dimension) — Chain planner (pure).
 *
 * Groups `ReferencePoint[]` by (side, tier), dedups near-equal coordinates,
 * and emits one `PlannedSegment` per adjacent pair — the "chain" of consecutive
 * dimensions the big players place along each side. Each tier is offset a fixed
 * DIMDLI-like distance outward so the 3 rows stack cleanly (detail innermost,
 * overall outermost).
 *
 * Reuses `snapToGrid` (ADR-049 SSoT) for coordinate quantization — no bespoke
 * rounding helper (N.0.2).
 */

import type { Point2D } from '../../../rendering/types/Types';
import { snapToGrid } from '../../grid/grid-snap';
import {
  sideMeasuresX,
  type AutoDimEdge,
  type AutoDimSide,
  type AutoDimTier,
  type AutoDimensionOptions,
  type Bounds2D,
  type PlannedSegment,
  type ReferencePoint,
} from './auto-dimension-types';

/** Merge tolerance for coincident reference coordinates (mm). */
const DEDUP_GRID_MM = 1;
/** Minimum span (mm) below which a segment is degenerate and skipped. */
const MIN_SEGMENT_MM = 1;
/** Fixed outward slot per tier (detail nearest the model, overall farthest). */
const TIER_INDEX: Readonly<Record<AutoDimTier, number>> = { detail: 0, axes: 1, overall: 2 };

/** Reuse the ADR-049 rounding SSoT for scalar quantization (both components equal). */
function quantize(coord: number, gridMm: number): number {
  return snapToGrid({ x: coord, y: coord }, gridMm).x;
}

export interface CoordSource {
  readonly coord: number;
  readonly id: string;
  readonly edge: AutoDimEdge;
}

/**
 * Dedup by quantized coord (first non-empty source wins), sorted ascending.
 * Accepts any point exposing `coord`/`sourceEntityId`/`edge` — so both the
 * perimeter tier buckets and the Φ3 interior planner reuse the same quantizer.
 */
export function dedupSorted(
  points: readonly Pick<ReferencePoint, 'coord' | 'sourceEntityId' | 'edge'>[],
): CoordSource[] {
  const byCoord = new Map<number, CoordSource>();
  for (const p of points) {
    const q = quantize(p.coord, DEDUP_GRID_MM);
    const existing = byCoord.get(q);
    if (!existing) {
      byCoord.set(q, { coord: q, id: p.sourceEntityId, edge: p.edge });
    } else if (!existing.id && p.sourceEntityId) {
      byCoord.set(q, { coord: q, id: p.sourceEntityId, edge: p.edge });
    }
  }
  return Array.from(byCoord.values()).sort((a, b) => a.coord - b.coord);
}

/** Perpendicular distance from the model edge to a tier's dim line (mm). */
function tierOffset(tier: AutoDimTier, options: AutoDimensionOptions): number {
  return options.offsetFromModel + TIER_INDEX[tier] * options.distanceBetweenLines;
}

/** Build [extOrigin1, extOrigin2, dimLineRef] + rotation for a side segment. */
function buildSegmentGeometry(
  side: AutoDimSide,
  a: number,
  b: number,
  off: number,
  overall: Bounds2D,
): { defPoints: readonly [Point2D, Point2D, Point2D]; rotation: number } {
  if (sideMeasuresX(side)) {
    const baseY = side === 'south' ? overall.min.y : overall.max.y;
    const yLine = side === 'south' ? baseY - off : baseY + off;
    return {
      defPoints: [{ x: a, y: baseY }, { x: b, y: baseY }, { x: a, y: yLine }],
      rotation: 0,
    };
  }
  const baseX = side === 'west' ? overall.min.x : overall.max.x;
  const xLine = side === 'west' ? baseX - off : baseX + off;
  return {
    defPoints: [{ x: baseX, y: a }, { x: baseX, y: b }, { x: xLine, y: a }],
    rotation: 90,
  };
}

function sourceOf(cs: CoordSource): PlannedSegment['source1'] {
  return cs.id ? { id: cs.id, edge: cs.edge } : undefined;
}

/** Plan all chains for the enabled sides/tiers into flat `PlannedSegment[]`. */
export function planChains(
  refPoints: readonly ReferencePoint[],
  overall: Bounds2D,
  options: AutoDimensionOptions,
): PlannedSegment[] {
  const segments: PlannedSegment[] = [];
  // Bucket by side|tier.
  const groups = new Map<string, ReferencePoint[]>();
  for (const p of refPoints) {
    const key = `${p.side}|${p.tier}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(p);
    else groups.set(key, [p]);
  }

  for (const [key, points] of groups) {
    const [side, tier] = key.split('|') as [AutoDimSide, AutoDimTier];
    const coords = dedupSorted(points);
    if (coords.length < 2) continue;
    const off = tierOffset(tier, options);

    for (let i = 0; i < coords.length - 1; i++) {
      const a = coords[i];
      const b = coords[i + 1];
      if (b.coord - a.coord < MIN_SEGMENT_MM) continue;
      const geom = buildSegmentGeometry(side, a.coord, b.coord, off, overall);
      segments.push({
        axis: sideMeasuresX(side) ? 'x' : 'y',
        side,
        tier,
        defPoints: geom.defPoints,
        rotation: geom.rotation,
        source1: sourceOf(a),
        source2: sourceOf(b),
      });
    }
  }

  return segments;
}
