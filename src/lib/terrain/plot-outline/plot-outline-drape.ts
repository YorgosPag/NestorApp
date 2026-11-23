/**
 * @fileoverview **Π7 — the plot outline laid ON the relief, for the 3D view** (ADR-920 §14.11 Π7 · Ζ1).
 * @related ../inspect/terrain-profile (`profileTraceOf` — the ONE «segment on the TIN», reused per edge) ·
 *   ../publication/terrain-3d-geometry (`terrain3dPolylinePairs` turns each run into `LineSegments2` pairs)
 *
 * A flat outline floats above the ground on a slope and sinks into it on a crest. So the outline is DRAPED: every edge
 * is cut where it crosses a triangle edge, and every cut takes its height from the SAME published surface (planar per
 * triangle ⇒ exact, nothing interpolated between triangles). The profile tool already does exactly this for one
 * segment; this file walks the ring with it.
 *
 * 🔑 **Off the relief, nothing is drawn** (Π7): a stretch of the outline outside the surveyed surface ends a run — no
 *    invented height, no line «at zero». The share that could be draped is reported (`drapedFraction`).
 * 🔑 A ring fully on the relief comes back as ONE closed run (last point = first point), so the line closes visually.
 *
 * Frame: the SNAPSHOT frame of the index (metres, centred, Δ3) in and out; `z` = absolute elevation, metres.
 */

import type { PlanarPoint } from '@/lib/geometry/planar-polygon';

import type { TerrainInspectIndex } from '../inspect/terrain-inspect-index';
import { profileTraceOf, type ProfileStation } from '../inspect/terrain-profile';

export interface DrapedPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface DrapedPlotOutline {
  /** Continuous stretches of the outline that lie on the relief, each ≥ 2 points. */
  readonly runs: readonly (readonly DrapedPoint[])[];
  /** Length on the relief ÷ perimeter, in [0, 1]. */
  readonly drapedFraction: number;
  readonly perimeterM: number;
}

const onGround = (s: ProfileStation): DrapedPoint => ({ x: s.x, y: s.y, z: s.z ?? 0 });

interface Walk {
  readonly runs: DrapedPoint[][];
  current: DrapedPoint[];
  drapedM: number;
  /** The very first piece of the ring is on the relief — the last run may close onto the first. */
  startsOnGround: boolean | null;
}

function closeRun(walk: Walk): void {
  if (walk.current.length >= 2) walk.runs.push(walk.current);
  walk.current = [];
}

/** One edge of the ring: on-relief pieces extend the current run, an off-relief piece ends it. */
function walkEdge(walk: Walk, index: TerrainInspectIndex, a: PlanarPoint, b: PlanarPoint): void {
  const { stations, pieces } = profileTraceOf(index, a, b);
  pieces.forEach((piece, i) => {
    if (walk.startsOnGround === null) walk.startsOnGround = piece.onSurface;
    if (!piece.onSurface) { closeRun(walk); return; }
    if (walk.current.length === 0) walk.current.push(onGround(stations[i]));
    walk.current.push(onGround(stations[i + 1]));
    walk.drapedM += piece.toS - piece.fromS;
  });
}

/** The last open run continues into the first one across the ring's start point. */
function joinAcrossStart(walk: Walk): void {
  const open = walk.current;
  walk.current = [];
  if (open.length < 2) return;
  if (walk.startsOnGround && walk.runs.length > 0) {
    const first = walk.runs[0];
    walk.runs[0] = [...open, ...first.slice(1)];
    return;
  }
  walk.runs.push(open);
}

function perimeterOf(ring: readonly PlanarPoint[]): number {
  return ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return sum + Math.hypot(q.x - p.x, q.y - p.y);
  }, 0);
}

/** Drape a closed ring (snapshot frame, no repeated first point) on the relief of `index`. */
export function drapePlotOutline(index: TerrainInspectIndex, ring: readonly PlanarPoint[]): DrapedPlotOutline {
  const perimeterM = perimeterOf(ring);
  if (ring.length < 3 || perimeterM <= 0) return { runs: [], drapedFraction: 0, perimeterM };
  const walk: Walk = { runs: [], current: [], drapedM: 0, startsOnGround: null };
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length];
    if (a.x !== b.x || a.y !== b.y) walkEdge(walk, index, a, b);
  });
  if (walk.runs.length === 0 && walk.current.length >= 2) {
    walk.runs.push(walk.current); // the whole ring on the relief: one closed run
    walk.current = [];
  } else {
    joinAcrossStart(walk);
  }
  return { runs: walk.runs, drapedFraction: Math.min(1, walk.drapedM / perimeterM), perimeterM };
}
