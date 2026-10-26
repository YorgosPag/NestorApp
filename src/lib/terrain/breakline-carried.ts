/**
 * ADR-920 Β4.8 Β3.6 — breaklines AS THE SURFACE CARRIES THEM.
 *
 * Where two breaklines meet at two elevations the resolver gives the meeting point ONE Z — the earlier line's, a
 * measurement's, or an engineer's rule — and splits both lines there, so the surface bends the other line through it.
 * The definition does not change (it is the engineer's input), so a line drawn from the definition passes ABOVE or
 * BELOW the surface it cuts, exactly at the spot the engineer is looking at. This returns each breakline with every
 * meeting point it takes part in as a vertex at the Z the surface carries — what the 3D line must draw.
 *
 * Pure. Identity is preserved: a breakline with no meeting point is returned as is, and the input array itself when
 * none has one — a consumer that caches by identity re-projects only when something really changed.
 */

import { closestPointOnSegment } from '@/lib/geometry/planar-polygon';
import type { Breakline, BreaklineElevationConflict, LocalOrigin, TopoPoint3D } from './terrain-types';

/** Below this (WORLD mm, planimetric) a meeting point IS an existing vertex, or lies on a segment. */
const ON_LINE_MM = 1;

interface Node {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Meeting points per breakline id — both halves of every pair (a survey point is no breakline). */
function nodesById(conflicts: readonly BreaklineElevationConflict[], origin: LocalOrigin): Map<string, Node[]> {
  const out = new Map<string, Node[]>();
  const add = (id: string, node: Node): void => {
    const list = out.get(id);
    if (list) list.push(node);
    else out.set(id, [node]);
  };
  for (const c of conflicts) {
    const node = { x: c.x + origin.x, y: c.y + origin.y, z: c.keptZ };
    add(c.overruledBreaklineId, node);
    if (c.keptBreaklineId !== undefined && c.keptBreaklineId !== c.overruledBreaklineId) add(c.keptBreaklineId, node);
  }
  return out;
}

/** How far along `a→b` the point `p` projects (its order on the segment), and how far off the segment it is. */
function projectOnSegment(p: Node, a: TopoPoint3D, b: TopoPoint3D): { readonly t: number; readonly d: number } {
  const on = closestPointOnSegment(p, a, b);
  return { t: Math.hypot(on.x - a.x, on.y - a.y), d: Math.hypot(p.x - on.x, p.y - on.y) };
}

/** `breakline` with its meeting points: an existing vertex takes the carried Z, a mid-segment point is inserted. */
function carry(breakline: Breakline, nodes: readonly Node[]): Breakline {
  const v = [...breakline.vertices];
  const segCount = breakline.closed && v.length > 2 ? v.length : v.length - 1;
  const inserts: { seg: number; t: number; node: Node }[] = [];
  for (const node of nodes) {
    const at = v.findIndex((p) => Math.hypot(p.x - node.x, p.y - node.y) <= ON_LINE_MM);
    if (at >= 0) {
      v[at] = { x: v[at]!.x, y: v[at]!.y, z: node.z };
      continue;
    }
    for (let i = 0; i < segCount; i++) {
      const { t, d } = projectOnSegment(node, v[i]!, v[(i + 1) % v.length]!);
      if (d <= ON_LINE_MM) { inserts.push({ seg: i, t, node }); break; }
    }
  }
  if (inserts.length === 0 && v.every((p, i) => p === breakline.vertices[i])) return breakline;
  const out: TopoPoint3D[] = [];
  for (let i = 0; i < v.length; i++) {
    out.push(v[i]!);
    const here = inserts.filter((s) => s.seg === i).sort((a, b) => a.t - b.t);
    for (const { node } of here) out.push({ x: node.x, y: node.y, z: node.z });
  }
  return { ...breakline, vertices: out };
}

/**
 * The breaklines with every meeting point of the build report inserted at the Z the surface carries. `origin` = the
 * report surface's LOCAL origin (conflict positions are LOCAL).
 */
export function breaklinesAsCarried(
  breaklines: readonly Breakline[],
  conflicts: readonly BreaklineElevationConflict[],
  origin: LocalOrigin,
): readonly Breakline[] {
  if (conflicts.length === 0) return breaklines;
  const byId = nodesById(conflicts, origin);
  let changed = false;
  const out = breaklines.map((b) => {
    const nodes = byId.get(b.id);
    const carried = nodes ? carry(b, nodes) : b;
    if (carried !== b) changed = true;
    return carried;
  });
  return changed ? out : breaklines;
}
