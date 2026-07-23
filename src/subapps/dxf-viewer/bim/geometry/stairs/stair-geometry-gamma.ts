/**
 * Gamma (Γ) stair geometry (ADR-358 §5.1 Phase 3b).
 *
 * Three flights joined by two intermediate landings — `turnSequence` controls
 * the rotation at each landing (`left` = +90°, `right` = −90°). When both
 * turns are `'right'` the third flight ends up anti-parallel to flight 1; a
 * `'right','left'` (or `'left','right'`) sequence re-aligns it parallel.
 *
 * z model (matches the prompt §1.2):
 *   - Flight 1 treads: z ∈ [0, (n1−1)·rise]
 *   - Landing 1: z = n1·rise
 *   - Flight 2 treads: z ∈ [(n1+1)·rise, (n1+n2)·rise]
 *   - Landing 2: z = (n1+n2+1)·rise
 *   - Flight 3 treads: z ∈ [(n1+n2+2)·rise, (stepCount+1)·rise]
 *
 * Gamma's top tread therefore reaches (stepCount+1)·rise — one rise higher
 * than l-shape because every additional landing inserts a +1 rise step into
 * the z accumulator. This is the convention required by Phase 3b prompt.
 *
 * `landingCornerStyle: 'chamfer' | 'fillet'` throws with a `/Phase 3c/`
 * sentinel — square corners only in Phase 3b.
 *
 * ADR-611 — flight 1 (rectilinear) and the two intermediate flights
 * (edge-origin) delegate to the shared generators; the `StairGeometry`
 * assembly tail (incl. the cut-plane split that was a local duplicate here)
 * comes from `stair-geometry-generators.ts`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.1 §6.2
 */

import type { Point3D } from '../../../rendering/types/Types';
import type {
  StairGeometry,
  StairParams,
  StairTurnDirectionLR,
  StairVariantGamma,
} from '../../../bim/types/stair-types';
import {
  type Vec2,
  perp,
  directionToUnitVector,
  offsetAlong,
  point,
  centrelineWidthEdges,
  edgeWidthEdges,
  landingTransitionRisers,
} from './stair-geometry-shared';
import { buildCornerLanding } from './stair-geometry-generators';
import {
  type StairRunResult,
  appendRunAcrossNinetyTurn,
  assembleTurnRunStair,
  beginTurnRun,
  edgeRun,
} from './stair-flight-run-builder';

/**
 * Γ (gamma) — three flights joined by two turn landings. ONE path for both the
 * bare stair and rest-landing (πλατύσκαλα) stairs (ADR-637 Phase 2b): every
 * flight is a run (`centrelineRun` for flight 1, `edgeRun` for the two
 * edge-origin flights), so an empty schedule yields runs byte-identical to the
 * old bare flights. Each turn landing is anchored at the preceding run's real
 * plan end (`endXY`) → a rest landing inside any flight slides everything
 * downstream with no bespoke offset math; the two-turn z-model stays invariant
 * (landing 1 at level n1, landing 2 at level n1+n2+1), only the footprint grows.
 * The walkline is the bespoke 6-vertex `buildGammaWalkline` when there are no
 * rest landings (byte-identical) and the run-stitched centreline otherwise.
 */
