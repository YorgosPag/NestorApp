/**
 * MEP home-run wire routing — ADR-408 Φ7 (SSoT, pure).
 *
 * Turns a persisted `MepSystem` (geometry-less: a panel source + member fixtures)
 * into the **derived** wire geometry of its circuit — the polyline a user sees as
 * "the circuit", Revit's home-run wiring. NOTHING here is persisted: the path is
 * recomputed at render time from the live host transforms, so it follows
 * moved/rotated panels and fixtures for free (mirror of `connectorWorldPosition`).
 *
 * This is the **single** routing computation. Both consumers read it:
 *   - the 2D annotation overlay (`HomeRunWiresOverlay`) — uses `x`/`y`;
 *   - the 3D conduit converter (`mep-wire-to-three.ts`) — uses `x`/`y` + `zMm`.
 *
 * Topology = **daisy-chain + home-run** (Giorgio): the panel is the first point,
 * then the nearest fixture, then the next nearest from there, … (greedy
 * nearest-neighbour). The panel→first-fixture leg is the "home run". Segment
 * style (`WireStyle`, per-circuit Revit "Wiring Type") is resolved here: all of
 * `'straight'`/`'orthogonal'`/`'arc'` expand to plain points via
 * {@link expandSegment}, so neither renderer carries any style maths.
 *
 * Pure — no store / React / Date / Math.random (survives workflow replay).
 *
 * @see ./mep-system-color.ts (systemColor — the circuit owns its colour)
 * @see ../types/mep-connector-types.ts (connectorWorldPosition — host→world point)
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { MepSystemEntity, ConductorBreakdown } from '../types/mep-system-types';
import { DEFAULT_CONDUCTORS } from '../types/mep-system-types';
import { systemColor } from './mep-system-color';
import { endpointKey, getOrientedWaypoints } from './mep-wire-waypoints';

/**
 * A routed host point. `x`/`y` are in **canvas units** (the same space as
 * `entity.params.position`), so the 2D overlay maps them straight through
 * `worldToScreen`. `zMm` is the connector elevation in **mm above FFL**, used
 * only by the 3D converter (the 2D overlay ignores it).
 */
export interface WireHostPoint {
  readonly x: number;
  readonly y: number;
  readonly zMm: number;
}

/**
 * Segment-rendering style (Revit "Wiring Type"). All three ship:
 *   - `'straight'`   — direct line between consecutive hosts (default).
 *   - `'orthogonal'` — L-elbow (horizontal-then-vertical) at each segment.
 *   - `'arc'`        — true curved run: each segment is a quadratic Bézier
 *                      **sampled into a polyline** here, so both renderers (2D
 *                      `lineTo`, 3D `LineCurve3` tube) draw the identical curve
 *                      from this ONE source — no curve maths leaks into either.
 */
export type WireStyle = 'straight' | 'orthogonal' | 'arc';

/** A fully-routed circuit wire: panel-first daisy chain carrying the circuit colour. */
export interface CircuitWirePath {
  readonly systemId: string;
  readonly colorHex: string;
  /**
   * Per-circuit segment style (Revit "Wiring Type"), derived from
   * `system.params.wireStyle`. Optional → consumers treat absent as `'straight'`.
   * SSoT mirror of `colorHex`: the System owns it, the path carries it, both
   * renderers read it (never a renderer-local default).
   */
  readonly style?: WireStyle;
  /**
   * Per-circuit conductor breakdown (Revit "#wires"), mirror of `colorHex`/
   * `style`: the System owns it, the path carries it, the 2D renderer draws the
   * home-run tick marks from it (`buildConductorTicks`). Always populated by
   * {@link computeCircuitWirePaths} (defaults to `DEFAULT_CONDUCTORS`).
   */
  readonly conductors?: ConductorBreakdown;
  /** Ordered host points: `[panel, nearest fixture, next nearest, …]`. */
  readonly points: readonly WireHostPoint[];
}

/**
 * Resolve a host's connector world point, or `null` when the host is off the
 * current scene (cross-floor member, or deleted). Each caller builds this from
 * its own entity source (2D: `scene.entities`; 3D: `Bim3DEntities`).
 */
export type ResolveWireHost = (entityId: string, connectorId: string) => WireHostPoint | null;

/** A resolved host carrying its `entityId:connectorId` identity for waypoint keys. */
interface RoutedHost {
  readonly key: string;
  readonly point: WireHostPoint;
}

/**
 * One host-level segment of a circuit (a daisy-chain leg between two consecutive
 * hosts), BEFORE any user waypoints are spliced in. The interaction layer hit-
 * tests against these to know which segment a click lands on (`keyA`/`keyB` build
 * the order-independent waypoint key) and to project an insertion point.
 */
