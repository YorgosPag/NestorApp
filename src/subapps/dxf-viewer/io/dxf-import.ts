/**
 * 🏢 ENTERPRISE: DXF Import Service
 *
 * Main orchestrator for DXF file import operations.
 * Uses centralized services for encoding and bounds calculation.
 *
 * @see encoding-service.ts - File encoding detection and conversion
 * @see ../utils/bounds-utils.ts - Bounds calculation and normalization
 */

import type { DxfImportResult, SceneModel } from '../types/scene';
import type { SceneUnits } from '../utils/scene-units';
import { encodingService, type SupportedEncoding } from './encoding-service';
import { calculateTightBounds } from '../utils/bounds-utils';
import { DXF_IMPORT_THRESHOLDS } from '../config/dxf-import-thresholds';

/** ADR-639 Στάδιο 1 — empty stats used by every early-return failure result. */
const EMPTY_IMPORT_STATS = { entityCount: 0, layerCount: 0, parseTimeMs: 0 } as const;

export class DxfImportService {
  private worker: Worker | null = null;
  /**
   * ADR-639 Στάδιο 1 — true once the worker has posted `worker-ready` (its module body
   * actually executed in the Worker scope). If a module fails to load (an import-chain
   * throw under Turbopack — the parse chain never reaches `self.postMessage`), this stays
   * false and `parseViaWorker` bails to the main-thread parse FAST instead of dead-waiting
   * the full parse timeout on a wedged worker. Persists across the singleton's lifetime.
   */
  private workerReady = false;

  private getWorker(): Worker {
    if (!this.worker) {
      // ADR-639 Στάδιο 1 — `{ type: 'module' }` is REQUIRED: dxf-parser.worker.ts uses
      // ES `import` (runDxfParse SSoT). A classic worker cannot resolve ES imports, so it
      // would crash on first message and silently fall back to a main-thread (freezing)
      // parse. Mirrors the working spell.worker instantiation.
      const worker = new Worker(
        new URL('../workers/dxf-parser.worker.ts', import.meta.url),
        { type: 'module' }
      );
      this.workerReady = false;
      // Persistent liveness listener — separate from the per-parse `onmessage` (which is
      // reassigned each import), so the readiness signal is never overwritten. Fires for the
      // result message too; the type guard ignores everything but the handshake.
      worker.addEventListener('message', (event: MessageEvent) => {
        if ((event.data as { type?: string } | null)?.type === 'worker-ready') {
          this.workerReady = true;
        }
      });
      this.worker = worker;
    }
    return this.worker;
  }

