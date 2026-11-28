/**
 * ADR-920 §14.12 Β4 — **the `terrain-fusion://` protocol, main-thread side**: the map asks for an elevation tile, and
 * gets the mosaic of the survey and the coarse ground as an image made in a Web Worker.
 *
 *   view ── retainElevationFusionSurface(snapshot, width) ─▶ { tileTemplate, release }      (the `tiles[0]` of the source)
 *   map  ── terrain-fusion://{key}/{z}/{x}/{y} ─▶ loader ─▶ worker-rpc ─▶ handler ─▶ ImageBitmap (moved, not copied)
 *
 * 🔑 **The key in the address is the identity of the surface.** One key per snapshot OBJECT and transition width. A
 * new snapshot is a new key, so a new tile address: the map drops what it held and asks again, and a request that was
 * already on its way still names the OLD surface — it can never be painted with the new one.
 *
 * 🔑 **Never an empty answer.** Every success is an image of `tileSizePx²` pixels. A cancelled request rejects with an
 * `AbortError` (the map ignores those); a tile that could not be made rejects with an error — after ONE more try,
 * because the map does not ask again for a tile that failed (it stays `errored` until the source is reloaded).
 *
 * 🔑 **The handler asks for the surface it does not know** (`need-surface`); the snapshot is then sent once and the
 * tile asked again. Nothing here tracks which thread knows what — the worker, the safety net and a worker started anew
 * all recover the same way.
 *
 * 🔑 **Registered by whoever shows a fused source, not by the map boundary.** `ensureElevationFusionProtocol` takes
 * `registerMapProtocol` as an argument (the pattern of `pmtiles-protocol.ts`): pages with a map and no terrain never
 * load this code, and `lib/maps` does not come to depend on `lib/terrain`.
 *
 * @module lib/terrain/elevation-fusion/fusion-tile-protocol
 */

