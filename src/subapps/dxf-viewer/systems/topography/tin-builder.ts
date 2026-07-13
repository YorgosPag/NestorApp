/**
 * ADR-650 Milestone 1 — TIN builder (Constrained Delaunay Triangulation).
 *
 * Big-player pattern (Civil 3D / CASS): the surface is a Constrained Delaunay TIN,
 * NOT plain Delaunay — a breakline segment is only guaranteed to survive as a triangle
 * edge under CDT (ADR-650 §5). We use `cdt2d` (MIT, robust-predicates backed) for the
 * CDT; the marching step (contour-generator) runs over the triangles it returns.
 *
 * Flow: survey points + breakline vertices → dedup → LOCAL positions + parallel Z →
 * constraint edges from breaklines → `cdt2d(positions, edges)` → {@link TinSurface}.
 *
 * "False-flat" triangles (all three vertices at one Z) yield no contour crossing and are
 * counted for QA (the digitized-contour terrace trap, ADR-650 §5); with spot-point input
 * they are rare, and the contour generator additionally nudges levels off exact vertex Z.
 */

import cdt2d, { type Cdt2dPoint, type Cdt2dEdge } from 'cdt2d';
import type { TopoPoint, Breakline, LocalOrigin, TinSurface, TopoBounds } from './topo-types';
import { computeLocalOrigin, ZERO_ORIGIN } from './topo-local-origin';

/**
 * Micrometre-grid key so coincident survey/breakline vertices merge to one TIN node.
 * Exported as the SSoT for «which LOCAL grid cell is this vertex in» — the QA topology
 * pass (ADR-650 M5α) reuses it to match a TIN edge back to a breakline segment, so the
 * two can never round differently and disagree about coincidence.
 */
export function localVertexKey(localX: number, localY: number): string {
  return `${Math.round(localX * 1000)}:${Math.round(localY * 1000)}`;
}

interface CollectedVertices {
  readonly positions: Cdt2dPoint[];
  readonly elevations: number[];
  readonly keyToIndex: Map<string, number>;
}

/** Add one LOCAL vertex (deduped by grid key), returning its index. */
function pushVertex(acc: CollectedVertices, localX: number, localY: number, z: number): number {
  const key = localVertexKey(localX, localY);
  const existing = acc.keyToIndex.get(key);
  if (existing !== undefined) return existing;
  const index = acc.positions.length;
  acc.positions.push([localX, localY]);
  acc.elevations.push(z);
  acc.keyToIndex.set(key, index);
  return index;
}

/** Collect survey points + breakline vertices into deduped LOCAL positions + Z. */
function collectVertices(
  points: readonly TopoPoint[],
  breaklines: readonly Breakline[],
  origin: LocalOrigin,
): CollectedVertices {
  const acc: CollectedVertices = { positions: [], elevations: [], keyToIndex: new Map() };
  for (const p of points) pushVertex(acc, p.x - origin.x, p.y - origin.y, p.z);
  for (const bl of breaklines) {
    for (const v of bl.vertices) pushVertex(acc, v.x - origin.x, v.y - origin.y, v.z);
  }
  return acc;
}

/** Build constraint edges (index pairs) from breaklines, closing rings when flagged. */
function buildConstraintEdges(
  breaklines: readonly Breakline[],
  acc: CollectedVertices,
  origin: LocalOrigin,
): Cdt2dEdge[] {
  const edges: Cdt2dEdge[] = [];
  for (const bl of breaklines) {
    const idx = bl.vertices.map((v) =>
      acc.keyToIndex.get(localVertexKey(v.x - origin.x, v.y - origin.y)),
    );
    for (let i = 0; i < idx.length - 1; i++) {
      const a = idx[i];
      const b = idx[i + 1];
      if (a !== undefined && b !== undefined && a !== b) edges.push([a, b]);
    }
    if (bl.closed && idx.length > 2) {
      const first = idx[0];
      const last = idx[idx.length - 1];
      if (first !== undefined && last !== undefined && first !== last) edges.push([last, first]);
    }
  }
  return edges;
}

/** Local-frame planimetric bounds + world-frame vertical bounds. */
function computeBounds(positions: readonly Cdt2dPoint[], elevations: readonly number[]): TopoBounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const [x, y] of positions) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  for (const z of elevations) { if (z < minZ) minZ = z; if (z > maxZ) maxZ = z; }
  return { minX, minY, maxX, maxY, minZ, maxZ };
}

/** Count triangles whose three vertices share one elevation (false flats, §5). */
function countFlatTriangles(
  triangles: ReadonlyArray<readonly [number, number, number]>,
  elevations: readonly number[],
): number {
  let count = 0;
  for (const [i, j, k] of triangles) {
    if (elevations[i] === elevations[j] && elevations[j] === elevations[k]) count++;
  }
  return count;
}

/**
 * Build a Constrained Delaunay {@link TinSurface} from survey points + breaklines.
 * Returns an empty surface (no triangles) when there are fewer than 3 distinct points.
 */
export function buildTin(
  points: readonly TopoPoint[],
  breaklines: readonly Breakline[] = [],
  originArg?: LocalOrigin,
): TinSurface {
  const origin = originArg ?? computeLocalOrigin(points, breaklines);
  const acc = collectVertices(points, breaklines, origin);

  if (acc.positions.length < 3) {
    return {
      positions: acc.positions,
      elevations: acc.elevations,
      triangles: [],
      origin: acc.positions.length ? origin : ZERO_ORIGIN,
      bounds: computeBounds(acc.positions, acc.elevations),
      flatTriangleCount: 0,
    };
  }

  const edges = buildConstraintEdges(breaklines, acc, origin);
  const triangles = cdt2d(acc.positions, edges, { delaunay: true });

  return {
    positions: acc.positions,
    elevations: acc.elevations,
    triangles,
    origin,
    bounds: computeBounds(acc.positions, acc.elevations),
    flatTriangleCount: countFlatTriangles(triangles, acc.elevations),
  };
}
