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

import type { StairRestLanding } from '../../types/stair-types';

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
