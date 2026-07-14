/**
 * ADR-650 M8α — Point-cloud import entry point (the wizard calls THIS, nothing lower).
 *
 * Mirrors `io/dxf-import.ts` (ADR-639 Στάδιο 1) byte-for-byte in its ROUTING shape: small files
 * run the pipeline inline; large files hand off to a singleton Worker guarded by a liveness probe
 * (a worker whose module failed to load never posts `worker-ready`, so we fall back FAST instead
 * of dead-waiting the whole parse ceiling) and a parse-ceiling timeout, with a main-thread
 * fallback when the worker soft-fails. The `pointcloud-pipeline.ts` core is what actually runs on
 * both sides — this file only decides WHERE it runs.
 *
 * The `ArrayBuffer` is TRANSFERRED to the worker (never structured-cloned — a 250 MB LAZ file
 * must not be copied across the boundary). A transferred buffer is neutered on the main thread
 * afterwards, so the main-thread FALLBACK path re-reads the `File` rather than reusing it.
 */

import type { PointCloudPipelineOptions } from '../systems/topography/pointcloud/pointcloud-pipeline';
import type {
  CloudSourceExtent,
  PointCloudPipelineResult,
  PointCloudStageKey,
  PointCloudWorkerRequest,
  PointCloudWorkerResponse,
} from '../systems/topography/pointcloud/pointcloud-types';
import {
  CLOUD_HEADER_PROBE_BYTES,
  POINTCLOUD_WORKER_MIN_BYTES,
  POINTCLOUD_WORKER_READY_PROBE_MS,
  POINTCLOUD_WORKER_TIMEOUT_MS,
} from '../systems/topography/pointcloud/pointcloud-defaults';

export interface PointCloudImportProgress {
  readonly stageKey: PointCloudStageKey;
  readonly ratio: number;
}

/** i18n KEYS (N.11) — routing-layer failures. Pipeline-stage failures carry their OWN key
 *  (`POINTCLOUD_MSG` / `VOXEL_ERROR_*`, `pointcloud-read.ts` / `voxel-decimate.ts`) and pass
 *  through untouched; these four exist only for "the worker itself never answered". */
const IMPORT_MSG = {
  ERROR_UNSUPPORTED_FORMAT: 'topography.pointcloud.error.unsupportedFormat',
  ERROR_WORKER_UNAVAILABLE: 'topography.pointcloud.error.workerUnavailable',
  ERROR_WORKER_CRASHED: 'topography.pointcloud.error.workerCrashed',
  ERROR_TIMEOUT: 'topography.pointcloud.error.timeout',
} as const;

/** Binary clouds — their columns live in a header; nothing to map. */
const BINARY_POINTCLOUD_EXTENSIONS: readonly string[] = ['.las', '.laz'];
/** Text clouds — a table of untyped columns, hence the M8β/Δ mapping step. */
const ASCII_POINTCLOUD_EXTENSIONS: readonly string[] = ['.xyz', '.pts'];

const POINTCLOUD_EXTENSIONS: readonly string[] = [
  ...BINARY_POINTCLOUD_EXTENSIONS,
  ...ASCII_POINTCLOUD_EXTENSIONS,
];

function hasExtension(fileName: string, extensions: readonly string[]): boolean {
  const lower = fileName.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext));
}

/** Whether `fileName` looks like a point cloud — the wizard's dispatch gate to this whole road. */
export function isPointCloudFile(fileName: string): boolean {
  return hasExtension(fileName, POINTCLOUD_EXTENSIONS);
}

/**
 * Whether the cloud is TEXT, i.e. whether the wizard must show the column-mapping grid (M8β/Δ).
 *
 * By extension, deliberately: this only decides what the wizard RENDERS, and it must decide it
 * before a single byte is read. The authoritative, magic-first `detectPointCloudFormat` still runs
 * inside the reader — a `.xyz` that is secretly LAS fails honestly there, and importing it here
 * would drag both binary readers into the main bundle for nothing.
 */
export function isAsciiPointCloudFile(fileName: string): boolean {
  return hasExtension(fileName, ASCII_POINTCLOUD_EXTENSIONS);
}

/**
 * ADR-650 M8β/Ε — the site extent of a BINARY cloud, straight off its public header, before any
 * filtering. `null` for an ASCII cloud (its raw rows are already visible in the mapping grid — they
 * ARE the extent readout) and for any file whose header will not parse. The head slice is tiny
 * (`CLOUD_HEADER_PROBE_BYTES`) and a `.laz` header is uncompressed, so this costs nothing and needs
 * no WASM. The wizard turns this into the unit readout that makes the engineer's choice verifiable.
 */
export async function readPointCloudSourceExtent(file: File): Promise<CloudSourceExtent | null> {
  if (!isPointCloudFile(file.name) || isAsciiPointCloudFile(file.name)) return null;
  try {
    const head = await file.slice(0, CLOUD_HEADER_PROBE_BYTES).arrayBuffer();
    const { cloudSourceExtentFromBuffer } = await import(
      '../systems/topography/pointcloud/cloud-unit-span'
    );
    return cloudSourceExtentFromBuffer(head);
  } catch {
    return null;
  }
}

/**
 * Import (read → classify → decimate → preview) a point-cloud `File`.
 *
 * @throws Error whose `message` is an i18n KEY — never raw text (N.11).
 */
