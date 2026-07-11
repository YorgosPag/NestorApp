/**
 * Shared stair geometry generators + assembler (ADR-611).
 *
 * SSoT layer sitting ON TOP of the `stair-geometry-shared.ts` primitives. Every
 * per-kind computer (`compute*`) previously repeated four families of code:
 *
 *   1. The `StairGeometry` **assembly tail** — cut-plane split, tread labels,
 *      handrails, bbox and the 13-field return object — identical across all
 *      12 kinds. → `assembleStairGeometry`.
 *   2. **Rectilinear flights** from a centreline base point (straight, l/u/gamma
 *      flight 1, v-shape arm, winder flight 1). → `buildRectilinearFlight`.
 *   3. **Edge-origin flights** whose origin sits on one width edge (l/u flight 2,
 *      gamma intermediate flights, winder flight 2). → `buildFlightFromEdge`.
 *   4. **Polar** (spiral/helical/triangular-fan) and **walkline-following**
 *      (elliptical/sketch/triangular-outline) tread + cut-line generators.
 *
 * Big-player parallel: Revit / ArchiCAD / Vectorworks stair engines expose a
 * single StairsRun geometry builder + reusable curve samplers; each run type
 * only computes its treads/risers/walkline and hands them to the builder. This
 * module mirrors that split — the kind files become thin bindings that inject
 * the geometric variation, the assembly + generators live once.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-611-stair-geometry-generators-ssot.md
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.1 §6.2 §6.3
 */

import type { Point3D } from '../../../rendering/types/Types';
import type {
  Polygon3D,
  Polyline3D,
  Segment3D,
  StairArrowSymbol,
  StairGeometry,
  StairParams,
  StairTurnDirectionLR,
} from '../../../bim/types/stair-types';
import {
  DEFAULT_CUT_PLANE_HEIGHT,
  type Vec2,
  perp,
  point,
  rectangleAt,
  directionToUnitVector,
  arrowSymbol,
  bboxOfPolygons,
  splitTreadsByCutPlane,
  buildCutLineForFlights,
  buildStringersFromWalkline,
  buildHandrailsFromParams,
} from './stair-geometry-shared';
import { buildTreadLabels, buildTreadLabelsWithLandings } from './stair-geometry-labels';
import { applyPerTreadNosing } from './stair-tread-overrides';

// ─── Flight geometry (treads + risers) ────────────────────────────────────────

export interface FlightGeometry {
  readonly treads: readonly Polygon3D[];
  readonly risers: readonly Segment3D[];
}

/**
 * Rectilinear flight from a CENTRELINE base point: `count` treads along `u`,
 * width `width` centred on the u-axis (±halfW along `perp(u)`), first tread at
 * `z = basePoint.z`, rising `rise` per step. Risers are diagonal `Segment3D`
 * (ADR-370 Phase 5.3) spanning the two width edges at ascending elevation.
 *
 * SSoT for: straight · l-shape flight 1 · u-shape flight 1 · gamma flight 1 ·
 * v-shape arm · winder flight 1.
 */
export function buildRectilinearFlight(
  basePoint: Readonly<Point3D>,
  u: Vec2,
  rise: number,
  tread: number,
  nosing: number,
  width: number,
  count: number,
): FlightGeometry {
  const v = perp(u);
  const halfW = width * 0.5;
  const depth = tread + nosing;
  const treads: Polygon3D[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const along = tread * i;
    const corner: Vec2 = {
      x: basePoint.x + u.x * along - v.x * halfW,
      y: basePoint.y + u.y * along - v.y * halfW,
    };
    treads[i] = rectangleAt(corner, u, depth, width, basePoint.z + rise * i);
  }
  const risers: Segment3D[] = [];
  for (let i = 0; i < count - 1; i++) {
    const along = tread * (i + 1);
    const cx = basePoint.x + u.x * along;
    const cy = basePoint.y + u.y * along;
    risers.push({
      start: point(cx - v.x * halfW, cy - v.y * halfW, basePoint.z + rise * i),
      end: point(cx + v.x * halfW, cy + v.y * halfW, basePoint.z + rise * (i + 1)),
    });
  }
  return { treads, risers };
}

