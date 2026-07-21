/**
 * ADR-637 Phase 2 / 2b — one stair RUN carrying zero or more rest landings
 * (πλατύσκαλα), in TWO origin conventions that share ONE walk:
 *
 *  - `buildRectilinearRun` — CENTRELINE origin (straight · multi-flight · v-shape ·
 *    L/U/Γ flight 1). Treads are v-centred (`buildRectilinearFlight`, ADR-611).
 *  - `buildEdgeOriginRun` — EDGE origin (L/U flight 2 · Γ intermediate flights).
 *    Treads span one width edge (`buildFlightFromEdge`, ADR-611).
 *
 * Both walk `planStairRunSegments` once through the shared `walkStairRun` core:
 * given a flight frame + a schedule of rest landings (LOCAL `at` fractions within
 * this run) it emits the run's treads / risers / rest-landing quads / grip
 * handles, advancing a single cursor along travel. Each sub-flight reuses the
 * ADR-611 flight generator and each landing reuses `buildCornerLanding` (0° corner
 * = same travel direction) — no new tread/landing math, ONE segment loop (N.18: no
 * sibling clone between the two origin conventions).
 *
 * z-model (matches gamma / multi-flight): local level `i` sits at
 * `z = baseZ + rise·(startLevel + i)`. A landing consumes exactly ONE level, so
 * the run's level span (`treadCount`) — and therefore the flight's top elevation
 * and any turn landing that follows it — stay invariant; only the plan footprint
 * grows by each landing's length. With an empty `restLandings` the result is a
 * single sub-flight identical to a bare flight generator.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-637-stair-rest-landings-ssot.md
 * @see docs/centralized-systems/reference/adrs/ADR-611-stair-geometry-generators-ssot.md
 */

import type { Point3D } from '../../../rendering/types/Types';
import type {
  Polygon3D,
  RestLandingHandle,
  Segment3D,
  StairGeometry,
  StairParams,
  StairRestLanding,
} from '../../../bim/types/stair-types';
import {
  type Vec2,
  type WidthEdges,
  arrowSymbol,
  buildTransitionRiser,
  centrelineWidthEdges,
  edgeWidthEdges,
  perp,
  point,
} from './stair-geometry-shared';
import {
  type FlightGeometry,
  assembleMultiFlight,
  buildCornerLanding,
  buildFlightFromEdge,
  buildRectilinearFlight,
} from './stair-geometry-generators';
import {
  partitionRestLandingsByFlight,
  planStairRunSegments,
  resolveRestLandingDepth,
  resolveRestLandingLength,
} from './stair-run-landings';