  /**
   * 🏢 ENTERPRISE: Import DXF file with optional encoding
   *
   * @param file - The DXF file to import
   * @param encoding - Optional encoding (auto-detected if not provided)
   * @param unitsOverride - ADR-462: user-selected source units (wizard). Drives the
   *        canonical-mm scale at parse. When omitted, $INSUNITS/heuristic decide.
   * @returns DXF import result with scene and stats
   */
  async importDxfFile(file: File, encoding?: string, unitsOverride?: SceneUnits): Promise<DxfImportResult> {

    // ADR-639 Στάδιο 1 — Large files parse in a Web Worker so the heavy, synchronous
    // line-by-line parse runs OFF the main thread and the browser UI never freezes.
    // Small files stay on the direct main-thread path (parse is fast; skip worker latency).
    if (file.size >= DXF_IMPORT_THRESHOLDS.WORKER_PARSE_MIN_BYTES) {
      const workerResult = await this.parseViaWorker(file, encoding, unitsOverride);
      if (workerResult.success) {
        return workerResult;
      }
      // Worker soft-failed (unsupported env, crash, timeout) → fall through to the
      // exhaustive direct main-thread parse as a safety net. It may briefly freeze the
      // UI, but loading-with-a-hitch beats failing to load at all.
      console.warn('⚠️ DXF worker parse failed; falling back to main-thread parse:', workerResult.error);
    }

    // 🏢 ENTERPRISE: Direct parse (primary for small files, safety-net fallback for large).
    // Encoding-aware (Greek Windows-1253 / ISO-8859-7 via encodingService), fault-tolerant.
    try {
      return await this.directParseFileWithEncoding(file, encoding, unitsOverride);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `DXF parsing failed: ${errorMessage}`, stats: { ...EMPTY_IMPORT_STATS } };
    }
  }

  /**
   * ADR-639 Στάδιο 1 — Parse a DXF file in the Web Worker, off the main thread.
   *
   * The file is READ + DECODED on the main thread with the correct encoding
   * (native TextDecoder is fast; encodingService handles Greek Windows-1253 / ISO-8859-7).
   * Only the heavy PARSE is handed to the worker. Bounds normalization runs back on the
   * main thread here (the worker parses with `normalizeBounds:false`), matching the
   * legacy behaviour so downstream consumers see an identically-shaped scene.
   */
  private async parseViaWorker(file: File, encoding?: string, unitsOverride?: SceneUnits): Promise<DxfImportResult> {
    // Read with the SAME encoding auto-detect as the direct path — never raw UTF-8,
    // which would corrupt Greek text in older cp1253/ISO-8859-7 DXF files.
    const readResult = await encodingService.readFileWithAutoDetect(file, encoding as SupportedEncoding | undefined);
    if (!readResult) {
      return {
        success: false,
        error: 'Failed to read DXF file with any supported encoding (UTF-8, Windows-1253, ISO-8859-7)',
        stats: { ...EMPTY_IMPORT_STATS },
      };
    }
    const { content } = readResult;

    return new Promise<DxfImportResult>((resolve) => {
      let settled = false;
      const finish = (result: DxfImportResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(readyProbe);
        clearTimeout(parseTimeout);
        resolve(result);
      };

      // ADR-639 Στάδιο 1 — LIVENESS probe (the real fix, 2026-07-12). A worker whose module
      // failed to load in the Worker scope (import-chain throw under Turbopack) never posts
      // `worker-ready`, so `onerror` may not fire and `postMessage` goes nowhere. Without this
      // we dead-waited the ENTIRE parse timeout on a wedged worker before falling back. Now: if
      // no readiness signal within WORKER_READY_PROBE_MS, treat the worker as unavailable and
      // fall back to the main-thread parse FAST. A slow SCENE parse never delays this — the
      // worker posts `worker-ready` at module load, before any parse message is handled. A
      // reused (already-ready) worker passes instantly. Declared BEFORE getWorker so `finish`
      // (callable from the getWorker catch) never hits a temporal-dead-zone reference.
      const readyProbe = setTimeout(() => {
        if (this.workerReady) return; // alive → the parse ceiling governs from here
        console.warn('⚠️ DXF worker did not signal readiness — treating as unavailable, falling back to main-thread parse');
        this.dispose();
        finish({
          success: false,
          error: 'DXF worker failed to load (no readiness signal) - falling back to main-thread parse',
          stats: { ...EMPTY_IMPORT_STATS },
        });
      }, DXF_IMPORT_THRESHOLDS.WORKER_READY_PROBE_MS);

      // Parse ceiling — applies only once the worker is confirmed alive (it never freezes the
      // UI). Abandons a worker that loaded but then wedged mid-parse; the fallback finishes it.
      const parseTimeoutMs = DXF_IMPORT_THRESHOLDS.WORKER_PARSE_TIMEOUT_MS;
      const parseTimeout = setTimeout(() => {
        console.error(`⌛ DXF import timeout after ${parseTimeoutMs / 1000} seconds`);
        this.dispose();
        finish({
          success: false,
          error: `DXF import timeout after ${parseTimeoutMs / 1000}s - worker did not respond`,
          stats: { ...EMPTY_IMPORT_STATS },
        });
      }, parseTimeoutMs);

      let worker: Worker;
      try {
        worker = this.getWorker();
      } catch (workerError) {
        console.error('Failed to create worker:', workerError);
        finish({
          success: false,
          error: 'Failed to initialize DXF parser. Worker not supported in this environment.',
          stats: { ...EMPTY_IMPORT_STATS },
        });
        return;
      }

      worker.onmessage = (event) => {
        const data = event.data as (DxfImportResult & { type?: string }) | null;
        if (data?.type === 'worker-ready') return; // liveness handshake, not the parse result
        const result = data as DxfImportResult;
        if (result.success && result.scene) {
          // Worker parses with normalizeBounds:false → finish normalization here
          // (move bottom-left corner → (0,0), positive quadrant).
          const perfectBounds = calculateTightBounds(result.scene.entities, true);
          result.scene.bounds = perfectBounds;
        }
        finish(result);
      };

      worker.onerror = (error) => {
        // ErrorEvent props are not own-enumerable → a bare log prints `{}`. Extract the
        // fields explicitly so a worker LOAD failure surfaces the real message/file/line
        // instead of an opaque object (ADR-639 Στάδιο 1 diagnosis, 2026-07-12).
        const ev = error as Partial<ErrorEvent>;
        console.error('DXF worker error:', {
          message: ev.message,
          filename: ev.filename,
          lineno: ev.lineno,
          colno: ev.colno,
        });
        // The worker faulted → drop it so the NEXT import rebuilds a clean one before we
        // fall through to the main-thread parse below.
        this.dispose();
        finish({
          success: false,
          error: 'DXF parsing worker failed. This might be due to an unsupported file format or corrupted file.',
          stats: { ...EMPTY_IMPORT_STATS },
        });
      };

      worker.postMessage({
        type: 'parse-dxf',
        fileContent: content,
        filename: file.name,
        unitsOverride, // ADR-462 — canonical-mm scale at parse
      });
    });
  }
  
  /**
   * 🏢 ENTERPRISE: Direct parse with encoding auto-detection
   *
   * Uses centralized encodingService for file reading.
   * Uses centralized calculateTightBounds for bounds normalization.
   */
  private async directParseFileWithEncoding(file: File, encoding?: string, unitsOverride?: SceneUnits): Promise<DxfImportResult> {
    try {
      // 🏢 ENTERPRISE: Use centralized encoding service
      const preferredEncoding = encoding as SupportedEncoding | undefined;
      const readResult = await encodingService.readFileWithAutoDetect(file, preferredEncoding);

      if (!readResult) {
        return {
          success: false,
          error: 'Failed to read DXF file with any supported encoding (UTF-8, Windows-1253, ISO-8859-7)',
          stats: { entityCount: 0, layerCount: 0, parseTimeMs: 0 }
        };
      }

      const { content } = readResult;

      // ADR-635 Φ3 — build/validate/normalize/wrap via the runDxfParse SSoT (dynamic import
      // keeps the heavy scene-builder out of the initial bundle, as before).
      const { runDxfParse } = await import('../utils/run-dxf-parse');
      return runDxfParse(content, unitsOverride, { normalizeBounds: true });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `DXF parsing failed: ${errorMessage}`,
        stats: { entityCount: 0, layerCount: 0, parseTimeMs: 0 }
      };
    }
  }
  
  dispose() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.workerReady = false;
  }
}

