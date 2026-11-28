/**
 * ADR-920 §14.12 Β4 — **the handler behind the `terrain-fusion://` protocol**: what runs inside the Web Worker and, as
 * the safety net, on the main thread — the SAME code.
 *
 *   `surface`    ─▶ build the fusion surface of a snapshot ONCE, keep it under its key
 *   `tile`       ─▶ read the coarse tiles the mosaic needs ─▶ `composeFusedElevationTile` ─▶ an image, ready for the map
 *   `elevations` ─▶ `fusedElevationAt` at given points (the exact road) — the number that belongs to the drawn ground
 *   `forget`     ─▶ drop a surface and its mosaics
 *
 * 🔑 **The surface is built here, never sent.** A `TerrainFusionSurface` holds functions (the projection, the indexes),
 * so it cannot cross a thread; the snapshot is plain data and can. A handler that does not know a key answers
 * `need-surface` — the protocol then sends the snapshot and asks again. The same rule serves the worker, the safety net
 * and a worker that was started anew.
 *
 * 🔑 **A tile carries the key of its surface.** It is composed with THAT surface or not at all: a late request of an old
 * survey can never be painted with a new one.
 *
 * 🔑 **Never an empty tile.** A tile the archive does not have is 0 m with provenance `none` (the composer's rule). A
 * tile the archive could not DELIVER is an error, not a flat tile: a made-up sea level would stay in the map's memory as
 * ground.
 *
 * 🔑 **A mosaic that was finished is kept** (bounded by bytes): the map cancels and asks again as the camera moves, and
 * composing is synchronous — once started it runs to its end. Same input ⇒ same bytes, so the memory is exact.
 *
 * 🔑 **Safe to interleave.** Requests overlap only at an `await` (reading the archive, encoding); everything the pure
 * core keeps between calls is used within one synchronous stretch.
 *
 * No DOM, no MapLibre, no I/O of its own: the archive reader and the encoder are injected (`fusion-tile-runtime.ts`).
 *
 * @module lib/terrain/elevation-fusion/fusion-tile-host
 */

