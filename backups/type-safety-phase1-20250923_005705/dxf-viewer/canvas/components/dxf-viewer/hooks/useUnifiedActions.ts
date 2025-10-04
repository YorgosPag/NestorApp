'use client';

// ✅ Debug flag for unified actions logging
const DEBUG_CANVAS_CORE = false;

import { useCallback } from 'react';
import type { ToolType } from '../../../../ui/toolbar/types';

interface UnifiedActionsOptions {
  // Zoom actions
  zoomIn: () => void;
  zoomOut: () => void;
  fitToView: () => void;
  setZoom: (zoom: number) => void;
  
  // UI actions
  toggleGrid: () => void;
  toggleLayers: () => void;
  toggleProperties: () => void;
  toggleCalibration: () => void;
  
  // Canvas actions
  handleUndo: () => void;
  handleRedo: () => void;
  
  // Tool actions
  handleToolChange: (tool: ToolType) => void;
}

export function useUnifiedActions({
  zoomIn,
  zoomOut,
  fitToView,
  setZoom,
  toggleGrid,
  toggleLayers,
  toggleProperties,
  toggleCalibration,
  handleUndo,
  handleRedo,
  handleToolChange
}: UnifiedActionsOptions) {
  
  // ============================================================================
  // UNIFIED ACTION HANDLER - Single point of entry για όλες τις actions
  // ============================================================================
  const handleAction = useCallback((action: string, data?: any) => {
    switch (action) {
      // Zoom actions
      case 'zoom-in-action':
        zoomIn();
        break;
        
      case 'zoom-out-action':
        zoomOut();
        break;
        
      case 'fit':
        fitToView();
        break;
        
      case 'set-zoom':
        if (typeof data === 'number') {
          setZoom(data);
        }
        break;
        
      // UI toggle actions
      case 'grid':
        toggleGrid();
        break;
      case 'toggle-layers':
        toggleLayers();
        break;
      case 'toggle-properties':
        toggleProperties();
        break;
      case 'toggle-calibration':
        toggleCalibration();
        break;
        
      // Tool actions
      case 'zoom-window':
        handleToolChange('zoom-window');
        break;
        
      // Canvas history actions
      case 'undo':
        handleUndo();
        break;
      case 'redo':
        handleRedo();
        break;
        
      default:
        if (DEBUG_CANVAS_CORE) console.log('🔍 Unhandled action:', action, data);
    }
  }, [
    zoomIn,
    zoomOut,
    fitToView,
    setZoom,
    toggleGrid,
    toggleLayers,
    toggleProperties,
    toggleCalibration,
    handleToolChange,
    handleUndo,
    handleRedo
  ]);

  return {
    handleAction,
  };
}