export function computeGamma(
  params: Readonly<StairParams>,
  variant: StairVariantGamma,
): StairGeometry {
  assertGammaCornerSupported(variant);
  const { basePoint, direction, rise, width } = params;
  const { u1, v1, u2, u3, turnSign1 } = resolveGammaFrame(direction, variant);
  const [n1, n2, n3] = variant.flightSplit;
  const landing1Depth = resolveDepth(variant.landings[0], width);
  const landing2Depth = resolveDepth(variant.landings[1], width);
  const halfW = width * 0.5;
  const { common, per, run1 } = beginTurnRun(params, u1, [n1, n2, n3]);
  const landing1 = buildCornerLanding(
    run1.endXY, u1, v1, width, landing1Depth, basePoint.z + rise * n1, /* centered */ true,
  );

  // Flight 2 — edge origin off the landing-1 turn corner, along u2, cross-width u1.
  const flight2Origin = offsetAlong(run1.endXY, v1, turnSign1 * halfW);
  const run2 = edgeRun(common, flight2Origin, u2, u1, n1 + 1, n2, per[1]);
  const landing2 = buildCornerLanding(
    run2.endXY, u2, u1, width, landing2Depth,
    basePoint.z + rise * (n1 + n2 + 1), /* centered */ false,
  );

  // Flight 3 — edge origin off the landing-2 corner, along u3, cross-width u2.
  // run2 ends on an EDGE (edge-origin flight), NOT the centreline — so, unlike
  // flight 2 (which offsets flight 1's CENTRELINE end by turnSign·halfW to reach the
  // edge), flight 3's origin sits on whichever u1-aligned edge of landing 2 it
  // departs from: the near edge (offset 0) when flight 3 travels −u1, the far edge
  // (offset `width`) when it travels +u1. Landing 2 spans `u1·[0, width]` from
  // `run2.endXY` (buildCornerLanding, not centred), so these two offsets land flight
  // 3 flush against it. The old `v2·turnSign2·halfW` offset was a blanket half-width
  // shift that left a constant halfW GAP between flight 3 and landing 2 (ADR-358).
  const flight3StartOffset = u1.x * u3.x + u1.y * u3.y > 0 ? width : 0;
  const flight3Origin = offsetAlong(run2.endXY, u1, flight3StartOffset);
  const run3 = edgeRun(common, flight3Origin, u3, u2, n1 + n2 + 2, n3, per[2]);

  // Transition risers around both turn landings. Turn 1: flight 1 centreline (u1)
  // → landing 1 (level n1) → flight 2 edge-origin (cross-width u1). Turn 2: flight
  // 2 edge-origin (cross-width u1) → landing 2 (level n1+n2+1) → flight 3 edge-
  // origin (cross-width u2). Each landing adds +1 rise (gamma z-model).
  const turnRisers = [
    ...landingTransitionRisers(
      centrelineWidthEdges(run1.endXY, u1, width),
      edgeWidthEdges(flight2Origin, u1, width),
      basePoint.z + rise * n1,
      rise,
    ),
    ...landingTransitionRisers(
      edgeWidthEdges(run2.endXY, u1, width),
      edgeWidthEdges(flight3Origin, u2, width),
      basePoint.z + rise * (n1 + n2 + 1),
      rise,
    ),
  ];

  const walkline = gammaWalkline(params, variant, [run1, run2, run3], { u1, u2, u3 });
  return assembleTurnRunStair(params, [run1, run2, run3], [landing1, landing2], walkline, turnRisers);
}

/**
 * Bespoke 6-vertex walkline with no rest landings (byte-identical to the pre-2b
 * gamma); run-stitched centreline (shared 90°-turn helper, same as L-shape) once
 * any flight carries a πλατύσκαλο.
 */
function gammaWalkline(
  params: Readonly<StairParams>,
  variant: StairVariantGamma,
  runs: readonly [StairRunResult, StairRunResult, StairRunResult],
  dirs: { u1: Vec2; u2: Vec2; u3: Vec2 },
): Point3D[] {
  const { basePoint, rise, tread, width } = params;
  const [n1, n2, n3] = variant.flightSplit;
  if (!params.restLandings || params.restLandings.length === 0) {
    return buildGammaWalkline(basePoint, dirs.u1, dirs.u2, dirs.u3, rise, tread, width, n1, n2, n3);
  }
  const walkline: Point3D[] = [...runs[0].walklinePts];
  appendRunAcrossNinetyTurn(walkline, runs[1], dirs.u1, width);
  appendRunAcrossNinetyTurn(walkline, runs[2], dirs.u2, width);
  return walkline;
}

// ─── helpers ────────────────────────────────────────────────────────────────

