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

import type { MepSystemEntity } from '../types/mep-system-types';
import { systemColor } from './mep-system-color';

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
  /** Ordered host points: `[panel, nearest fixture, next nearest, …]`. */
  readonly points: readonly WireHostPoint[];
}

/**
 * Resolve a host's connector world point, or `null` when the host is off the
 * current scene (cross-floor member, or deleted). Each caller builds this from
 * its own entity source (2D: `scene.entities`; 3D: `Bim3DEntities`).
 */
export type ResolveWireHost = (entityId: string, connectorId: string) => WireHostPoint | null;

/** Squared plan distance (x/y only) — routing ignores elevation. */
function planDistSq(a: WireHostPoint, b: WireHostPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * Order member points as a greedy nearest-neighbour chain starting from `origin`
 * (the panel). Deterministic: strict `<` keeps the first-listed member on ties,
 * so the result is replay-stable. Returns the ordered members (origin excluded).
 */
function orderDaisyChain(
  origin: WireHostPoint,
  members: readonly WireHostPoint[],
): WireHostPoint[] {
  const remaining = [...members];
  const chain: WireHostPoint[] = [];
  let last = origin;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = planDistSq(last, remaining[0]!);
    for (let i = 1; i < remaining.length; i++) {
      const d = planDistSq(last, remaining[i]!);
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
 * Compute the home-run wire path for every system. A system is skipped when its
 * panel source cannot be resolved (no anchor for the home run) or it has no
 * resolvable member (nothing to wire). Off-scene members are dropped silently.
 */
export function computeCircuitWirePaths(
  systems: readonly MepSystemEntity[],
  resolve: ResolveWireHost,
): CircuitWirePath[] {
  const paths: CircuitWirePath[] = [];
  for (const system of systems) {
    const { sourceEntityId, sourceConnectorId, members } = system.params;
    const origin = resolve(sourceEntityId, sourceConnectorId);
    if (!origin) continue;
    const memberPoints = members
      .map((m) => resolve(m.entityId, m.connectorId))
      .filter((p): p is WireHostPoint => p !== null);
    if (memberPoints.length === 0) continue;
    paths.push({
      systemId: system.id,
      colorHex: systemColor(system),
      style: system.params.wireStyle ?? 'straight',
      points: [origin, ...orderDaisyChain(origin, memberPoints)],
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
