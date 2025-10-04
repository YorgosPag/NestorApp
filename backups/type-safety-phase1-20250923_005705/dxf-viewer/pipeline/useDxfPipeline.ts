// src/subapps/dxf-viewer/pipeline/useDxfPipeline.ts
'use client';
import { useState } from 'react';
import { dxfImportService } from '../io/dxf-import';
import type { SceneModel, DxfImportResult } from '../types/scene';
import { createDxfImportUtils } from '../utils/canvas-core';
import { useLevels } from '../systems/levels';
import { useProjectHierarchy } from '../contexts/ProjectHierarchyContext';
import type { 
  DxfDestination, 
  DxfProcessingOptions, 
  ProcessedDxfResult,
  DestinationStorage 
} from './types';

export function useDxfPipeline() {
  const lm = (() => {
    try { return useLevels(); } catch { return null as any; }
  })();
  
  const { getAvailableDestinations } = useProjectHierarchy();
  
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<DxfImportResult | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<DxfDestination | null>(null);
  const [processingOptions, setProcessingOptions] = useState<DxfProcessingOptions>({
    destination: null as any,
    processLayers: true,
    preserveGrid: false,
    preserveRulers: false,
    autoScale: true
  });

  async function importDxfFile(file: File, levelId?: string): Promise<SceneModel | null> {
    setBusy(true);
    console.log('🔧 Ξεκινά εισαγωγή DXF:', file.name);
    
    try {
      // Χρήση πραγματικού worker-based importer
      const result = await dxfImportService.importDxfFile(file);
      setLastResult(result);
      
      const dxfUtils = createDxfImportUtils();
      const scene = dxfUtils.processImportResult(result);
      
      if (!scene) {
        return null;
      }

      // Αποθήκευση σκηνής στο Level Manager
      if (lm && lm.currentLevelId) {
        console.log('💾 Αποθήκευση σκηνής σε level:', lm.currentLevelId);
        lm.setLevelScene(lm.currentLevelId, result.scene);
      }

      return result.scene;
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
    
    console.log('🔧 Enhanced DXF Import:', {
      fileName: file.name,
      destination: destination.label,
      type: destination.type
    });

    try {
      // Standard DXF parsing
      const result = await dxfImportService.importDxfFile(file);
      
      const dxfUtils = createDxfImportUtils();
      const scene = dxfUtils.processImportResult(result);
      
      if (!scene) {
        return {
          success: false,
          scene: null,
          destination,
          error: result.error || 'Import failed'
        };
      }

      // Process based on destination type
      const processedScene = await processSceneForDestination(scene, destination, options);
      
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
    console.log('⚙️ Processing scene for destination:', destination.type);
    
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
    console.log('💾 Storing scene at destination:', destination.label);
    
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
    console.log('🅿️ Enhancing for parking view');
    return scene;
  };

  const prepareForLayerOverlays = async (scene: SceneModel): Promise<SceneModel> => {
    // Prepare scene for status layer overlays
    console.log('🗺️ Preparing for layer overlays');
    return scene;
  };

  const isolateUnitView = async (scene: SceneModel): Promise<SceneModel> => {
    // Remove building context, focus on unit
    console.log('🏠 Isolating unit view');
    return scene;
  };

  const isolateStorageView = async (scene: SceneModel): Promise<SceneModel> => {
    // Focus on storage area
    console.log('📦 Isolating storage view');
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
