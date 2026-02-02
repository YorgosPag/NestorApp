import { useState, useEffect, useCallback } from 'react';
import type { Point2D } from '../rendering/types/Types';
import type { Region, RegionStatus } from '../types/overlay';
// 🏢 ADR-092: Centralized localStorage Service
import { storageGet, storageSet, STORAGE_KEYS } from '../utils/storage-utils';

// ✅ ENTERPRISE FIX: Extended OverlayState for manager use
interface ExtendedOverlayState {
  regions: Record<string, Region>; // Object instead of array for efficient lookup
  layers: Record<string, RegionLayerObject>;
  groups: Record<string, unknown>;
  currentLayerId: string;
}
import { RegionOperations, DuplicationGuard, type RegionLayerObject } from '../utils/region-operations';
import { useDrawingSystem } from '../hooks/drawing/useDrawingSystem';
// ADR-130: Centralized Default Layer Name
import { DEFAULT_LAYER_NAME } from '../config/layer-config';
// ✅ ENTERPRISE FIX: Import hooks only, not React components
import { useSelection } from '../systems/selection';
import { useLevels } from '../systems/levels';

// ADR-130: Centralized default layer
const initialState: ExtendedOverlayState = {
  regions: {},
  layers: { [DEFAULT_LAYER_NAME]: RegionOperations.createDefaultLayer() },
  groups: {},
  currentLayerId: DEFAULT_LAYER_NAME
};

export function useOverlayManager() {
  const [coreState, setCoreState] = useState(initialState);
  const { currentLevelId } = useLevels();
  
  // Compose with specialized hooks
  const drawingSystem = useDrawingSystem();
  const selectionSystem = useSelection();
  const duplicationGuard = DuplicationGuard.getInstance();

  // ---------- Persistence per level ----------
  // 🏢 ADR-092: Using centralized storage-utils
  useEffect(() => {
    if (!currentLevelId) return;

    interface PersistedOverlayData {
      regions?: Record<string, Region>;
      layers?: Record<string, RegionLayerObject>;
      groups?: Record<string, unknown>;
    }

    const storageKey = `${STORAGE_KEYS.OVERLAY_STATE_PREFIX}${currentLevelId}`;
    const saved = storageGet<PersistedOverlayData | null>(storageKey, null);

    if (saved) {
      setCoreState(prev => ({
        ...prev,
        regions: saved.regions || {},
        layers: saved.layers || { default: RegionOperations.createDefaultLayer() },
        groups: saved.groups || {}
      }));
    }
  }, [currentLevelId]);

  useEffect(() => {
    if (!currentLevelId) return;

    const storageKey = `${STORAGE_KEYS.OVERLAY_STATE_PREFIX}${currentLevelId}`;
    storageSet(storageKey, {
      regions: coreState.regions,
      layers: coreState.layers,
      groups: coreState.groups
    });
  }, [coreState.regions, coreState.layers, coreState.groups, currentLevelId]);

  // ---------- Region CRUD with duplication prevention ----------
  const createRegion = useCallback((vertices: Point2D[], status: RegionStatus = 'for-sale'): string => {
    if (!currentLevelId || vertices.length < 3) return '';

    // Check for time-window duplicates
    const duplicateCheck = duplicationGuard.checkDuplication(vertices);
    if (duplicateCheck.isDuplicate && duplicateCheck.existingId) {
      return duplicateCheck.existingId;
    }

    // ✅ ENTERPRISE FIX: Pass regions object directly
    const existing = RegionOperations.findRegionDuplicate(
      coreState.regions,
      vertices,
      currentLevelId,
      status
    );
    
    if (existing) {
      console.warn('🛡️ Duplicate createRegion blocked (deep compare). Returning:', existing.id);
      duplicationGuard.registerCreation(vertices, existing.id);
      return existing.id;
    }

    // Create new region
    try {
      const region = RegionOperations.createRegion(vertices, currentLevelId, status);
      
      setCoreState(prev => {
        // ADR-130: Centralized default layer
        const layerId = prev.currentLayerId || DEFAULT_LAYER_NAME;
        const updatedLayers = RegionOperations.addRegionToLayer(prev.layers, layerId, region.id);
        
        return {
          ...prev,
          regions: { ...prev.regions, [region.id]: region },
          layers: updatedLayers
        };
      });

      // Update selection to new region
      selectionSystem.selectRegion(region.id);
      
      // Register creation to prevent duplicates
      duplicationGuard.registerCreation(vertices, region.id);

      return region.id;
    } catch (error) {
      console.error('❌ Failed to create region:', error);
      return '';
    }
  }, [coreState.regions, currentLevelId, selectionSystem]);

  const updateRegion = useCallback((regionId: string, updates: Partial<Region>) => {
    setCoreState(prev => {
      const region = prev.regions[regionId];
      if (!region) return prev;
      
      try {
        const updatedRegion = RegionOperations.updateRegion(region, updates);
        return {
          ...prev,
          regions: { ...prev.regions, [regionId]: updatedRegion }
        };
      } catch (error) {
        console.error('❌ Failed to update region:', error);
        return prev;
      }
    });
  }, []);

  const deleteRegion = useCallback((regionId: string) => {
    setCoreState(prev => {
      if (!prev.regions[regionId]) return prev;
      
      const { [regionId]: _deleted, ...restRegions } = prev.regions;
      const updatedLayers = RegionOperations.removeRegionFromLayers(prev.layers, regionId);
      
      return {
        ...prev,
        regions: restRegions,
        layers: updatedLayers
      };
    });
    
    // Update selection
    selectionSystem.removeFromSelection(regionId);
  }, [selectionSystem]);

  const toggleRegionVisibility = useCallback((regionId: string) => {
    updateRegion(regionId, { 
      visible: !coreState.regions[regionId]?.visible 
    });
  }, [updateRegion, coreState.regions]);

  // ---------- Enhanced drawing integration ----------
  const enhancedFinishDrawing = useCallback(() => {
    const vertices = drawingSystem.finishDrawing();
    if (vertices) {
      const regionId = createRegion(vertices, drawingSystem.drawingRegionStatus);
      return regionId;
    }
    return null;
  }, [drawingSystem, createRegion]);

  // ---------- Computed values ----------
  const getVisibleRegions = useCallback(() => {
    if (!currentLevelId) return [];
    
    // ✅ ENTERPRISE FIX: Pass regions object directly
    return RegionOperations.getVisibleRegions(
      coreState.regions,
      currentLevelId,
      selectionSystem.filters.visibleStatuses,
      selectionSystem.filters.visibleUnitTypes
    );
  }, [coreState.regions, currentLevelId, selectionSystem.filters.visibleStatuses, selectionSystem.filters.visibleUnitTypes]);

  return {
    // Core state (computed)
    ...coreState,
    visibleRegions: getVisibleRegions(),

    // Drawing system (delegated)
    ...drawingSystem,
    finishDrawing: enhancedFinishDrawing,

    // Selection system (delegated)
    ...selectionSystem,

    // Region operations
    createRegion,
    updateRegion,
    deleteRegion,
    toggleRegionVisibility,

    // Utility methods
    clearLevel: () => {
      setCoreState(initialState);
      selectionSystem.clearSelection();
      drawingSystem.cancelDrawing();
      duplicationGuard.clear();
    }
  };
}