import { createBoundedLru } from '@/lib/cache/bounded-lru';
import { archiveTileOf, type ArchiveTileAddress } from '@/lib/geo/osm/osm-archive-tile';
import type { ListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-types';
import type { WorkerRpcContext } from '@/lib/workers/worker-rpc-protocol';
import type { GeoPoint } from '@/types/geo/coordinates';

import {
  coarseFieldOf,
  coarseNeighbourhoodOf,
  coarseTilesNeededFor,
  type CoarseElevationField,
  type CoarseElevationTile,
} from './coarse-elevation-field';
import {
  fusionAbortError,
  type CoarseArchiveRef,
  type CoarseReadingOrigin,
  type FusionCoarseReader,
} from './fusion-coarse-reader';
import { fusedElevationAt, type FusedElevation, type TerrainElevationProvenance } from './terrain-fused-elevation';
import { terrainFusionSurfaceOf, type TerrainFusionSurface } from './terrain-fusion-surface';
import { composeFusedElevationTile } from './terrain-fusion-tile';

export type FusionTileRequest =
  | { readonly kind: 'tile'; readonly surface: string; readonly tile: ArchiveTileAddress; readonly archive: CoarseArchiveRef }
  | { readonly kind: 'surface'; readonly surface: string; readonly snapshot: ListingTerrainSnapshot; readonly transitionM: number }
  | { readonly kind: 'forget'; readonly surface: string }
  /** `surface: null` ⇒ the coarse ground alone. */
  | { readonly kind: 'elevations'; readonly surface: string | null; readonly archive: CoarseArchiveRef; readonly points: readonly GeoPoint[] };

/** Which thread answered — the worker, or the safety net on the main thread. */
export type FusionThread = 'worker' | 'main';

export interface FusionTileTiming {
  /** Waiting for the coarse tiles (0 when all were in memory). */
  readonly coarseMs: number;
  /** The mosaic itself (0 when it came from memory). */
  readonly composeMs: number;
  /** Bytes → image. */
  readonly encodeMs: number;
}

/** `I` = the image the map receives (`ImageBitmap` in a browser). */
export interface FusionTileAnswer<I> {
  readonly kind: 'tile';
  readonly image: I;
  /** Pixels per provenance — they sum to `tileSizePx²`. */
  readonly pixels: Readonly<Record<TerrainElevationProvenance, number>>;
  /** Coarse tiles read for this mosaic, by where they came from — the archive requests a worker makes are counted here. */
  readonly coarse: Readonly<Record<CoarseReadingOrigin, number>>;
  /** The mosaic was already composed (an earlier, cancelled or repeated, request). */
  readonly fromMemory: boolean;
  readonly thread: FusionThread;
  readonly timing: FusionTileTiming;
}

export type FusionTileReply<I> =
  | FusionTileAnswer<I>
  | { readonly kind: 'need-surface'; readonly surface: string }
  | { readonly kind: 'elevations'; readonly elevations: readonly FusedElevation[] }
  | { readonly kind: 'done' };

export type FusionTileHandler<I> = (request: FusionTileRequest, context: Pick<WorkerRpcContext<never>, 'signal'>) => Promise<FusionTileReply<I>>;

export interface FusionTileHostOptions<I> {
  readonly reader: FusionCoarseReader;
  /** `tileSizePx² × 4` Terrarium bytes → the image handed to the map. Must not keep or detach `rgba`. */
  readonly encode: (rgba: Uint8ClampedArray<ArrayBuffer>, tileSizePx: number) => Promise<I>;
  readonly tileCacheBytes: number;
  readonly thread: FusionThread;
  /** Milliseconds, monotonic (`performance.now`). */
  readonly now: () => number;
}

interface ComposedTile {
  readonly surface: string;
  readonly rgba: Uint8ClampedArray<ArrayBuffer>;
  readonly pixels: Readonly<Record<TerrainElevationProvenance, number>>;
}

interface CoarseAround {
  readonly field: CoarseElevationField | null;
  readonly origins: Record<CoarseReadingOrigin, number>;
}

/** Reads the given coarse tiles (the primary first) and makes the field around the primary; `null` field ⇒ no primary. */
async function readCoarse(
  reader: FusionCoarseReader,
  archive: CoarseArchiveRef,
  addresses: readonly ArchiveTileAddress[],
  signal: AbortSignal,
): Promise<CoarseAround> {
  const readings = await Promise.all(addresses.map((address) => reader.read(archive, address, signal)));
  const origins: Record<CoarseReadingOrigin, number> = { memory: 0, network: 0, shared: 0 };
  const tiles: CoarseElevationTile[] = [];
  for (const { address, heights, origin } of readings) {
    origins[origin]++;
    if (heights !== null) tiles.push({ address, heights });
  }
  const field = readings[0].heights === null ? null : coarseFieldOf(readings[0].address, archive.tileSizePx, tiles);
  return { field, origins };
}

/** The mosaics already composed, bounded by bytes, and which of them belong to each surface. */
function createTileMemory(maxBytes: number) {
  const bySurface = new Map<string, Set<string>>();
  const tiles = createBoundedLru<ComposedTile>({
    maxWeight: maxBytes,
    weigh: (tile) => tile.rgba.byteLength,
    onEvict: (tile, key) => bySurface.get(tile.surface)?.delete(key),
  });
  return {
    get: (key: string): ComposedTile | undefined => tiles.get(key),
    set: (key: string, tile: ComposedTile): void => {
      tiles.set(key, tile);
      if (!tiles.has(key)) return;
      const keys = bySurface.get(tile.surface) ?? new Set<string>();
      bySurface.set(tile.surface, keys.add(key));
    },
    forget: (surface: string): void => {
      for (const key of [...(bySurface.get(surface) ?? [])]) tiles.delete(key);
      bySurface.delete(surface);
    },
  };
}

/** **The handler** — one per thread, holding its surfaces and its mosaics. */
export function createFusionTileHost<I>(options: FusionTileHostOptions<I>): FusionTileHandler<I> {
  const { reader, encode, thread, now } = options;
  /** `null` = a snapshot without georeference: there is nothing to fuse, the tile is the coarse ground. */
  const surfaces = new Map<string, TerrainFusionSurface | null>();
  const memory = createTileMemory(options.tileCacheBytes);

  type TileRequest = Extract<FusionTileRequest, { kind: 'tile' }>;

  const compose = async (request: TileRequest, surface: TerrainFusionSurface | null, signal: AbortSignal) => {
    const { tile, archive } = request;
    const t0 = now();
    const needed = coarseTilesNeededFor(tile, archive.tileSizePx, archive.maxZoom, archive.tileSizePx);
    const { field, origins } = await readCoarse(reader, archive, needed, signal);
    const t1 = now();
    // The last moment a cancelled request costs nothing: from here the mosaic runs to its end.
    if (signal.aborted) throw fusionAbortError();
    const { rgba, pixels } = composeFusedElevationTile({ tile, tileSizePx: archive.tileSizePx, coarse: field, surface });
    return { composed: { surface: request.surface, rgba, pixels }, origins, coarseMs: t1 - t0, composeMs: now() - t1 };
  };

  const answerTile = async (request: TileRequest, signal: AbortSignal): Promise<FusionTileReply<I>> => {
    if (!surfaces.has(request.surface)) return { kind: 'need-surface', surface: request.surface };
    const { tile, archive } = request;
    const key = `${request.surface}|${archive.url}|${tile.z}/${tile.x}/${tile.y}`;
    const remembered = memory.get(key);
    const fresh = remembered === undefined ? await compose(request, surfaces.get(request.surface) ?? null, signal) : null;
    const composed = remembered ?? fresh?.composed;
    if (composed === undefined) throw new Error('terrain-fusion: no mosaic');
    if (fresh !== null) memory.set(key, composed);
    if (signal.aborted) throw fusionAbortError();
    const t2 = now();
    const image = await encode(composed.rgba, archive.tileSizePx);
    return {
      kind: 'tile',
      image,
      pixels: composed.pixels,
      coarse: fresh?.origins ?? { memory: 0, network: 0, shared: 0 },
      fromMemory: fresh === null,
      thread,
      timing: { coarseMs: fresh?.coarseMs ?? 0, composeMs: fresh?.composeMs ?? 0, encodeMs: now() - t2 },
    };
  };

  const answerElevations = async (
    request: Extract<FusionTileRequest, { kind: 'elevations' }>,
    signal: AbortSignal,
  ): Promise<FusionTileReply<I>> => {
    const { archive } = request;
    if (request.surface !== null && !surfaces.has(request.surface)) return { kind: 'need-surface', surface: request.surface };
    const surface = request.surface === null ? null : surfaces.get(request.surface) ?? null;
    const elevations: FusedElevation[] = [];
    for (const point of request.points) {
      const primary = archiveTileOf(point, archive.maxZoom);
      const { field } = await readCoarse(reader, archive, coarseNeighbourhoodOf(primary), signal);
      elevations.push(fusedElevationAt(surface, field, point));
    }
    return { kind: 'elevations', elevations };
  };

  return async (request, { signal }) => {
    switch (request.kind) {
      case 'tile':
        return answerTile(request, signal);
      case 'elevations':
        return answerElevations(request, signal);
      case 'surface':
        memory.forget(request.surface);
        surfaces.set(request.surface, terrainFusionSurfaceOf(request.snapshot, request.transitionM));
        return { kind: 'done' };
      case 'forget':
        memory.forget(request.surface);
        surfaces.delete(request.surface);
        return { kind: 'done' };
    }
  };
}
