/**
 * ADR-429 — MEP Routing Brain: the wall-aware routing entry point (SSoT swap, Slice 3).
 *
 * The single function the three MEP orchestrators (water / drainage / heating) call in place of
 * the bare Manhattan router. It keeps the SAME signature + return type (`readonly RoutedSegment[]`)
 * so the swap is one line per orchestrator and no post-processing changes.
 *
 * Architecture (FULL SSoT, zero-regression): it does NOT re-derive the trunk-branch brain. It
 * calls the existing `routeOrthogonalTrunkBranch` for the decomposition (spine axis, arm split,
 * tap points, cumulative loading + min-Ø), then, for each emitted run that actually crosses a
 * wall, replaces that single straight run with an A* detour — multiple collinear `RoutedSegment`s
 * carrying the parent run's metadata VERBATIM (`role`, `cumulativeLU`, `cumulativeMinDiameterMm`).
 * Runs that clear all walls stay byte-identical. No obstacles, or A* finds no path ⇒ the run stays
 * straight. Hence: no walls in a scene ⇒ output identical to Manhattan ⇒ the 48 existing tests are
 * untouched.
 *
 * Root-outward ordering (relied on by drainage slope assignment) survives: a detour is traversed
 * start→end, so every emitted sub-run's `start` stays upstream of its `end`.
 *
 * Pure + deterministic.
 *
 * @see ./orthogonal-router.ts (the reused decomposition + Manhattan fallback)
 * @see ./astar-grid.ts (findOrthogonalPath) · ./wall-obstacles.ts (segmentHitsObstacles)
 */

import {
  routeOrthogonalTrunkBranch,
  type RouteTarget,
  type RoutedSegment,
} from './orthogonal-router';
import type { Point2D } from '../../../rendering/types/Types';
import { findOrthogonalPath, type AStarOptions } from './astar-grid';
import { segmentHitsObstacles } from './wall-obstacles';
import type { Rect2D } from './routing-constants';

/** Emit the runs for one parent run: its A* detour sub-runs, or the straight run unchanged. */
function expandRun(
  run: RoutedSegment,
  obstacles: readonly Rect2D[],
  opts: AStarOptions,
  out: RoutedSegment[],
): void {
  if (!segmentHitsObstacles(run.start, run.end, obstacles)) {
    out.push(run);
    return;
  }
  const path: Point2D[] | null = findOrthogonalPath(run.start, run.end, obstacles, opts);
  if (!path || path.length < 2) {
    out.push(run); // A* found no fit → keep straight (Manhattan fallback).
    return;
  }
  for (let i = 0; i < path.length - 1; i++) {
    out.push({
      start: path[i],
      end: path[i + 1],
      role: run.role,
      cumulativeLU: run.cumulativeLU,
      cumulativeMinDiameterMm: run.cumulativeMinDiameterMm,
    });
  }
}

/**
 * Route `root → targets` as an orthogonal trunk-branch tree that detours AROUND wall obstacles.
 * Identical contract to `routeOrthogonalTrunkBranch`; `obstacles` empty ⇒ delegates verbatim.
 */
export function routeWallAware(
  root: Point2D,
  targets: readonly RouteTarget[],
  obstacles: readonly Rect2D[],
  opts: AStarOptions = {},
): readonly RoutedSegment[] {
  const runs = routeOrthogonalTrunkBranch(root, targets);
  if (obstacles.length === 0) return runs;
  const out: RoutedSegment[] = [];
  for (const run of runs) expandRun(run, obstacles, opts, out);
  return out;
}
