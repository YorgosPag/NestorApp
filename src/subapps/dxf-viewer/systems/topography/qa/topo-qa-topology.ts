/**
 * ADR-650 M5α — TIN topology derivations shared by the QA checks.
 *
 * Two pure adjacency products the raw {@link TinSurface} does not carry:
 *   - `buildVertexAdjacency` — vertex → its neighbour vertices (elevation-bust needs each
 *     node's ring of neighbours to judge whether its Z is an outlier).
 *   - `buildEdgeFaces` — undirected edge → the 1–2 triangles on it (missing-breakline needs
 *     the two faces sharing an edge to measure the fold across it).
 *
 * `buildBreaklineEdgeKeys` marks which TIN edges are already pinned by a breakline, reusing
 * `localVertexKey` from the tin-builder SSoT so a breakline vertex and the TIN node it became
 * round to the SAME cell — no independent rounding to drift.
 */

import type { TinSurface, Breakline, LocalOrigin } from '../topo-types';
import { localVertexKey } from '../tin-builder';

/** Undirected vertex-index pair, always `min:max`, so direction never matters. */
export function edgeKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** Vertex index → the set of vertex indices sharing a triangle with it. */
export function buildVertexAdjacency(surface: TinSurface): ReadonlyArray<ReadonlySet<number>> {
  const adjacency: Set<number>[] = surface.positions.map(() => new Set<number>());
  for (const [i, j, k] of surface.triangles) {
    adjacency[i]!.add(j); adjacency[i]!.add(k);
    adjacency[j]!.add(i); adjacency[j]!.add(k);
    adjacency[k]!.add(i); adjacency[k]!.add(j);
  }
  return adjacency;
}

/** One interior TIN edge and the two triangle indices that share it. */
export interface EdgeFaces {
  readonly a: number;
  readonly b: number;
  readonly faces: readonly [number, number];
}

/**
 * Every edge shared by exactly two triangles (interior edges — the only ones with a
 * dihedral to measure; boundary edges have a single face and are skipped).
 */
export function buildEdgeFaces(surface: TinSurface): readonly EdgeFaces[] {
  const byEdge = new Map<string, { a: number; b: number; faces: number[] }>();
  const record = (a: number, b: number, tri: number): void => {
    const key = edgeKey(a, b);
    const entry = byEdge.get(key);
    if (entry) entry.faces.push(tri);
    else byEdge.set(key, { a: Math.min(a, b), b: Math.max(a, b), faces: [tri] });
  };
  surface.triangles.forEach(([i, j, k], tri) => {
    record(i, j, tri); record(j, k, tri); record(k, i, tri);
  });
  const interior: EdgeFaces[] = [];
  for (const { a, b, faces } of byEdge.values()) {
    if (faces.length === 2) interior.push({ a, b, faces: [faces[0]!, faces[1]!] });
  }
  return interior;
}

/**
 * Keys (`edgeKey` over TIN vertex indices) of the edges already pinned by a breakline.
 * Resolves each breakline vertex to its TIN node via `localVertexKey` (the builder SSoT),
 * then keys the consecutive pairs — a steep edge in this set is EXPECTED, not a finding.
 */
export function buildBreaklineEdgeKeys(
  surface: TinSurface,
  breaklines: readonly Breakline[],
  origin: LocalOrigin,
): ReadonlySet<string> {
  const nodeByCell = new Map<string, number>();
  surface.positions.forEach(([x, y], index) => nodeByCell.set(localVertexKey(x, y), index));

  const keys = new Set<string>();
  for (const bl of breaklines) {
    const nodes = bl.vertices.map((v) => nodeByCell.get(localVertexKey(v.x - origin.x, v.y - origin.y)));
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i]; const b = nodes[i + 1];
      if (a !== undefined && b !== undefined && a !== b) keys.add(edgeKey(a, b));
    }
    if (bl.closed && nodes.length > 2) {
      const first = nodes[0]; const last = nodes[nodes.length - 1];
      if (first !== undefined && last !== undefined && first !== last) keys.add(edgeKey(first, last));
    }
  }
  return keys;
}