/**
 * Flight whose origin sits on ONE width edge (not the centreline): `count`
 * treads along `uAlong`, width spanning `[0, width]` along `vWidth`, first tread
 * at `z = zFirstTread`. Risers span `vWidth·[0, width]` at ascending elevation.
 *
 * SSoT for: l-shape flight 2 · u-shape flight 2 · gamma intermediate flights ·
 * winder flight 2.
 */
export function buildFlightFromEdge(
  originXY: Vec2,
  uAlong: Vec2,
  vWidth: Vec2,
  rise: number,
  tread: number,
  nosing: number,
  width: number,
  count: number,
  zFirstTread: number,
): FlightGeometry {
  const depth = tread + nosing;
  const treads: Polygon3D[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const ox = originXY.x + uAlong.x * (tread * i);
    const oy = originXY.y + uAlong.y * (tread * i);
    const tz = zFirstTread + rise * i;
    treads[i] = [
      point(ox, oy, tz),
      point(ox + uAlong.x * depth, oy + uAlong.y * depth, tz),
      point(ox + uAlong.x * depth + vWidth.x * width, oy + uAlong.y * depth + vWidth.y * width, tz),
      point(ox + vWidth.x * width, oy + vWidth.y * width, tz),
    ];
  }
  const risers: Segment3D[] = [];
  for (let i = 0; i < count - 1; i++) {
    const along = (i + 1) * tread;
    const cx = originXY.x + uAlong.x * along;
    const cy = originXY.y + uAlong.y * along;
    risers.push({
      start: point(cx, cy, zFirstTread + rise * i),
      end: point(cx + vWidth.x * width, cy + vWidth.y * width, zFirstTread + rise * (i + 1)),
    });
  }
  return { treads, risers };
}

// ─── Per-kind samplers (polar grid + walkline-following) ──────────────────────
// Extracted to `stair-geometry-samplers.ts` (500-line cap); re-exported here so
// existing import sites keep resolving them from this module.
export {
  type AngularGrid,
  buildAngularGrid,
  radialPoint,
  radialTangentAt,
  chordTangent,
  buildWalklineTreads,
  buildWalklineRisers,
  buildWalklineCutLine,
} from './stair-geometry-samplers';

// ─── Assembler (the shared StairGeometry builder) ─────────────────────────────

/**
 * Kind-specific geometric parts that each `compute*` computes on its own; the
 * assembler turns them into the final `StairGeometry`. `landings` defaults to
 * empty. When landings are present, labels are numbered with the interleaved
 * `buildTreadLabelsWithLandings` convention; otherwise the plain
 * `buildTreadLabels` runs over `flightSplit`.
 */
export interface StairGeometryParts {
  readonly treads: readonly Polygon3D[];
  readonly risers: readonly Segment3D[];
  readonly stringers: { readonly inner: Polyline3D; readonly outer: Polyline3D };
  readonly walkline: Polyline3D;
  readonly cutLine: Segment3D | undefined;
  readonly arrowSymbol: StairArrowSymbol;
  /** Per-flight tread counts driving label numbering (e.g. `[stepCount]`, `[n1, n2]`). */
  readonly flightSplit: readonly number[];
  /** Interleaved landing polygons (one per inter-flight boundary). Defaults to `[]`. */
  readonly landings?: readonly Polygon3D[];
}

/**
 * Assemble the cached `StairGeometry` from kind-specific parts + `params`.
 * Owns the cut-plane split, tread-label numbering, handrail derivation and the
 * bounding box — the invariant tail every kind shared verbatim.
 */
