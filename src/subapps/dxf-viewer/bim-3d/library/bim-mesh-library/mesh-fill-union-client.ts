/**
 * mesh-fill-union-client — ADR-683 §10.9.2: main-thread façade for the exact-fill union worker.
 *
 * Lazily spawns `mesh-fill-union.worker.ts` and runs a tiny promise-based RPC over `postMessage`
 * (one `requestId` per job). The worker unions an asset's projected plan triangles into the EXACT
 * vector footprint (few points, symmetric) off the main thread; this façade resolves the awaiting
 * promise with the flat rings. The mesh cache calls it AFTER it has already shown the instant raster
 * placeholder, then swaps raster → exact when the union resolves.
 *
 * Never rejects: any failure (no-worker env, worker crash, union throw) resolves `null` so the
 * caller simply keeps its raster placeholder — the plan is always drawn, exactness is an upgrade.
 *
 * @see ./mesh-fill-union.worker — the pure `polygon-clipping` union (framework-free)
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §10.9.2
 */

import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('MeshFillUnion');

interface UnionResponse {
  readonly requestId: string;
  readonly key: string;
  readonly rings?: number[][];
  readonly error?: string;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<string, (rings: number[][] | null) => void>();

/** Resolve every in-flight request with `null` (worker gone) and clear the table. */
function drainPending(): void {
  for (const resolve of pending.values()) resolve(null);
  pending.clear();
}

function ensureWorker(): Worker | null {
  if (worker) return worker;
  if (typeof Worker === 'undefined') return null; // SSR / non-browser — caller keeps raster.
  try {
    const w = new Worker(new URL('./mesh-fill-union.worker.ts', import.meta.url), { type: 'module' });
    w.addEventListener('message', (event: MessageEvent<UnionResponse>) => {
      const { requestId, rings, error } = event.data;
      const resolve = pending.get(requestId);
      if (!resolve) return;
      pending.delete(requestId);
      if (error) {
        logger.warn('exact fill union failed — keeping raster placeholder', { error });
        resolve(null);
      } else {
        resolve(rings ?? null);
      }
    });
    w.addEventListener('error', (event) => {
      logger.warn('mesh-fill-union worker crashed — keeping raster placeholder', {
        message: event.message,
      });
      worker = null;
      drainPending();
    });
    worker = w;
    return w;
  } catch (err) {
    logger.warn('mesh-fill-union worker unavailable', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Request the EXACT vector fill rings (flat plan-meter `[x0,y0,x1,y1,…]`) for `key` by unioning the
 * given projected plan triangles on the worker thread. Resolves `null` (never rejects) when no worker
 * is available or the union fails. Sends a structured-clone COPY of `triangles` (no transfer) so the
 * caller's cached `Float32Array` stays intact.
 */
export function requestExactFillRings(
  key: string,
  triangles: Float32Array,
): Promise<number[][] | null> {
  const w = ensureWorker();
  if (!w) return Promise.resolve(null);
  const requestId = `mfu-${key}-${nextId++}`;
  return new Promise((resolve) => {
    pending.set(requestId, resolve);
    w.postMessage({ requestId, key, triangles });
  });
}
