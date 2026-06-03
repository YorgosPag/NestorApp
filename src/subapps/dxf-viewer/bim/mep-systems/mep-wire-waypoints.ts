/**
 * MEP wire waypoints — ADR-408 Φ7 follow-up #3 (SSoT, pure).
 *
 * User-placed intermediate vertices on a circuit's home-run run (Revit "Wire
 * Vertex"). Unlike the derived routing geometry, waypoints ARE persisted user
 * data (on `MepSystemParams.wireWaypoints`, mirror of `wireStyle`/`color`).
 *
 * Topology = **per-segment, order-independent** (Giorgio, Revit-grade): a
 * waypoint set is bound to the *pair of hosts* of a daisy-chain segment, keyed by
 * a sorted join of the two endpoints' `entityId:connectorId`. Because the key
 * ignores direction, the waypoints survive when the greedy nearest-neighbour
 * daisy-chain re-orders (e.g. a fixture is moved) — exactly like Revit binds
 * vertices to a wire run, not to a list position.
 *
 * **Canonical orientation:** the stored array runs from the lexicographically
 * smaller endpoint key (`min`) to the larger (`max`). Renderers/hit-tests view a
 * segment in *draw* direction `A→B`, which may be reversed vs canonical; the
 * `*Oriented` edit helpers here are the ONE place that normalises draw-index ↔
 * canonical-index, so no caller ever reasons about the reversal.
 *
 * Pure — no store / React / Date / Math.random (survives workflow replay).
 *
 * @see ./mep-wire-routing.ts (splices these into the routed polyline)
 * @see ./mep-wire-waypoint-hit.ts (hit-testing in draw orientation)
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

/** A persisted intermediate vertex in **canvas units** (same space as host x/y). */
export interface WirePlanPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Per-segment waypoint sets, keyed by {@link buildSegmentKey}. Each value is the
 * ordered list of vertices for that segment in **canonical** orientation
 * (min-endpoint → max-endpoint). Absent/empty key ⇒ no waypoints on that segment.
 */
export type WireWaypointMap = Readonly<Record<string, readonly WirePlanPoint[]>>;

/** Identity of one segment endpoint (a host connector): `entityId:connectorId`. */
export function endpointKey(entityId: string, connectorId: string): string {
  return `${entityId}:${connectorId}`;
}

/**
 * Order-independent key for the segment between two endpoints. The two endpoint
 * keys are sorted, so `key(A,B) === key(B,A)` — the waypoints stay attached to the
 * host pair regardless of daisy-chain direction.
 */
export function buildSegmentKey(endpointKeyA: string, endpointKeyB: string): string {
  return endpointKeyA <= endpointKeyB
    ? `${endpointKeyA}|${endpointKeyB}`
    : `${endpointKeyB}|${endpointKeyA}`;
}

/** True when draw direction `A→B` matches canonical orientation (`A` is the min). */
function isCanonicalDirection(endpointKeyA: string, endpointKeyB: string): boolean {
  return endpointKeyA <= endpointKeyB;
}

/**
 * The waypoints of segment `A→B` (draw direction), oriented to run from `A` to
 * `B`. Returns `[]` when the segment has none. Reverses the stored canonical
 * array when the draw direction is `max→min`.
 */
export function getOrientedWaypoints(
  map: WireWaypointMap | undefined,
  endpointKeyA: string,
  endpointKeyB: string,
): readonly WirePlanPoint[] {
  if (!map) return [];
  const stored = map[buildSegmentKey(endpointKeyA, endpointKeyB)];
  if (!stored || stored.length === 0) return [];
  return isCanonicalDirection(endpointKeyA, endpointKeyB) ? stored : [...stored].reverse();
}

/** Map a draw-orientation move/delete index to the canonical-array index. */
function toCanonicalIndex(orientedIndex: number, length: number, canonical: boolean): number {
  return canonical ? orientedIndex : length - 1 - orientedIndex;
}

/** Replace `map[segKey]` with `next`, deleting the key when `next` is empty (immutable). */
function withSegment(
  map: WireWaypointMap | undefined,
  segKey: string,
  next: readonly WirePlanPoint[],
): WireWaypointMap {
  const out: Record<string, readonly WirePlanPoint[]> = { ...(map ?? {}) };
  if (next.length === 0) {
    delete out[segKey];
  } else {
    out[segKey] = next;
  }
  return out;
}

/**
 * Insert `point` into segment `A→B` (draw direction) so it appears at draw index
 * `orientedIndex` (0 = right after host `A`). Returns a new map.
 */
export function insertWaypointOriented(
  map: WireWaypointMap | undefined,
  endpointKeyA: string,
  endpointKeyB: string,
  orientedIndex: number,
  point: WirePlanPoint,
): WireWaypointMap {
  const segKey = buildSegmentKey(endpointKeyA, endpointKeyB);
  const canonical = isCanonicalDirection(endpointKeyA, endpointKeyB);
  const stored = map?.[segKey] ?? [];
  // Draw-index `i` → canonical insert position `n - i` when reversed.
  const pos = canonical ? orientedIndex : stored.length - orientedIndex;
  const next = [...stored.slice(0, pos), point, ...stored.slice(pos)];
  return withSegment(map, segKey, next);
}

/** Move the waypoint at draw index `orientedIndex` of segment `A→B` to `point`. */
export function moveWaypointOriented(
  map: WireWaypointMap | undefined,
  endpointKeyA: string,
  endpointKeyB: string,
  orientedIndex: number,
  point: WirePlanPoint,
): WireWaypointMap {
  const segKey = buildSegmentKey(endpointKeyA, endpointKeyB);
  const stored = map?.[segKey];
  if (!stored || stored.length === 0) return map ?? {};
  const canonical = isCanonicalDirection(endpointKeyA, endpointKeyB);
  const idx = toCanonicalIndex(orientedIndex, stored.length, canonical);
  if (idx < 0 || idx >= stored.length) return map ?? {};
  const next = stored.slice();
  next[idx] = point;
  return withSegment(map, segKey, next);
}

/** Delete the waypoint at draw index `orientedIndex` of segment `A→B`. */
export function deleteWaypointOriented(
  map: WireWaypointMap | undefined,
  endpointKeyA: string,
  endpointKeyB: string,
  orientedIndex: number,
): WireWaypointMap {
  const segKey = buildSegmentKey(endpointKeyA, endpointKeyB);
  const stored = map?.[segKey];
  if (!stored || stored.length === 0) return map ?? {};
  const canonical = isCanonicalDirection(endpointKeyA, endpointKeyB);
  const idx = toCanonicalIndex(orientedIndex, stored.length, canonical);
  if (idx < 0 || idx >= stored.length) return map ?? {};
  const next = [...stored.slice(0, idx), ...stored.slice(idx + 1)];
  return withSegment(map, segKey, next);
}
