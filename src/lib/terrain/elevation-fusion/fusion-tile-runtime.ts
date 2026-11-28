/**
 * ADR-920 §14.12 Β4 — **the fusion handler wired to a browser thread**: the archive is read with `pmtiles`, a coarse
 * tile is decoded through a canvas, and the mosaic leaves as an `ImageBitmap`. The worker and the main-thread safety
 * net both call {@link createBrowserFusionTileHost} — one handler, two threads.
 *
 * 🔑 **Pixels are data here, not colour**: every `createImageBitmap` is asked for no colour-space conversion and no
 * alpha premultiplication (`RAW_IMAGE_BITMAP_OPTIONS`). Β0 measured `createImageBitmap(ImageData)` at 0 differing bytes
 * in 1.048.576, in a worker and on the main thread.
 *
 * 🔑 **A canvas that lies is refused.** Some browsers alter `getImageData` on purpose (fingerprinting protection); a
 * coarse tile read through such a canvas would be wrong heights. The handler then fails by name instead of drawing them
 * — and the view is expected to ask `isElevationFusionSupported()` first and fall back to the plain archive.
 *
 * 🔑 **The archive is opened once per thread** (`PMTiles` keeps the header and the directory): every tile after the
 * first is one range request. The URL arrives as data from the catalogue (`CoarseArchiveRef`), never written here.
 *
 * @module lib/terrain/elevation-fusion/fusion-tile-runtime
 */

import { PMTiles } from 'pmtiles';

import { decodeTerrarium } from '@/lib/maps/elevation-terrarium';
import { canvasReadsPixelsFaithfully, decodeImagePixels, RAW_IMAGE_BITMAP_OPTIONS } from '@/lib/media/image-pixels';
import {
  LISTING_TERRAIN_FUSION_COARSE_CACHE_BYTES,
  LISTING_TERRAIN_FUSION_COARSE_TIMEOUT_MS,
  LISTING_TERRAIN_FUSION_TILE_CACHE_BYTES,
} from '@/lib/terrain/publication/listing-terrain-config';

import { createFusionCoarseReader, type CoarseTileLoad } from './fusion-coarse-reader';
import { createFusionTileHost, type FusionThread, type FusionTileHandler, type FusionTileReply } from './fusion-tile-host';

/** The error of a thread whose canvas does not return the pixels that were written. */
export const FUSION_CANVAS_UNFAITHFUL = 'terrain-fusion-canvas-unfaithful';

/** Can THIS thread turn pixels into an image and read an image back as the bytes it holds? */
export function fusionRuntimeSupported(): boolean {
  return typeof createImageBitmap === 'function' && typeof ImageData !== 'undefined' && canvasReadsPixelsFaithfully();
}

function createArchiveLoad(): CoarseTileLoad {
  const archives = new Map<string, PMTiles>();
  const archiveOf = (url: string): PMTiles => {
    const known = archives.get(url);
    if (known !== undefined) return known;
    const opened = new PMTiles(url);
    archives.set(url, opened);
    return opened;
  };
  return async (archive, address, signal) => {
    if (!canvasReadsPixelsFaithfully()) throw new Error(FUSION_CANVAS_UNFAITHFUL);
    const response = await archiveOf(archive.url).getZxy(address.z, address.x, address.y, signal);
    if (response === undefined) return null;
    const pixels = await decodeImagePixels(new Blob([response.data]), RAW_IMAGE_BITMAP_OPTIONS);
    return decodeTerrarium(pixels.rgba);
  };
}

function encodeBitmap(rgba: Uint8ClampedArray<ArrayBuffer>, tileSizePx: number): Promise<ImageBitmap> {
  return createImageBitmap(new ImageData(rgba, tileSizePx, tileSizePx), RAW_IMAGE_BITMAP_OPTIONS);
}

export type BrowserFusionTileReply = FusionTileReply<ImageBitmap>;
export type BrowserFusionTileHandler = FusionTileHandler<ImageBitmap>;

/** The handler of this thread. */
export function createBrowserFusionTileHost(thread: FusionThread): BrowserFusionTileHandler {
  return createFusionTileHost<ImageBitmap>({
    reader: createFusionCoarseReader({
      load: createArchiveLoad(),
      maxBytes: LISTING_TERRAIN_FUSION_COARSE_CACHE_BYTES,
      timeoutMs: LISTING_TERRAIN_FUSION_COARSE_TIMEOUT_MS,
    }),
    encode: encodeBitmap,
    tileCacheBytes: LISTING_TERRAIN_FUSION_TILE_CACHE_BYTES,
    thread,
    now: () => performance.now(),
  });
}

/** What of a reply moves to the other thread instead of being copied. */
export function fusionReplyTransfer(reply: BrowserFusionTileReply): Transferable[] {
  return reply.kind === 'tile' ? [reply.image] : [];
}
