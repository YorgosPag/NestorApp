/**
 * ADR-637 Phase 3 — rest landings (πλατύσκαλα) for the WALKLINE-FOLLOWING family
 * (sketch · elliptical). The single SSoT that turns a `StairParams.restLandings`
 * schedule into flat-z landing stretches inside a sampled walkline, so the shared
 * `buildWalklineTreads`/`buildWalklineRisers` generators re-flow the treads with
 * zero new tread/landing math (N.18 — no clone of the wedge-tread loop).
 *
 * ── The model (matches the rectilinear z-model, ADR-637 §2) ──
 * A walkline-following run has `stepCount` wedge treads over `stepCount+1` sampled
 * points `P_0..P_stepCount`, tread `i` flat at `z_i = base + i·rise`, the rise
 * happening at the riser between consecutive points. A rest landing at level `L`
 * simply STRETCHES the chord at level `L` from its natural going to the landing's
 * plan `length` along the SAME base tangent, keeping every point's `z` unchanged,
 * and rigid-translates every downstream point by the extra plan offset. Therefore:
 *   • total rise and riser count stay invariant (z values untouched);
 *   • only the plan footprint grows by `length − going` per landing;
 *   • the stretched chord's wedge (flat at `z_L`) IS the landing quad — reclassified
 *     out of the tread list into `landings[]` (reuse, not re-computation).
 *
 * This is the walkline analogue of `buildRectilinearRun` (`stair-flight-run-builder.ts`):
 * both fold `planStairRunSegments` into one geometry, one via the flight generator,
 * this one via the sampled walkline.
 *
 * ADR-637 Phase 4-C — grip handles ARE now surfaced for this family: each landing
 * emits a `RestLandingHandle` (centroid + travel tangent + length/depth) from the
 * SAME stretched-chord walk that builds the landing quad (SSoT — a grip can never
 * disagree with what's drawn). `slideRestLanding` projects the cursor onto the
 * sampled walkline by arc-length (not axially — curved runs have `totalRun = 0`),
 * so a curved landing slides along its own curve.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-637-stair-rest-landings-ssot.md
 * @see ./stair-flight-run-builder.ts (rectilinear sibling)
 * @see ./stair-geometry-samplers.ts (buildWalklineTreads — z per point)
 */

import type { Point3D } from '../../../rendering/types/Types';
import type {
  Polygon3D,
  Polyline3D,
  RestLandingHandle,
  StairRestLanding,
} from '../../../bim/types/stair-types';
import { point } from './stair-geometry-shared';
import { buildWalklineTreads, chordTangent } from './stair-geometry-samplers';
import {
  planStairRunSegments,
  resolveRestLandingDepth,
  resolveRestLandingLength,
} from './stair-run-landings';

/** Treads + landings + label bookkeeping for a walkline run carrying rest landings. */
export interface WalklineRunResult {
  /** Stretched walkline (`stepCount+1` pts, z unchanged, plan shifted past landings). */
  readonly walkline: Polyline3D;
  /** Rising wedge treads only (landing chords removed). */
  readonly treads: readonly Polygon3D[];
  /** Flat landing quads (the stretched chords), in level order. */
  readonly landings: readonly Polygon3D[];
  /** ADR-637 Phase 4-C — per-landing grip handle (centroid + travel tangent), level order. */
  readonly landingHandles: readonly RestLandingHandle[];
  /** Per-sub-flight rising-tread counts (label numbering; `length === landings.length + 1`). */
  readonly flightSplit: readonly number[];
}

/**
 * Build a walkline-following run honouring its rest-landing schedule. The caller
 * supplies the uniformly sampled base `walkline` (already carrying `z_i = base +
 * i·rise`) and the winding `sign`; this returns the stretched walkline plus the
 * split tread/landing lists. With an empty schedule the walkline is returned
 * unchanged and every chord is a tread (byte-identical to the pre-Phase-3 path —
 * callers gate on `hasRestLandings` so they never reach here in that case).
 */
export function buildWalklineRunWithLandings(
  walkline: Polyline3D,
  restLandings: readonly StairRestLanding[],
  width: number,
  sign: 1 | -1,
): WalklineRunResult {
  const stepCount = walkline.length - 1;
  const segments = planStairRunSegments(stepCount, restLandings);

  const landingByLevel = new Map<number, StairRestLanding>();
  const flightSplit: number[] = [];
  for (const seg of segments) {
    if (seg.kind === 'flight') flightSplit.push(seg.treadCount);
    else landingByLevel.set(seg.level, seg.landing);
  }

  // Stretch each landing chord along its base tangent; rigid-translate the rest.
  const out: Point3D[] = new Array(walkline.length);
  out[0] = point(walkline[0].x, walkline[0].y, walkline[0].z);
  const landingHandles: RestLandingHandle[] = [];
  let shiftX = 0;
  let shiftY = 0;
  for (let level = 0; level < stepCount; level++) {
    const cur = walkline[level];
    const next = walkline[level + 1];
    const landing = landingByLevel.get(level);
    if (landing) {
      const length = resolveRestLandingLength(landing.length, width);
      const t = chordTangent(cur, next); // base plan tangent (z-independent)
      const endX = out[level].x + t.x * length;
      const endY = out[level].y + t.y * length;
      out[level + 1] = point(endX, endY, next.z); // z unchanged → riser onto next tread
      shiftX = endX - next.x;
      shiftY = endY - next.y;
      // Handle centroid = midpoint of the stretched chord at the landing's flat z
      // (the wedge tread sits at `out[level].z`, see buildWalklineTreads); travel
      // axis = the base tangent the chord was stretched along.
      landingHandles.push({
        id: landing.id,
        center: point((out[level].x + endX) / 2, (out[level].y + endY) / 2, out[level].z),
        along: t,
        length,
        depth: resolveRestLandingDepth(landing.depth, width),
      });
    } else {
      out[level + 1] = point(next.x + shiftX, next.y + shiftY, next.z);
    }
  }

  // One wedge per chord (SSoT), then reclassify the landing-level chords as quads.
  const allTreads = buildWalklineTreads(out, width, sign);
  const treads: Polygon3D[] = [];
  const landings: Polygon3D[] = [];
  for (let i = 0; i < allTreads.length; i++) {
    if (landingByLevel.has(i)) landings.push(allTreads[i]);
    else treads.push(allTreads[i]);
  }

  return { walkline: out, treads, landings, landingHandles, flightSplit };
}
