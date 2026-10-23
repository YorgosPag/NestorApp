/**
 * ADR-650 — undirected edge chaining. The SSoT «loose edges → ordered polylines».
 *
 * Two topography producers emit a BAG of edges and both need the same thing back: continuous,
 * ordered chains.
 *   - M1 contours: marching-triangles emits one segment per triangle×level → `contour-chainer`.
 *   - M8β/Γ auto-breaklines: the steep-fold detector emits one edge per TIN fold → `chain-feature-edges`.
 * The walk is identical (adjacency + consume-each-edge-once), so it lives HERE once instead of
 * twice (N.18 — a token-level clone of the contour walk is exactly what jscpd would catch).
 *
 * The ONE real difference is what to do at a junction (a node where ≥3 chained edges meet):
 *   - contours: keep walking (a saddle level touches itself; the extra crossing is not a fork
 *     the caller cares about) — the historical M1 behaviour, preserved bit-for-bit.
 *   - breaklines: **stop** (`stopAtJunction`). Where a road edge meets a ditch, Civil 3D gives
 *     you THREE feature lines, not one guessed-through polyline. Guessing which branch
 *     «continues» is exactly the kind of invention a survey tool must never do.
 *
 * Nodes are opaque keys (`string` for a contour's coordinate cell, `number` for a TIN vertex
 * index) — the walk never looks at coordinates, so the caller keeps ownership of geometry.
 */

/** Anything hashable enough to identify a node: a coordinate cell key, or a TIN vertex index. */
export type ChainNodeKey = string | number;

/** One walked chain. When `closed`, the first node is repeated as the last one. */
export interface ChainedPath<K extends ChainNodeKey> {
  readonly nodes: readonly K[];
  readonly closed: boolean;
}

export interface ChainOptions {
  /** Stop the walk on stepping into a node of degree ≠ 2 (a dead end or a fork). */
  readonly stopAtJunction?: boolean;
}

/** Symmetric key of an undirected pair, so an edge is consumed once whichever way it is walked. */
function pairKey(a: ChainNodeKey, b: ChainNodeKey): string {
  const ka = String(a);
  const kb = String(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

/**
 * Chain a bag of undirected edges into ordered paths, consuming every edge exactly once.
 *
 * Degree-1 nodes are walked first (open chains start at their real ends), so a chain is never
 * cut in half by a start picked mid-way; whatever survives that pass is a cycle and comes out
 * `closed`. Self-loops and duplicate edges are absorbed. ~O(edges).
 */
export function chainUndirectedEdges<K extends ChainNodeKey>(
  edges: readonly (readonly [K, K])[],
  options: ChainOptions = {},
): ChainedPath<K>[] {
  const adjacency = new Map<K, K[]>();
  for (const [a, b] of edges) {
    if (a === b) continue;
    (adjacency.get(a) ?? adjacency.set(a, []).get(a)!).push(b);
    (adjacency.get(b) ?? adjacency.set(b, []).get(b)!).push(a);
  }

  const used = new Set<string>();
  const degree = (node: K): number => (adjacency.get(node) ?? []).length;
  const nextUnused = (node: K): K | undefined =>
    (adjacency.get(node) ?? []).find((n) => !used.has(pairKey(node, n)));

  const walk = (start: K): K[] => {
    const nodes: K[] = [start];
    let current = start;
    for (;;) {
      const next = nextUnused(current);
      if (next === undefined) break;
      used.add(pairKey(current, next));
      nodes.push(next);
      current = next;
      if (options.stopAtJunction === true && degree(next) !== 2) break;
    }
    return nodes;
  };

  const paths: ChainedPath<K>[] = [];
  const starts = [...adjacency.keys()].sort((a, b) => degree(a) - degree(b));
  for (const start of starts) {
    while (nextUnused(start) !== undefined) {
      const nodes = walk(start);
      if (nodes.length < 2) break;
      paths.push({ nodes, closed: nodes.length > 2 && nodes[0] === nodes[nodes.length - 1] });
    }
  }
  return paths;
}
