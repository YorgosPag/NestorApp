/**
 * CANVAS V2 - DXF IMPORT HOOK
 *
 * 🏢 ENTERPRISE: Uses centralized DXF import utilities from dxf-import.ts
 * Single source of truth for DXF import result processing.
 *
 * @see io/dxf-import.ts for centralized utilities
 */

'use client';

import { useState } from 'react';
import type { SceneModel } from '../types/scene';
import {
  dxfImportService,
  processDxfImportResult,
  handleDxfImportError
} from '../io/dxf-import';

export function useDxfImport() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importDxfFile = async (file: File): Promise<SceneModel | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await dxfImportService.importDxfFile(file);

      // 🏢 ENTERPRISE: Use centralized utilities from dxf-import.ts
      return processDxfImportResult(
        result,
        undefined, // onSuccess - no callback needed, just return scene
        (errorMsg) => setError(errorMsg)
      );
    } catch (err) {
      // 🏢 ENTERPRISE: Use centralized error handler
      return handleDxfImportError(err, (errorMsg) => setError(errorMsg));
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