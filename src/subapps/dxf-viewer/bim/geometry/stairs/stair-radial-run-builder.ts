/**
 * ADR-637 Phase 3 (radial) — rest landings (πλατύσκαλα) for the RADIAL family
 * (spiral · helical). The angle-space analogue of `buildWalklineRunWithLandings`:
 * a radial run is parametrised by a sweep ANGLE (each tread sweeps `angleStep` at
 * constant z), so a rest landing is a flat annular sector swept over a WIDER angle
 * `Δθ = length / walklineRadius` at the landing's z, and every downstream tread is
 * shifted in angle by the extra sweep. The spiral/helix therefore stays a clean
 * curve — the total sweep simply grows by each landing's angle (unlike the
 * elliptical tangent-stretch, this introduces no "gap").
 *
 * ── The model (matches the rectilinear z-model, ADR-637 §2) ──
 * Level `i` sits at `z = center.z + rise·i`; a landing consumes exactly ONE level
 * (one rise onto the following tread), so total rise and riser count stay invariant
 * — only the plan footprint (the swept angle) grows. Treads and the landing quad
 * are the SAME `radialSector` primitive (a landing = a sector over a bigger angle),
 * risers the SAME `radialRiser` (N.18 — no new radial math, no clone).
 *
 * Called by `computeRadialStair` only when `hasRestLandings` is true; the no-rest
 * path there is untouched (byte-identical single-flight radial geometry).
 *
 * ADR-637 Phase 4-C — grip handles ARE now surfaced for this family: each landing
 * emits a `RestLandingHandle` at the mid-sweep walkline point (travel axis = the
 * radial tangent there), from the SAME angle walk that builds the landing sector.
 * `slideRestLanding` projects the cursor onto the sampled walkline by arc-length
 * (radial runs have `totalRun = 0`), so a spiral/helical landing slides along its
 * own curve.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-637-stair-rest-landings-ssot.md
 * @see ./stair-walkline-run-builder.ts (walkline-following sibling)
 * @see ./stair-geometry-runs.ts (computeRadialStair / RadialStairConfig)
 */

import type { Point3D } from '../../../rendering/types/Types';
import type {
  Polygon3D,
  RestLandingHandle,
  Segment3D,
  StairGeometry,
  StairParams,
} from '../../../bim/types/stair-types';
import { DEFAULT_CUT_PLANE_HEIGHT, arrowSymbol } from './stair-geometry-shared';
import {
  assembleStairGeometry,
  buildWalklineCutLine,
  radialPoint,
  radialRiser,
  radialSector,
  radialTangentAt,
} from './stair-geometry-generators';
import type { RadialStairConfig } from './stair-geometry-runs';
import {
  planStairRunSegments,
  resolveRestLandingDepth,
  resolveRestLandingLength,
} from './stair-run-landings';

const DEG2RAD = Math.PI / 180;

/**
 * Build a full radial `StairGeometry` honouring its rest-landing schedule.
 * Precondition (caller-enforced): `hasRestLandings(params.stepCount,
 * params.restLandings)` is true.
 */
export function buildRadialRunWithLandings(
  params: Readonly<StairParams>,
  cfg: RadialStairConfig,
): StairGeometry {
  const { center, innerRadius, outerRadius, apex } = cfg;
  const stepCount = params.stepCount;
  const sign: 1 | -1 = cfg.turnDirection === 'ccw' ? 1 : -1;
  const angleStep = (sign * (cfg.sweepAngleDeg * DEG2RAD)) / stepCount;
  const riseStep = params.rise;
  const walklineRadius = (innerRadius + outerRadius) * 0.5;
  const zAt = (level: number): number => center.z + riseStep * level;

  const segments = planStairRunSegments(stepCount, params.restLandings ?? []);
  const treads: Polygon3D[] = [];
  const risers: Segment3D[] = [];
  const landings: Polygon3D[] = [];
  const landingHandles: RestLandingHandle[] = [];
  const flightSplit: number[] = [];
  // One boundary per level edge (walkline + stringers) — `stepCount+1` entries.
  const boundaries: Array<{ theta: number; z: number }> = [{ theta: 0, z: center.z }];

  let theta = 0;
  const advance = (level: number, span: number): void => {
    theta += span;
    // Riser onto the next tread (skipped after the top level — no next tread).
    if (level < stepCount - 1) {
      risers.push(radialRiser(center, innerRadius, outerRadius, theta, zAt(level), zAt(level + 1)));
    }
    boundaries.push({ theta, z: zAt(level + 1) });
  };

  for (const seg of segments) {
    if (seg.kind === 'flight') {
      for (let k = 0; k < seg.treadCount; k++) {
        const level = seg.startLevel + k;
        treads.push(radialSector(center, innerRadius, outerRadius, theta, theta + angleStep, zAt(level), apex, sign));
        advance(level, angleStep);
      }
      flightSplit.push(seg.treadCount);
    } else {
      const length = resolveRestLandingLength(seg.landing.length, params.width);
      const dTheta = walklineRadius > 1e-9 ? sign * (length / walklineRadius) : angleStep;
      landings.push(radialSector(center, innerRadius, outerRadius, theta, theta + dTheta, zAt(seg.level), apex, sign));
      // Grip handle at the mid-sweep walkline point; travel axis = radial tangent there.
      const midTheta = theta + dTheta / 2;
      landingHandles.push({
        id: seg.landing.id,
        center: radialPoint(center, walklineRadius, midTheta, zAt(seg.level)),
        along: radialTangentAt(midTheta, sign),
        length,
        depth: resolveRestLandingDepth(seg.landing.depth, params.width),
      });
      advance(seg.level, dTheta);
    }
  }

  const walkline: Point3D[] = boundaries.map((b) => radialPoint(center, walklineRadius, b.theta, b.z));
  const stringers = {
    inner: boundaries.map((b) => radialPoint(center, innerRadius, b.theta, b.z)),
    outer: boundaries.map((b) => radialPoint(center, outerRadius, b.theta, b.z)),
  };
  const cutPlaneHeight = params.cutPlaneHeight ?? DEFAULT_CUT_PLANE_HEIGHT;
  const cutLine = buildWalklineCutLine(walkline, params.width, cutPlaneHeight);

  const geometry = assembleStairGeometry(params, {
    treads,
    risers,
    stringers,
    walkline,
    cutLine,
    arrowSymbol: arrowSymbol(walkline[0], walkline[walkline.length - 1], params.upDirection),
    flightSplit,
    landings,
  });
  // ADR-637 Phase 4-C — surface the per-landing grip handles (mirror of the
  // rectilinear `buildRectilinearRun` consumers). Absent ⇒ no rest-landing grips.
  return landingHandles.length > 0
    ? { ...geometry, restLandingHandles: landingHandles }
    : geometry;
}
