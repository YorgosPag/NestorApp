/**
 * ADR-358 Phase 3a — `StairGeometryService` entry point.
 *
 * Pure functions (no DOM / React / DXF deps). Dispatch on `StairParams.variant.kind`.
 * Phase 3a implements ONLY `'straight'` + `'l-shape'`. The remaining 9 kinds throw
 * sentinel errors — Phase 3b/4a/4b/4c will replace them incrementally as they
 * register kind-specific computers.
 *
 * Conventions (shared with Phase 2a/2b):
 *   - Plan view: +X right, +Y up. ccw rotation = positive angle (math frame).
 *   - All linear inputs in mm (storage canonical per §5.0).
 *   - Tread polygon at z = i·rise (i = 0..stepCount−1) — vertices co-planar, CCW.
 *   - Riser i (between treads i and i+1) is the vertical edge segment.
 *   - Walkline = polyline of waist-line of the flight (Polyline3D).
 *   - Stringers = parallel-offset of walkline at ±width/2 (uses Phase 2b SSoT).
 *   - cutPlaneHeight default 1200 mm (§5.1 Q21). When `params.cutPlaneHeight` is
 *     undefined the default applies. cutLine is emitted only when the cut plane
 *     actually splits the stair (both below/above lists non-empty).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.1 §5.3 §6.2 §6.3
 */

import { offsetPolyline } from '../../../rendering/entities/shared/geometry-offset-utils';
import type {
  Point3D,
  Polygon3D,
  Polyline3D,
  Segment3D,
  StairGeometry,
  StairParams,
} from '../../../bim/types/stair-types';
import {
  DEFAULT_CUT_PLANE_HEIGHT,
  type Vec2,
  directionToUnitVector,
  perp,
  point,
  arrowSymbol,
  splitTreadsByCutPlane,
  buildCutLine,
  buildStringersFromWalkline,
} from './stair-geometry-shared';
import {
  assembleMultiFlight,
  assembleStairGeometry,
  buildCornerLanding,
  buildRectilinearFlight,
} from './stair-geometry-generators';
import {
  hasRestLandings,
  planStairRunSegments,
  resolveRestLandingLength,
} from './stair-run-landings';
import { computeLShape } from './stair-geometry-lshape';
import { computeUShape } from './stair-geometry-ushape';
import { computeGamma } from './stair-geometry-gamma';
import { computeMultiFlight } from './stair-geometry-multiflight';
import { computeSpiral } from './stair-geometry-spiral';
import { computeHelical } from './stair-geometry-helical';
import { computeElliptical } from './stair-geometry-elliptical';
import { computeWinder } from './stair-geometry-winder';
import { computeTriangularFan } from './stair-geometry-triangular-fan';
import { computeTriangularOutline } from './stair-geometry-triangular-outline';
import { computeSketch } from './stair-geometry-sketch';
import { computeVShape } from './stair-geometry-vshape';

// ─── Public entry point (kind dispatch) ──────────────────────────────────────

/**
 * Compute the cached `StairGeometry` from a parametric `StairParams`. Dispatches
 * on `params.variant.kind`. Phase 3a covers `'straight'` and `'l-shape'`; other
 * kinds throw with a sentinel that subsequent phases replace.
 */