/** Scalars shared by both origin conventions. */
interface StairRunScalars {
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

/** Frame + scalars + schedule for one CENTRELINE-origin rectilinear run. */
export interface BuildRectilinearRunInput extends StairRunScalars {
  /** Centreline origin of the run's first tread (plan XY). */
  readonly originXY: Vec2;
  /** Unit travel direction. */
  readonly u: Vec2;
}

/** Frame + scalars + schedule for one EDGE-origin run (origin on one width edge). */
export interface BuildEdgeOriginRunInput extends StairRunScalars {
  /** Edge origin of the run's first tread (plan XY, on the `vWidth·0` edge). */
  readonly originXY: Vec2;
  /** Unit travel direction. */
  readonly uAlong: Vec2;
  /** Unit cross-width direction; treads span `vWidth·[0, width]`. */
  readonly vWidth: Vec2;
}

/** Geometry + label/cut-line bookkeeping for one stair run. */
export interface StairRunResult {
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
  /** One direction per sub-flight (all equal travel dir) for `buildCutLineForFlights`. */
  readonly cutDirs: Vec2[];
  /** Centreline polyline of the run: origin → sub-flight/landing ends. */
  readonly walklinePts: Point3D[];
  /** Cursor after the run in the run's OWN origin convention (centreline / edge). */
  readonly endXY: Vec2;
}

/** @deprecated Alias kept for existing import sites — use `StairRunResult`. */
export type RectilinearRunResult = StairRunResult;

/** The z + step scalars every run in one stair shares (frame-independent). */
export interface StairRunCommon {
  readonly baseZ: number;
  readonly rise: number;
  readonly tread: number;
  readonly nosing: number;
  readonly width: number;
}

/**
 * Positional convenience over `buildRectilinearRun` — a CENTRELINE-origin run
 * from `common` scalars + frame. Lets turning kinds (L/U/Γ) build each flight in
 * one line without repeating the `{ ...common }` spread (N.18).
 */
export function centrelineRun(
  common: StairRunCommon,
  originXY: Vec2,
  u: Vec2,
  startLevel: number,
  treadCount: number,
  restLandings: readonly StairRestLanding[],
): StairRunResult {
  return buildRectilinearRun({ ...common, originXY, u, startLevel, treadCount, restLandings });
}

/** The shared prologue of every turning kind (L/U/Γ): partition + flight 1. */
export interface TurnRunSetup {
  /** z + step scalars for every run of this stair. */
  readonly common: StairRunCommon;
  /** Rest landings routed per flight (`flightTreadCounts` order). */
  readonly per: StairRestLanding[][];
  /** Flight 1 as a centreline run (empty schedule ⇒ a bare centreline flight). */
  readonly run1: StairRunResult;
}

/**
 * Start a turning rectilinear stair (L / U / Γ): resolve the shared `common`
 * scalars, partition `params.restLandings` across `flightTreadCounts`, and build
 * flight 1 as a centreline run from `basePoint` along `u1`. The single SSoT for
 * the prologue all three kinds shared verbatim (N.18) — each kind then places its
 * own turn landing(s) + edge-origin flight(s) off `run1.endXY`.
 */
export function beginTurnRun(
  params: Readonly<StairParams>,
  u1: Vec2,
  flightTreadCounts: readonly number[],
): TurnRunSetup {
  const { basePoint, rise, tread, nosing, width } = params;
  const common: StairRunCommon = { baseZ: basePoint.z, rise, tread, nosing, width };
  const per = partitionRestLandingsByFlight(flightTreadCounts, params.restLandings);
  const run1 = centrelineRun(
    common, { x: basePoint.x, y: basePoint.y }, u1, 0, flightTreadCounts[0], per[0],
  );
  return { common, per, run1 };
}

/** Positional convenience over `buildEdgeOriginRun` (see `centrelineRun`). */
export function edgeRun(
  common: StairRunCommon,
  originXY: Vec2,
  uAlong: Vec2,
  vWidth: Vec2,
  startLevel: number,
  treadCount: number,
  restLandings: readonly StairRestLanding[],
): StairRunResult {
  return buildEdgeOriginRun({ ...common, originXY, uAlong, vWidth, startLevel, treadCount, restLandings });
}

/**
 * Per-origin geometry primitives injected into the shared walk. `along` is the
 * travel direction (cursor advance + `cutDirs`); the four builders turn a plan
 * cursor + elevation into the run's flights / landing quads / handles / walkline
 * points in the correct origin convention.
 */
interface StairRunBuilders {
  readonly along: Vec2;
  buildFlight(cursor: Vec2, zFirstTread: number, treadCount: number): FlightGeometry;
  buildLanding(cursor: Vec2, length: number, z: number): Polygon3D;
  landingCenter(cursor: Vec2, length: number, z: number): Point3D;
  walklinePoint(cursor: Vec2, z: number): Point3D;
  /** Width edges of the run's cross-section at `cursor` (for transition risers). */
  widthEdges(cursor: Vec2): WidthEdges;
}

/**
 * The SSoT run walk shared by both origin conventions. Plans the level schedule
 * once and folds each segment through the injected `builders`. See file header
 * for the z-model and reuse contract.
 */
function walkStairRun(scalars: StairRunScalars, builders: StairRunBuilders, originXY: Vec2): StairRunResult {
  const { startLevel, baseZ, rise, width, tread, treadCount, restLandings } = scalars;
  const segments = planStairRunSegments(treadCount, restLandings);
  const zAtLevel = (level: number): number => baseZ + rise * (startLevel + level);

  const treads: Polygon3D[] = [];
  const risers: Segment3D[] = [];
  const landings: Polygon3D[] = [];
  const landingHandles: RestLandingHandle[] = [];
  const flightSplit: number[] = [];
  const cutDirs: Vec2[] = [];
  let cursor: Vec2 = { x: originXY.x, y: originXY.y };
  const walklinePts: Point3D[] = [builders.walklinePoint(cursor, zAtLevel(0))];

  for (let idx = 0; idx < segments.length; idx++) {
    const seg = segments[idx];
    // Top level of this segment (highest level it occupies): a flight's last
    // tread, or the landing's single level. Every inter-segment boundary in a run
    // touches a landing (consecutive flight levels coalesce into one segment), so
    // each boundary needs the transition riser the per-segment generators omit.
    let segTopLevel: number;
    if (seg.kind === 'flight') {
      const flight = builders.buildFlight(cursor, zAtLevel(seg.startLevel), seg.treadCount);
      treads.push(...flight.treads);
      risers.push(...flight.risers);
      flightSplit.push(seg.treadCount);
      cutDirs.push(builders.along);
      const along = tread * seg.treadCount;
      cursor = { x: cursor.x + builders.along.x * along, y: cursor.y + builders.along.y * along };
      walklinePts.push(builders.walklinePoint(cursor, zAtLevel(seg.startLevel + seg.treadCount)));
      segTopLevel = seg.startLevel + seg.treadCount - 1;
    } else {
      const z = zAtLevel(seg.level);
      const length = resolveRestLandingLength(seg.landing.length, width);
      landings.push(builders.buildLanding(cursor, length, z));
      landingHandles.push({
        id: seg.landing.id,
        center: builders.landingCenter(cursor, length, z),
        along: builders.along,
        length,
        depth: resolveRestLandingDepth(seg.landing.depth, width),
      });
      cursor = { x: cursor.x + builders.along.x * length, y: cursor.y + builders.along.y * length };
      walklinePts.push(builders.walklinePoint(cursor, z));
      segTopLevel = seg.level;
    }
    // Transition riser at the boundary to the next segment (cursor now sits on the
    // shared plan edge). Skipped after the last segment (top of the run).
    if (idx < segments.length - 1) {
      risers.push(buildTransitionRiser(builders.widthEdges(cursor), zAtLevel(segTopLevel), zAtLevel(segTopLevel + 1)));
    }
  }

  return {
    treads, risers, landings, landingHandles, flightSplit, cutDirs, walklinePts,
    endXY: { x: cursor.x, y: cursor.y },
  };
}

/**
 * Build one CENTRELINE-origin rectilinear run honouring its rest-landing
 * schedule. Treads are v-centred (`buildRectilinearFlight`); a landing quad is
 * centred on the travel axis (`buildCornerLanding` centred), its handle centroid
 * sitting at `origin + u·(length/2)`; the walkline follows the centreline cursor.
 */
export function buildRectilinearRun(input: BuildRectilinearRunInput): StairRunResult {
  const { u, rise, tread, nosing, width } = input;
  const v = perp(u);
  const builders: StairRunBuilders = {
    along: u,
    buildFlight: (cursor, zFirstTread, treadCount) =>
      buildRectilinearFlight(point(cursor.x, cursor.y, zFirstTread), u, rise, tread, nosing, width, treadCount),
    buildLanding: (cursor, length, z) => buildCornerLanding(cursor, u, v, width, length, z, /* centered */ true),
    landingCenter: (cursor, length, z) =>
      point(cursor.x + u.x * (length / 2), cursor.y + u.y * (length / 2), z),
    walklinePoint: (cursor, z) => point(cursor.x, cursor.y, z),
    widthEdges: (cursor) => centrelineWidthEdges(cursor, u, width),
  };
  return walkStairRun(input, builders, input.originXY);
}

/**
 * ADR-637 Phase 2b — append `runOut`'s centreline walkline to `acc` across a
 * single 90° turn, given the INCOMING travel direction `uIn`. A clean quarter-turn
 * miter corner (`lastAccPoint + uIn·(width/2)`, same elevation) bridges the two
 * runs so the stringer offset produces a square corner; `runOut`'s own centreline
 * points (already carrying any rest-landing flat-z stretches) follow. Shared by
 * every rectilinear turning kind (L flight 1→2, Γ flight 1→2 and 2→3).
 */
export function appendRunAcrossNinetyTurn(
  acc: Point3D[],
  runOut: StairRunResult,
  uIn: Vec2,
  width: number,
): void {
  const last = acc[acc.length - 1];
  const halfW = width * 0.5;
  acc.push(point(last.x + uIn.x * halfW, last.y + uIn.y * halfW, last.z));
  acc.push(...runOut.walklinePts);
}

/**
 * ADR-637 Phase 2b — assemble a turning rectilinear stair (L / U / Γ) from its
 * ordered `runs` (flight 1 centreline + flights 2+ edge-origin) and the
 * `turnLandings` between consecutive runs (one per flight boundary), plus the
 * pre-stitched `walkline`. The single SSoT for the "spread each run's parts +
 * interleave rest landings with turn landings + surface grip handles" tail that
 * L/U/Γ share (N.18 — no per-kind twin). Rest landings and turn landings
 * interleave in build order so `buildTreadLabelsWithLandings` sees exactly
 * `landings.length === flightSplit.length − 1`.
 */
export function assembleTurnRunStair(
  params: Readonly<StairParams>,
  runs: readonly StairRunResult[],
  turnLandings: readonly Polygon3D[],
  walkline: Point3D[],
  turnRisers: readonly Segment3D[] = [],
): StairGeometry {
  const treads: Polygon3D[] = [];
  const risers: Segment3D[] = [];
  const cutDirs: Vec2[] = [];
  const flightSplit: number[] = [];
  const landings: Polygon3D[] = [];
  const landingHandles: RestLandingHandle[] = [];
  runs.forEach((run, i) => {
    treads.push(...run.treads);
    risers.push(...run.risers);
    cutDirs.push(...run.cutDirs);
    flightSplit.push(...run.flightSplit);
    landings.push(...run.landings);
    landingHandles.push(...run.landingHandles);
    if (i < turnLandings.length) landings.push(turnLandings[i]);
  });
  // Transition risers around each turn landing (flight→landing→flight) — the
  // per-run generators only emit each flight's internal risers (N.18 SSoT).
  risers.push(...turnRisers);
  const geometry = assembleMultiFlight(params, {
    treads,
    risers,
    walkline,
    cutDirs,
    flightSplit,
    arrowSymbol: arrowSymbol(walkline[0], walkline[1], params.upDirection),
    landings,
  });
  return landingHandles.length > 0 ? { ...geometry, restLandingHandles: landingHandles } : geometry;
}

/**
 * Build one EDGE-origin run honouring its rest-landing schedule. Treads span the
 * width edge (`buildFlightFromEdge`); a landing quad spans `vWidth·[0, width]`
 * (`buildCornerLanding` not-centred), its handle centroid + walkline offset to the
 * centreline by `vWidth·(width/2)`. Mirror of `buildRectilinearRun` for the flights
 * whose origin sits on one width edge (L/U flight 2, Γ intermediate flights).
 */
export function buildEdgeOriginRun(input: BuildEdgeOriginRunInput): StairRunResult {
  const { uAlong, vWidth, rise, tread, nosing, width } = input;
  const halfW = width * 0.5;
  const centreOffset = (cursor: Vec2, z: number): Point3D =>
    point(cursor.x + vWidth.x * halfW, cursor.y + vWidth.y * halfW, z);
  const builders: StairRunBuilders = {
    along: uAlong,
    buildFlight: (cursor, zFirstTread, treadCount) =>
      buildFlightFromEdge(cursor, uAlong, vWidth, rise, tread, nosing, width, treadCount, zFirstTread),
    buildLanding: (cursor, length, z) =>
      buildCornerLanding(cursor, uAlong, vWidth, width, length, z, /* centered */ false),
    landingCenter: (cursor, length, z) =>
      point(
        cursor.x + uAlong.x * (length / 2) + vWidth.x * halfW,
        cursor.y + uAlong.y * (length / 2) + vWidth.y * halfW,
        z,
      ),
    walklinePoint: (cursor, z) => centreOffset(cursor, z),
    widthEdges: (cursor) => edgeWidthEdges(cursor, vWidth, width),
  };
  return walkStairRun(input, builders, input.originXY);
}
