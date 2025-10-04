'use client';

import { useRef, useState, useCallback } from 'react';
import type { ToolType } from '../../../../ui/toolbar/types';
import type { DxfCanvasRef } from '../../DxfCanvas';
import type { MeasurementRenderer } from '../../../../utils/measurement-tools';

export function useDxfViewerState() {
  // ============================================================================
  // TOOL STATE - Tool selection and toolbar-related state
  // ============================================================================
  const [activeTool, setActiveTool] = useState<ToolType>('select');

  // ============================================================================
  // CANVAS STATE - Canvas references and canvas-specific state  
  // ============================================================================
  const dxfCanvasRef = useRef<DxfCanvasRef>(null);
  const overlayCanvasRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentZoom, setCurrentZoom] = useState(1.0);

  // ============================================================================
  // UI STATE - UI visibility and display toggles
  // ============================================================================
  const [showGrid, setShowGrid] = useState(true);
  const [showLayers, setShowLayers] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [isZoomWindowActive, setIsZoomWindowActive] = useState(false);

  // ============================================================================
  // SELECTION STATE - Entity selection management
  // ============================================================================
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);

  // ============================================================================
  // SYSTEM STATE - External system integrations and app-level state
  // ============================================================================
  const [measurementRenderer, setMeasurementRenderer] = useState<MeasurementRenderer | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // ============================================================================
  // HELPER FUNCTIONS (memoized για σταθερότητα)
  // ============================================================================
  
  const resetUIState = useCallback(() => {
    setShowGrid(true);
    setShowLayers(false);
    setShowProperties(false);
    setShowCalibration(false);
    setIsZoomWindowActive(false);
  }, []);

  const resetToolState = useCallback(() => {
    setActiveTool('select');
  }, []);

  const resetSelectionState = useCallback(() => {
    setSelectedEntityIds([]);
  }, []);

  const resetSystemState = useCallback(() => {
    setMeasurementRenderer(null);
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  const resetAllState = useCallback(() => {
    resetToolState();
    resetUIState();
    resetSelectionState();
    resetSystemState();
    setCurrentZoom(1.0);
  }, [resetToolState, resetUIState, resetSelectionState, resetSystemState]);

  return {
    // ========== TOOL STATE ==========
    activeTool,
    setActiveTool,

    // ========== CANVAS STATE ========== 
    dxfCanvasRef,
    overlayCanvasRef,
    canvasRef,
    currentZoom,
    setCurrentZoom,

    // ========== UI STATE ==========
    showGrid,
    setShowGrid,
    showLayers,
    setShowLayers,
    showProperties,
    setShowProperties,
    showCalibration,
    setShowCalibration,
    isZoomWindowActive,
    setIsZoomWindowActive,

    // ========== SELECTION STATE ==========
    selectedEntityIds,
    setSelectedEntityIds,

    // ========== SYSTEM STATE ==========
    measurementRenderer,
    setMeasurementRenderer,
    canUndo,
    setCanUndo,
    canRedo,
    setCanRedo,

    // ========== HELPER FUNCTIONS ==========
    resetUIState,
    resetToolState,
    resetSelectionState,
    resetSystemState,
    resetAllState,
  };
}