export function assembleStairGeometry(
  params: Readonly<StairParams>,
  parts: StairGeometryParts,
): StairGeometry {
  const landings = parts.landings ?? [];
  // ADR-611 Φ4 (ADR-358 Q19) — per-tread nosing SSoT. Runs on the global
  // build-order tread list BEFORE the cut-plane split, so index i aligns with
  // `perTreadOverrides[i]` and the 3D tag/material key. No-op (same reference)
  // when the stair has no overrides → geometry stays byte-identical.
  const treads = applyPerTreadNosing(parts.treads, params);
  const cutPlaneHeight = params.cutPlaneHeight ?? DEFAULT_CUT_PLANE_HEIGHT;
  const split = splitTreadsByCutPlane(treads, cutPlaneHeight);
  const treadLabels = landings.length > 0
    ? buildTreadLabelsWithLandings(
        treads,
        landings,
        parts.flightSplit,
        params.treadLabelDisplay,
        params.treadLabelEveryN,
        params.treadLabelRestartPerFlight,
        params.treadNumberStart,
      )
    : buildTreadLabels(
        treads,
        parts.flightSplit,
        params.treadLabelDisplay,
        params.treadLabelEveryN,
        params.treadLabelRestartPerFlight,
        params.treadNumberStart,
      );
  return {
    treads: split.below,
    treadsBelowCut: split.below,
    treadsAboveCut: split.above,
    risers: parts.risers,
    stringers: parts.stringers,
    walkline: parts.walkline,
    handrails: buildHandrailsFromParams(parts.walkline, params.width, params.handrails),
    landings,
    arrowSymbol: parts.arrowSymbol,
    cutLine: parts.cutLine,
    treadLabels,
    bbox: bboxOfPolygons(
      landings.length > 0 ? [...treads, ...landings] : treads,
    ),
  };
}

/**
 * Single-flight assembler for the walkline-following convention: the up-arrow
 * runs from the first to the last walkline vertex, and label numbering runs
 * over one flight of `stepCount` treads. Used by every curved single-flight
 * kind (radial + walkline-following).
 */
export function assembleSingleFlightWalkline(
  params: Readonly<StairParams>,
  parts: {
    readonly treads: readonly Polygon3D[];
    readonly risers: readonly Segment3D[];
    readonly stringers: { readonly inner: Polyline3D; readonly outer: Polyline3D };
    readonly walkline: Polyline3D;
    readonly cutLine: Segment3D | undefined;
  },
): StairGeometry {
  return assembleStairGeometry(params, {
    treads: parts.treads,
    risers: parts.risers,
    stringers: parts.stringers,
    walkline: parts.walkline,
    cutLine: parts.cutLine,
    arrowSymbol: arrowSymbol(
      parts.walkline[0],
      parts.walkline[parts.walkline.length - 1],
      params.upDirection,
    ),
    flightSplit: [params.stepCount],
  });
}

/**
 * Multi-flight assembler: derives stringers from the walkline and the cutLine
 * from the per-flight tread counts + directions (`buildCutLineForFlights`),
 * then assembles. The up-arrow is kind-specific (first-segment vs base-to-top)
 * so it is passed in. Used by v-shape, l-shape, u-shape, gamma, winder.
 */
export interface MultiFlightParts {
  readonly treads: readonly Polygon3D[];
  readonly risers: readonly Segment3D[];
  readonly walkline: Polyline3D;
  /** One direction per flight, feeding `buildCutLineForFlights`. */
  readonly cutDirs: readonly Vec2[];
  /** Per-flight tread counts (label numbering + cut-line flight boundaries). */
  readonly flightSplit: readonly number[];
  readonly arrowSymbol: StairArrowSymbol;
  readonly landings?: readonly Polygon3D[];
}

export function assembleMultiFlight(
  params: Readonly<StairParams>,
  parts: MultiFlightParts,
): StairGeometry {
  const stringers = buildStringersFromWalkline(parts.walkline, params.width);
  const cutPlaneHeight = params.cutPlaneHeight ?? DEFAULT_CUT_PLANE_HEIGHT;
  const cutLine = buildCutLineForFlights(
    parts.treads,
    parts.flightSplit,
    parts.cutDirs,
    params.width,
    cutPlaneHeight,
  );
  return assembleStairGeometry(params, {
    treads: parts.treads,
    risers: parts.risers,
    stringers,
    walkline: parts.walkline,
    cutLine,
    arrowSymbol: parts.arrowSymbol,
    flightSplit: parts.flightSplit,
    landings: parts.landings,
  });
}

