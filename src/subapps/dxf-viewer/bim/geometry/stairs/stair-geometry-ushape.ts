/**
 * U-shape stair geometry (ADR-358 §5.1 Phase 3b).
 *
 * Two parallel flights joined by a 180° mid-landing. Industry-standard
 * footprint (Revit / ArchiCAD / Vectorworks):
 *   - Flight 1 occupies the v1·[−halfW, +halfW] band, ascending along +u1.
 *   - Flight 2 occupies an adjacent band offset by `turnSign·width` along v1,
 *     descending back along −u1 (anti-parallel).
 *   - Landing footprint = `(2·width) × landingDepth` — spans both flights
 *     laterally, sits at the top end of flight 1 in u1 direction.
 *
 * `landingDepth: 'auto'` resolves to `width` (Q24 — NOK-compliant by
 * construction, mirrors l-shape Phase 3a convention; the prompt's industry
 * note about `max(width, tread)` collapses to `width` for any geometry where
 * `tread ≤ width`, which is the canonical case).
 *
 * z model: flight 1 treads at z ∈ [0, (n1−1)·rise]; landing at z = n1·rise;
 * flight 2 treads at z ∈ [(n1+1)·rise, stepCount·rise]. Last tread reaches the
 * top floor at stepCount·rise — same convention as l-shape Phase 3a.
 *
 * `landingCornerStyle: 'chamfer' | 'fillet'` throws with a `/Phase 3c/`
 * sentinel — square corners only in Phase 3b.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.1 §6.2
 */

import type { Point3D } from '../../../rendering/types/Types';
import type {
  Polygon3D,
  Polyline3D,
  Segment3D,
  StairGeometry,
  StairParams,
  StairVariantUShape,
} from '../../../bim/types/stair-types';
import {
  DEFAULT_CUT_PLANE_HEIGHT,
  type Vec2,
  perp,
  directionToUnitVector,
  point,
  arrowSymbol,
  bboxOfPolygons,
  buildCutLineForFlights,
  buildStringersFromWalkline,
  buildHandrailsFromParams,
} from './stair-geometry-shared';
import { buildTreadLabelsWithLandings } from './stair-geometry-labels';

export function computeUShape(
  params: Readonly<StairParams>,
  variant: StairVariantUShape,
): StairGeometry {
  assertUShapeCornerSupported(variant);
  const { basePoint, direction, rise, tread, nosing, width, upDirection } = params;
  const u1 = directionToUnitVector(direction);
  const v1 = perp(u1);
  const [n1, n2] = variant.flightSplit;
  const landingDepth = variant.landingDepth === 'auto' ? width : variant.landingDepth;
  const turnSign: 1 | -1 = variant.turnDirection === 'right' ? -1 : 1;
  const u2: Vec2 = { x: -u1.x, y: -u1.y };

  const flight1 = buildUShapeFlight1(basePoint, u1, v1, rise, tread, nosing, width, n1);
  const landing = buildUShapeLanding(basePoint, u1, v1, turnSign, rise, tread, width, landingDepth, n1);
  const flight2 = buildUShapeFlight2(
    basePoint, u1, v1, u2, turnSign, rise, tread, nosing, width, landingDepth, n1, n2,
  );
  const allTreads: readonly Polygon3D[] = [...flight1.treads, ...flight2.treads];
  const risers: readonly Segment3D[] = [...flight1.risers, ...flight2.risers];
  const walkline = buildUShapeWalkline(basePoint, u1, v1, u2, turnSign, rise, tread, width, n1, n2);
  const stringers = buildStringersFromWalkline(walkline, width);
  // ADR-358 Phase 3d hotfix — arrow on FIRST flight segment (see lshape rationale).
  const arrow = arrowSymbol(walkline[0], walkline[1], upDirection);
  const cutPlaneHeight = params.cutPlaneHeight ?? DEFAULT_CUT_PLANE_HEIGHT;
  const split = splitTreadsByCutPlaneUShape(allTreads, cutPlaneHeight);
  const cutLine = buildCutLineForFlights(allTreads, [n1, n2], [u1, u2], width, cutPlaneHeight);
  const treadLabels = buildTreadLabelsWithLandings(
    allTreads,
    [landing],
    [n1, n2],
    params.treadLabelDisplay,
    params.treadLabelEveryN,
    params.treadLabelRestartPerFlight,
    params.treadNumberStart,
  );
  return {
    treads: split.below,
    treadsBelowCut: split.below,
    treadsAboveCut: split.above,
    risers,
    stringers,
    walkline,
    handrails: buildHandrailsFromParams(walkline, params.width, params.handrails),
    landings: [landing],
    arrowSymbol: arrow,
    cutLine,
    treadLabels,
    bbox: bboxOfPolygons([...allTreads, landing]),
  };
}

