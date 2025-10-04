
/**
 * useDxfViewerState - Refactored
 * Main hook that orchestrates all DXF viewer functionality using specialized hooks
 */

'use client';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_DXF_VIEWER_STATE = false;

import { useCallback, useState } from 'react';
import type { DxfCanvasRef } from '../canvas/DxfCanvas';
import type { ToolType } from '../ui/toolbar/types';
import type { DrawingTool } from './useUnifiedDrawing';
import { useGripContext } from '../providers/GripProvider';
import { useToolbarState } from './common/useToolbarState';
import { useCanvasActions } from './canvas/useCanvasActions';
import { useSceneState } from './scene/useSceneState';
import { useDrawingHandlers } from './drawing/useDrawingHandlers';

export function useDxfViewerState(dxfCanvasRef: React.RefObject<DxfCanvasRef>) {
  const { gripSettings } = useGripContext();

  // Manage activeTool state locally since useToolbarState no longer provides it
  const [activeTool, setActiveTool] = useState<ToolType>('select');

  // Use specialized hooks
  const toolbarState = useToolbarState();
  const sceneState = useSceneState(dxfCanvasRef);
  const canvasActions = useCanvasActions(dxfCanvasRef, sceneState.currentScene, sceneState.selectedEntityIds, sceneState.handleSceneChange);
  const drawingHandlers = useDrawingHandlers(
    dxfCanvasRef,
    activeTool,
    sceneState.onEntityCreated,
    setActiveTool,
    sceneState.currentScene
  );

  // Enhanced tool change handler that coordinates all systems
  const handleToolChange = useCallback((tool: ToolType) => {
    if (DEBUG_DXF_VIEWER_STATE) console.log('🔧 [useDxfViewerState] handleToolChange called with:', tool);
    if (DEBUG_DXF_VIEWER_STATE) console.log('🔧 [useDxfViewerState] Previous activeTool:', activeTool);

    // Set the active tool state
    setActiveTool(tool);
    if (DEBUG_DXF_VIEWER_STATE) console.log('🔧 [useDxfViewerState] Setting activeTool to:', tool);
    
    const onDrawingStart = (drawingTool: DrawingTool) => {
      drawingHandlers.startDrawing?.(drawingTool);
    };
    
    const onZoomAction = (action: string) => {
      if (action === 'zoom-in') canvasActions.zoomIn();
      else if (action === 'zoom-out') canvasActions.zoomOut();
      else if (action === 'zoom-extents') canvasActions.fitToView();
    };
    
    toolbarState.handleToolChange(
      tool,
      () => {}, // No measurement system - empty function
      onDrawingStart,
      onZoomAction,
      drawingHandlers.cancelAllOperations
    );
  }, [toolbarState, drawingHandlers, canvasActions]);

  // Enhanced action handler that includes UI toggles
  const handleAction = useCallback((action: string, data?: any) => {
    switch (action) {
      case 'grid': 
        toolbarState.toggleGrid(); 
        break;
      case 'toggle-layers': 
      case 'layering': 
        toolbarState.toggleLayers(); 
        break;
      case 'toggle-properties': 
        toolbarState.toggleProperties(); 
        break;
      case 'toggle-calibration': 
        toolbarState.toggleCalibration(); 
        break;
      case 'toggle-cursor-settings': 
        toolbarState.toggleCursorSettings(); 
        break;
      case 'zoom-window': 
        handleToolChange('zoom-window'); 
        break;
      default: 
        canvasActions.handleAction(action, data);
    }
  }, [toolbarState, canvasActions, handleToolChange]);

  // Calibration toggle handler
  const handleCalibrationToggle = useCallback((show: boolean) => {
    if (show !== toolbarState.showCalibration) {
      toolbarState.toggleCalibration();
    }
  }, [toolbarState]);

  // Cursor settings toggle handler
  const handleCursorSettingsToggle = useCallback(() => {
    toolbarState.toggleCursorSettings();
  }, [toolbarState]);

  return {
    // State from specialized hooks
    activeTool,
    currentZoom: canvasActions.currentZoom,
    showGrid: toolbarState.showGrid,
    snapEnabled: canvasActions.snapEnabled,
    showLayers: toolbarState.showLayers,
    showCalibration: toolbarState.showCalibration,
    showCursorSettings: toolbarState.showCursorSettings,
    canUndo: canvasActions.canUndo,
    canRedo: canvasActions.canRedo,
    currentScene: sceneState.currentScene,
    selectedEntityIds: sceneState.selectedEntityIds,
    drawingState: drawingHandlers.drawingState,
    gripSettings,

    // Actions
    handleToolChange,
    handleAction,
    handleFileImport: sceneState.handleFileImport,
    handleTransformChange: canvasActions.handleTransformChange,
    handleSceneChange: sceneState.handleSceneChange,
    handleCalibrationToggle,
    handleCursorSettingsToggle,
    setSelectedEntityIds: sceneState.setSelectedEntityIds,
    onDrawingPoint: drawingHandlers.onDrawingPoint,
    onDrawingHover: drawingHandlers.onDrawingHover,
    onDrawingCancel: drawingHandlers.onDrawingCancel,
    onDrawingDoubleClick: drawingHandlers.onDrawingDoubleClick,
    onEntityCreated: sceneState.onEntityCreated,
    onToggleSnap: canvasActions.setSnapEnabled,
  };
}
