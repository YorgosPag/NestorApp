import { useCallback } from 'react';
import type { GridSettings, GridSettingsUpdate } from './config';
import { RULERS_GRID_CONFIG } from './config';
// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_RULERS_GRID = false;

export interface GridManagementHook {
  toggleGrid: () => void;
  setGridVisibility: (visible: boolean) => void;
  updateGridSettings: (updates: GridSettingsUpdate) => void;
  setGridStep: (step: number) => void;
  setGridOpacity: (opacity: number) => void;
  setGridColor: (color: string) => void;
}

export function useGridManagement(
  grid: GridSettings,
  setGrid: React.Dispatch<React.SetStateAction<GridSettings>>
): GridManagementHook {
  const toggleGrid = useCallback(() => {
    setGrid(prev => ({
      ...prev,
      visual: { ...prev.visual, enabled: !prev.visual.enabled }
    }));
  }, [setGrid]);

  const setGridVisibility = useCallback((visible: boolean) => {
    if (DEBUG_RULERS_GRID) console.log('🔧 [useGridManagement] setGridVisibility called:', { 
      visible, 
      currentEnabled: grid.visual.enabled,
      fullGridState: grid 
    });
    setGrid(prev => {
      const newGrid = {
        ...prev,
        visual: { ...prev.visual, enabled: visible }
      };
      if (DEBUG_RULERS_GRID) console.log('🔧 [useGridManagement] setGridVisibility NEW STATE:', newGrid);
      return newGrid;
    });
  }, [setGrid, grid]);

  const updateGridSettings = useCallback((updates: GridSettingsUpdate) => {
    if (DEBUG_RULERS_GRID) console.log('🔧 [useGridManagement] updateGridSettings called:', { 
      updates, 
      currentGrid: grid 
    });
    setGrid(prev => {
      const newSettings = { ...prev };
      
      if (updates.visual) {
        newSettings.visual = { ...prev.visual, ...updates.visual };
        if (DEBUG_RULERS_GRID) console.log('🔧 [useGridManagement] VISUAL update:', { 
          oldVisual: prev.visual,
          updateVisual: updates.visual,
          newVisual: newSettings.visual 
        });
      }
      if (updates.snap) {
        newSettings.snap = { ...prev.snap, ...updates.snap };
        if (DEBUG_RULERS_GRID) console.log('🔧 [useGridManagement] SNAP update:', newSettings.snap);
      }
      if (updates.behavior) {
        newSettings.behavior = { ...prev.behavior, ...updates.behavior };
        if (DEBUG_RULERS_GRID) console.log('🔧 [useGridManagement] BEHAVIOR update:', newSettings.behavior);
      }
      
      if (DEBUG_RULERS_GRID) console.log('🔧 [useGridManagement] updateGridSettings FINAL NEW STATE:', newSettings);
      return newSettings;
    });
  }, [setGrid, grid]);

  const setGridStep = useCallback((step: number) => {
    const clampedStep = Math.max(
      RULERS_GRID_CONFIG.MIN_GRID_STEP,
      Math.min(RULERS_GRID_CONFIG.MAX_GRID_STEP, step)
    );
    setGrid(prev => ({
      ...prev,
      visual: { ...prev.visual, step: clampedStep },
      snap: { ...prev.snap, step: clampedStep }
    }));
  }, [setGrid]);

  const setGridOpacity = useCallback((opacity: number) => {
    const clampedOpacity = Math.max(
      RULERS_GRID_CONFIG.MIN_OPACITY,
      Math.min(RULERS_GRID_CONFIG.MAX_OPACITY, opacity)
    );
    setGrid(prev => ({
      ...prev,
      visual: { ...prev.visual, opacity: clampedOpacity }
    }));
  }, [setGrid]);

  const setGridColor = useCallback((color: string) => {
    setGrid(prev => ({
      ...prev,
      visual: { ...prev.visual, color, majorGridColor: color, minorGridColor: color }
    }));
  }, [setGrid]);

  return {
    toggleGrid,
    setGridVisibility,
    updateGridSettings,
    setGridStep,
    setGridOpacity,
    setGridColor
  };
}