import type { ArchiveTileAddress } from '@/lib/geo/osm/osm-archive-tile';
import {
  DEFAULT_ELEVATION_SOURCE_ID,
  ELEVATION_FUSION_URL_SCHEME,
  elevationFusionTileTemplate,
  elevationSource,
  parseElevationFusionTileUrl,
  unwrapArchiveUrl,
} from '@/lib/maps/basemap-catalog';
import type { ListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-types';
import { createWorkerRpcClient, type WorkerRpcClient } from '@/lib/workers/worker-rpc-client';
import type { WorkerRpcCancellableResult } from '@/lib/workers/worker-rpc-protocol';
import type { GeoPoint } from '@/types/geo/coordinates';

import { fusionAbortError, type CoarseArchiveRef } from './fusion-coarse-reader';
import type { FusionTileAnswer, FusionTileReply, FusionTileRequest } from './fusion-tile-host';
import { createBrowserFusionTileHost, fusionRuntimeSupported, type BrowserFusionTileHandler } from './fusion-tile-runtime';
import { spawnFusionTileWorker } from './fusion-tile-worker-spawn';
import type { FusedElevation } from './terrain-fused-elevation';

/** A surface the protocol serves, for as long as its holder keeps it. */
export interface ElevationFusionSurfaceHandle {
  readonly key: string;
  /** The `tiles[0]` of the `raster-dem` source. */
  readonly tileTemplate: string;
  /** The holder is done: when the last one is, the surface and its mosaics are dropped. Safe to call twice. */
  readonly release: () => void;
}

/** One tile request as the protocol saw it — for instruments (the measurement page); production code does not read it. */
export interface ElevationFusionTileEvent {
  readonly surface: string;
  readonly tile: ArchiveTileAddress;
  readonly outcome: 'ok' | 'cancelled' | 'failed';
  /** From the map's request to the answer — the wait in the worker's queue included. */
  readonly wallMs: number;
  /** What the handler reported; `null` unless `outcome` is `ok`. */
  readonly answer: Omit<FusionTileAnswer<unknown>, 'image' | 'kind'> | null;
  readonly error: string | null;
}

type FusionClient<I> = Pick<WorkerRpcClient<FusionTileRequest, FusionTileReply<I>>, 'run' | 'call'>;
type FusionResult<I> = WorkerRpcCancellableResult<FusionTileReply<I>>;

export interface ElevationFusionProtocolOptions<I> {
  readonly client: FusionClient<I>;
  readonly archive: () => CoarseArchiveRef;
  /** Milliseconds, monotonic. */
  readonly now: () => number;
  /** The instrument, if one is attached: called as every tile request ends. Production code attaches none. */
  readonly onTile?: (event: ElevationFusionTileEvent) => void;
}

export interface ElevationFusionProtocol<I> {
  readonly retain: (snapshot: ListingTerrainSnapshot, transitionM: number) => ElevationFusionSurfaceHandle;
  /** The image of one tile address. Rejects with an `AbortError` when cancelled, with an error when it cannot be made. */
  readonly loadTile: (url: string, signal: AbortSignal) => Promise<I>;
  /** The fused ground at points of the earth, through the exact road. `surface: null` ⇒ the coarse ground alone. */
  readonly elevationsAt: (surface: string | null, points: readonly GeoPoint[], signal?: AbortSignal) => Promise<readonly FusedElevation[]>;
}

interface LiveSurface {
  readonly snapshot: ListingTerrainSnapshot;
  readonly transitionM: number;
  holders: number;
}

const NEVER_ABORTED = new AbortController().signal;

/** The surfaces being served: one key per snapshot object and width, counted by holder. */
function createSurfaceRegistry(forget: (key: string) => void) {
  const keys = new WeakMap<ListingTerrainSnapshot, Map<number, string>>();
  const live = new Map<string, LiveSurface>();
  let issued = 0;
  const keyOf = (snapshot: ListingTerrainSnapshot, width: number): string => {
    const byWidth = keys.get(snapshot) ?? new Map<number, string>();
    keys.set(snapshot, byWidth);
    const known = byWidth.get(width);
    if (known !== undefined) return known;
    const key = `s${++issued}`;
    byWidth.set(width, key);
    return key;
  };
  const retain = (snapshot: ListingTerrainSnapshot, transitionM: number): ElevationFusionSurfaceHandle => {
    const width = Number.isFinite(transitionM) && transitionM > 0 ? transitionM : 0;
    const key = keyOf(snapshot, width);
    const entry = live.get(key) ?? { snapshot, transitionM: width, holders: 0 };
    live.set(key, entry);
    entry.holders++;
    let released = false;
    const release = (): void => {
      if (released) return;
      released = true;
      if (--entry.holders > 0) return;
      live.delete(key);
      forget(key);
    };
    return { key, tileTemplate: elevationFusionTileTemplate(key), release };
  };
  return { retain, get: (key: string): LiveSurface | undefined => live.get(key) };
}

export function createElevationFusionProtocol<I>(options: ElevationFusionProtocolOptions<I>): ElevationFusionProtocol<I> {
  const { client, archive, now, onTile } = options;
  const registry = createSurfaceRegistry((key) => void client.call({ kind: 'forget', surface: key }));
  const introductions = new Map<string, Promise<FusionResult<I>>>();

  /** Sends the snapshot of `key` — once, however many tiles found it missing at the same moment. */
  const introduce = (key: string, surface: LiveSurface): Promise<FusionResult<I>> => {
    const pending = introductions.get(key);
    if (pending !== undefined) return pending;
    const { snapshot, transitionM } = surface;
    const sent = client.run({ kind: 'surface', surface: key, snapshot, transitionM }, {}).finally(() => introductions.delete(key));
    introductions.set(key, sent);
    return sent;
  };

  /** One question; a handler that does not know the surface is given it, and asked once more. */
  const ask = async (request: FusionTileRequest, signal: AbortSignal): Promise<FusionResult<I>> => {
    const first = await client.run(request, { signal });
    if (first.kind !== 'ok' || first.value.kind !== 'need-surface') return first;
    const surface = registry.get(first.value.surface);
    if (surface === undefined) return { kind: 'cancelled' };
    const introduced = await introduce(first.value.surface, surface);
    if (introduced.kind !== 'ok') return introduced;
    const second = await client.run(request, { signal });
    if (second.kind === 'ok' && second.value.kind === 'need-surface') return { kind: 'failed', error: 'surface-not-accepted' };
    return second;
  };

  const emit = (event: ElevationFusionTileEvent): void => onTile?.(event);

  const errorOf = (result: FusionResult<I>): string => (result.kind === 'failed' ? result.error : result.kind);

  const loadTile = async (url: string, signal: AbortSignal): Promise<I> => {
    const address = parseElevationFusionTileUrl(url);
    if (address === null) throw new Error(`terrain-fusion: not a tile address: ${url}`);
    const { surface, ...tile } = address;
    // A surface nobody holds any more belongs to a source that is going away: its late requests are cancellations.
    if (registry.get(surface) === undefined) throw fusionAbortError();
    const request: FusionTileRequest = { kind: 'tile', surface, tile, archive: archive() };
    const startedAt = now();
    let result = await ask(request, signal);
    // The map does not ask again for a tile that failed; one more try covers a worker that just fell (the client has
    // moved to the safety net by now) and a passing network fault.
    if (result.kind === 'failed' && !signal.aborted) result = await ask(request, signal);
    const wallMs = now() - startedAt;
    if (result.kind === 'ok' && result.value.kind === 'tile') {
      const { image, ...answer } = result.value;
      emit({ surface, tile, outcome: 'ok', wallMs, answer, error: null });
      return image;
    }
    if (result.kind === 'cancelled' || signal.aborted) {
      emit({ surface, tile, outcome: 'cancelled', wallMs, answer: null, error: null });
      throw fusionAbortError();
    }
    const error = result.kind === 'ok' ? `unexpected-${result.value.kind}` : errorOf(result);
    emit({ surface, tile, outcome: 'failed', wallMs, answer: null, error });
    throw new Error(`terrain-fusion: ${error}`);
  };

  const elevationsAt: ElevationFusionProtocol<I>['elevationsAt'] = async (surface, points, signal = NEVER_ABORTED) => {
    const result = await ask({ kind: 'elevations', surface, archive: archive(), points }, signal);
    if (result.kind === 'ok' && result.value.kind === 'elevations') return result.value.elevations;
    if (result.kind === 'cancelled' || signal.aborted) throw fusionAbortError();
    throw new Error(`terrain-fusion: ${result.kind === 'ok' ? `unexpected-${result.value.kind}` : errorOf(result)}`);
  };

  return {
    retain: registry.retain,
    loadTile,
    elevationsAt,
  };
}

// ── the one protocol of the page ────────────────────────────────────────────────────────────────────────────────────

/** The coarse archive the fusion reads — from the catalogue, never written here (CHECK 3.95). */
export function elevationFusionCoarseArchive(): CoarseArchiveRef {
  const source = elevationSource(DEFAULT_ELEVATION_SOURCE_ID);
  return { url: unwrapArchiveUrl(source.archiveUrl), maxZoom: source.maxZoom, tileSizePx: source.tileSizePx };
}

let shared: ElevationFusionProtocol<ImageBitmap> | null = null;

/** The ONE instrument of the page (the measurement page), or none. */
let tileObserver: ((event: ElevationFusionTileEvent) => void) | null = null;

function sharedProtocol(): ElevationFusionProtocol<ImageBitmap> {
  if (shared !== null) return shared;
  let safetyNet: BrowserFusionTileHandler | null = null;
  shared = createElevationFusionProtocol<ImageBitmap>({
    client: createWorkerRpcClient<FusionTileRequest, FusionTileReply<ImageBitmap>>({
      spawn: spawnFusionTileWorker,
      fallback: async (request, context) => (safetyNet ??= createBrowserFusionTileHost('main'))(request, context),
    }),
    archive: elevationFusionCoarseArchive,
    now: () => performance.now(),
    onTile: (event) => tileObserver?.(event),
  });
  return shared;
}

/**
 * Can this browser make fused elevation tiles at all? `false` ⇒ the view gives the map the plain elevation archive
 * (`elevationSource(…).archiveUrl`) instead of a fused source: ground without the survey, never wrong heights.
 */
export function isElevationFusionSupported(): boolean {
  return fusionRuntimeSupported();
}

/** What we need of `registerMapProtocol` (`lib/maps/maplibre.ts`) — passed in, so this leaf never imports the map. */
export type RegisterElevationFusionProtocol = (
  scheme: string,
  loader: (parameters: { readonly url: string }, abort: AbortController) => Promise<{ data: ImageBitmap }>,
) => void;

let registered = false;

/** Registers the scheme in the map's global protocol table — once per page, however many views ask. */
export function ensureElevationFusionProtocol(register: RegisterElevationFusionProtocol): void {
  if (registered) return;
  registered = true;
  register(ELEVATION_FUSION_URL_SCHEME.replace('://', ''), async (parameters, abort) => ({
    data: await sharedProtocol().loadTile(parameters.url, abort.signal),
  }));
}

/** Starts serving `snapshot` with a transition zone `transitionM` wide; the handle carries the tile address. */
export function retainElevationFusionSurface(snapshot: ListingTerrainSnapshot, transitionM: number): ElevationFusionSurfaceHandle {
  return sharedProtocol().retain(snapshot, transitionM);
}

/** The fused ground at points of the earth, with its provenance — the number that belongs to the ground that is drawn. */
export function fusedElevationsAt(
  surface: string | null,
  points: readonly GeoPoint[],
  signal?: AbortSignal,
): Promise<readonly FusedElevation[]> {
  return sharedProtocol().elevationsAt(surface, points, signal);
}

/** For the ONE instrument of a page: every tile request, as it ends. `null` detaches it. */
export function setElevationFusionTileObserver(observer: ((event: ElevationFusionTileEvent) => void) | null): void {
  tileObserver = observer;
}
