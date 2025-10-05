import { useState, useEffect, useCallback } from 'react';
import type { Point2D } from '../rendering/types/Types';
import type { OverlayState, Region, OverlayLayer, RegionStatus } from '../types/overlay';
import { RegionOperations, DuplicationGuard } from '../utils/region-operations';
import { useDrawingSystem } from '../hooks/drawing/useDrawingSystem';
import { useSelection } from '../systems/selection/SelectionSystem';
import { useLevels } from '../systems/levels';

const initialState: Pick<OverlayState, 'regions' | 'layers' | 'groups' | 'currentLayerId'> = {
  regions: {},
  layers: { default: RegionOperations.createDefaultLayer() },
  groups: {},
  currentLayerId: 'default'
};

export function useOverlayManager() {
  const [coreState, setCoreState] = useState(initialState);
  const { currentLevelId } = useLevels();
  
  // Compose with specialized hooks
  const drawingSystem = useDrawingSystem();
  const selectionSystem = useSelection();
  const duplicationGuard = DuplicationGuard.getInstance();

  // ---------- Persistence per level ----------
  useEffect(() => {
    if (!currentLevelId) return;
    
    try {
      const saved = localStorage.getItem(`dxf-overlay-${currentLevelId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setCoreState(prev => ({
          ...prev,
          regions: parsed.regions || {},
          layers: parsed.layers || { default: RegionOperations.createDefaultLayer() },
          groups: parsed.groups || {}
        }));
      }
    } catch (error) {
      console.warn('Failed to load overlay state:', error);
    }
  }, [currentLevelId]);

  useEffect(() => {
    if (!currentLevelId) return;
    
    try {
      localStorage.setItem(`dxf-overlay-${currentLevelId}`, JSON.stringify({
        regions: coreState.regions,
        layers: coreState.layers,
        groups: coreState.groups
      }));
    } catch (error) {
      console.warn('Failed to save overlay state:', error);
    }
  }, [coreState.regions, coreState.layers, coreState.groups, currentLevelId]);

  // ---------- Region CRUD with duplication prevention ----------
  const createRegion = useCallback((vertices: Point2D[], status: RegionStatus = 'for-sale'): string => {
    if (!currentLevelId || vertices.length < 3) return '';

    // Check for time-window duplicates
    const duplicateCheck = duplicationGuard.checkDuplication(vertices);
    if (duplicateCheck.isDuplicate && duplicateCheck.existingId) {
      return duplicateCheck.existingId;
    }

    // Check for existing identical regions
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
        const layerId = prev.currentLayerId || 'default';
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
    
    return RegionOperations.getVisibleRegions(
      coreState.regions,
      currentLevelId,
      selectionSystem.visibleStatuses,
      selectionSystem.visibleUnitTypes
    );
  }, [coreState.regions, currentLevelId, selectionSystem.visibleStatuses, selectionSystem.visibleUnitTypes]);

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
