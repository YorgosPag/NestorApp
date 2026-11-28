/**
 * ADR-920 §14.12 Β4 — **the reader of the coarse elevation archive**: «the decoded heights of this tile», once.
 *
 *   in memory            ─▶ the heights, at once
 *   being read           ─▶ the SAME promise, joined
 *   neither              ─▶ one load (fetch + decode), under a deadline
 *
 * 🔑 **One load per tile, however many ask.** Neighbouring output tiles need the same coarse tiles; the second asker
 * joins the load of the first.
 *
 * 🔑 **Cancellation counts the waiters** (the `AsyncCache` of maplibre-contour): when one of several askers cancels, the
 * load goes on for the others; it is aborted only when the LAST one leaves. A caller's `signal` therefore never kills
 * a download another tile is waiting for.
 *
 * 🔑 **Only a success is remembered.** A failed, timed-out or abandoned load leaves nothing behind — the next ask reads
 * the network again. «The archive has no tile here» IS a success (`heights: null`) and is remembered as such.
 *
 * 🔑 **Bounded by bytes** (`bounded-lru.ts`): a decoded tile of 512² is a megabyte.
 *
 * Pure of I/O: the load itself (`CoarseTileLoad`) is injected — the worker and the main-thread safety net pass the same
 * one (`fusion-tile-runtime.ts`), a test passes a table.
 *
 * @module lib/terrain/elevation-fusion/fusion-coarse-reader
 */

import { createDeadline, linkedAbortSignal, TimeoutError } from '@/lib/async-utils';
import { createBoundedLru } from '@/lib/cache/bounded-lru';
import type { ArchiveTileAddress } from '@/lib/geo/osm/osm-archive-tile';

/** The coarse archive as data — it crosses into the worker. Built from the catalogue, never written here. */
export interface CoarseArchiveRef {
  /** `https://…` (without the `pmtiles://` scheme). */
  readonly url: string;
  /** The deepest level of the archive. */
  readonly maxZoom: number;
  /** Pixels per side of its tiles. */
  readonly tileSizePx: number;
}

/** Heights in metres, row by row from the north — or `null` when the archive has no tile at that address. */
export type CoarseTileHeights = Float32Array | null;

/** Fetch + decode of one tile. Rejects on a network or decoding failure; resolves `null` for «no such tile». */
export type CoarseTileLoad = (archive: CoarseArchiveRef, address: ArchiveTileAddress, signal: AbortSignal) => Promise<CoarseTileHeights>;

/** Where a reading came from: this reader's memory, a load this ask started, or a load another ask had started. */
export type CoarseReadingOrigin = 'memory' | 'network' | 'shared';

export interface CoarseTileReading {
  readonly address: ArchiveTileAddress;
  readonly heights: CoarseTileHeights;
  readonly origin: CoarseReadingOrigin;
}

export interface FusionCoarseReader {
  /** Rejects with an `AbortError` when `signal` aborts first, with a `TimeoutError` when the deadline passes. */
  readonly read: (archive: CoarseArchiveRef, address: ArchiveTileAddress, signal: AbortSignal) => Promise<CoarseTileReading>;
}

export interface FusionCoarseReaderOptions {
  readonly load: CoarseTileLoad;
  readonly maxBytes: number;
  readonly timeoutMs: number;
}

/** The error MapLibre recognises as «the request was cancelled» (`isAbortError`: an `Error` named `AbortError`). */
export function fusionAbortError(): Error {
  const error = new Error('terrain-fusion: request aborted');
  error.name = 'AbortError';
  return error;
}

/** Weight of a remembered «no tile here»: it holds no heights, but it must still be evictable. */
const ABSENT_WEIGHT_BYTES = 64;

interface Flight {
  readonly promise: Promise<CoarseTileHeights>;
  readonly abandon: () => void;
  waiting: number;
}

export function createFusionCoarseReader(options: FusionCoarseReaderOptions): FusionCoarseReader {
  const { load, timeoutMs } = options;
  const settled = createBoundedLru<{ readonly heights: CoarseTileHeights }>({
    maxWeight: options.maxBytes,
    weigh: ({ heights }) => heights?.byteLength ?? ABSENT_WEIGHT_BYTES,
  });
  const flights = new Map<string, Flight>();

  const start = (key: string, archive: CoarseArchiveRef, address: ArchiveTileAddress): Flight => {
    const deadline = createDeadline(timeoutMs);
    const abandoned = new AbortController();
    const promise = load(archive, address, linkedAbortSignal(deadline.signal, abandoned.signal))
      .then((heights) => {
        if (heights !== null && heights.length !== archive.tileSizePx * archive.tileSizePx) {
          throw new Error(`terrain-fusion: coarse tile of ${heights.length} heights, expected ${archive.tileSizePx}²`);
        }
        settled.set(key, { heights });
        return heights;
      }, (error: unknown) => {
        throw deadline.signal.aborted && !abandoned.signal.aborted ? new TimeoutError(timeoutMs) : error;
      })
      .finally(() => {
        deadline.dispose();
        if (flights.get(key) === flight) flights.delete(key);
      });
    // A load every waiter has left rejects with nobody listening; that is not an unhandled error.
    promise.catch(() => undefined);
    const flight: Flight = { promise, abandon: () => abandoned.abort(), waiting: 0 };
    flights.set(key, flight);
    return flight;
  };

  const join = (flight: Flight, key: string, signal: AbortSignal): Promise<CoarseTileHeights> =>
    new Promise((resolve, reject) => {
      flight.waiting++;
      const onAbort = (): void => {
        if (--flight.waiting <= 0 && flights.get(key) === flight) {
          flights.delete(key);
          flight.abandon();
        }
        reject(fusionAbortError());
      };
      signal.addEventListener('abort', onAbort, { once: true });
      const settle = (): void => signal.removeEventListener('abort', onAbort);
      flight.promise.then((heights) => { settle(); resolve(heights); }, (error: unknown) => { settle(); reject(error); });
    });

  return {
    read: async (archive, address, signal) => {
      if (signal.aborted) throw fusionAbortError();
      const key = `${archive.url}#${address.z}/${address.x}/${address.y}`;
      const known = settled.get(key);
      if (known !== undefined) return { address, heights: known.heights, origin: 'memory' };
      const flying = flights.get(key);
      const flight = flying ?? start(key, archive, address);
      return { address, heights: await join(flight, key, signal), origin: flying === undefined ? 'network' : 'shared' };
    },
  };
}