export function computeStairGeometry(params: Readonly<StairParams>): StairGeometry {
  const variant = params.variant;
  switch (variant.kind) {
    case 'straight':
      return computeStraight(params);
    case 'l-shape':
      return computeLShape(params, variant);
    case 'u-shape':
      return computeUShape(params, variant);
    case 'gamma':
      return computeGamma(params, variant);
    case 'multi-flight':
      return computeMultiFlight(params, variant);
    case 'spiral':
      return computeSpiral(params, variant);
    case 'helical':
      return computeHelical(params, variant);
    case 'elliptical':
      return computeElliptical(params, variant);
    case 'winder':
      return computeWinder(params, variant);
    case 'triangular-fan':
      return computeTriangularFan(params, variant);
    case 'triangular-outline':
      return computeTriangularOutline(params, variant);
    case 'sketch':
      return computeSketch(params, variant);
    case 'v-shape':
      return computeVShape(params, variant);
    default: {
      const _exhaustive: never = variant;
      throw new Error(`StairGeometryService: unhandled variant ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/**
 * Walkline from a centerline polyline by parallel offset. Re-exported helper —
 * Phase 4a/4b services pass curved centerlines (helix/spiral samples) and want
 * the walkline offset by `params.walklineOffset` from the inner edge.
 *
 * Reuses Phase 2b `offsetPolyline` — no parallel-offset duplicate in this file.
 */
export function computeWalkline(centerline: Polyline3D, offset: number): Polyline3D {
  return offsetPolyline(centerline, offset);
}

// ─── STRAIGHT ────────────────────────────────────────────────────────────────

function computeStraight(params: Readonly<StairParams>): StairGeometry {
  // ADR-637 — a straight run carrying rest landings is planned + assembled like a
  // multi-flight (0° turns). No landings → the byte-identical single-flight path.
  if (hasRestLandings(params.stepCount, params.restLandings)) {
    return computeStraightWithLandings(params);
  }
  const { basePoint, direction, rise, tread, nosing, width, stepCount, upDirection } = params;
  const u = directionToUnitVector(direction);
  // ADR-611 — flight treads/risers (rectilinear, centreline origin) from the
  // shared `buildRectilinearFlight` generator. Risers keep the ADR-370 Phase
  // 5.3 diagonal Segment3D encoding the generator implements.
  const flight = buildRectilinearFlight(basePoint, u, rise, tread, nosing, width, stepCount);
  const walkline = buildStraightWalkline(basePoint, u, tread, rise, stepCount);
  const stringers = buildStringersFromWalkline(walkline, width);
  const totalRun = tread * (stepCount - 1);
  const arrow = arrowSymbol(
    basePoint,
    point(basePoint.x + u.x * totalRun, basePoint.y + u.y * totalRun, basePoint.z),
    upDirection,
  );
  const cutPlaneHeight = params.cutPlaneHeight ?? DEFAULT_CUT_PLANE_HEIGHT;
  const split = splitTreadsByCutPlane(flight.treads, cutPlaneHeight);
  const cutLine =
    split.below.length > 0 && split.above.length > 0
      ? buildCutLine(split.above[0], u, width, cutPlaneHeight)
      : undefined;
  return assembleStairGeometry(params, {
    treads: flight.treads,
    risers: flight.risers,
    stringers,
    walkline,
    cutLine,
    arrowSymbol: arrow,
    flightSplit: [stepCount],
  });
}

/**
 * ADR-637 — straight run with one or more rest landings. Walks the kind-
 * independent `planStairRunSegments` schedule: each flight segment reuses
 * `buildRectilinearFlight` (ADR-611), each landing segment reuses
 * `buildCornerLanding` (0° corner = same travel direction), advancing a single
 * centreline cursor along `u`. z of level `i` = `base.z + i·rise`, so a landing
 * sits flat one riser above the flight below it (gamma/multi-flight z-model).
 * Assembled through `assembleMultiFlight` so cut-line/labels/landings match the
 * turn-landing family exactly.
 */
function computeStraightWithLandings(params: Readonly<StairParams>): StairGeometry {
  const { basePoint, direction, rise, tread, nosing, width, stepCount, upDirection } = params;
  const u = directionToUnitVector(direction);
  const v = perp(u);
  const segments = planStairRunSegments(stepCount, params.restLandings);

  const treads: Polygon3D[] = [];
  const risers: Segment3D[] = [];
  const landings: Polygon3D[] = [];
  const flightSplit: number[] = [];
  const cutDirs: Vec2[] = [];
  const walkline: Point3D[] = [point(basePoint.x, basePoint.y, basePoint.z)];

  let cx = basePoint.x;
  let cy = basePoint.y;
  const zAtLevel = (level: number): number => basePoint.z + rise * level;

  for (const seg of segments) {
    if (seg.kind === 'flight') {
      const flightStart = point(cx, cy, zAtLevel(seg.startLevel));
      const flight = buildRectilinearFlight(flightStart, u, rise, tread, nosing, width, seg.treadCount);
      treads.push(...flight.treads);
      risers.push(...flight.risers);
      flightSplit.push(seg.treadCount);
      cutDirs.push(u);
      const along = tread * seg.treadCount;
      cx += u.x * along;
      cy += u.y * along;
      walkline.push(point(cx, cy, zAtLevel(seg.startLevel + seg.treadCount)));
    } else {
      const z = zAtLevel(seg.level);
      const length = resolveRestLandingLength(seg.landing.length, width);
      landings.push(buildCornerLanding({ x: cx, y: cy }, u, v, width, length, z, /* centered */ true));
      cx += u.x * length;
      cy += u.y * length;
      walkline.push(point(cx, cy, z));
    }
  }

  return assembleMultiFlight(params, {
    treads,
    risers,
    walkline,
    cutDirs,
    flightSplit,
    arrowSymbol: arrowSymbol(walkline[0], walkline[1], upDirection),
    landings,
  });
}

function buildStraightWalkline(
  basePoint: Readonly<{ x: number; y: number; z: number }>,
  u: Vec2,
  tread: number,
  rise: number,
  stepCount: number,
): Polyline3D {
  const run = tread * (stepCount - 1);
  return [
    point(basePoint.x, basePoint.y, basePoint.z),
    point(
      basePoint.x + u.x * run,
      basePoint.y + u.y * run,
      basePoint.z + rise * (stepCount - 1),
    ),
  ];
}
