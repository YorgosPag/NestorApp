/**
 * Rest-landing run planner (ADR-637) — the kind-independent SSoT for placing
 * intermediate "πλατύσκαλα" (rest landings) anywhere along a stair run.
 *
 * The BIG idea: a rest landing is NOT a per-kind feature. It is a schedule of
 * levels expressed once, in `StairParams.restLandings`, and consumed by EVERY
 * stair kind through this single planner. Rectilinear kinds (straight/L/Γ/Π/
 * multi-flight/V) turn each landing level into a `buildCornerLanding` quad;
 * walkline kinds (spiral/helical/elliptical/sketch) turn it into a flat-z
 * stretch on the walkline (ADR-619 `preserveZ`). One schedule, two renderers,
 * all 13 kinds — no twin mechanism (N.0.2 SSoT).
 *
 * ── Level model (matches the existing turn-landing z-model, gamma/multi-flight) ──
 * A run of `stepCount` levels indexed `0..stepCount−1`, level `i` sitting at
 * `z = base.z + i·rise`. Each level is either a TREAD or a LANDING. A landing
 * consumes exactly ONE level (one rise), replacing the tread that would sit
 * there — identical to L-shape's `n1 + 1 + n2 = stepCount` convention. Total
 * rise and riser count are therefore invariant when a landing is added; only
 * the PLAN footprint grows by the landing's length. Dragging a landing along
 * the run moves which level it claims → the treads on either side re-flow.
 *
 * Levels `0` and `stepCount−1` are reserved as treads (a rest landing always
 * has ≥1 tread below and above), so valid landing levels are `1..stepCount−2`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-637-stair-rest-landings-ssot.md
 * @see docs/centralized-systems/reference/adrs/ADR-611-stair-geometry-generators-ssot.md
 */

import type { StairKind, StairRestLanding } from '../../types/stair-types';

/**
 * Kinds whose geometry generator actually CONSUMES `StairParams.restLandings`
 * today (`StairGeometryService.ts` / `stair-geometry-multiflight.ts` /
 * `stair-geometry-vshape.ts`). Other kinds ignore the field — the docstring
 * above describes the eventual "all 13 kinds" target, but code is the source
 * of truth (CLAUDE.md N.0.1), so UI (ADR-637 Phase 4-B `StairRestLandingsSection`)
 * gates the add/edit affordance on this SSoT instead of offering a silent no-op.
 */
const REST_LANDING_SUPPORTED_KINDS: ReadonlySet<StairKind> = new Set([
  'straight',
  'multi-flight',
  'v-shape',
]);

/** True when `kind`'s geometry generator consumes `StairParams.restLandings`. */
export function stairKindSupportsRestLandings(kind: StairKind): boolean {
  return REST_LANDING_SUPPORTED_KINDS.has(kind);
}

/** A consecutive run of `treadCount` treads starting at level `startLevel`. */
export interface StairRunFlightSegment {
  readonly kind: 'flight';
  /** 0-based level index of this flight's first tread. */
  readonly startLevel: number;
  /** Number of consecutive treads in this flight (≥ 1). */
  readonly treadCount: number;
}

/** A single rest landing occupying level `level` (`z = base.z + level·rise`). */
export interface StairRunLandingSegment {
  readonly kind: 'landing';
  /** 0-based level index this landing claims. */
  readonly level: number;
  readonly landing: StairRestLanding;
}

export type StairRunSegment = StairRunFlightSegment | StairRunLandingSegment;

/**
 * Resolve a landing's plan LENGTH (along travel). `'auto'` → `width` (a square
 * landing, matching the depth of every turn landing). Non-finite / non-positive
 * values fall back to `width` so a malformed param can never emit a degenerate
 * zero-length quad.
 */
export function resolveRestLandingLength(
  length: StairRestLanding['length'],
  width: number,
): number {
  if (length === 'auto') return width;
  return Number.isFinite(length) && length > 0 ? length : width;
}

/**
 * Resolve a landing's cross-width DEPTH. `'auto'` (or absent) → `width`
 * (full-width landing). A narrower landing is allowed but never wider than the
 * stair is meaningful here — callers clamp against `width` at the grip layer.
 */
export function resolveRestLandingDepth(
  depth: StairRestLanding['depth'],
  width: number,
): number {
  if (depth === undefined || depth === 'auto') return width;
  return Number.isFinite(depth) && depth > 0 ? depth : width;
}

/** Clamp a level to the legal rest-landing band `[1, stepCount−2]`, or `null`. */
function clampLandingLevel(level: number, stepCount: number): number | null {
  const lo = 1;
  const hi = stepCount - 2;
  if (hi < lo) return null; // stepCount < 3 → no room for a rest landing
  if (level < lo) return lo;
  if (level > hi) return hi;
  return level;
}

/**
 * Find the first free level ≥/≤ `target` inside `[1, stepCount−2]`, scanning
 * outward (up first, then down). Returns `null` when the band is exhausted
 * (more landings requested than free levels).
 */
function firstFreeLevel(
  target: number,
  used: ReadonlySet<number>,
  stepCount: number,
): number | null {
  const clamped = clampLandingLevel(target, stepCount);
  if (clamped === null) return null;
  const lo = 1;
  const hi = stepCount - 2;
  for (let radius = 0; radius <= hi - lo; radius++) {
    const up = clamped + radius;
    if (up <= hi && !used.has(up)) return up;
    const down = clamped - radius;
    if (down >= lo && !used.has(down)) return down;
  }
  return null;
}

