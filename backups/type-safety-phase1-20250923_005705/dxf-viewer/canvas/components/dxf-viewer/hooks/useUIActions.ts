'use client';

import { useCallback } from 'react';

interface UIActionsOptions {
  showGrid: boolean;
  showLayers: boolean;
  showProperties: boolean;
  showCalibration: boolean;
  setShowGrid: (show: boolean) => void;
  setShowLayers: (show: boolean) => void;
  setShowProperties: (show: boolean) => void;
  setShowCalibration: (show: boolean) => void;
}

export function useUIActions({
  showGrid,
  showLayers,
  showProperties,
  showCalibration,
  setShowGrid,
  setShowLayers,
  setShowProperties,
  setShowCalibration
}: UIActionsOptions) {
  
  // ============================================================================
  // UI TOGGLE ACTIONS
  // ============================================================================
  const toggleGrid = useCallback(() => {
    setShowGrid(prev => !prev);
  }, [setShowGrid]);

  const toggleLayers = useCallback(() => {
    setShowLayers(prev => !prev);
  }, [setShowLayers]);

  const toggleProperties = useCallback(() => {
    setShowProperties(prev => !prev);
  }, [setShowProperties]);

  const toggleCalibration = useCallback(() => {
    setShowCalibration(prev => !prev);
  }, [setShowCalibration]);

  return {
    // State
    showGrid,
    showLayers,
    showProperties,
    showCalibration,
    
    // Actions
    toggleGrid,
    toggleLayers,
    toggleProperties,
    toggleCalibration,
  };
}