export const dxfImportService = new DxfImportService();

// ============================================================================
// 🏢 ENTERPRISE: CENTRALIZED DXF IMPORT UTILITIES
// ============================================================================
// Single source of truth για DXF import result processing
// Replaces duplicate inline utilities in useDxfImport.ts and useDxfPipeline.ts
// ============================================================================

/**
 * 🏢 ENTERPRISE: Type-safe DXF import result processor
 *
 * Centralized utility for processing DXF import results with proper error handling.
 * Used by useDxfImport and useDxfPipeline hooks.
 *
 * @param result - The DXF import result from dxfImportService
 * @param onSuccess - Optional callback when import succeeds
 * @param onError - Optional callback when import fails
 * @returns The scene model if successful, null otherwise
 */
export function processDxfImportResult(
  result: DxfImportResult,
  onSuccess?: (scene: SceneModel) => void,
  onError?: (error: string) => void
): SceneModel | null {
  if (result.success && result.scene) {
    onSuccess?.(result.scene);
    return result.scene;
  }

  const errorMsg = result.error || 'Import failed - unknown reason';
  console.error('❌ [DxfImportUtils] Import failed:', errorMsg);
  onError?.(errorMsg);
  return null;
}

/**
 * 🏢 ENTERPRISE: Type-safe DXF import error handler
 *
 * Centralized utility for handling exceptions during DXF import.
 * Provides consistent error logging and callback invocation.
 *
 * @param err - The caught error/exception
 * @param onError - Optional callback to invoke with error message
 * @returns null (always returns null to indicate failure)
 */
export function handleDxfImportError(
  err: unknown,
  onError?: (error: string) => void
): null {
  const errorMessage = err instanceof Error ? err.message : 'Unknown error';
  console.error('⛔ [DxfImportUtils] Exception during DXF import:', err);
  onError?.(errorMessage);
  return null;
}

/**
 * 🏢 ENTERPRISE: DXF Import Utilities Factory
 *
 * Creates an object with all DXF import utility functions.
 * Provides backward compatibility with existing inline utility pattern.
 *
 * @deprecated Prefer using processDxfImportResult and handleDxfImportError directly
 * @returns Object containing processImportResult and handleImportError functions
 */
export const createDxfImportUtils = () => ({
  processImportResult: processDxfImportResult,
  handleImportError: handleDxfImportError
});