/** Plan frame shared by both gamma paths: the three flight directions + turns. */
interface GammaFrame {
  readonly u1: Vec2;
  readonly v1: Vec2;
  readonly u2: Vec2;
  readonly v2: Vec2;
  readonly u3: Vec2;
  readonly turnSign1: 1 | -1;
  readonly turnSign2: 1 | -1;
}

/**
 * Resolve the three flight directions from the base `direction` + `turnSequence`.
 * SSoT for both `computeGamma` and `computeGammaWithRestLandings` (N.18 — the
 * `u2 = turnSign1·v1`, `u3 = turnSign2·v2` chain lives once).
 */
function resolveGammaFrame(direction: number, variant: StairVariantGamma): GammaFrame {
  const u1 = directionToUnitVector(direction);
  const v1 = perp(u1);
  const turnSign1 = turnSign(variant.turnSequence[0]);
  const turnSign2 = turnSign(variant.turnSequence[1]);
  const u2: Vec2 = { x: turnSign1 * v1.x, y: turnSign1 * v1.y };
  const v2 = perp(u2);
  const u3: Vec2 = { x: turnSign2 * v2.x, y: turnSign2 * v2.y };
  return { u1, v1, u2, v2, u3, turnSign1, turnSign2 };
}

function turnSign(d: StairTurnDirectionLR): 1 | -1 {
  return d === 'right' ? -1 : 1;
}

function resolveDepth(d: 'auto' | number, width: number): number {
  return d === 'auto' ? width : d;
}

function assertGammaCornerSupported(variant: StairVariantGamma): void {
  const style = variant.landingCornerStyle ?? 'square';
  if (style !== 'square') {
    throw new Error(
      `StairGeometryService: landingCornerStyle '${style}' requires Phase 3c (chamfer/fillet not implemented)`,
    );
  }
}

function buildGammaWalkline(
  basePoint: Readonly<Point3D>,
  u1: Vec2,
  u2: Vec2,
  u3: Vec2,
  rise: number,
  tread: number,
  width: number,
  n1: number,
  n2: number,
  n3: number,
): Point3D[] {
  // 6-vertex pattern. Sharp 90° turns occur at p3 (landing 1) and p5 (landing
  // 2). p2 and p4 are collinear with their successors so each stringer offset
  // produces 6 vertices with two miter corners (outer/inner miter = halfW·√2).
  const halfW = width * 0.5;
  const a1 = n1 * tread;
  const a3 = a1 + halfW;
  // Centreline run from a turn corner to the NEXT corner: the half-width miter into
  // the flight's first tread (`halfW`) + the flight's full run (`n·tread`). The old
  // `(n−1)·tread` dropped one tread, pulling the landing-2 corner + flight-3 leg
  // 1 tread short of the run-built treads, so stringers/handrails (offset off this
  // walkline) sat ~1 tread off the steps (ADR-358). `n·tread` matches the run-stitched
  // walkline used once any rest landing is present.
  const flight2InnerRun = halfW + n2 * tread;
  const flight3Run = halfW + n3 * tread;
  const zL1 = basePoint.z + rise * n1;
  const zL2 = basePoint.z + rise * (n1 + n2 + 1);
  const zTop = basePoint.z + rise * (n1 + n2 + n3 + 1);
  // p3 = landing 1 corner (xy at u1·a3 from basePoint)
  const p3x = basePoint.x + u1.x * a3;
  const p3y = basePoint.y + u1.y * a3;
  // p4 = collinear extension along u2 by flight2InnerRun
  const p4x = p3x + u2.x * flight2InnerRun;
  const p4y = p3y + u2.y * flight2InnerRun;
  // p5 = p4 + u2·halfW (landing 2 corner)
  const p5x = p4x + u2.x * halfW;
  const p5y = p4y + u2.y * halfW;
  return [
    point(basePoint.x, basePoint.y, basePoint.z),
    point(basePoint.x + u1.x * a1, basePoint.y + u1.y * a1, zL1),
    point(p3x, p3y, zL1),
    point(p4x, p4y, zL2),
    point(p5x, p5y, zL2),
    point(p5x + u3.x * flight3Run, p5y + u3.y * flight3Run, zTop),
  ];
}
