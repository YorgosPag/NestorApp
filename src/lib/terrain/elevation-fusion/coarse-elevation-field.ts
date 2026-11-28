/**
 * ADR-920 §14.12 Β3 — **the coarse ground as a field**: «how high is the regional elevation model at this point?».
 *
 *   decoded tiles of ONE level (the tile holding the point + its neighbours) ─▶ bilinear reading at Mercator (u, v)
 *
 * 🔑 **A pure function of the point, per level.** The reading is done in the GLOBAL pixel grid of the level (pixel
 * centres at half-integers), never in the grid of the tile being produced. Every output tile at or beyond the deepest
 * level of the archive therefore reads the SAME surface, and two neighbouring output tiles agree on their common edge.
 *
 * 🔑 **It reads across tile borders.** The four pixels around a point may sit in up to four tiles. The prototype of Β0
 * clamped at the border of the coarse tile, which breaks the slope along every z12 seam; here the neighbour is read, and
 * only a neighbour that is really MISSING (outside the archive) falls back to the border pixel of the tile holding the
 * point.
 *
 * ⚠️ **Shallower levels are other surfaces.** A pyramid level is a resampling of the one below it, so the reading at
 * z10 is not the reading at z12 — a property of every tile pyramid. Below the archive's deepest level an output tile
 * reads its own level (where its pixel centres coincide with the archive's: the reading is then the pixel itself).
 *
 * ⚠️ No wrap across the antimeridian: columns outside the world are «missing». The archive is Greece.
 *
 * Pure: no I/O, no decoding (that is `lib/maps/elevation-terrarium.ts`), runs in a worker.
 *
 * @module lib/terrain/elevation-fusion/coarse-elevation-field
 */

import type { ArchiveTileAddress } from '@/lib/geo/osm/osm-archive-tile';

/** One decoded tile of the coarse archive: heights in metres, row by row from the north, `tileSizePx²` values. */
export interface CoarseElevationTile {
  readonly address: ArchiveTileAddress;
  readonly heights: Float32Array;
}

/** The neighbourhood is 3 × 3 tiles around the one that holds the point. */
const BLOCKS_PER_AXIS = 3;

export interface CoarseElevationField {
  /** The tile the readings are for; its neighbours serve only the pixels across its borders. */
  readonly primary: ArchiveTileAddress;
  readonly tileSizePx: number;
  /** Row-major 3 × 3 around {@link primary} (index 4 = the primary itself); `null` where the archive has no tile. */
  readonly blocks: readonly (Float32Array | null)[];
  /** Pixels across the whole world at the level of {@link primary} — `2^z · tileSizePx`, worked out once per field. */
  readonly pixelsPerWorld: number;
}

/** The level of the coarse archive an output tile of level `z` reads: its own, or the archive's deepest. */
export function coarseLevelFor(z: number, archiveMaxZoom: number): number {
  return Math.min(z, archiveMaxZoom);
}

/** The coarse tile that holds an output tile (its ancestor at the level it reads, or itself). */
export function coarsePrimaryFor(tile: ArchiveTileAddress, archiveMaxZoom: number): ArchiveTileAddress {
  const z = coarseLevelFor(tile.z, archiveMaxZoom);
  const shift = 2 ** (tile.z - z);
  return { z, x: Math.floor(tile.x / shift), y: Math.floor(tile.y / shift) };
}

/**
 * Every coarse tile a reading inside `primary` may touch: the primary first, then its existing neighbours (the world
 * has no tile beyond its edge). The caller fetches what it can; what is missing stays out of the field.
 */
export function coarseNeighbourhoodOf(primary: ArchiveTileAddress): ArchiveTileAddress[] {
  const last = 2 ** primary.z - 1;
  const out: ArchiveTileAddress[] = [primary];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = primary.x + dx;
      const y = primary.y + dy;
      if ((dx !== 0 || dy !== 0) && x >= 0 && x <= last && y >= 0 && y <= last) out.push({ z: primary.z, x, y });
    }
  }
  return out;
}

/**
 * The coarse tiles the mosaic of ONE output tile actually reads (Β4): the primary first, then only the neighbours a
 * pixel of that output tile can reach. {@link coarseNeighbourhoodOf} is the superset every reading inside the primary
 * may touch; an output tile is a small window of it, and most windows never leave the primary.
 *
 * 🔑 **Same bytes as the full neighbourhood.** The range is worked out from the centres of the first and last pixel of
 * the output tile — the very expressions the composer evaluates — in the global pixel grid of the coarse level. A
 * neighbour left out is one no reading gives any weight: at or below the archive's deepest level the pixel centres of an
 * output tile of the same size ARE the archive's (the fraction is exactly `0`, all the arithmetic is in powers of two),
 * so its right and bottom neighbours would be multiplied by zero.
 *
 * `tileSizePx` = pixels per side of the OUTPUT tile; `coarseTileSizePx` = of the archive's tiles.
 */
