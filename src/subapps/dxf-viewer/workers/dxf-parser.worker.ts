// DXF Parser Web Worker - Working Implementation
import type { DxfImportResult } from '../types/scene';
import type { SceneUnits } from '../utils/scene-units';

interface WorkerMessage {
  type: 'parse-dxf';
  fileContent: string;
  filename: string;
  // ADR-462 — user-selected source units (canonical-mm scale at parse).
  unitsOverride?: SceneUnits;
}

// ADR-639 Στάδιο 1 — the heavy `runDxfParse` SSoT (→ DxfSceneBuilder → stores/text-engine/…)
// is loaded via DYNAMIC import INSIDE the handler, NOT a static top-level import. Why: a
// static top-level import of that whole chain FAILED to execute in the Worker module scope
// under Turbopack (the module errored at load → `worker.onerror` fired an opaque `{}` and the
// parse never ran → main-thread fallback + freeze). The main-thread path already imports it
// dynamically (`dxf-import.ts`) and works, so the Worker mirrors it: the module now loads with
// only type imports at top level (posts `worker-ready`), and any load error surfaces as a
// CATCHABLE, message-carrying failure instead of a silent opaque worker crash.
async function parseDxfContent(content: string, filename: string, unitsOverride?: SceneUnits): Promise<DxfImportResult> {
  console.debug('🔧 Worker: Received parse request for:', filename);
  // ADR-635 Φ3 — shared build/validate/wrap SSoT (fault-tolerant, diagnostics-carrying).
  const { runDxfParse } = await import('../utils/run-dxf-parse');
  const result = runDxfParse(content, unitsOverride, { normalizeBounds: false });
  console.debug(
    result.success
      ? `✅ Worker: Parse completed in ${result.stats.parseTimeMs.toFixed(2)}ms`
      : `❌ Worker: Parse error: ${result.error}`,
  );
  return result;
}

// Enhanced worker message handler
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { type, fileContent, filename, unitsOverride } = e.data;
  
  if (type !== 'parse-dxf') {
    console.warn('⚠️ Worker: Unknown message type:', type);
    self.postMessage({
      success: false,
      error: `Unknown message type: ${type}`,
      stats: { entityCount: 0, layerCount: 0, parseTimeMs: 0 }
    });
    return;
  }

  // Validate input
  if (!fileContent || typeof fileContent !== 'string') {
    console.error('❌ Worker: Invalid file content');
    self.postMessage({
      success: false,
      error: 'Invalid file content provided',
      stats: { entityCount: 0, layerCount: 0, parseTimeMs: 0 }
    });
    return;
  }

  if (!filename || typeof filename !== 'string') {
    console.warn('⚠️ Worker: No filename provided, using default');
  }

  try {
    // Parse the DXF content using working method (dynamic import of the heavy SSoT chain).
    const result = await parseDxfContent(fileContent, filename || 'unknown.dxf', unitsOverride);

    // Send result back to main thread
    self.postMessage(result);
  } catch (error) {
    // ADR-639 Στάδιο 1 — this now ALSO catches a failure to load the runDxfParse chain
    // (dynamic import), surfacing the real message instead of the opaque `{}` load crash.
    console.error('❌ Worker: Unexpected error in message handler:', error);

    self.postMessage({
      success: false,
      error: 'Unexpected worker error: ' + (error instanceof Error ? error.message : 'Unknown error'),
      stats: { entityCount: 0, layerCount: 0, parseTimeMs: 0 }
    });
  }
};

// Handle worker errors
self.onerror = (error) => {
  console.error('❌ Worker: Global error:', error);

  // ✅ ENTERPRISE: Type-safe error message extraction
  let errorMessage = 'Unknown error';
  if (typeof error === 'string') {
    errorMessage = error;
  } else if (error && typeof error === 'object' && 'message' in error) {
    errorMessage = (error as ErrorEvent).message || 'Unknown error';
  }

  self.postMessage({
    success: false,
    error: 'Worker global error: ' + errorMessage,
    stats: { entityCount: 0, layerCount: 0, parseTimeMs: 0 }
  });
};

// ADR-639 Στάδιο 1 — LIVENESS handshake. This line runs ONLY if the whole module (incl. the
// `runDxfParse` import chain) executed without throwing in the Worker scope. The main thread
// (dxf-import.ts) waits for it: no signal within WORKER_READY_PROBE_MS ⇒ the worker failed to
// load ⇒ fast fallback to the main-thread parse instead of a dead-wait on a wedged worker.
self.postMessage({ type: 'worker-ready' });

// Log worker startup
console.debug('🚀 DXF Parser Worker initialized and ready');