// ─── helpers ────────────────────────────────────────────────────────────────

function assertUShapeCornerSupported(variant: StairVariantUShape): void {
  const style = variant.landingCornerStyle ?? 'square';
  if (style !== 'square') {
    throw new Error(
      `StairGeometryService: landingCornerStyle '${style}' requires Phase 3c (chamfer/fillet not implemented)`,
    );
  }
}

function splitTreadsByCutPlaneUShape(
  treads: readonly Polygon3D[],
  cutPlaneHeight: number,
): { readonly below: readonly Polygon3D[]; readonly above: readonly Polygon3D[] } {
  const below: Polygon3D[] = [];
  const above: Polygon3D[] = [];
  for (const t of treads) {
    const z = t[0]?.z ?? 0;
    if (z < cutPlaneHeight) below.push(t); else above.push(t);
  }
  return { below, above };
}

function buildUShapeFlight1(
  basePoint: Readonly<Point3D>,
  u: Vec2,
  v: Vec2,
  rise: number,
  tread: number,
  nosing: number,
  width: number,
  n1: number,
): { readonly treads: readonly Polygon3D[]; readonly risers: readonly Segment3D[] } {
  const halfW = width * 0.5;
  const depth = tread + nosing;
  const treads: Polygon3D[] = new Array(n1);
  for (let i = 0; i < n1; i++) {
    const along = tread * i;
    const ox = basePoint.x + u.x * along - v.x * halfW;
    const oy = basePoint.y + u.y * along - v.y * halfW;
    const tz = basePoint.z + rise * i;
    treads[i] = [
      point(ox, oy, tz),
      point(ox + u.x * depth, oy + u.y * depth, tz),
      point(ox + u.x * depth + v.x * width, oy + u.y * depth + v.y * width, tz),
      point(ox + v.x * width, oy + v.y * width, tz),
    ];
  }
  const risers: Segment3D[] = [];
  for (let i = 0; i < n1 - 1; i++) {
    const along = tread * (i + 1);
    const cx = basePoint.x + u.x * along - v.x * halfW;
    const cy = basePoint.y + u.y * along - v.y * halfW;
    // ADR-370 Phase 5.3 — diagonal Segment3D (see StairGeometryService.buildStraightRisers).
    // Flight 1 width axis = v, near edge at cx,cy (cy already − v·halfW), far edge at +v·width.
    risers.push({
      start: point(cx, cy, basePoint.z + rise * i),
      end: point(cx + v.x * width, cy + v.y * width, basePoint.z + rise * (i + 1)),
    });
  }
  return { treads, risers };
}

function buildUShapeLanding(
  basePoint: Readonly<Point3D>,
  u: Vec2,
  v: Vec2,
  turnSign: 1 | -1,
  rise: number,
  tread: number,
  width: number,
  landingDepth: number,
  n1: number,
): Polygon3D {
  const halfW = width * 0.5;
  const along0 = n1 * tread;
  const along1 = along0 + landingDepth;
  // Landing spans 2·width laterally: from flight 1's far edge (turnSign side =
  // landing-shared with flight 2) outward by `width`, plus flight 1's own
  // width band on the opposite side.
  const vNear = turnSign === -1 ? -(halfW + width) : -halfW;
  const vFar = turnSign === -1 ? halfW : halfW + width;
  const z = basePoint.z + rise * n1;
  return [
    point(basePoint.x + u.x * along0 + v.x * vNear, basePoint.y + u.y * along0 + v.y * vNear, z),
    point(basePoint.x + u.x * along1 + v.x * vNear, basePoint.y + u.y * along1 + v.y * vNear, z),
    point(basePoint.x + u.x * along1 + v.x * vFar, basePoint.y + u.y * along1 + v.y * vFar, z),
    point(basePoint.x + u.x * along0 + v.x * vFar, basePoint.y + u.y * along0 + v.y * vFar, z),
  ];
}