export function coarseTilesNeededFor(
  tile: ArchiveTileAddress,
  tileSizePx: number,
  archiveMaxZoom: number,
  coarseTileSizePx: number,
): ArchiveTileAddress[] {
  const primary = coarsePrimaryFor(tile, archiveMaxZoom);
  const lastIndex = 2 ** primary.z - 1;
  const n = 2 ** tile.z;
  const pixelsPerWorld = 2 ** primary.z * coarseTileSizePx;
  /** The tiles (along one axis) holding the coarse pixels the output pixels `0 … tileSizePx − 1` read. */
  const span = (tileIndex: number): readonly [number, number] => {
    const first = ((tileIndex + 0.5 / tileSizePx) / n) * pixelsPerWorld - 0.5;
    const last = ((tileIndex + (tileSizePx - 0.5) / tileSizePx) / n) * pixelsPerWorld - 0.5;
    const from = Math.floor(Math.floor(first) / coarseTileSizePx);
    const to = Math.floor(Math.ceil(last) / coarseTileSizePx);
    return [Math.max(0, from), Math.min(lastIndex, to)];
  };
  const [x0, x1] = span(tile.x);
  const [y0, y1] = span(tile.y);
  const out: ArchiveTileAddress[] = [primary];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (x !== primary.x || y !== primary.y) out.push({ z: primary.z, x, y });
    }
  }
  return out;
}

/**
 * The field around `primary` from whatever tiles were read. Tiles of another level, outside the 3 × 3 neighbourhood or
 * of another size are ignored — they cannot be part of this surface.
 */
export function coarseFieldOf(
  primary: ArchiveTileAddress,
  tileSizePx: number,
  tiles: readonly CoarseElevationTile[],
): CoarseElevationField {
  const blocks = new Array<Float32Array | null>(BLOCKS_PER_AXIS * BLOCKS_PER_AXIS).fill(null);
  for (const { address, heights } of tiles) {
    const dx = address.x - primary.x;
    const dy = address.y - primary.y;
    if (address.z !== primary.z || Math.abs(dx) > 1 || Math.abs(dy) > 1) continue;
    if (heights.length !== tileSizePx * tileSizePx) continue;
    blocks[(dy + 1) * BLOCKS_PER_AXIS + (dx + 1)] = heights;
  }
  return { primary, tileSizePx, blocks, pixelsPerWorld: 2 ** primary.z * tileSizePx };
}

/** The height of global pixel (ix, iy) of the level, or `null` when its tile is not in the field. */
function pixelAt(field: CoarseElevationField, ix: number, iy: number): number | null {
  const { primary, tileSizePx, blocks } = field;
  const bx = Math.floor(ix / tileSizePx) - primary.x + 1;
  const by = Math.floor(iy / tileSizePx) - primary.y + 1;
  if (bx < 0 || bx >= BLOCKS_PER_AXIS || by < 0 || by >= BLOCKS_PER_AXIS) return null;
  const block = blocks[by * BLOCKS_PER_AXIS + bx];
  if (block === null) return null;
  const col = ix - (primary.x + bx - 1) * tileSizePx;
  const row = iy - (primary.y + by - 1) * tileSizePx;
  return block[row * tileSizePx + col];
}

/** Pixel (ix, iy), or — when its tile is missing — the nearest pixel of the primary tile. */
function pixelOrBorder(field: CoarseElevationField, primaryHeights: Float32Array, ix: number, iy: number): number {
  const direct = pixelAt(field, ix, iy);
  if (direct !== null) return direct;
  const { primary, tileSizePx } = field;
  const col = Math.min(tileSizePx - 1, Math.max(0, ix - primary.x * tileSizePx));
  const row = Math.min(tileSizePx - 1, Math.max(0, iy - primary.y * tileSizePx));
  return primaryHeights[row * tileSizePx + col];
}

/**
 * The coarse elevation at Mercator (u, v) — both in [0, 1], v from the north — in metres; `null` when the archive has
 * no tile for the point («no data here», never a silent zero). The point is expected inside the primary tile.
 */
export function coarseElevationAt(field: CoarseElevationField, u: number, v: number): number | null {
  const primaryHeights = field.blocks[(BLOCKS_PER_AXIS * BLOCKS_PER_AXIS - 1) / 2];
  if (primaryHeights === null) return null;
  const { pixelsPerWorld } = field;
  // Pixel centres sit at half-integers of the global grid.
  const gx = u * pixelsPerWorld - 0.5;
  const gy = v * pixelsPerWorld - 0.5;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  // The common case, read directly: all four pixels inside the primary tile (Β3.1 — measured 0,17–0,30 µs per reading
  // through the general road below, which resolves the 3 × 3 block four times). Same pixels, same blend, same bits.
  const { tileSizePx } = field;
  const column = x0 - field.primary.x * tileSizePx;
  const row = y0 - field.primary.y * tileSizePx;
  if (column >= 0 && row >= 0 && column < tileSizePx - 1 && row < tileSizePx - 1) {
    const at = row * tileSizePx + column;
    const north = primaryHeights[at] * (1 - fx) + primaryHeights[at + 1] * fx;
    const south = primaryHeights[at + tileSizePx] * (1 - fx) + primaryHeights[at + tileSizePx + 1] * fx;
    return north * (1 - fy) + south * fy;
  }
  const top = pixelOrBorder(field, primaryHeights, x0, y0) * (1 - fx) + pixelOrBorder(field, primaryHeights, x0 + 1, y0) * fx;
  const bottom = pixelOrBorder(field, primaryHeights, x0, y0 + 1) * (1 - fx) + pixelOrBorder(field, primaryHeights, x0 + 1, y0 + 1) * fx;
  return top * (1 - fy) + bottom * fy;
}
