/**
 * useToolbarState
 * Manages toolbar tool selection and UI state
 */

'use client';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_TOOLBAR_STATE = false;

import { useState, useCallback } from 'react';
import type { ToolType } from '../../ui/toolbar/types';
import type { MeasurementType } from '../../types/measurements';
import type { DrawingTool } from '../drawing/useUnifiedDrawing';

export function useToolbarState() {
  // UI State - activeTool removed, now managed by parent
  const [showGrid, setShowGrid] = useState(true);
  const [showLayers, setShowLayers] = useState(true); // ✅ ΔΙΟΡΘΩΣΗ: Default true για να φαίνονται τα layers
  const [showCalibration, setShowCalibration] = useState(false);
  const [showCursorSettings, setShowCursorSettings] = useState(false);

  // Tool change handler
  const handleToolChange = useCallback((
    tool: ToolType,
    onMeasurementStart: (type: MeasurementType) => void,
    onDrawingStart: (tool: DrawingTool) => void,
    onZoomAction: (action: string) => void,
    onCancel: () => void
  ) => {

    onCancel(); // Cancel any ongoing operations
    
    // Handle zoom tools directly
    if (tool === 'zoom-in') {
      onZoomAction('zoom-in');
      return;
    } else if (tool === 'zoom-out') {
      onZoomAction('zoom-out');
      return;
    } else if (tool === 'zoom-extents') {
      onZoomAction('zoom-extents');
      return;
    } else if (tool === 'zoom-window') {
      // zoom-window handled by parent - no local setActiveTool
      return;
    }
    
    // activeTool is now managed by parent - no local setActiveTool

    if (tool === 'measure-distance') {
      // measure-distance uses same logic as line tool but keeps its own identity

      onDrawingStart('measure-distance');
    } else if (tool === 'measure-area') {

      onDrawingStart('measure-area');
    } else if (tool === 'measure-angle') {
      // measure-angle uses same logic as polyline tool but keeps its own identity

      onDrawingStart('measure-angle');
    } else if (tool.startsWith('measure-')) {
      const measurementType = tool.replace('measure-', '') as MeasurementType;
      onMeasurementStart(measurementType);
    } else if (['line', 'rectangle', 'circle', 'circle-diameter', 'circle-2p-diameter', 'polyline', 'polygon'].includes(tool)) {
      onDrawingStart(tool as DrawingTool);
    }
  }, []);

  // UI toggle handlers
  const toggleGrid = useCallback(() => setShowGrid(p => !p), []);
  const toggleLayers = useCallback(() => setShowLayers(p => !p), []);
  const toggleCalibration = useCallback(() => setShowCalibration(p => !p), []);
  const toggleCursorSettings = useCallback(() => setShowCursorSettings(p => !p), []);

  return {
    // State - activeTool removed, now managed by parent
    showGrid,
    showLayers,
    showCalibration,
    showCursorSettings,
    
    // Actions - setActiveTool removed, now managed by parent
    handleToolChange,
    toggleGrid,
    toggleLayers,
    toggleCalibration,
    toggleCursorSettings
  };
}