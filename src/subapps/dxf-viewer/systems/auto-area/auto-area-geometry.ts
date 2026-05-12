/**
 * Auto-area geometry: finds closed polygon faces formed by connected line segments.
 * Algorithm: half-edge planar face traversal (O(n log n)).
 */

import type { Point2D } from '../../rendering/types/Types';

// ============================================================================
// TYPES
// ============================================================================

interface Node {
  pos: Point2D;
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Given an array of line segment endpoint pairs, finds all bounded (interior)
 * closed polygon faces formed by connected segments. Returns each face as an
 * ordered array of vertices.
 *
 * @param linePairs - Array of [start, end] world-coord pairs
 * @param tolerance - Endpoint merge distance (snap tolerance)
 */
export function findClosedPolygonsFromLines(
  linePairs: ReadonlyArray<readonly [Point2D, Point2D]>,
  tolerance: number,
): Point2D[][] {
  if (linePairs.length < 3) return [];

  // 1. Normalize endpoints
  const nodes: Node[] = [];
  const edgeList: [number, number][] = [];

  const findOrAdd = (p: Point2D): number => {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i].pos;
      if (Math.hypot(n.x - p.x, n.y - p.y) <= tolerance) return i;
    }
    return nodes.push({ pos: { x: p.x, y: p.y } }) - 1;
  };

  for (const [s, e] of linePairs) {
    const u = findOrAdd(s);
    const v = findOrAdd(e);
    if (u !== v) edgeList.push([u, v]);
  }

  if (edgeList.length < 3) return [];

  // 2. Half-edge structure
  // he = 2*i → edge[i] forward (u→v); he = 2*i+1 → backward (v→u)
  const heCount = edgeList.length * 2;
  const heFrom = new Int32Array(heCount);
  const heTo   = new Int32Array(heCount);
  for (let i = 0; i < edgeList.length; i++) {
    const [u, v] = edgeList[i];
    heFrom[2 * i]     = u;  heTo[2 * i]     = v;
    heFrom[2 * i + 1] = v;  heTo[2 * i + 1] = u;
  }

  // Sort outgoing half-edges CCW by angle at each node
  const nodeOut: number[][] = nodes.map(() => []);
  for (let he = 0; he < heCount; he++) nodeOut[heFrom[he]].push(he);

  const angle = (he: number): number =>
    Math.atan2(nodes[heTo[he]].pos.y - nodes[heFrom[he]].pos.y,
               nodes[heTo[he]].pos.x - nodes[heFrom[he]].pos.x);

  for (const out of nodeOut) out.sort((a, b) => angle(a) - angle(b));

  // Build heNext: next half-edge in face cycle = prev CCW edge from destination
  const heNext = new Int32Array(heCount);
  for (let he = 0; he < heCount; he++) {
    const twin = he ^ 1;
    const v = heFrom[twin];
    const out = nodeOut[v];
    const idx = out.indexOf(twin);
    heNext[he] = out[(idx - 1 + out.length) % out.length];
  }

  // 3. Trace all face cycles
  const visited = new Uint8Array(heCount);
  const faces: Point2D[][] = [];

  for (let start = 0; start < heCount; start++) {
    if (visited[start]) continue;
    const poly: Point2D[] = [];
    let he = start;
    let guard = 0;
    do {
      visited[he] = 1;
      poly.push(nodes[heFrom[he]].pos);
      he = heNext[he];
    } while (he !== start && ++guard < heCount);

    if (poly.length < 3) continue;

    // Keep only interior (bounded) faces: positive signed area in DXF math coords
    let area2 = 0;
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length;
      area2 += poly[i].x * poly[j].y - poly[j].x * poly[i].y;
    }
    if (area2 > 0) faces.push(poly);
  }

  return faces;
}
