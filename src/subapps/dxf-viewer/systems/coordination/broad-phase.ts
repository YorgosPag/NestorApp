/**
 * ADR-435 — broad-phase (Slice 0).
 *
 * Uniform spatial-hash grid: each entity's (margin-inflated) AABB is hashed into
 * every cell it spans; candidate pairs are the entities that share a cell. This
 * filters the ~99% non-overlapping pairs in ~O(n) instead of the O(n²) all-pairs
 * scan that freezes the UI on a real building. Deterministic (no Date/random).
 *
 * @see ./aabb.ts
 */

import type { Aabb3, ClashEntity } from './clash-types';
import { aabbMaxExtent } from './aabb';

/** Result of a broad-phase pass — candidate index pairs plus scan diagnostics. */
export interface BroadPhaseResult {
  /** Unordered candidate pairs as `[i, j]` indices into the input array (i < j). */
  readonly pairs: ReadonlyArray<readonly [number, number]>;
  /** Effective grid cell size (m) chosen from the data. */
  readonly cellSizeM: number;
  /** Cells whose population blew past the safety cap (logged, never silently dropped). */
  readonly overflowCells: number;
}

/** Below this, two AABBs are treated as a degenerate point for grid sizing. */
const MIN_CELL_M = 0.25;
const MAX_CELL_M = 8;
/** Guard against a pathological dense cell turning broad-phase back into O(n²). */
const MAX_CELL_POPULATION = 512;

function cellKey(ix: number, iy: number, iz: number): string {
  return `${ix}|${iy}|${iz}`;
}

/** Median largest-extent of the boxes → a grid cell that holds a handful of entities. */
function chooseCellSize(boxes: readonly Aabb3[]): number {
  if (boxes.length === 0) return MIN_CELL_M;
  const extents = boxes.map(aabbMaxExtent).sort((a, b) => a - b);
  const median = extents[Math.floor(extents.length / 2)];
  if (!Number.isFinite(median) || median <= 0) return MIN_CELL_M;
  return Math.min(MAX_CELL_M, Math.max(MIN_CELL_M, median));
}

/**
 * Compute candidate pairs. `marginM` inflates every box so clearance candidates
 * (boxes that are merely *near*, not overlapping) still share a cell.
 */
export function broadPhasePairs(
  entities: readonly ClashEntity[],
  marginM = 0,
): BroadPhaseResult {
  const boxes = entities.map((e) => e.aabb);
  const cellSizeM = chooseCellSize(boxes);
  const grid = new Map<string, number[]>();
  let overflowCells = 0;

  for (let i = 0; i < entities.length; i++) {
    const b = boxes[i];
    const minX = Math.floor((b.min.x - marginM) / cellSizeM);
    const maxX = Math.floor((b.max.x + marginM) / cellSizeM);
    const minY = Math.floor((b.min.y - marginM) / cellSizeM);
    const maxY = Math.floor((b.max.y + marginM) / cellSizeM);
    const minZ = Math.floor((b.min.z - marginM) / cellSizeM);
    const maxZ = Math.floor((b.max.z + marginM) / cellSizeM);
    for (let ix = minX; ix <= maxX; ix++) {
      for (let iy = minY; iy <= maxY; iy++) {
        for (let iz = minZ; iz <= maxZ; iz++) {
          const key = cellKey(ix, iy, iz);
          const bucket = grid.get(key);
          if (bucket) bucket.push(i);
          else grid.set(key, [i]);
        }
      }
    }
  }

  const pairs = collectPairs(grid, () => { overflowCells++; });
  return { pairs, cellSizeM, overflowCells };
}

/** Emit deduped i<j pairs from same-cell co-occupants, capping pathological cells. */
function collectPairs(
  grid: ReadonlyMap<string, number[]>,
  onOverflow: () => void,
): ReadonlyArray<readonly [number, number]> {
  const seen = new Set<number>();
  const pairs: Array<readonly [number, number]> = [];
  for (const bucket of grid.values()) {
    if (bucket.length < 2) continue;
    const members = bucket.length > MAX_CELL_POPULATION
      ? (onOverflow(), bucket.slice(0, MAX_CELL_POPULATION))
      : bucket;
    for (let a = 0; a < members.length; a++) {
      for (let b = a + 1; b < members.length; b++) {
        const i = Math.min(members[a], members[b]);
        const j = Math.max(members[a], members[b]);
        const token = i * 1_000_003 + j; // dedupe across cells (boxes span many)
        if (seen.has(token)) continue;
        seen.add(token);
        pairs.push([i, j]);
      }
    }
  }
  return pairs;
}
