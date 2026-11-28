/**
 * ADR-920 §14.12 Β3 — **the elevation mosaic of one tile**: `(z, x, y)` + survey + coarse field → Terrarium pixels.
 *
 * 🔑 **Every pixel is the fused ground at the CENTRE of that pixel** (`fuseElevationInto`, a pure function of the
 * point). MapLibre reads DEM pixels as cell centres (since 6.9.1) and back-fills each tile's border from its
 * neighbour, so two tiles — and two zoom levels at or beyond the archive's deepest — describe one surface.
 *
 * 🔑 **Never empty, always the same size.** A tile without coarse data is 0 m everywhere, not a missing tile (an empty
 * answer drops the terrain to a z ≤ 5 ancestor), and every tile has `tileSizePx²` pixels (MapLibre throws `dem dimension
 * mismatch` otherwise). The size is the caller's: it is the `tileSizePx` of the elevation source (`basemap-catalog.ts`).
 *
 * 🔑 **The cheap road is the common one.** Β0 measured that most requested tiles do not touch the plot (and many are
 * shallow levels): a tile whose box misses the survey's reach never asks the survey anything.
 *
 * 🔑 **The tile takes the lattice road into the survey's frame** (Β3.1): the same `fuseElevationInto`, with the survey's
 * measured lattice of the projection instead of the projection itself. Measured in plain Node, 512²: a tile half in the
 * transition zone fell from 1.139 ms to 57 ms, one that misses the survey from ~75 ms to 13 ms (ADR-920 §14.12 «βήμα
 * Β3.1», with the limits of that measurement). The exact road remains the definition the tile is tested against, pixel
 * by pixel.
 *
 * The output is bytes, not an image: turning them into an `ImageBitmap` is the protocol's business (Β4), in a worker.
 *
 * Pure and deterministic: the same inputs give the same bytes, on the main thread and in a worker alike.
 *
 * @module lib/terrain/elevation-fusion/terrain-fusion-tile
 */

import type { ArchiveTileAddress } from '@/lib/geo/osm/osm-archive-tile';
import { TERRARIUM_BYTES_PER_PIXEL, writeTerrarium } from '@/lib/maps/elevation-terrarium';
import { MAPLIBRE_TILE_SIZE_PX, worldPixelToLngLat } from '@/lib/maps/metric-size';

import type { CoarseElevationField } from './coarse-elevation-field';
import { createFusedElevationSink, fuseElevationInto, type TerrainElevationProvenance } from './terrain-fused-elevation';
import type { TerrainFusionSurface } from './terrain-fusion-surface';

export interface FusedElevationTileRequest {
  readonly tile: ArchiveTileAddress;
  /** Pixels per side — the `tileSizePx` of the elevation source. */
  readonly tileSizePx: number;
  /** The coarse field around this tile (`coarsePrimaryFor`), or `null` when the archive has nothing here. */
  readonly coarse: CoarseElevationField | null;
  /** The survey, or `null` when there is none to fuse (the tile is then a resampling of the coarse model). */
  readonly surface: TerrainFusionSurface | null;
}

export interface FusedElevationTile {
  /** `tileSizePx² × 4` bytes, Terrarium, opaque, first row = north. */
  readonly rgba: Uint8ClampedArray<ArrayBuffer>;
  /** How many pixels took their height from each provenance — they sum to `tileSizePx²`. */
  readonly pixels: Readonly<Record<TerrainElevationProvenance, number>>;
}

/** Mercator coordinate (in [0, 1]) of the centre of pixel `i` of a tile at index `tileIndex` of a level `n` tiles wide. */
function centreOf(tileIndex: number, i: number, tileSizePx: number, n: number): number {
  return (tileIndex + (i + 0.5) / tileSizePx) / n;
}

const lngOf = (u: number): number => worldPixelToLngLat(u * MAPLIBRE_TILE_SIZE_PX, 0, 0)[0];
const latOf = (v: number): number => worldPixelToLngLat(0, v * MAPLIBRE_TILE_SIZE_PX, 0)[1];

/** Does the box of the tile touch the reach of the survey on the earth? */
function touchesSurvey(tile: ArchiveTileAddress, surface: TerrainFusionSurface): boolean {
  const n = 2 ** tile.z;
  const { west, east, south, north } = surface.geoReach;
  return lngOf((tile.x + 1) / n) >= west && lngOf(tile.x / n) <= east
    && latOf(tile.y / n) >= south && latOf((tile.y + 1) / n) <= north;
}

/** The mosaic of one tile. */
export function composeFusedElevationTile(request: FusedElevationTileRequest): FusedElevationTile {
  const { tile, tileSizePx, coarse } = request;
  const surface = request.surface !== null && touchesSurvey(tile, request.surface) ? request.surface : null;
  const n = 2 ** tile.z;
  const us = Float64Array.from({ length: tileSizePx }, (_, column) => centreOf(tile.x, column, tileSizePx, n));
  const lngs = us.map(lngOf);
  const rgba = new Uint8ClampedArray(tileSizePx * tileSizePx * TERRARIUM_BYTES_PER_PIXEL);
  const pixels: Record<TerrainElevationProvenance, number> = { measured: 0, interpolated: 0, indicative: 0, none: 0 };
  // One sink and one point for the whole tile: a quarter of a million pixels, no allocation per pixel.
  const sink = createFusedElevationSink();
  const point = { u: 0, v: 0, lng: 0, lat: 0 };
  for (let row = 0; row < tileSizePx; row++) {
    point.v = centreOf(tile.y, row, tileSizePx, n);
    point.lat = latOf(point.v);
    for (let column = 0; column < tileSizePx; column++) {
      point.u = us[column];
      point.lng = lngs[column];
      fuseElevationInto(sink, surface, coarse, point, 'lattice');
      writeTerrarium(rgba, (row * tileSizePx + column) * TERRARIUM_BYTES_PER_PIXEL, sink.elevationM);
      pixels[sink.provenance]++;
    }
  }
  return { rgba, pixels };
}