function buildUShapeFlight2(
  basePoint: Readonly<Point3D>,
  u1: Vec2,
  v1: Vec2,
  u2: Vec2,
  turnSign: 1 | -1,
  rise: number,
  tread: number,
  nosing: number,
  width: number,
  landingDepth: number,
  n1: number,
  n2: number,
): { readonly treads: readonly Polygon3D[]; readonly risers: readonly Segment3D[] } {
  const halfW = width * 0.5;
  const depth = tread + nosing;
  // Flight 2 lateral inner edge (the edge shared with the landing, closest to
  // flight 1): v1·(turnSign·halfW). For turnRight (turnSign=-1) → −halfW;
  // for turnLeft (+1) → +halfW.
  const innerEdge: Vec2 = {
    x: basePoint.x + u1.x * (n1 * tread + landingDepth) + v1.x * (turnSign * halfW),
    y: basePoint.y + u1.y * (n1 * tread + landingDepth) + v1.y * (turnSign * halfW),
  };
  // vOut = direction from inner edge to outer edge of flight 2. For turnRight:
  // outer is further negative on v1 → vOut = −v1. For turnLeft: outer further
  // positive → vOut = +v1. Compactly: vOut = turnSign·v1.
  const vOut: Vec2 = { x: turnSign * v1.x, y: turnSign * v1.y };
  const treads: Polygon3D[] = new Array(n2);
  for (let i = 0; i < n2; i++) {
    const ox = innerEdge.x + u2.x * (tread * i);
    const oy = innerEdge.y + u2.y * (tread * i);
    const tz = basePoint.z + rise * (n1 + 1 + i);
    treads[i] = [
      point(ox, oy, tz),
      point(ox + u2.x * depth, oy + u2.y * depth, tz),
      point(ox + u2.x * depth + vOut.x * width, oy + u2.y * depth + vOut.y * width, tz),
      point(ox + vOut.x * width, oy + vOut.y * width, tz),
    ];
  }
  const risers: Segment3D[] = [];
  for (let i = 0; i < n2 - 1; i++) {
    const along = (i + 1) * tread;
    const cx = innerEdge.x + u2.x * along;
    const cy = innerEdge.y + u2.y * along;
    // ADR-370 Phase 5.3 — diagonal Segment3D. Flight 2 width axis = vOut,
    // innerEdge is the near width edge, far edge at +vOut·width.
    risers.push({
      start: point(cx, cy, basePoint.z + rise * (n1 + 1 + i)),
      end: point(cx + vOut.x * width, cy + vOut.y * width, basePoint.z + rise * (n1 + 2 + i)),
    });
  }
  return { treads, risers };
}

function buildUShapeWalkline(
  basePoint: Readonly<Point3D>,
  u1: Vec2,
  v1: Vec2,
  u2: Vec2,
  turnSign: 1 | -1,
  rise: number,
  tread: number,
  width: number,
  n1: number,
  n2: number,
): Polyline3D {
  // 4-vertex pattern with TWO sharp 90° turns at the landing entry/exit.
  // p1: basePoint.
  // p2: u1 · (n1·tread + halfW), v1·0  — landing-entry L corner (90° turn into v1·turnSign).
  // p3: u1 · (n1·tread + halfW), v1·(turnSign·width)  — landing-exit L corner (90° turn into u2).
  // p4: p3 + u2 · (halfW + (n2−1)·tread)  — flight 2 walkline end.
  const halfW = width * 0.5;
  const aTurn = n1 * tread + halfW;
  const lateral = turnSign * width;
  const flight2Run = halfW + (n2 - 1) * tread;
  return [
    point(basePoint.x, basePoint.y, basePoint.z),
    point(basePoint.x + u1.x * aTurn, basePoint.y + u1.y * aTurn, basePoint.z + rise * n1),
    point(
      basePoint.x + u1.x * aTurn + v1.x * lateral,
      basePoint.y + u1.y * aTurn + v1.y * lateral,
      basePoint.z + rise * n1,
    ),
    point(
      basePoint.x + u1.x * aTurn + v1.x * lateral + u2.x * flight2Run,
      basePoint.y + u1.y * aTurn + v1.y * lateral + u2.y * flight2Run,
      basePoint.z + rise * (n1 + n2),
    ),
  ];
}