// ─── Two-flight switchback with mid-landing (l-shape / u-shape) ────────────────

/** Shared plan-frame setup for a two-flight switchback stair with a landing. */
export interface SwitchbackBase {
  readonly u1: Vec2;
  readonly v1: Vec2;
  readonly n1: number;
  readonly n2: number;
  readonly landingDepth: number;
  readonly turnSign: 1 | -1;
}

/**
 * Resolve the shared setup for l-shape / u-shape landing variants: flight-1
 * direction `u1` + its perpendicular `v1`, the `[n1, n2]` split, the resolved
 * `landingDepth` (`'auto'` → width), and the `turnSign` (right = −1, left = +1).
 */
export function resolveSwitchbackBase(
  params: Readonly<StairParams>,
  variant: {
    readonly flightSplit: readonly [number, number];
    readonly landingDepth: 'auto' | number;
    readonly turnDirection: StairTurnDirectionLR;
  },
): SwitchbackBase {
  const u1 = directionToUnitVector(params.direction);
  const v1 = perp(u1);
  const [n1, n2] = variant.flightSplit;
  const landingDepth = variant.landingDepth === 'auto' ? params.width : variant.landingDepth;
  const turnSign: 1 | -1 = variant.turnDirection === 'right' ? -1 : 1;
  return { u1, v1, n1, n2, landingDepth, turnSign };
}

/**
 * Rectangular corner landing (ADR-611 SSoT — shared by gamma + multi-flight).
 *
 * A `depth × width` rectangle at a flight junction, aligned to the incoming
 * flight frame (`uAlong` = travel dir, `vWidth` = its perpendicular). When
 * `centered`, the landing spans `vWidth · [−halfW, +halfW]` from `originXY`
 * (origin on the flight centreline — gamma flight 1 / every multi-flight turn).
 * When not centred it spans `vWidth · [0, width]` (origin at one v-edge — gamma
 * intermediate flights). Traced outer→along→across→back so the polygon is a
 * simple convex quad.
 *
 * SSoT for: gamma landings · multi-flight turn landings.
 */
export function buildCornerLanding(
  originXY: Vec2,
  uAlong: Vec2,
  vWidth: Vec2,
  width: number,
  depth: number,
  z: number,
  centered: boolean,
): Polygon3D {
  const halfW = width * 0.5;
  const vLow = centered ? -halfW : 0;
  const vHigh = centered ? halfW : width;
  return [
    point(originXY.x + vWidth.x * vLow, originXY.y + vWidth.y * vLow, z),
    point(
      originXY.x + uAlong.x * depth + vWidth.x * vLow,
      originXY.y + uAlong.y * depth + vWidth.y * vLow,
      z,
    ),
    point(
      originXY.x + uAlong.x * depth + vWidth.x * vHigh,
      originXY.y + uAlong.y * depth + vWidth.y * vHigh,
      z,
    ),
    point(originXY.x + vWidth.x * vHigh, originXY.y + vWidth.y * vHigh, z),
  ];
}

/**
 * Assemble a two-flight switchback stair with one mid-landing (l-shape /
 * u-shape). Concatenates the two flights, numbers the up-arrow on the first
 * walkline segment (industry convention) and interleaves the single landing.
 */
export function assembleTwoFlightLanding(
  params: Readonly<StairParams>,
  parts: {
    readonly flight1: FlightGeometry;
    readonly flight2: FlightGeometry;
    readonly walkline: Polyline3D;
    readonly landing: Polygon3D;
    readonly dirs: readonly [Vec2, Vec2];
    readonly split: readonly [number, number];
  },
): StairGeometry {
  return assembleMultiFlight(params, {
    treads: [...parts.flight1.treads, ...parts.flight2.treads],
    risers: [...parts.flight1.risers, ...parts.flight2.risers],
    walkline: parts.walkline,
    cutDirs: parts.dirs,
    flightSplit: parts.split,
    arrowSymbol: arrowSymbol(parts.walkline[0], parts.walkline[1], params.upDirection),
    landings: [parts.landing],
  });
}

