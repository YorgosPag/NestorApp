/**
 * ADR-650 / ADR-718 — the vertex table of a TIN under construction, deduped on ONE micrometre grid.
 *
 * Its own module (ADR-920 Β4.8 Τ) because three builders now feed it: the TIN builder, the breakline resolver (which
 * inserts crossing nodes) and ADR-718's surface crop. `tin-builder` re-exports everything here, so existing importers
 * are unchanged.
 */

import type { TinPosition } from './terrain-types';

/**
 * Micrometre-grid key so coincident survey/breakline vertices merge to one TIN node.
 * Exported as the SSoT for «which LOCAL grid cell is this vertex in» — the QA topology
 * pass (ADR-650 M5α) reuses it to match a TIN edge back to a breakline segment, so the
 * two can never round differently and disagree about coincidence.
 */
export function localVertexKey(localX: number, localY: number): string {
  return `${Math.round(localX * 1000)}:${Math.round(localY * 1000)}`;
}

/**
 * The growing vertex table of a TIN under construction. Exported (with its factory and
 * {@link pushVertex}) because ADR-718's surface crop assembles a SECOND TIN from clipped triangle
 * pieces and must dedup on the **same** micrometre grid — two dedup rules would let the crop merge
 * vertices the builder kept apart (or the reverse), and the two surfaces would disagree about
 * where a shared edge is.
 */
export interface CollectedVertices {
  readonly positions: TinPosition[];
  readonly elevations: number[];
  readonly keyToIndex: Map<string, number>;
}

/** An empty vertex table. */
export function createVertexAccumulator(): CollectedVertices {
  return { positions: [], elevations: [], keyToIndex: new Map() };
}

/** Planimetric bounds of LOCAL positions (`Infinity`/`-Infinity` when empty) — ONE loop for the builder and the grid. */
export function planarBoundsOf(positions: readonly TinPosition[]): {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
} {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of positions) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** Add one LOCAL vertex (deduped by grid key), returning its index. */
export function pushVertex(acc: CollectedVertices, localX: number, localY: number, z: number): number {
  const key = localVertexKey(localX, localY);
  const existing = acc.keyToIndex.get(key);
  if (existing !== undefined) return existing;
  const index = acc.positions.length;
  acc.positions.push([localX, localY]);
  acc.elevations.push(z);
  acc.keyToIndex.set(key, index);
  return index;
}
