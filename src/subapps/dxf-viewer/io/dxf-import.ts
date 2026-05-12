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
import { encodingService, type SupportedEncoding } from './encoding-service';
import { calculateTightBounds } from '../utils/bounds-utils';
import { PANEL_LAYOUT } from '../config/panel-tokens';

export class DxfImportService {
  private worker: Worker | null = null;
  
  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('../workers/dxf-parser.worker.ts', import.meta.url)
      );
    }
    return this.worker;
  }

  /**
   * 🏢 ENTERPRISE: Import DXF file with optional encoding
   *
   * @param file - The DXF file to import
   * @param encoding - Optional encoding (auto-detected if not provided)
   * @returns DXF import result with scene and stats
   */
  async importDxfFile(file: File, encoding?: string): Promise<DxfImportResult> {

    // 🏢 ENTERPRISE: Direct parse first (reliable, encoding-aware)
    // Worker fallback kept for future use but direct parse is primary path
    try {
      const result = await this.directParseFileWithEncoding(file, encoding);
      if (result.success) {
        return result;
      }
    } catch {
      // Fall through to worker path
    }
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      const importTimeout = PANEL_LAYOUT.TIMING.IMPORT_TIMEOUT;
      const timeout = setTimeout(() => {
        console.error(`⌛ DXF import timeout after ${importTimeout / 1000} seconds`);
        resolve({
          success: false,
          error: `DXF import timeout after ${importTimeout / 1000}s - worker did not respond`,
          stats: { entityCount: 0, layerCount: 0, parseTimeMs: 0 }
        });
      }, importTimeout);
      
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (!content) {
          clearTimeout(timeout);
          resolve({
            success: false,
            error: 'Failed to read file content',
            stats: { entityCount: 0, layerCount: 0, parseTimeMs: 0 }
          });
          return;
        }
        
        try {
          const worker = this.getWorker();
          
          worker.onmessage = (event) => {
            clearTimeout(timeout);
            const result = event.data as DxfImportResult;
            
            if (result.success && result.scene) {
              // Normalize to positive quadrant: bottom-left corner → (0,0)
              const perfectBounds = calculateTightBounds(result.scene.entities, true);
              result.scene.bounds = perfectBounds;
            }
            
            resolve(result);
          };
          
          worker.onerror = (error) => {
            clearTimeout(timeout);
            console.error('DXF worker error:', error);
            resolve({
              success: false,
              error: 'DXF parsing worker failed. This might be due to an unsupported file format or corrupted file.',
              stats: { entityCount: 0, layerCount: 0, parseTimeMs: 0 }
            });
          };
          
          worker.postMessage({ 
            type: 'parse-dxf',
            fileContent: content,
            filename: file.name
          });
        } catch (workerError) {
          clearTimeout(timeout);
          console.error('Failed to create worker:', workerError);
          resolve({
            success: false,
            error: 'Failed to initialize DXF parser. Worker not supported in this environment.',
            stats: { entityCount: 0, layerCount: 0, parseTimeMs: 0 }
          });
        }
      };
      
      reader.onerror = () => {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: 'Failed to read file',
          stats: { entityCount: 0, layerCount: 0, parseTimeMs: 0 }
        });
      };
      
      // 🏢 ENTERPRISE: Use provided encoding or default to UTF-8
      reader.readAsText(file, encoding || 'UTF-8');
    });
  }
  
  /**
   * 🏢 ENTERPRISE: Direct parse with encoding auto-detection
   *
   * Uses centralized encodingService for file reading.
   * Uses centralized calculateTightBounds for bounds normalization.
   */
  private async directParseFileWithEncoding(file: File, encoding?: string): Promise<DxfImportResult> {
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

      const { DxfSceneBuilder } = await import('../utils/dxf-scene-builder');
      const startTime = performance.now();

      const scene = DxfSceneBuilder.buildScene(content);

      if (!scene) {
        return {
          success: false,
          error: 'Failed to build scene from DXF content',
          stats: { entityCount: 0, layerCount: 0, parseTimeMs: 0 }
        };
      }

      // Normalize to positive quadrant: bottom-left corner → (0,0)
      if (scene.entities.length > 0) {
        const perfectBounds = calculateTightBounds(scene.entities, true);
        scene.bounds = perfectBounds;
      }

      if (!DxfSceneBuilder.validateScene(scene)) {
        return {
          success: false,
          error: 'Scene validation failed',
          stats: { entityCount: 0, layerCount: 0, parseTimeMs: 0 }
        };
      }

      const parseTimeMs = performance.now() - startTime;

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
