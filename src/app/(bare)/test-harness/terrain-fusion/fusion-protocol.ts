/**
 * ADR-920 §14.12 Β0 — το **πρωτότυπο** πρωτοκόλλου σύντηξης: ένα σχήμα πλακιδίων που δίνει στη MapLibre **ένα** έδαφος.
 *
 * Η MapLibre καλεί το πρωτόκολλο στο **κύριο νήμα**· εδώ το αίτημα πάει είτε στον Worker είτε στον ίδιο χειριστή επί
 * τόπου (`mode`), και κάθε αίτημα γράφεται στο ημερολόγιο που διαβάζουν οι μετρήσεις (α) και (β).
 *
 * ⚠️ Πρωτότυπο: η κατάσταση είναι καθολική του module (μία σελίδα δοκιμής, ένας χάρτης). Το Β4 τη δένει ανά επιφάνεια.
 */

import {
  DEFAULT_ELEVATION_SOURCE_ID,
  ELEVATION_FUSION_URL_SCHEME,
  elevationFusionTileTemplate,
  elevationSource,
  unwrapArchiveUrl,
} from '@/lib/maps/basemap-catalog';
import { registerMapProtocol, type MapProtocolLoader } from '@/lib/maps/maplibre';
import { createWorkerRpcClient, type WorkerRpcClient } from '@/lib/workers/worker-rpc-client';
import type { WorkerLike } from '@/lib/workers/worker-rpc-protocol';

import { createFusionHost, type CoarseArchive, type FusionHost, type FusionReply, type FusionRequest } from './fusion-host';
import type { TileId } from './fusion-math';
import type { ProbeSurfaceSpec } from './synthetic-site';

export type FusionMode = 'worker' | 'main';

export interface FusionLogEntry {
  readonly tile: TileId;
  readonly mode: FusionMode;
  readonly outcome: 'ok' | 'cancelled' | 'failed';
  readonly composition: 'fused' | 'coarse' | 'flat' | null;
  /** Από τη στιγμή που ρώτησε η MapLibre ως την απάντηση — μαζί με την αναμονή στην ουρά του Worker. */
  readonly wallMs: number;
  readonly coarseMs: number | null;
  readonly composeMs: number | null;
  readonly bitmapMs: number | null;
}

type FusionClient = WorkerRpcClient<FusionRequest, FusionReply>;

const state: { mode: FusionMode; surface: ProbeSurfaceSpec | null; log: FusionLogEntry[] } = {
  mode: 'worker',
  surface: null,
  log: [],
};

let mainHost: FusionHost | null = null;
const clients: Partial<Record<FusionMode, FusionClient>> = {};

function spawnFusionWorker(): WorkerLike | null {
  if (typeof Worker === 'undefined') return null;
  return new Worker(new URL('./fusion.worker.ts', import.meta.url), { type: 'module', name: 'terrain-fusion-probe' });
}

function clientOf(mode: FusionMode): FusionClient {
  const known = clients[mode];
  if (known !== undefined) return known;
  const created = createWorkerRpcClient<FusionRequest, FusionReply>({
    spawn: mode === 'worker' ? spawnFusionWorker : () => null,
    fallback: async (request) => (mainHost ??= createFusionHost())(request),
  });
  clients[mode] = created;
  return created;
}

/** Το αρχείο του χοντρού — από το μητρώο, ποτέ γραμμένο εδώ (CHECK 3.95). */
export function coarseArchive(): CoarseArchive {
  const source = elevationSource(DEFAULT_ELEVATION_SOURCE_ID);
  return { url: unwrapArchiveUrl(source.archiveUrl), maxZoom: source.maxZoom };
}

const TILE_PATH = /\/(\d+)\/(\d+)\/(\d+)$/;

function tileOfUrl(url: string): TileId | null {
  const match = TILE_PATH.exec(url);
  return match === null ? null : { z: Number(match[1]), x: Number(match[2]), y: Number(match[3]) };
}

function record(tile: TileId, mode: FusionMode, startedAt: number, reply: FusionReply | 'cancelled' | 'failed'): void {
  const tileReply = typeof reply === 'object' && reply.kind === 'tile' ? reply : null;
  state.log.push({
    tile,
    mode,
    outcome: tileReply !== null ? 'ok' : reply === 'cancelled' ? 'cancelled' : 'failed',
    composition: tileReply?.composition ?? null,
    wallMs: performance.now() - startedAt,
    coarseMs: tileReply?.coarseMs ?? null,
    composeMs: tileReply?.composeMs ?? null,
    bitmapMs: tileReply?.bitmapMs ?? null,
  });
}

const loadFusedTile: MapProtocolLoader = async (parameters, abort) => {
  const tile = tileOfUrl(parameters.url);
  if (tile === null) throw new Error(`terrain-fusion: not a tile address: ${parameters.url}`);
  const mode = state.mode;
  const startedAt = performance.now();
  const request: FusionRequest = { kind: 'tile', tile, archive: coarseArchive(), surface: state.surface, keepPixels: false };
  const result = await clientOf(mode).run(request, { signal: abort.signal });
  if (result.kind === 'ok' && result.value.kind === 'tile') {
    record(tile, mode, startedAt, result.value);
    return { data: result.value.bitmap };
  }
  const cancelled = result.kind === 'cancelled' || abort.signal.aborted;
  record(tile, mode, startedAt, cancelled ? 'cancelled' : 'failed');
  if (cancelled) throw new DOMException('terrain-fusion: request aborted', 'AbortError');
  throw new Error(`terrain-fusion: ${result.kind === 'failed' ? result.error : result.kind}`);
};

let registered = false;

/** Εγγραφή **μία φορά** στο καθολικό μητρώο πρωτοκόλλων της MapLibre. */
export function ensureFusionProtocol(): void {
  if (registered) return;
  registerMapProtocol(ELEVATION_FUSION_URL_SCHEME.replace('://', ''), loadFusedTile);
  registered = true;
}

/**
 * Το `tiles[0]` της πηγής. Η `revision` μπαίνει στη διεύθυνση **μόνο** για να αδειάσει η μνήμη πλακιδίων της MapLibre
 * όταν αλλάζει η επιφάνεια ή ο τρόπος εκτέλεσης — ο χειριστής διαβάζει την τρέχουσα κατάσταση, όχι τη διεύθυνση.
 */
export function fusionTileTemplate(revision: number): string {
  return elevationFusionTileTemplate(`probe-${revision}`);
}

export function configureFusion(next: { readonly mode: FusionMode; readonly surface: ProbeSurfaceSpec | null }): void {
  state.mode = next.mode;
  state.surface = next.surface;
}

export function fusionLog(): readonly FusionLogEntry[] {
  return state.log;
}

export function clearFusionLog(): void {
  state.log = [];
}

/** Απευθείας ερώτηση στον χειριστή (έξω από τη MapLibre) — για τους ελέγχους (γ) και (δ). */
export async function askFusion(mode: FusionMode, request: FusionRequest): Promise<FusionReply> {
  const result = await clientOf(mode).call(request);
  if (result.kind === 'ok') return result.value;
  throw new Error(`terrain-fusion: ${result.kind === 'failed' ? result.error : result.kind}`);
}
