/**
 * useDxfViewerState - Refactored for New Architecture
 * Main hook that orchestrates all DXF viewer functionality using useCanvasOperations
 */

'use client';

import { useCallback, useState } from 'react';
import { useCanvasOperations } from './interfaces/useCanvasOperations';
import type { ToolType } from '../ui/toolbar/types';
import type { DrawingTool } from './useUnifiedDrawing';
import { useGripContext } from '../providers/GripProvider';
import { useToolbarState } from './common/useToolbarState';
import { useSceneState } from './scene/useSceneState';

export function useDxfViewerState() {
  const { gripSettings } = useGripContext();
  const canvasOps = useCanvasOperations();

  // Manage activeTool state locally
  const [activeTool, setActiveTool] = useState<ToolType>('select');

  // Use specialized hooks
  const toolbarState = useToolbarState();
  const sceneState = useSceneState();

  // Canvas actions through new API
  const canvasActions = {
    zoomIn: canvasOps.zoomIn,
    zoomOut: canvasOps.zoomOut,
    fitToView: canvasOps.fitToView,
    resetToOrigin: canvasOps.resetToOrigin,
    undo: useCallback(() => {
      // TODO: Implement undo through new architecture

    }, []),
    redo: useCallback(() => {
      // TODO: Implement redo through new architecture

    }, [])
  };

  // Enhanced tool change handler
  const handleToolChange = useCallback((tool: ToolType) => {

    setActiveTool(tool);

    const onZoomAction = (action: string) => {
      if (action === 'zoom-in') canvasActions.zoomIn();
      else if (action === 'zoom-out') canvasActions.zoomOut();
      else if (action === 'zoom-extents') canvasActions.fitToView();
      else if (action === 'zoom-reset') canvasActions.resetToOrigin();
    };

    toolbarState.handleToolChange(
      tool,
      () => {}, // No measurement system - empty function
      () => {}, // No drawing system - empty function
      onZoomAction,
      () => {} // No cancel operations - empty function
    );
  }, [toolbarState, canvasActions]);

  // Enhanced action handler
  const handleAction = useCallback((action: string, data?: number | string | Record<string, unknown>) => {
    console.log('🎯 useDxfViewerState handleAction called:', action, data); // DEBUG - shows actual values
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
      case 'undo':
        canvasActions.undo();
        break;
      case 'redo':
        canvasActions.redo();
        break;
      case 'fit-to-view':
      case 'zoom-extents':
        console.log('🎯 ENTERING fit-to-view case, calling canvasActions.fitToView()'); // DEBUG
        canvasActions.fitToView();
        console.log('🎯 FINISHED calling canvasActions.fitToView()'); // DEBUG
        break;
      case 'zoom-in':
        canvasActions.zoomIn();
        break;
      case 'zoom-out':
        canvasActions.zoomOut();
        break;
      case 'zoom-reset':
        canvasActions.resetToOrigin();
        break;
      case 'zoom-window':
        // Zoom window tool is handled by tool change, not direct action
        handleToolChange('zoom-window');
        break;
      case 'pan':
        // Pan tool is handled by tool change, not action
        handleToolChange('pan');
        break;
      default:
        console.warn('Unknown action:', action);
    }
  }, [toolbarState, canvasActions]);

  return {
    ...sceneState,
    ...toolbarState,
    gripSettings,
    activeTool,
    setActiveTool,
    handleToolChange,
    handleAction,
    canvasOps
  };
}