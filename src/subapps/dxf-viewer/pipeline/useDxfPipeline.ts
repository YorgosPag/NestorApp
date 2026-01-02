/**
 * DXF Pipeline Hook - Advanced DXF Import with Destination Support
 *
 * 🏢 ENTERPRISE: Uses centralized DXF import utilities from dxf-import.ts
 * Single source of truth for DXF import result processing.
 *
 * @see io/dxf-import.ts for centralized utilities
 */
'use client';

import { useState } from 'react';
import {
  dxfImportService,
  processDxfImportResult
} from '../io/dxf-import';
import type { SceneModel, DxfImportResult } from '../types/scene';
import { useLevels } from '../systems/levels';
import { useProjectHierarchy } from '../contexts/ProjectHierarchyContext';
import type {
  DxfDestination,
  DxfProcessingOptions,
  ProcessedDxfResult
} from './types';

export function useDxfPipeline() {
  const lm = (() => {
    try { return useLevels(); } catch { return null; }
  })();
  
  const { getAvailableDestinations } = useProjectHierarchy();
  
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<DxfImportResult | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<DxfDestination | null>(null);
  const [processingOptions, setProcessingOptions] = useState<DxfProcessingOptions>({
    destination: null,
    processLayers: true,
    preserveGrid: false,
    preserveRulers: false,
    autoScale: true
  });

  async function importDxfFile(file: File, levelId?: string): Promise<SceneModel | null> {
    setBusy(true);

    try {
      // Χρήση πραγματικού worker-based importer
      const result = await dxfImportService.importDxfFile(file);
      setLastResult(result);

      // 🏢 ENTERPRISE: Use centralized utility from dxf-import.ts
      const scene = processDxfImportResult(result);

      if (!scene) {
        return null;
      }

      // Αποθήκευση σκηνής στο Level Manager
      if (lm && lm.currentLevelId && result.scene) {
        // ✅ ENTERPRISE: Null safety for SceneModel assignment
        if (result.scene !== null) {
          lm.setLevelScene(lm.currentLevelId, result.scene);
        }
      }

      // ✅ ENTERPRISE: Ensure null return instead of undefined
      return (result.scene ?? null) as SceneModel | null;
    } catch (error) {
      console.error('💥 Σφάλμα κατά την εισαγωγή DXF:', error);
      setLastResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stats: { entityCount: 0, layerCount: 0, parseTimeMs: 0 }
      });
      return null;
    } finally {
      setBusy(false);
    }
  }

  // Enhanced import με destination support
  async function importDxfFileWithDestination(
    file: File, 
    destination: DxfDestination, 
    options: Partial<DxfProcessingOptions> = {}
  ): Promise<ProcessedDxfResult> {
    setBusy(true);
    const startTime = Date.now();

    try {
      // Standard DXF parsing
      const result = await dxfImportService.importDxfFile(file);

      // 🏢 ENTERPRISE: Use centralized utility from dxf-import.ts
      const scene = processDxfImportResult(result);

      if (!scene) {
        return {
          success: false,
          scene: null,
          destination,
          error: result.error || 'Import failed'
        };
      }

      // ✅ ENTERPRISE: Type guard ensures scene is not null before processing
      // Process based on destination type
      const processedScene = await processSceneForDestination(scene as SceneModel, destination, options);
      
      // Store in appropriate location
      await storeSceneAtDestination(processedScene, destination);
      
      const endTime = Date.now();
      
      const processedResult: ProcessedDxfResult = {
        success: true,
        scene: processedScene,
        destination,
        stats: {
          ...result.stats,
          distributionTimeMs: endTime - startTime
        }
      };

      setLastResult(result);
      setSelectedDestination(destination);
      
      return processedResult;

    } catch (error) {
      console.error('💥 Enhanced DXF Import Error:', error);
      return {
        success: false,
        scene: null,
        destination,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      setBusy(false);
    }
  }

  // Process scene based on destination requirements
  async function processSceneForDestination(
    scene: SceneModel, 
    destination: DxfDestination, 
    options: Partial<DxfProcessingOptions>
  ): Promise<SceneModel> {

    let processedScene = { ...scene };

    switch (destination.type) {
      case 'project':
        // For projects: preserve full drawing, optionally process parking layers
        if (destination.metadata?.category === 'parking') {
          processedScene = await enhanceForParkingView(processedScene);
        }
        break;

      case 'building':
      case 'floor':
        // For buildings/floors: prepare for layer overlays
        processedScene = await prepareForLayerOverlays(processedScene);
        break;

      case 'unit':
        // For units: isolate unit boundary, remove building context
        processedScene = await isolateUnitView(processedScene);
        break;

      case 'storage':
        // For storage: similar to unit but for storage areas
        processedScene = await isolateStorageView(processedScene);
        break;
    }

    // Apply global processing options
    if (!options.preserveGrid) {
      processedScene = removeGrid(processedScene);
    }
    if (!options.preserveRulers) {
      processedScene = removeRulers(processedScene);
    }

    return processedScene;
  }

  // Store scene at the specified destination
  async function storeSceneAtDestination(scene: SceneModel, destination: DxfDestination): Promise<void> {

    // Implementation would depend on your storage backend
    // For now, just use the existing level manager
    if (lm && lm.currentLevelId) {
      lm.setLevelScene(`${destination.type}_${destination.id}`, scene);
    }

    // TODO: Implement actual storage to Firestore based on destination type
    switch (destination.type) {
      case 'project':
        // await saveToProjectStorage(destination.id, scene);
        break;
      case 'building':
        // await saveToBuildingStorage(destination.id, scene);
        break;
      // ... other cases
    }
  }

  // Helper functions for scene processing
  const enhanceForParkingView = async (scene: SceneModel): Promise<SceneModel> => {
    // Add parking-specific enhancements

    return scene;
  };

  const prepareForLayerOverlays = async (scene: SceneModel): Promise<SceneModel> => {
    // Prepare scene for status layer overlays

    return scene;
  };

  const isolateUnitView = async (scene: SceneModel): Promise<SceneModel> => {
    // Remove building context, focus on unit

    return scene;
  };

  const isolateStorageView = async (scene: SceneModel): Promise<SceneModel> => {
    // Focus on storage area

    return scene;
  };

  const removeGrid = (scene: SceneModel): SceneModel => {
    // Remove grid entities
    return scene;
  };

  const removeRulers = (scene: SceneModel): SceneModel => {
    // Remove ruler entities
    return scene;
  };

  // Get available destinations from hierarchy
  const getDestinations = (): DxfDestination[] => {
    return getAvailableDestinations().map(dest => ({
      id: dest.id,
      type: dest.type,
      label: dest.label,
      parentId: dest.parentId,
      metadata: dest.metadata
    }));
  };

  return { 
    // Legacy support
    importDxfFile, 
    busy, 
    lastResult,
    // Enhanced pipeline
    importDxfFileWithDestination,
    selectedDestination,
    setSelectedDestination,
    processingOptions,
    setProcessingOptions,
    getDestinations
  };
}
