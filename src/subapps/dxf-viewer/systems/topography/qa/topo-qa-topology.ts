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

/**
 * The planimetric length (LOCAL mm) of every UNIQUE TIN edge — the raw material for «how far
 * apart was this survey shot?», which is what `check-boundary-elevation-coverage` calibrates its
 * bridge threshold against (ADR-725).
 *
 * Unique, not per-triangle: an interior edge belongs to two triangles, and counting it twice
 * would weight the interior of the survey against its border for no reason. Planimetric on
 * purpose — the question is shot SPACING, and a slope must not make a shot look further away
 * than the surveyor actually walked.
 *
 * Lives here rather than in the check because it is the same family as the two adjacency
 * products above: a derivation the raw {@link TinSurface} does not carry, useful to any QA rule
 * that needs to know the survey's own scale.
 */
export function tinEdgeLengths(surface: TinSurface): number[] {
  const seen = new Set<string>();
  const lengths: number[] = [];
  const add = (a: number, b: number): void => {
    const key = edgeKey(a, b);
    if (seen.has(key)) return;
    seen.add(key);
    const length = tinEdgeLength(surface, a, b);
    if (Number.isFinite(length)) lengths.push(length);
  };
  for (const [i, j, k] of surface.triangles) { add(i, j); add(j, k); add(k, i); }
  return lengths;
}

/**
 * Planimetric length (LOCAL mm) of the edge between two TIN vertices, or `NaN` when either
 * index is out of range. One owner of the measurement, so the population {@link tinEdgeLengths}
 * calibrates against and the per-triangle test that compares to it can never drift apart.
 */
export function tinEdgeLength(surface: TinSurface, a: number, b: number): number {
  const pa = surface.positions[a];
  const pb = surface.positions[b];
  if (!pa || !pb) return NaN;
  return Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
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
