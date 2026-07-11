/**
 * Bathroom-layout ranking · ADR-638.
 *
 * Scores a candidate arrangement on four ergonomic/practical axes (each 0..1) and
 * folds them into one weighted score gated by completeness. Pure, millimetres.
 * Deliberately simple & deterministic (rule-based, no ML) so it is unit-testable
 * and explains WHY one layout beats another via the returned breakdown.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import type { FixturePlacement, LayoutScoreBreakdown } from './bathroom-layout-types';
import { resolveFixtureSpec } from './sanitary-clearance-spec';
import { areaOf, cornerInsideFraction, rectOverlapMm2, roomDiagonalMm } from './layout-geometry';
import { clamp01 } from '../../utils/scalar-math';

/** Weights of the four score axes (sum = 1). */
const W = { ergonomics: 0.35, plumbing: 0.25, circulation: 0.2, tidiness: 0.2 } as const;

/** Clustering of wet fixtures — short pipe runs score higher. */
function scorePlumbing(
  placements: readonly FixturePlacement[],
  diagMm: number,
  wetWallHintIndex: number | undefined,
): number {
  const wet = placements.filter((p) => resolveFixtureSpec(p.kind).wet);
  if (wet.length < 2 || diagMm <= 0) return 1;
  const cx = wet.reduce((s, p) => s + p.center.x, 0) / wet.length;
  const cy = wet.reduce((s, p) => s + p.center.y, 0) / wet.length;
  const avgDist =
    wet.reduce((s, p) => s + Math.hypot(p.center.x - cx, p.center.y - cy), 0) / wet.length;
  const clustering = clamp01(1 - avgDist / (0.5 * diagMm));
  const onHint =
    wetWallHintIndex === undefined
      ? 0
      : wet.filter((p) => p.wallIndex === wetWallHintIndex).length / wet.length;
  return clamp01(0.85 * clustering + 0.15 * onHint);
}

/** Door path kept clear + central floor left open. */
function scoreCirculation(
  placements: readonly FixturePlacement[],
  roomAreaMm2: number,
  doorKeepClears: readonly (readonly Point2D[])[],
): number {
  const occupied = placements.reduce((s, p) => s + areaOf(p.footprint), 0);
  const openness = roomAreaMm2 > 0 ? clamp01(1 - occupied / roomAreaMm2) : 0;
  // Worst intrusion fraction across ALL door swing quadrants / entry zones.
  let worstFrac = 0;
  for (const zone of doorKeepClears) {
    if (zone.length < 3) continue;
    const keepArea = areaOf(zone) || 1;
    const worst = placements.reduce((m, p) => Math.max(m, rectOverlapMm2(p.footprint, zone)), 0);
    worstFrac = Math.max(worstFrac, worst / keepArea);
  }
  const doorClear = clamp01(1 - worstFrac);
  return clamp01(0.5 * openness + 0.5 * doorClear);
}

/** Fixtures grouped on few walls read as tidier (aligned runs). */
function scoreTidiness(placements: readonly FixturePlacement[]): number {
  if (placements.length <= 1) return 1;
  const wallsUsed = new Set(placements.map((p) => p.wallIndex)).size;
  return clamp01(1 - (wallsUsed - 1) / (placements.length - 1));
}

/** Ergonomics with the room polygon in scope (obstruction = another footprint in my use-zone). */
function ergonomicsWithRoom(
  placements: readonly FixturePlacement[],
  roomLifted: readonly Point3D[],
): number {
  if (placements.length === 0) return 1;
  let sum = 0;
  for (const p of placements) {
    const inside = cornerInsideFraction(p.useZone, roomLifted);
    const zoneArea = areaOf(p.useZone) || 1;
    let obstruction = 0;
    for (const other of placements) {
      if (other === p) continue;
      obstruction += rectOverlapMm2(p.useZone, other.footprint) / zoneArea;
    }
    sum += clamp01(inside - obstruction);
  }
  return sum / placements.length;
}

/** Compute the full ranked score + breakdown for one candidate layout. */
export function scoreLayout(args: {
  readonly placements: readonly FixturePlacement[];
  readonly requestedCount: number;
  readonly roomLifted: readonly Point3D[];
  readonly roomAreaMm2: number;
  readonly doorKeepClears: readonly (readonly Point2D[])[];
  readonly wetWallHintIndex: number | undefined;
}): { score: number; breakdown: LayoutScoreBreakdown } {
  const { placements, requestedCount, roomLifted, roomAreaMm2, doorKeepClears, wetWallHintIndex } = args;
  const completeness = requestedCount > 0 ? placements.length / requestedCount : 1;
  const breakdown: LayoutScoreBreakdown = {
    ergonomics: ergonomicsWithRoom(placements, roomLifted),
    plumbing: scorePlumbing(placements, roomDiagonalMm(roomLifted), wetWallHintIndex),
    circulation: scoreCirculation(placements, roomAreaMm2, doorKeepClears),
    tidiness: scoreTidiness(placements),
    completeness: clamp01(completeness),
  };
  const weighted =
    W.ergonomics * breakdown.ergonomics +
    W.plumbing * breakdown.plumbing +
    W.circulation * breakdown.circulation +
    W.tidiness * breakdown.tidiness;
  return { score: clamp01(completeness) * weighted, breakdown };
}