export async function importPointCloud(
  file: File,
  opts: PointCloudPipelineOptions,
  onProgress?: (p: PointCloudImportProgress) => void,
): Promise<PointCloudPipelineResult> {
  if (!isPointCloudFile(file.name)) {
    throw new Error(IMPORT_MSG.ERROR_UNSUPPORTED_FORMAT);
  }

  if (file.size < POINTCLOUD_WORKER_MIN_BYTES) {
    const buffer = await file.arrayBuffer();
    return runMainThreadPipeline(buffer, file.name, opts, onProgress);
  }

  try {
    const buffer = await file.arrayBuffer();
    return await pointCloudImportService.importViaWorker(buffer, file.name, opts, onProgress);
  } catch (workerError) {
    console.warn('⚠️ Point-cloud worker import failed; falling back to main-thread pipeline:', workerError);
    const freshBuffer = await file.arrayBuffer(); // the earlier buffer was TRANSFERRED (neutered)
    return runMainThreadPipeline(freshBuffer, file.name, opts, onProgress);
  }
}

async function runMainThreadPipeline(
  buffer: ArrayBuffer,
  fileName: string,
  opts: PointCloudPipelineOptions,
  onProgress?: (p: PointCloudImportProgress) => void,
): Promise<PointCloudPipelineResult> {
  const { runPointCloudPipeline } = await import('../systems/topography/pointcloud/pointcloud-pipeline');
  return await runPointCloudPipeline(buffer, fileName, opts, (stageKey, ratio) =>
    onProgress?.({ stageKey, ratio }),
  );
}

// ─── Worker routing ─────────────────────────────────────────────────────────────

function buildPointCloudRequest(
  requestId: string,
  fileName: string,
  buffer: ArrayBuffer,
  opts: PointCloudPipelineOptions,
): PointCloudWorkerRequest {
  return {
    type: 'read-and-classify',
    requestId,
    fileName,
    buffer,
    read: opts.read,
    csf: opts.csf,
    decimate: opts.decimate,
    forceCsf: opts.forceCsf,
  };
}

/** Dispatch one worker response to the right callback. `worker-ready`/stale-request are no-ops. */
function handlePointCloudResponse(
  data: PointCloudWorkerResponse,
  requestId: string,
  onProgress: ((p: PointCloudImportProgress) => void) | undefined,
  onDone: (result: PointCloudPipelineResult) => void,
  onError: (errorKey: string) => void,
): void {
  if (data.type === 'worker-ready') return;
  if (data.requestId !== requestId) return; // a stale reply from an abandoned/timed-out request
  if (data.type === 'progress') {
    onProgress?.({ stageKey: data.stageKey, ratio: data.ratio });
    return;
  }
  if (data.type === 'done') {
    onDone(data.result);
    return;
  }
  onError(data.errorKey);
}

class PointCloudImportService {
  private worker: Worker | null = null;
  /** ADR-639 Στάδιο 1 pattern — true once the worker has posted `worker-ready`. */
  private workerReady = false;
  private requestSeq = 0;

  private getWorker(): Worker {
    if (!this.worker) {
      const worker = new Worker(new URL('../workers/pointcloud.worker.ts', import.meta.url), {
        type: 'module',
      });
      this.workerReady = false;
      worker.addEventListener('message', (event: MessageEvent) => {
        if ((event.data as { type?: string } | null)?.type === 'worker-ready') {
          this.workerReady = true;
        }
      });
      this.worker = worker;
    }
    return this.worker;
  }

  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.workerReady = false;
  }

  async importViaWorker(
    buffer: ArrayBuffer,
    fileName: string,
    opts: PointCloudPipelineOptions,
    onProgress?: (p: PointCloudImportProgress) => void,
  ): Promise<PointCloudPipelineResult> {
    const requestId = `pc_${++this.requestSeq}_${Date.now()}`;
    let worker: Worker;
    try {
      worker = this.getWorker();
    } catch {
      throw new Error(IMPORT_MSG.ERROR_WORKER_UNAVAILABLE);
    }
    return this.raceWorkerResponse(worker, requestId, buffer, fileName, opts, onProgress);
  }

  private raceWorkerResponse(
    worker: Worker,
    requestId: string,
    buffer: ArrayBuffer,
    fileName: string,
    opts: PointCloudPipelineOptions,
    onProgress?: (p: PointCloudImportProgress) => void,
  ): Promise<PointCloudPipelineResult> {
    return new Promise<PointCloudPipelineResult>((resolve, reject) => {
      let settled = false;
      const finish = (run: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(readyProbe);
        clearTimeout(timeout);
        run();
      };

      const readyProbe = setTimeout(() => {
        if (this.workerReady) return; // alive → the timeout ceiling governs from here
        this.dispose();
        finish(() => reject(new Error(IMPORT_MSG.ERROR_WORKER_UNAVAILABLE)));
      }, POINTCLOUD_WORKER_READY_PROBE_MS);

      const timeout = setTimeout(() => {
        this.dispose();
        finish(() => reject(new Error(IMPORT_MSG.ERROR_TIMEOUT)));
      }, POINTCLOUD_WORKER_TIMEOUT_MS);

      worker.onmessage = (event: MessageEvent<PointCloudWorkerResponse>) => {
        handlePointCloudResponse(
          event.data,
          requestId,
          onProgress,
          (result) => finish(() => resolve(result)),
          (errorKey) => finish(() => reject(new Error(errorKey))),
        );
      };

      worker.onerror = () => {
        this.dispose();
        finish(() => reject(new Error(IMPORT_MSG.ERROR_WORKER_CRASHED)));
      };

      worker.postMessage(buildPointCloudRequest(requestId, fileName, buffer, opts), [buffer]);
    });
  }
}

const pointCloudImportService = new PointCloudImportService();
