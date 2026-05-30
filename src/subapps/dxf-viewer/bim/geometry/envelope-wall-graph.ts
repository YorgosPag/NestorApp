/**
 * ADR-396 Phase P3 — Envelope wall adjacency graph.
 *
 * Extracted from `envelope-perimeter.ts` (SRP / N.7.1 file-size). Builds the
 * wall→wall adjacency from shared face-corner keys (valence-2 nodes), then
 * orders each connected component into a chain with cycle + `enclosesRegion`
 * detection. Pure graph algorithms — no geometry, no scene units.
 */

export interface WallEdge {
  readonly neighborId: string;
  readonly viaKey: string;
}

/** Minimal node-key view of a prepared wall (structural subset of KeyedWall). */
export interface WallNodeKeys {
  readonly id: string;
  readonly startKeys: readonly string[];
  readonly endKeys: readonly string[];
}

/**
 * Χτίζει wall→wall adjacency από κοινά face corner keys (valence-2).
 * Dedup: κάθε ζεύγος τοίχων συνδέεται το πολύ μία φορά (πρώτο shared key).
 */
export function buildWallAdjacency(prepared: readonly WallNodeKeys[]): Map<string, WallEdge[]> {
  // nodeMap: key → list of {wallId, side}
  type Side = 'start' | 'end';
  const nodeMap = new Map<string, Array<{ wallId: string; side: Side }>>();
  const reg = (keys: readonly string[], wallId: string, side: Side): void => {
    for (const k of keys) {
      const arr = nodeMap.get(k);
      if (arr) arr.push({ wallId, side });
      else nodeMap.set(k, [{ wallId, side }]);
    }
  };
  for (const p of prepared) {
    reg(p.startKeys, p.id, 'start');
    reg(p.endKeys, p.id, 'end');
  }

  const adj = new Map<string, WallEdge[]>();
  for (const p of prepared) adj.set(p.id, []);

  const seen = new Set<string>(); // dedup wall pairs
  for (const [key, entries] of nodeMap) {
    if (entries.length < 2) continue;
    // Find the 2 DISTINCT wall ids (valence-2 = exactly 2 distinct walls).
    const distinct = entries.filter((a, i) =>
      !entries.slice(0, i).some(b => b.wallId === a.wallId),
    );
    if (distinct.length !== 2) continue;
    const [a, b] = distinct;
    const pairKey = [a.wallId, b.wallId].sort().join(':');
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);
    adj.get(a.wallId)?.push({ neighborId: b.wallId, viaKey: key });
    adj.get(b.wallId)?.push({ neighborId: a.wallId, viaKey: key });
  }
  return adj;
}

export function sharedKey(adj: Map<string, WallEdge[]>, aId: string, bId: string): string | null {
  return adj.get(aId)?.find(e => e.neighborId === bId)?.viaKey ?? null;
}

export function orderComponent(
  seedId: string,
  adj: Map<string, WallEdge[]>,
  visited: Set<string>,
): { ids: string[]; closed: boolean; enclosesRegion: boolean } {
  const comp = new Set<string>([seedId]);
  const queue = [seedId];
  while (queue.length > 0) {
    const c = queue.pop() as string;
    for (const e of adj.get(c) ?? []) {
      if (!comp.has(e.neighborId)) { comp.add(e.neighborId); queue.push(e.neighborId); }
    }
  }
  comp.forEach(id => visited.add(id));

  // ADR-396 v2 — «περικλείει χώρο;»: κύκλος ⟺ ακμές ≥ κόμβοι (degreeSum/2 ≥ comp).
  let degreeSum = 0;
  for (const id of comp) degreeSum += adj.get(id)?.length ?? 0;
  const enclosesRegion = degreeSum / 2 >= comp.size;

  const isCycle = [...comp].every(id => (adj.get(id)?.length ?? 0) === 2);
  let start = seedId;
  if (!isCycle) {
    for (const id of comp) {
      if ((adj.get(id)?.length ?? 0) < 2) { start = id; break; }
    }
  }

  const ordered: string[] = [];
  const oset = new Set<string>();
  let prev: string | null = null;
  let cur: string | null = start;
  while (cur !== null && !oset.has(cur)) {
    ordered.push(cur); oset.add(cur);
    const next: WallEdge | undefined = (adj.get(cur) ?? []).find(
      e => e.neighborId !== prev && !oset.has(e.neighborId),
    );
    prev = cur;
    cur = next ? next.neighborId : null;
  }
  const closed = isCycle && ordered.length === comp.size && ordered.length >= 3;
  return { ids: ordered, closed, enclosesRegion };
}
