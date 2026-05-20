/**
 * Wall Split — pure geometry functions for ADR-363 Phase 5.6 (Wall Split Tool).
 *
 * Handles:
 *   - Axis offset computation (mm from wall start to split point)
 *   - Splitting WallParams into two clean segments at a split offset
 *   - Redistributing hosted openings between the two new wall segments
 *   - Computing the perpendicular indicator line for the hover preview
 *
 * Phase 1 limitation: straight walls only (kind === 'straight').
 * Curved/polyline split is deferred to Phase 0.5+ (chord-length approximation
 * needed for arc-length redistribution of openings).
 *
 * All measurements in mm (Nestor convention, consistent with wall-types.ts).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §Phase 5.6
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WallEntity, WallParams } from '../types/wall-types';
import type { OpeningEntity, OpeningParams } from '../types/opening-types';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum allowable wall segment length after a split (mm). */
const MIN_SEGMENT_MM = 100;

/** Perpendicular indicator extends this factor × half-thickness beyond wall edges. */
const INDICATOR_REACH_FACTOR = 1.5;

// ── Public types ──────────────────────────────────────────────────────────────

/** One opening whose wall reference and offset must be patched after a split. */
export interface OpeningUpdate {
  readonly openingId: string;
  readonly previousParams: OpeningParams;
  readonly nextParams: OpeningParams;
}

export interface SplitWallResult {
  /** mm distance from wall.params.start to the split point along the axis. */
  readonly splitOffset: number;
  readonly wall1Params: WallParams;
  readonly wall2Params: WallParams;
  readonly wall1OpeningIds: string[];
  readonly wall2OpeningIds: string[];
  readonly openingUpdates: readonly OpeningUpdate[];
}

// ── Split offset ──────────────────────────────────────────────────────────────

/**
 * Projects `splitPoint` onto the wall axis and returns the clamped offset in mm
 * from `wall.params.start`.
 *
 * Returns `null` when:
 *   - wall.kind is 'curved' or 'polyline' (deferred to Phase 0.5+)
 *   - the wall axis is degenerate (length ≤ 0)
 *   - the clamped offset would leave either segment shorter than MIN_SEGMENT_MM
 */
export function computeSplitOffset(wall: WallEntity, splitPoint: Point2D): number | null {
  if (wall.kind !== 'straight') return null;
  const { start, end } = wall.params;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const totalLen = Math.hypot(dx, dy);
  if (totalLen <= 0) return null;

  const rawOffset = ((splitPoint.x - start.x) * dx + (splitPoint.y - start.y) * dy) / totalLen;
  const clamped = Math.max(MIN_SEGMENT_MM, Math.min(rawOffset, totalLen - MIN_SEGMENT_MM));

  if (totalLen - clamped < MIN_SEGMENT_MM) return null;
  return clamped;
}

// ── Wall param split ──────────────────────────────────────────────────────────

/**
 * Computes WallParams for both segments. The split midpoint is interpolated
 * exactly on the axis using `splitOffset / totalLen`.
 *
 * Bevel inheritance (Revit/AutoCAD join-cleanup pattern):
 *   wall1: startBevel from original (retains existing T/L join), endBevel cleared
 *   wall2: startBevel cleared, endBevel from original (retains existing join)
 *
 * `measurementLength` is cleared on both (auto-derived from new geometry).
 */
export function computeSplitWallParams(
  wall: WallEntity,
  splitOffset: number,
): { wall1Params: WallParams; wall2Params: WallParams } {
  const { start, end } = wall.params;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const totalLen = Math.hypot(dx, dy);
  const t = splitOffset / totalLen;
  const mid = { x: start.x + t * dx, y: start.y + t * dy, z: 0 };

  const shared = {
    category: wall.params.category,
    height: wall.params.height,
    thickness: wall.params.thickness,
    flip: wall.params.flip,
    dna: wall.params.dna,
    sceneUnits: wall.params.sceneUnits,
    // ADR-369 §9 Q5 — preserved from original wall on split.
    baseBinding: wall.params.baseBinding,
    topBinding: wall.params.topBinding,
    baseOffset: wall.params.baseOffset,
    topOffset: wall.params.topOffset,
    ...(wall.params.unconnectedHeight !== undefined && {
      unconnectedHeight: wall.params.unconnectedHeight,
    }),
  } as const;

  const wall1Params: WallParams = {
    ...shared,
    start: wall.params.start,
    end: mid,
    startBevel: wall.params.startBevel,
  };

  const wall2Params: WallParams = {
    ...shared,
    start: mid,
    end: wall.params.end,
    endBevel: wall.params.endBevel,
  };

  return { wall1Params, wall2Params };
}

// ── Opening redistribution ────────────────────────────────────────────────────

/**
 * Assigns each hosted opening to wall1 or wall2 based on where the opening's
 * CENTER falls relative to `splitOffset` (AutoCAD/Revit straddle policy:
 * center exactly on split → goes to wall1).
 *
 * Wall2 openings receive an adjusted `offsetFromStart` = original offset − splitOffset,
 * clamped to [0, +∞). All openings receive a new `wallId` (both new walls have
 * fresh IDs; the original wall is deleted).
 *
 * @param openingsByIdFn - scene lookup for each opening (returns null if missing)
 */
export function redistributeOpenings(
  hostedOpeningIds: readonly string[],
  openingsByIdFn: (id: string) => OpeningEntity | null,
  splitOffset: number,
  wall1Id: string,
  wall2Id: string,
): {
  wall1OpeningIds: string[];
  wall2OpeningIds: string[];
  openingUpdates: OpeningUpdate[];
} {
  const wall1OpeningIds: string[] = [];
  const wall2OpeningIds: string[] = [];
  const openingUpdates: OpeningUpdate[] = [];

  for (const oid of hostedOpeningIds) {
    const opening = openingsByIdFn(oid);
    if (!opening) continue;
    const prev = opening.params;
    const center = prev.offsetFromStart + prev.width / 2;

    if (center > splitOffset) {
      wall2OpeningIds.push(oid);
      const newOffset = Math.max(0, prev.offsetFromStart - splitOffset);
      openingUpdates.push({
        openingId: oid,
        previousParams: prev,
        nextParams: { ...prev, wallId: wall2Id, offsetFromStart: newOffset },
      });
    } else {
      wall1OpeningIds.push(oid);
      openingUpdates.push({
        openingId: oid,
        previousParams: prev,
        nextParams: { ...prev, wallId: wall1Id },
      });
    }
  }

  return { wall1OpeningIds, wall2OpeningIds, openingUpdates };
}

// ── Preview indicator ─────────────────────────────────────────────────────────

/**
 * Two endpoints of the perpendicular indicator line rendered during the
 * wall-split hover preview. Extends INDICATOR_REACH_FACTOR × half-thickness
 * in each direction from `splitPoint` along the wall normal.
 *
 * Returns a zero-length pair when the axis is degenerate.
 */
export function computeSplitIndicatorLine(
  wall: WallEntity,
  splitPoint: Point2D,
): readonly [Point2D, Point2D] {
  const { start, end } = wall.params;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return [splitPoint, splitPoint];

  const perpX = -dy / len;
  const perpY = dx / len;
  const reach = (wall.params.thickness / 2) * INDICATOR_REACH_FACTOR;

  return [
    { x: splitPoint.x + perpX * reach, y: splitPoint.y + perpY * reach },
    { x: splitPoint.x - perpX * reach, y: splitPoint.y - perpY * reach },
  ];
}
