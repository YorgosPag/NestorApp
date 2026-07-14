/**
 * ADR-650 M8β/Γ — steep edges → candidate feature lines. **This is the new part.**
 *
 * The M5α «καμπανάκι» already tells the surveyor WHICH EDGES fold suspiciously. But a breakline
 * is not an edge — it is a POLYLINE: the edge of a road is ~200 consecutive steep edges that
 * must come back as ONE ordered chain, or the engineer is left clicking two hundred hints.
 * Chaining is what turns a QA hint into an actual feature line, and it is all this module does.
 *
 * The walk is the shared `chainUndirectedEdges` SSoT, run with `stopAtJunction` — where three
 * breaks meet (a road edge running into a ditch) Civil 3D hands you THREE feature lines and
 * lets you decide; it does not guess which branch «continues». Neither do we.
 *
 * Then two quality gates, both from the config SSoT: too few edges (triangulation noise) and
 * too short (a bush, a rock, a mis-shot — not a linear feature). What survives is offered,
 * longest first; nothing is written anywhere (§9 — the panel's explicit confirm does that).
 */

import type { TinSurface, TopoPoint } from '../topo-types';
import type { SteepEdge } from './detect-feature-edges';
import type { AutoBreaklineCandidate } from './auto-breakline-types';
import type { ChainedPath } from '../graph-chain';
import { chainUndirectedEdges } from '../graph-chain';
import { edgeKey } from '../qa/topo-qa-topology';
import { nodeWorld } from '../qa/topo-qa-format';
import { calculatePolylineLength } from '../../../rendering/entities/shared/geometry-polyline-utils';
import { AUTO_BREAKLINE_CONFIG } from './auto-breakline-config';

/** TIN vertex index → its WORLD survey point (`nodeWorld` SSoT + the node's world elevation). */
function toWorld(surface: TinSurface, node: number): TopoPoint {
  const { x, y } = nodeWorld(surface, node);
  return { x, y, z: surface.elevations[node]! };
}

/** Mean dihedral fold along a walked chain — «how hard does the surface break here?». */
function meanFoldDeg(nodes: readonly number[], foldByEdge: ReadonlyMap<string, number>): number {
  let sum = 0;
  for (let i = 0; i < nodes.length - 1; i++) {
    sum += foldByEdge.get(edgeKey(nodes[i]!, nodes[i + 1]!)) ?? 0;
  }
  return nodes.length > 1 ? sum / (nodes.length - 1) : 0;
}

/**
 * One walked chain → a candidate, or `null` when a quality gate rejects it.
 * A closed chain repeats its start node; the candidate drops that repeat, because
 * `Breakline.closed` already means «the first and last vertices are joined».
 */
function toCandidate(
  surface: TinSurface,
  path: ChainedPath<number>,
  foldByEdge: ReadonlyMap<string, number>,
  index: number,
): AutoBreaklineCandidate | null {
  const { nodes, closed } = path;
  const edgeCount = nodes.length - 1;
  if (edgeCount < AUTO_BREAKLINE_CONFIG.MIN_CHAIN_EDGES) return null;

  const ring = closed ? nodes.slice(0, -1) : nodes;
  const vertices = ring.map((node) => toWorld(surface, node));
  const lengthMm = calculatePolylineLength(vertices.map((v) => ({ x: v.x, y: v.y })), closed);
  if (lengthMm < AUTO_BREAKLINE_CONFIG.MIN_CHAIN_LENGTH_MM) return null;

  return {
    id: `auto-breakline:${index}:${nodes[0]}-${nodes[nodes.length - 1]}`,
    vertices,
    closed,
    lengthMm,
    avgFoldDeg: meanFoldDeg(nodes, foldByEdge),
    edgeCount,
  };
}

/**
 * Chain steep edges into candidate feature lines, longest first, capped by the config.
 * Pure over its inputs — no store read, no store write.
 */
export function chainFeatureEdges(
  surface: TinSurface,
  steepEdges: readonly SteepEdge[],
): { readonly candidates: readonly AutoBreaklineCandidate[]; readonly droppedByCap: number } {
  const foldByEdge = new Map<string, number>();
  for (const e of steepEdges) foldByEdge.set(edgeKey(e.a, e.b), e.foldDeg);

  const chained = chainUndirectedEdges(
    steepEdges.map((e) => [e.a, e.b] as const),
    { stopAtJunction: true },
  );

  const all = chained
    .map((path, index) => toCandidate(surface, path, foldByEdge, index))
    .filter((c): c is AutoBreaklineCandidate => c !== null)
    .sort((a, b) => b.lengthMm - a.lengthMm);

  const candidates = all.slice(0, AUTO_BREAKLINE_CONFIG.MAX_CANDIDATES);
  return { candidates, droppedByCap: all.length - candidates.length };
}
