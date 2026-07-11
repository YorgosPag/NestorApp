/**
 * ADR-637 Phase 2 — one rectilinear stair RUN (centreline origin) carrying zero
 * or more rest landings (πλατύσκαλα).
 *
 * This is the SSoT generalization of `computeStraightWithLandings`'s inner loop:
 * given a flight frame (`originXY`, travel dir `u`, first-tread elevation) and a
 * schedule of rest landings expressed as LOCAL `at` fractions within this run, it
 * walks `planStairRunSegments` and emits the run's treads / risers / rest-landing
 * quads, advancing a single centreline cursor along `u`. Each sub-flight reuses
 * `buildRectilinearFlight` (ADR-611) and each landing reuses `buildCornerLanding`
 * (0° corner = same travel direction, centred) — no new tread/landing math.
 *
 * z-model (matches gamma / multi-flight): local level `i` sits at
 * `z = baseZ + rise·(startLevel + i)`. A landing consumes exactly ONE level, so
 * the run's level span (`treadCount`) — and therefore the flight's top elevation
 * and the turn landing that follows it — stay invariant; only the plan footprint
 * grows by each landing's length. With an empty `restLandings` the result is a
 * single sub-flight identical to a bare `buildRectilinearFlight`.
 *
 * Consumed by every rectilinear kind (straight / multi-flight / v-shape /
 * l-shape·u-shape·gamma flight 1) so the rest-landing scheduling is written once.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-637-stair-rest-landings-ssot.md
 * @see docs/centralized-systems/reference/adrs/ADR-611-stair-geometry-generators-ssot.md
 */

import type { Point3D } from '../../../rendering/types/Types';
import type {
  Polygon3D,
  RestLandingHandle,
  Segment3D,
  StairRestLanding,
} from '../../../bim/types/stair-types';
import { type Vec2, perp, point } from './stair-geometry-shared';
import { buildCornerLanding, buildRectilinearFlight } from './stair-geometry-generators';
import {
  planStairRunSegments,
  resolveRestLandingDepth,
  resolveRestLandingLength,
} from './stair-run-landings';

/** Frame + scalars + schedule for one rectilinear run. */
export interface BuildRectilinearRunInput {
  /** Centreline origin of the run's first tread (plan XY). */
  readonly originXY: Vec2;
  /** Unit travel direction. */
  readonly u: Vec2;
  /** Level offset of the run's first tread within the whole stair (z bookkeeping). */
  readonly startLevel: number;
  /** Global base elevation; z of local level `i` = `baseZ + rise·(startLevel + i)`. */
  readonly baseZ: number;
  readonly rise: number;
  readonly tread: number;
  readonly nosing: number;
  readonly width: number;
  /** This run's own level span (treads + rest landings). */
  readonly treadCount: number;
  /** Rest landings assigned to THIS run, with `at` as a LOCAL fraction (0..1). */
  readonly restLandings: readonly StairRestLanding[];
}

/** Geometry + label/cut-line bookkeeping for one rectilinear run. */
export interface RectilinearRunResult {
  readonly treads: Polygon3D[];
  readonly risers: Segment3D[];
  /** Rest-landing quads, in run order (one per inter-sub-flight boundary). */
  readonly landings: Polygon3D[];
  /**
   * ADR-637 Phase 4-A — per-rest-landing grip handle (id + centre + travel dir +
   * length/depth), one per emitted landing, in run order (parallel to `landings`).
   * Computed from the SAME cursor walk as the quad (SSoT for grip placement).
   */
  readonly landingHandles: RestLandingHandle[];
  /** Per-sub-flight tread counts (label numbering + cut-line boundaries). */
  readonly flightSplit: number[];
  /** One direction per sub-flight (all equal `u`) for `buildCutLineForFlights`. */
  readonly cutDirs: Vec2[];
  /** Centreline polyline of the run: origin → sub-flight/landing ends. */
  readonly walklinePts: Point3D[];
  /** Centreline cursor after the run (for the caller to continue / turn). */
  readonly endXY: Vec2;
}

/**
 * Build one rectilinear run (centreline origin) honouring its rest-landing
 * schedule. See file header for the z-model and reuse contract.
 */
export function buildRectilinearRun(input: BuildRectilinearRunInput): RectilinearRunResult {
  const { originXY, u, startLevel, baseZ, rise, tread, nosing, width, treadCount, restLandings } =
    input;
  const v = perp(u);
  const segments = planStairRunSegments(treadCount, restLandings);
  const zAtLevel = (level: number): number => baseZ + rise * (startLevel + level);

  const treads: Polygon3D[] = [];
  const risers: Segment3D[] = [];
  const landings: Polygon3D[] = [];
  const landingHandles: RestLandingHandle[] = [];
  const flightSplit: number[] = [];
  const cutDirs: Vec2[] = [];
  let cx = originXY.x;
  let cy = originXY.y;
  const walklinePts: Point3D[] = [point(cx, cy, zAtLevel(0))];

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
      walklinePts.push(point(cx, cy, zAtLevel(seg.startLevel + seg.treadCount)));
    } else {
      const z = zAtLevel(seg.level);
      const length = resolveRestLandingLength(seg.landing.length, width);
      landings.push(buildCornerLanding({ x: cx, y: cy }, u, v, width, length, z, /* centered */ true));
      // ADR-637 Phase 4-A — grip handle from the SAME walk: centroid = origin +
      // u·(length/2) (buildCornerLanding is v-centred), travel dir = u, resolved
      // length + cross-width depth. Emitted before advancing the cursor.
      landingHandles.push({
        id: seg.landing.id,
        center: point(cx + u.x * (length / 2), cy + u.y * (length / 2), z),
        along: u,
        length,
        depth: resolveRestLandingDepth(seg.landing.depth, width),
      });
      cx += u.x * length;
      cy += u.y * length;
      walklinePts.push(point(cx, cy, z));
    }
  }

  return {
    treads, risers, landings, landingHandles, flightSplit, cutDirs, walklinePts,
    endXY: { x: cx, y: cy },
  };
}