/**
 * Plan the run into ordered flight/landing segments. Kind-independent: the
 * caller supplies only `stepCount` and the `restLandings` schedule; the geometry
 * of each segment is the caller's concern.
 *
 * Each landing's `at` (0..1) maps to a level via `round(at·(stepCount−1))`,
 * clamped to `[1, stepCount−2]`. Collisions (two landings on the same level)
 * are resolved by nudging outward to the nearest free level, so authoring order
 * never silently drops a landing. Landings are then emitted in level order.
 *
 * With no landings (or `stepCount < 3`) the result is a single flight of
 * `stepCount` treads — the geometry then stays byte-identical to the pre-ADR-637
 * single-flight path.
 */
export function planStairRunSegments(
  stepCount: number,
  restLandings: readonly StairRestLanding[] | undefined,
): StairRunSegment[] {
  const placed: Array<{ level: number; landing: StairRestLanding }> = [];
  if (restLandings && restLandings.length > 0 && stepCount >= 3) {
    const used = new Set<number>();
    // Author order = `at` order, so nudging is deterministic and stable.
    const sorted = [...restLandings].sort((a, b) => a.at - b.at);
    for (const landing of sorted) {
      const target = Math.round(landing.at * (stepCount - 1));
      const level = firstFreeLevel(target, used, stepCount);
      if (level !== null) {
        used.add(level);
        placed.push({ level, landing });
      }
    }
    placed.sort((a, b) => a.level - b.level);
  }

  const segments: StairRunSegment[] = [];
  let flightStart = 0;
  let flightCount = 0;
  let placedIdx = 0;
  for (let i = 0; i < stepCount; i++) {
    const isLanding = placedIdx < placed.length && placed[placedIdx].level === i;
    if (isLanding) {
      if (flightCount > 0) {
        segments.push({ kind: 'flight', startLevel: flightStart, treadCount: flightCount });
      }
      segments.push({ kind: 'landing', level: i, landing: placed[placedIdx].landing });
      placedIdx++;
      flightStart = i + 1;
      flightCount = 0;
    } else {
      if (flightCount === 0) flightStart = i;
      flightCount++;
    }
  }
  if (flightCount > 0) {
    segments.push({ kind: 'flight', startLevel: flightStart, treadCount: flightCount });
  }
  return segments;
}

/**
 * Split a global rest-landing schedule across the flights of a multi-flight run.
 *
 * A multi-flight stair develops as `flightTreadCounts` = per-flight level spans;
 * a rest landing's global `at` (0..1 over the WHOLE developed run) is mapped to a
 * global tread index `round(at·(total−1))`, then routed to the flight whose tread
 * range contains it. Its `at` is RE-EXPRESSED as a LOCAL fraction within that
 * flight so `buildRectilinearRun` (which plans each flight independently) places
 * it at the same level the global schedule intended.
 *
 * A landing that maps to the very first (`0`) or very last (`total−1`) tread of
 * the whole stair — where no rest landing is legal (levels `0` / `span−1` are
 * reserved treads) — is clamped inward to the nearest interior flight tread, so a
 * boundary landing is routed to a real flight rather than silently dropped. Each
 * flight's own planner then re-clamps to its legal `[1, span−2]` band.
 *
 * Returns one array per flight (same length/order as `flightTreadCounts`), each
 * carrying the landings routed to that flight with local `at`.
 */
export function partitionRestLandingsByFlight(
  flightTreadCounts: readonly number[],
  restLandings: readonly StairRestLanding[] | undefined,
): StairRestLanding[][] {
  const perFlight: StairRestLanding[][] = flightTreadCounts.map(() => []);
  if (!restLandings || restLandings.length === 0 || flightTreadCounts.length === 0) {
    return perFlight;
  }
  const total = flightTreadCounts.reduce((a, b) => a + b, 0);
  if (total < 1) return perFlight;

  // Flight start (cumulative first-tread level) per flight.
  const flightStart: number[] = [];
  let acc = 0;
  for (const n of flightTreadCounts) {
    flightStart.push(acc);
    acc += n;
  }

  for (const landing of restLandings) {
    // Global tread index this landing claims, clamped to the interior [1, total−2]
    // so a boundary `at` still lands on a real (non-reserved) flight tread.
    const raw = Math.round(landing.at * (total - 1));
    const globalIdx = clampToInterior(raw, total);
    if (globalIdx === null) continue; // total < 3 → no interior tread anywhere
    const flightIdx = flightIndexOfLevel(globalIdx, flightStart, flightTreadCounts);
    const span = flightTreadCounts[flightIdx];
    const localLevel = globalIdx - flightStart[flightIdx];
    // Re-express as a local fraction; the flight's own planner re-clamps to its band.
    const localAt = span > 1 ? localLevel / (span - 1) : 0;
    perFlight[flightIdx].push({ ...landing, at: localAt });
  }
  return perFlight;
}

/** Clamp a global tread index into `[1, total−2]`, or `null` when no interior exists. */
function clampToInterior(idx: number, total: number): number | null {
  if (total < 3) return null;
  if (idx < 1) return 1;
  if (idx > total - 2) return total - 2;
  return idx;
}

/** Find the flight whose `[start, start+count)` tread range contains `level`. */
function flightIndexOfLevel(
  level: number,
  flightStart: readonly number[],
  flightTreadCounts: readonly number[],
): number {
  for (let f = flightStart.length - 1; f >= 0; f--) {
    if (level >= flightStart[f] && level < flightStart[f] + flightTreadCounts[f]) return f;
  }
  return 0;
}

/** True when the params carry at least one rest landing that can materialize. */
export function hasRestLandings(
  stepCount: number,
  restLandings: readonly StairRestLanding[] | undefined,
): boolean {
  return (
    !!restLandings &&
    restLandings.length > 0 &&
    stepCount >= 3 &&
    planStairRunSegments(stepCount, restLandings).some((s) => s.kind === 'landing')
  );
}
