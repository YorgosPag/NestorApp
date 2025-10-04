// DXF Parser Web Worker - Working Implementation
import type { DxfImportResult } from '../types/scene';
import { DxfSceneBuilder } from '../utils/dxf-scene-builder';

interface WorkerMessage {
  type: 'parse-dxf';
  fileContent: string;
  filename: string;
}

// Main DXF content parser using working DxfSceneBuilder
function parseDxfContent(content: string, filename: string): DxfImportResult {
  const startTime = performance.now();
  console.log('🔧 Worker: Received parse request for:', filename);
  
  try {
    // Build scene using working DxfSceneBuilder (not broken npm parser)
    const scene = DxfSceneBuilder.buildScene(content);
    
    // Validate the built scene
    if (!DxfSceneBuilder.validateScene(scene)) {
      throw new Error('Invalid scene generated during parsing');
    }
    
    const parseTimeMs = performance.now() - startTime;
    console.log(`✅ Worker: Parse completed in ${parseTimeMs.toFixed(2)}ms`);
    
    return {
      success: true,
      scene,
      stats: {
        entityCount: scene.entities.length,
        layerCount: Object.keys(scene.layers).length,
        parseTimeMs
      }
    };
  } catch (error) {
    console.error('❌ Worker: Parse error:', error);
    
    const parseTimeMs = performance.now() - startTime;
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error',
      stats: {
        entityCount: 0,
        layerCount: 0,
        parseTimeMs
      }
    };
  }
}

// Enhanced worker message handler
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { type, fileContent, filename } = e.data;
  
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
    const result = parseDxfContent(fileContent, filename || 'unknown.dxf');
    
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
  
  self.postMessage({
    success: false,
    error: 'Worker global error: ' + (error.message || 'Unknown error'),
    stats: { entityCount: 0, layerCount: 0, parseTimeMs: 0 }
  });
};

// Log worker startup
console.log('🚀 DXF Parser Worker initialized and ready');