export interface CircuitHostSegment {
  readonly systemId: string;
  readonly keyA: string;
  readonly keyB: string;
  readonly a: WireHostPoint;
  readonly b: WireHostPoint;
}

/** Squared plan distance (x/y only) — routing ignores elevation. */
function planDistSq(a: WireHostPoint, b: WireHostPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * Order member hosts as a greedy nearest-neighbour chain starting from `origin`
 * (the panel). Deterministic: strict `<` keeps the first-listed member on ties,
 * so the result is replay-stable. Returns the ordered members (origin excluded).
 */
function orderDaisyChain(origin: RoutedHost, members: readonly RoutedHost[]): RoutedHost[] {
  const remaining = [...members];
  const chain: RoutedHost[] = [];
  let last = origin;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = planDistSq(last.point, remaining[0]!.point);
    for (let i = 1; i < remaining.length; i++) {
      const d = planDistSq(last.point, remaining[i]!.point);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    last = remaining.splice(bestIdx, 1)[0]!;
    chain.push(last);
  }
  return chain;
}

/**
 * Resolve + order the hosts of one system into a daisy chain `[panel, …members]`,
 * or `null` when the system has no resolvable source / member. Shared by both the
 * routed-path builder and the host-segment builder so they never diverge.
 */
function routeHosts(system: MepSystemEntity, resolve: ResolveWireHost): RoutedHost[] | null {
  const { sourceEntityId, sourceConnectorId, members } = system.params;
  const originPoint = resolve(sourceEntityId, sourceConnectorId);
  if (!originPoint) return null;
  const origin: RoutedHost = { key: endpointKey(sourceEntityId, sourceConnectorId), point: originPoint };
  const memberHosts = members
    .map((m): RoutedHost | null => {
      const point = resolve(m.entityId, m.connectorId);
      return point ? { key: endpointKey(m.entityId, m.connectorId), point } : null;
    })
    .filter((h): h is RoutedHost => h !== null);
  if (memberHosts.length === 0) return null;
  return [origin, ...orderDaisyChain(origin, memberHosts)];
}

/**
 * The host-level segments (daisy-chain legs) of every system — the geometry the
 * waypoint interaction hit-tests. No waypoints spliced in: each segment is the
 * raw `a→b` between two hosts, with the keys needed to look up / edit its
 * waypoints via {@link buildSegmentKey}.
 */
export function computeCircuitHostSegments(
  systems: readonly MepSystemEntity[],
  resolve: ResolveWireHost,
): CircuitHostSegment[] {
  const segments: CircuitHostSegment[] = [];
  for (const system of systems) {
    const hosts = routeHosts(system, resolve);
    if (!hosts) continue;
    for (let i = 1; i < hosts.length; i++) {
      const a = hosts[i - 1]!;
      const b = hosts[i]!;
      segments.push({ systemId: system.id, keyA: a.key, keyB: b.key, a: a.point, b: b.point });
    }
  }
  return segments;
}

/**
 * Splice the user waypoints of segment `a→b` between its endpoints, assigning each
 * an interpolated `zMm` by its position along the broken `a→wps→b` polyline
 * (linear in plan length → smooth conduit in 3D). Returns the interior draw
 * points (waypoints only, endpoints excluded).
 *
 * SSoT: the 3D waypoint **handle** layer (`use-bim3d-wire-waypoint-interaction-3d`)
 * also calls this so the sphere sits at the EXACT point the conduit passes
 * through. A naive `(i+1)/(N+1)` index fraction would put the handle at a
 * different elevation than the arc-length-interpolated wire whenever the segment
 * endpoints differ in height — the sphere then floats off the line (visible when
 * orbiting). Both consume this ONE interpolation, so they never diverge.
 */
export function splicedSegmentInterior(
  a: WireHostPoint,
  b: WireHostPoint,
  wps: readonly { x: number; y: number }[],
): WireHostPoint[] {
  if (wps.length === 0) return [];
  const verts = [a, ...wps.map((w) => ({ x: w.x, y: w.y, zMm: 0 })), b];
  const cum: number[] = [0];
  for (let i = 1; i < verts.length; i++) {
    cum.push(cum[i - 1]! + Math.hypot(verts[i]!.x - verts[i - 1]!.x, verts[i]!.y - verts[i - 1]!.y));
  }
  const total = cum[cum.length - 1]!;
  return wps.map((w, i) => {
    const t = total < 1e-9 ? 0 : cum[i + 1]! / total;
    return { x: w.x, y: w.y, zMm: a.zMm + (b.zMm - a.zMm) * t };
  });
}

/**
 * Compute the home-run wire path for every system. A system is skipped when its
 * panel source cannot be resolved (no anchor for the home run) or it has no
 * resolvable member (nothing to wire). Off-scene members are dropped silently.
 * Any persisted per-segment waypoints (`params.wireWaypoints`) are spliced into
 * `points`, so `buildWirePolyline` applies the path `style` per sub-segment and
 * both 2D + 3D renderers consume the waypoints with no change.
 */
export function computeCircuitWirePaths(
  systems: readonly MepSystemEntity[],
  resolve: ResolveWireHost,
): CircuitWirePath[] {
  const paths: CircuitWirePath[] = [];
  for (const system of systems) {
    const hosts = routeHosts(system, resolve);
    if (!hosts) continue;
    const waypointMap = system.params.wireWaypoints;
    const points: WireHostPoint[] = [hosts[0]!.point];
    for (let i = 1; i < hosts.length; i++) {
      const a = hosts[i - 1]!;
      const b = hosts[i]!;
      const wps = getOrientedWaypoints(waypointMap, a.key, b.key);
      points.push(...splicedSegmentInterior(a.point, b.point, wps), b.point);
    }
    paths.push({
      systemId: system.id,
      colorHex: systemColor(system),
      style: system.params.wireStyle ?? 'straight',
      conductors: system.params.conductors ?? DEFAULT_CONDUCTORS,
      points,
    });
  }
  return paths;
}

/** Number of straight chords used to approximate one `'arc'` segment. */
const ARC_SAMPLES = 16;
/** Arc bulge as a fraction of the segment length (control-point offset). */
const ARC_BULGE_FRACTION = 0.18;

/**
 * Sample the segment `a→b` as a quadratic Bézier into `ARC_SAMPLES` chords. The
 * control point sits at the segment midpoint, pushed perpendicular (to the left
 * of `a→b`) by `ARC_BULGE_FRACTION × length`, so the run bows out like a Revit
 * arc wire. `zMm` rides the same Bézier (control z = midpoint z → linear in z).
 * Degenerate (zero-length) segments collapse to the direct two points.
 */
function arcSegment(a: WireHostPoint, b: WireHostPoint): WireHostPoint[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return [a, b];
  const bulge = len * ARC_BULGE_FRACTION;
  const cx = (a.x + b.x) / 2 + (-dy / len) * bulge;
  const cy = (a.y + b.y) / 2 + (dx / len) * bulge;
  const cz = (a.zMm + b.zMm) / 2;
  const out: WireHostPoint[] = [a];
  for (let i = 1; i < ARC_SAMPLES; i++) {
    const t = i / ARC_SAMPLES;
    const mt = 1 - t;
    const w0 = mt * mt;
    const w1 = 2 * mt * t;
    const w2 = t * t;
    out.push({
      x: w0 * a.x + w1 * cx + w2 * b.x,
      y: w0 * a.y + w1 * cy + w2 * b.y,
      zMm: w0 * a.zMm + w1 * cz + w2 * b.zMm,
    });
  }
  out.push(b);
  return out;
}

/**
 * Expand one segment `a→b` into draw points (inclusive of both ends) per
 * `style`. `'straight'` is the direct line; `'orthogonal'` inserts an L-elbow
 * (horizontal-then-vertical, elbow at `b`'s elevation); `'arc'` samples a
 * quadratic Bézier ({@link arcSegment}) so the curve lives in this ONE place and
 * both renderers consume it as plain points. The seam that lets styles change
 * without touching the routing engine or either renderer.
 */
export function expandSegment(
  a: WireHostPoint,
  b: WireHostPoint,
  style: WireStyle = 'straight',
): WireHostPoint[] {
  if (style === 'orthogonal') {
    return [a, { x: b.x, y: a.y, zMm: b.zMm }, b];
  }
  if (style === 'arc') {
    return arcSegment(a, b);
  }
  return [a, b];
}

/**
 * Flatten a circuit path into a single draw polyline, expanding every segment by
 * the path's own `style` (Revit "Wiring Type") and de-duplicating the shared
 * joins. Both renderers call this so the drawn shape is identical in 2D and 3D —
 * and the `path.style ?? 'straight'` default lives here, the ONE place.
 */
export function buildWirePolyline(path: CircuitWirePath): WireHostPoint[] {
  const pts = path.points;
  if (pts.length === 0) return [];
  const style = path.style ?? 'straight';
  const out: WireHostPoint[] = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    const seg = expandSegment(pts[i - 1]!, pts[i]!, style);
    for (let j = 1; j < seg.length; j++) out.push(seg[j]!);
  }
  return out;
}
