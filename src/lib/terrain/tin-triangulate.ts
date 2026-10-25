/**
 * ADR-650 / ADR-920 Β4.8 Τ — the ONE call into the triangulation engine: positions + constraint edges → triangles.
 *
 * Engine: **Delaunator** (Delaunay, ISC) + **Constrainautor** (Sloan 1992 constrained edges, ISC), both on Shewchuk's
 * ADAPTIVE predicates (`robust-predicates`, Unlicense): exact arithmetic only when the fast answer is in doubt — the
 * same answers as the exact-everywhere `cdt2d` it replaced, ~×80 cheaper (measured, ADR-920 §13.8 «Υπο-βήμα 5α»).
 *
 * Two measured facts this file exists to absorb (2026-10-25):
 * - Delaunator emits triangles CLOCKWISE in a y-up frame (its docs speak of y-down screens); the `TinSurface`
 *   contract is counter-clockwise from above, so every triangle is re-wound here — once, for every consumer.
 * - Constrainautor THROWS on an edge that crosses a constrained edge or passes through a vertex (`cdt2d` instead cut
 *   holes in the surface). `tin-breakline-resolve` removes both cases first; a refusal that still happens is
 *   COUNTED and the surface stays whole.
 */

import Delaunator from 'delaunator';
import Constrainautor from '@kninnug/constrainautor';
import type { TinPosition, TinTriangle } from './terrain-types';

/** A constraint edge — two vertex indices into the positions array. */
export type TinEdge = readonly [number, number];

interface ConstrainedTriangulation {
  readonly triangles: TinTriangle[];
  /** Edges the constrainer refused (each left out; the triangulation around it stays valid). */
  readonly refusedEdges: TinEdge[];
}

function flatCoordinates(positions: readonly TinPosition[]): Float64Array {
  const coords = new Float64Array(positions.length * 2);
  for (let i = 0; i < positions.length; i++) {
    coords[2 * i] = positions[i][0];
    coords[2 * i + 1] = positions[i][1];
  }
  return coords;
}

/** Delaunator's flat CW index list → counter-clockwise triples. */
function counterClockwise(flat: ArrayLike<number>): TinTriangle[] {
  const out: TinTriangle[] = [];
  for (let t = 0; t < flat.length; t += 3) out.push([flat[t], flat[t + 2], flat[t + 1]]);
  return out;
}

/**
 * Constrained Delaunay triangulation of `positions` (deduped by the caller). Collinear or fewer than three points
 * → no triangles. Deterministic: same input, same triangles.
 */
export function triangulateConstrained(
  positions: readonly TinPosition[],
  edges: readonly TinEdge[],
): ConstrainedTriangulation {
  const delaunay = new Delaunator(flatCoordinates(positions));
  if (delaunay.triangles.length === 0) return { triangles: [], refusedEdges: [...edges] };
  const refusedEdges: TinEdge[] = [];
  if (edges.length > 0) {
    const constrainer = new Constrainautor(delaunay);
    for (const edge of edges) {
      try {
        constrainer.constrainOne(edge[0], edge[1]);
      } catch {
        refusedEdges.push(edge);
      }
    }
  }
  return { triangles: counterClockwise(delaunay.triangles), refusedEdges };
}
