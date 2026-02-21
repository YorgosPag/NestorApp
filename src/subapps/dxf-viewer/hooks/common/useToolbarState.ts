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
  const [showLayers, setShowLayers] = useState(true); // ✅ DEFAULT: Show colored layers by default
  const [showCalibration, setShowCalibration] = useState(false);
  const [showCursorSettings, setShowCursorSettings] = useState(false);
  // ADR-189 §4.13: Guide Panel visibility
  const [showGuidePanel, setShowGuidePanel] = useState(false);

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

    if (tool === 'measure-distance' || tool === 'measure-distance-continuous') {
      // 🏢 ENTERPRISE (2026-01-27): Distance measurement tools (single + continuous)
      // Both use same drawing logic but continuous doesn't stop after 2nd point
      onDrawingStart(tool as DrawingTool);
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
  const toggleGuidePanel = useCallback(() => setShowGuidePanel(p => !p), []);
  // ADR-189: Open only (idempotent — won't close if already open)
  const openGuidePanel = useCallback(() => setShowGuidePanel(true), []);

  return {
    // State - activeTool removed, now managed by parent
    showGrid,
    showLayers,
    showCalibration,
    showCursorSettings,
    showGuidePanel,

    // Actions - setActiveTool removed, now managed by parent
    handleToolChange,
    toggleGrid,
    toggleLayers,
    toggleCalibration,
    toggleCursorSettings,
    toggleGuidePanel,
    openGuidePanel
  };
}