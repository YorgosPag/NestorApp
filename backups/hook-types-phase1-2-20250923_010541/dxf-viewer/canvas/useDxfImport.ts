// ✅ Debug flag for DXF import logging
const DEBUG_CANVAS_CORE = false;

import { useState } from 'react';
import type { SceneModel } from '../types/scene';
import { dxfImportService } from '../io/dxf-import';
import { createDxfImportUtils } from '../utils/canvas-core';

export function useDxfImport() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importDxfFile = async (file: File): Promise<SceneModel | null> => {
    setIsLoading(true);
    setError(null);
    
    if (DEBUG_CANVAS_CORE) console.log('🔄 Starting DXF import for file:', file.name, 'Size:', file.size, 'Type:', file.type);
    
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