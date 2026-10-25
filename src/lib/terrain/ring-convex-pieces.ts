/**
 * ADR-718 / ADR-920 Β4.8 Τ — a closed ring (a plot boundary, possibly concave) as CONVEX pieces: the interior
 * triangles of its constrained triangulation, each with its bounding box.
 *
 * Why it exists: the surface crop clipped every TIN triangle against the WHOLE boundary and fanned the result from its
 * first vertex, on the claim «the piece is convex». It is not — a concave boundary ∩ a triangle can be concave, and
 * Sutherland–Hodgman leaves zero-width bridges where the boundary leaves and re-enters — so the fan laid overlapping
 * triangles (measured: an L-shaped 300 m² plot cropped to 304 m² once the triangulator picked other diagonals on an
 * exact grid). Clipping against convex pieces makes every piece convex ∩ convex = convex, and the fan exact. Same
 * engine as the TIN itself (`tin-triangulate`), same dedup grid.
 */

import { pointInPolygon, type PlanarPoint } from '@/lib/geometry/planar-polygon';
import { createVertexAccumulator, pushVertex } from './tin-vertex-accumulator';
import { triangulateConstrained, type TinEdge } from './tin-triangulate';

export interface ConvexPiece {
  readonly corners: readonly [PlanarPoint, PlanarPoint, PlanarPoint];
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

function pieceOf(a: PlanarPoint, b: PlanarPoint, c: PlanarPoint): ConvexPiece {
  return {
    corners: [a, b, c],
    minX: Math.min(a.x, b.x, c.x),
    minY: Math.min(a.y, b.y, c.y),
    maxX: Math.max(a.x, b.x, c.x),
    maxY: Math.max(a.y, b.y, c.y),
  };
}

/** The ring's interior as triangles (its edges constrained; a triangle is inside iff its centroid is). */
export function ringConvexPieces(ring: readonly PlanarPoint[]): ConvexPiece[] {
  if (ring.length < 3) return [];
  const acc = createVertexAccumulator();
  const indices = ring.map((p) => pushVertex(acc, p.x, p.y, 0));
  const edges: TinEdge[] = [];
  for (let i = 0; i < indices.length; i++) {
    const a = indices[i];
    const b = indices[(i + 1) % indices.length];
    if (a !== b) edges.push([a, b]);
  }
  const at = (index: number): PlanarPoint => ({ x: acc.positions[index][0], y: acc.positions[index][1] });
  const pieces: ConvexPiece[] = [];
  for (const [i, j, k] of triangulateConstrained(acc.positions, edges).triangles) {
    const [a, b, c] = [at(i), at(j), at(k)];
    if (pointInPolygon({ x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 }, ring)) pieces.push(pieceOf(a, b, c));
  }
  return pieces;
}

/** Do the boxes of `piece` and of the points overlap? (Touching counts — the exact clip decides.) */
export function boxesOverlap(piece: ConvexPiece, points: readonly PlanarPoint[]): boolean {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  return minX <= piece.maxX && maxX >= piece.minX && minY <= piece.maxY && maxY >= piece.minY;
}
