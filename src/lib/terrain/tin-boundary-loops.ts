/**
 * ADR-662 Φ2β · ADR-920 Β4.8 — the boundary of a set of triangles, as rings of VERTEX INDICES (pure SSoT).
 *
 * Big-player model (Civil 3D «Surface Border» / Revit Toposolid boundary): the visible edge of a triangulated
 * region is its **boundary edges** — the ones claimed by EXACTLY ONE triangle of the set (an interior edge is
 * shared by two). The boundary edges are chained into rings by the shared `chainUndirectedEdges` walk.
 *
 * The set is whatever the caller passes: the whole TIN (the DXF surface footprint, the listing's «survey
 * extent»), or a subset (one slope class, the sparse triangles of the listing map). Geometry stays with the
 * caller — this module never looks at coordinates.
 *
 * ⚠️ Rings are chained over UNDIRECTED edges, so their winding cannot tell a hole from an island
 * (`topo-surface-area.ts`). Fill them with `fill-rule="evenodd"`, and take AREAS from the triangles, never from
 * the rings.
 *
 * 🔑 Moved here from `dxf-viewer/systems/topography/topo-surface-perimeter.ts` (ADR-920 Β4.8): the public plot
 * listing needs the same question and may not import from the subapp (CHECK 3.62). The DXF keeps only its
 * LOCAL→WORLD re-projection.
 *
 * @module lib/terrain/tin-boundary-loops
 */

import { chainUndirectedEdges } from './graph-chain';

/** One triangle as three vertex indices, counter-clockwise seen from above. */
export type TriangleIndices = readonly [number, number, number];

/** Undirected edge key (order-independent), so an edge counts once whichever triangle names it. */
function edgeKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** The three undirected edges of a triangle. */
function triangleEdges([i, j, k]: TriangleIndices): readonly (readonly [number, number])[] {
  return [[i, j], [j, k], [k, i]];
}

/** The edges of the set claimed by exactly one of its triangles. */
export function tinBoundaryEdges(triangles: readonly TriangleIndices[]): [number, number][] {
  const claimCount = new Map<string, number>();
  for (const tri of triangles) {
    for (const [a, b] of triangleEdges(tri)) {
      const key = edgeKey(a, b);
      claimCount.set(key, (claimCount.get(key) ?? 0) + 1);
    }
  }
  const boundary: [number, number][] = [];
  for (const tri of triangles) {
    for (const [a, b] of triangleEdges(tri)) {
      if (claimCount.get(edgeKey(a, b)) === 1) boundary.push([a, b]);
    }
  }
  return boundary;
}

/**
 * The boundary ring(s) of the set as vertex-index rings — the closing node is NOT repeated. An empty set yields
 * `[]`; a region with holes yields outer + hole loops; a chain shorter than three vertices is dropped.
 */
export function tinBoundaryLoops(triangles: readonly TriangleIndices[]): number[][] {
  if (triangles.length === 0) return [];
  const boundary = tinBoundaryEdges(triangles);
  return chainUndirectedEdges(boundary)
    .map(({ nodes, closed }) => (closed ? nodes.slice(0, -1) : [...nodes]))
    .filter((ring) => ring.length >= 3);
}
