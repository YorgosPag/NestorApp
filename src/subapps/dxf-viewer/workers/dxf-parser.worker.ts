// DXF Parser Web Worker - Working Implementation
import type { DxfImportResult } from '../types/scene';
import type { SceneUnits } from '../utils/scene-units';
// ADR-635 Φ3 — shared build/validate/wrap SSoT (fault-tolerant, diagnostics-carrying).
import { runDxfParse } from '../utils/run-dxf-parse';

interface WorkerMessage {
  type: 'parse-dxf';
  fileContent: string;
  filename: string;
  // ADR-462 — user-selected source units (canonical-mm scale at parse).
  unitsOverride?: SceneUnits;
}

// Main DXF content parser — delegates to the runDxfParse SSoT. The main thread normalizes
// bounds after transfer (dxf-import.ts onmessage), so the Worker leaves normalizeBounds off.
function parseDxfContent(content: string, filename: string, unitsOverride?: SceneUnits): DxfImportResult {
  console.debug('🔧 Worker: Received parse request for:', filename);
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
    // Parse the DXF content using working method
    const result = parseDxfContent(fileContent, filename || 'unknown.dxf', unitsOverride);
    
    // Send result back to main thread
    self.postMessage(result);
  } catch (error) {
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

// Log worker startup
console.debug('🚀 DXF Parser Worker initialized and ready');
