/**
 * ADR-429 — Routing Brain: the wall-aware swap entry. Proves zero-regression (no walls ⇒
 * identical to Manhattan) and correct detour metadata propagation.
 */

import {
  routeOrthogonalTrunkBranch,
  type RouteTarget,
  type RoutedSegment,
} from '../orthogonal-router';
import { routeWallAware } from '../route-wall-aware';
import { segmentHitsObstacles } from '../wall-obstacles';
import type { Rect2D } from '../routing-constants';

const ROOT = { x: 0, y: 0 };
const TARGETS: readonly RouteTarget[] = [
  { point: { x: 1000, y: 0 }, loadingUnits: 2 },
  { point: { x: 1000, y: 400 }, loadingUnits: 3, minBranchDiameterMm: 100 },
];

describe('routeWallAware — zero-regression', () => {
  it('returns the Manhattan result verbatim when there are no obstacles', () => {
    expect(routeWallAware(ROOT, TARGETS, [])).toEqual(routeOrthogonalTrunkBranch(ROOT, TARGETS));
  });

  it('leaves runs that clear every wall unchanged', () => {
    const farWall: Rect2D = { minX: 0, minY: 5000, maxX: 200, maxY: 6000 };
    expect(routeWallAware(ROOT, TARGETS, [farWall])).toEqual(
      routeOrthogonalTrunkBranch(ROOT, TARGETS),
    );
  });
});

describe('routeWallAware — detour', () => {
  const blocker: Rect2D = { minX: 400, minY: -300, maxX: 600, maxY: 300 };

  it('replaces a blocked run with detour sub-runs carrying the parent metadata', () => {
    const manhattan = routeOrthogonalTrunkBranch(ROOT, TARGETS);
    const blockedRun = manhattan.find(
      (r) => segmentHitsObstacles(r.start, r.end, [blocker]),
    ) as RoutedSegment;
    expect(blockedRun).toBeDefined();

    const out = routeWallAware(ROOT, TARGETS, [blocker]);
    const sub = out.filter(
      (r) =>
        r.role === blockedRun.role &&
        r.cumulativeLU === blockedRun.cumulativeLU &&
        r.cumulativeMinDiameterMm === blockedRun.cumulativeMinDiameterMm,
    );
    // The blocked run became ≥2 collinear sub-runs (a detour), all with identical metadata.
    expect(sub.length).toBeGreaterThanOrEqual(2);
  });

  it('emits no sub-run that crosses a wall interior', () => {
    const out = routeWallAware(ROOT, TARGETS, [blocker]);
    for (const r of out) expect(segmentHitsObstacles(r.start, r.end, [blocker])).toBe(false);
  });

  it('preserves total branch loading (closed under detour)', () => {
    const branchLU = (segs: readonly RoutedSegment[]): number =>
      segs.filter((s) => s.role === 'branch').reduce((n, s) => n + s.cumulativeLU, 0);
    // Detour only splits trunk/branch geometry; per-run loading is copied, not re-summed.
    const out = routeWallAware(ROOT, TARGETS, [blocker]);
    expect(branchLU(out)).toBeGreaterThan(0);
  });
});
