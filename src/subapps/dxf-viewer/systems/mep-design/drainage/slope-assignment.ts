/**
 * ADR-427 — Stage 5 Slope: assign gravity fall + per-endpoint elevations (SSoT).
 *
 * Water supply runs flat at the source elevation; drainage must DESCEND into the collector.
 * Given the sized runs (root-outward order from the router) + the collector invert (the
 * lowest datum), this walks the tree from the root assigning each run a slope (the standard's
 * minimum gradient for its DN) and a pair of per-endpoint elevations: the end CLOSER to the
 * collector (`start`) is lower, the end FARTHER (`end`) is higher by `length · slope`. So the
 * whole network rises monotonically away from the collector ⇒ descends monotonically into it.
 *
 * The router emits every run with `start` nearer the root and guarantees each run's `start`
 * point was already placed by an earlier run (or is the root), so a single forward pass
 * resolves all elevations deterministically. Plan lengths are converted scene-units → mm
 * (elevations are mm, matching the segment z SSoT).
 *
 * @see ./gravity-router.ts (caller) · ../routing/orthogonal-router.ts (root-outward order)
 */

import type { Point2D } from '../../../rendering/types/Types';
import { mmToSceneUnits, type SceneUnits } from '../../../utils/scene-units';

/** A routed run after sizing — the input to slope assignment. */
export interface RoutedSizedRun {
  readonly start: Point2D;
  readonly end: Point2D;
  readonly role: 'trunk' | 'branch';
  readonly diameterMm: number;
  readonly cumulativeDU: number;
}

/** A run with its gravity slope + descending per-endpoint elevations resolved. */
export interface SlopedRun extends RoutedSizedRun {
  readonly slopePercent: number;
  readonly startElevationMm: number;
  readonly endElevationMm: number;
}

/** Provider of the minimum gradient (% fall) for a nominal DN. */
export interface SlopeStandard {
  minSlopePercentForDN(dnMm: number): number;
}

/** Exact key — the router emits bit-identical shared coordinates for joined runs. */
function pointKey(p: Point2D): string {
  return `${p.x},${p.y}`;
}

/**
 * Resolve gravity slopes + elevations for the sized runs. `rootInvertMm` is the collector
 * outlet invert (lowest); elevations rise outward from it. Pure + deterministic.
 */
export function assignGravitySlopes(
  runs: readonly RoutedSizedRun[],
  rootPoint: Point2D,
  rootInvertMm: number,
  sceneUnits: SceneUnits,
  standard: SlopeStandard,
): readonly SlopedRun[] {
  const mmPerScene = 1 / mmToSceneUnits(sceneUnits);
  const elevationAt = new Map<string, number>([[pointKey(rootPoint), rootInvertMm]]);
  const out: SlopedRun[] = [];
  for (const run of runs) {
    const slopePercent = standard.minSlopePercentForDN(run.diameterMm);
    const startElevationMm = elevationAt.get(pointKey(run.start)) ?? rootInvertMm;
    const planLenMm = Math.hypot(run.end.x - run.start.x, run.end.y - run.start.y) * mmPerScene;
    const endElevationMm = startElevationMm + (planLenMm * slopePercent) / 100;
    elevationAt.set(pointKey(run.end), endElevationMm);
    out.push({ ...run, slopePercent, startElevationMm, endElevationMm });
  }
  return out;
}
