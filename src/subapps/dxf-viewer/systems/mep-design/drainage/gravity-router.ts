/**
 * ADR-427 — Stage 3+4+5: gravity router (route → size → slope) for one collector.
 *
 * A thin composition over the SHARED orthogonal trunk-branch router (ADR-426/§A): the
 * collector is the routing root, the fixture drain points are the targets. The router's
 * `cumulativeLU` is read as cumulative **Discharge Units** (it grows toward the root); each
 * run is sized `max(table(ΣDU), cumulativeMinDiameterMm)` so a WC line never drops below
 * DN100 anywhere on its path. Then `assignGravitySlopes` resolves descending per-endpoint
 * elevations from the collector invert. NOT wall-aware yet — the same A* swap that benefits
 * water (ADR-426 Slice 3) replaces `routeOrthogonalTrunkBranch` here with the contract intact.
 *
 * @see ../routing/orthogonal-router.ts (shared router) · ./slope-assignment.ts
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { SceneUnits } from '../../../utils/scene-units';
import {
  routeOrthogonalTrunkBranch,
  type RouteTarget,
} from '../routing/orthogonal-router';
import type { DrainageSizingStandard } from './drainage-sizing';
import { assignGravitySlopes, type RoutedSizedRun } from './slope-assignment';
import {
  DRAINAGE_CLASSIFICATION,
  type ProposedDrainageSegment,
} from './drainage-design-types';

/** Route + size + slope the drainage runs from fixtures to one collector. Pure. */
export function routeGravityNetwork(
  rootPoint: Point2D,
  rootInvertMm: number,
  targets: readonly RouteTarget[],
  sizingStandard: DrainageSizingStandard,
  sceneUnits: SceneUnits,
): readonly ProposedDrainageSegment[] {
  const routed = routeOrthogonalTrunkBranch(rootPoint, targets);
  // Size each run: the ΣDU curve, floored by the largest min branch DN it carries.
  const sized: RoutedSizedRun[] = routed.map((r) => ({
    start: r.start,
    end: r.end,
    role: r.role,
    cumulativeDU: r.cumulativeLU,
    diameterMm: Math.max(
      sizingStandard.diameterForDU(r.cumulativeLU),
      r.cumulativeMinDiameterMm,
    ),
  }));
  const sloped = assignGravitySlopes(sized, rootPoint, rootInvertMm, sceneUnits, sizingStandard);
  return sloped.map((s) => ({
    start: s.start,
    end: s.end,
    classification: DRAINAGE_CLASSIFICATION,
    diameterMm: s.diameterMm,
    cumulativeDU: s.cumulativeDU,
    role: s.role,
    slopePercent: s.slopePercent,
    startElevationMm: s.startElevationMm,
    endElevationMm: s.endElevationMm,
  }));
}
