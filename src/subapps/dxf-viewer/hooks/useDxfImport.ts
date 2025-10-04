/**
 * CANVAS V2 - DXF IMPORT HOOK
 * ✅ Μετακινήθηκε από canvas/ για canvas-v2 compatibility
 * Χρησιμοποιεί το υπάρχον dxfImportService και createDxfImportUtils
 */

'use client';

import { useState } from 'react';
import type { SceneModel } from '../types/scene';
import { dxfImportService } from '../io/dxf-import';
// ✅ ΔΙΟΡΑΘΩΣΗ: Inline utility function αντί για διαγραμμένο canvas-core

// ✅ INLINE DXF IMPORT UTILITIES
const createDxfImportUtils = () => ({
  processImportResult: (result: any, onSuccess?: (scene: SceneModel) => SceneModel, onError?: (error: string) => void) => {
    if (result.success && result.scene) {
      return onSuccess ? onSuccess(result.scene) : result.scene;
    } else {
      const errorMsg = result.error || 'Import failed - unknown reason';
      console.error('❌ DXF import failed:', errorMsg);
      onError?.(errorMsg);
      return null;
    }
  },

  handleImportError: (err: unknown, onError?: (error: string) => void) => {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('⛔ Exception during DXF import:', err);
    onError?.(errorMessage);
    return null;
  }
});

export function useDxfImport() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importDxfFile = async (file: File): Promise<SceneModel | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await dxfImportService.importDxfFile(file);
      const dxfUtils = createDxfImportUtils();

      return dxfUtils.processImportResult(
        result,
        (scene) => scene, // onSuccess - just return the scene
        (error) => setError(error) // onError - set error state
      );
    } catch (err) {
      const dxfUtils = createDxfImportUtils();
      return dxfUtils.handleImportError(err, (error) => setError(error));
    } finally {
      setIsLoading(false);
    }
  };

  return {
    importDxfFile,
    isLoading,
    error,
    clearError: () => setError(null)
  };
}