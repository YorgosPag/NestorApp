/**
 * useDxfViewerState - Refactored for New Architecture
 * Main hook that orchestrates all DXF viewer functionality using useCanvasOperations
 */

'use client';

import { useCallback, useState } from 'react';
import { useCanvasOperations } from './interfaces/useCanvasOperations';
import type { ToolType } from '../ui/toolbar/types';
import type { DrawingTool } from './drawing/useUnifiedDrawing';
import { useGripContext } from '../providers/GripProvider';
import { useToolbarState } from './common/useToolbarState';
import { useSceneState } from './scene/useSceneState';
import { useDrawingHandlers } from './drawing/useDrawingHandlers';
import { useSnapContext } from '../snapping/context/SnapContext';
// 🏢 ENTERPRISE (2026-01-26): Command History for Undo/Redo - ADR-032
import { useCommandHistory } from '../core/commands';

export function useDxfViewerState() {
  const { gripSettings } = useGripContext();
  const canvasOps = useCanvasOperations();
  // 🏢 ENTERPRISE (2026-01-26): Command History for Undo/Redo - ADR-032
  const { undo, redo, canUndo, canRedo } = useCommandHistory();

  // Manage activeTool state locally
  const [activeTool, setActiveTool] = useState<ToolType>('select');

  // Use specialized hooks
  const toolbarState = useToolbarState();
  const sceneState = useSceneState();

  // 🎯 CENTRALIZED SNAP SYSTEM
  const { snapEnabled, setSnapEnabled } = useSnapContext();

  // 🎯 CENTRALIZED DRAWING SYSTEM
  const drawingHandlers = useDrawingHandlers(
    activeTool,
    (entity) => {
      // Handle entity creation - add to scene
      if (sceneState.currentScene) {
        const updatedScene = {
          ...sceneState.currentScene,
          entities: [...sceneState.currentScene.entities, entity]
        };
        sceneState.handleSceneChange(updatedScene);
      }
    },
    setActiveTool,
    sceneState.currentScene || undefined
  );

  // Canvas actions through new API
  // 🏢 ENTERPRISE (2026-01-26): Undo/Redo connected to Command History - ADR-032
  // 🏢 ENTERPRISE (2026-01-27): Added getTransform/setTransform for direct scale setting - ADR-043
  const canvasActions = {
    zoomIn: canvasOps.zoomIn,
    zoomOut: canvasOps.zoomOut,
    fitToView: canvasOps.fitToView,
    resetToOrigin: canvasOps.resetToOrigin,
    getTransform: canvasOps.getTransform,
    setTransform: canvasOps.setTransform,
    undo: useCallback(() => {
      if (canUndo) {
        undo();
      }
    }, [canUndo, undo]),
    redo: useCallback(() => {
      if (canRedo) {
        redo();
      }
    }, [canRedo, redo])
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

    // 🏢 ENTERPRISE (2026-01-27): Connect drawing/measurement tools to unified drawing system
    // Both onMeasurementStart and onDrawingStart call the same startDrawing from useUnifiedDrawing
    // This enables measure-angle, measure-area, measure-distance, line, rectangle, etc.
    toolbarState.handleToolChange(
      tool,
      drawingHandlers.startDrawing, // ✅ MEASUREMENT TOOLS: measure-angle, measure-area, measure-distance
      drawingHandlers.startDrawing, // ✅ DRAWING TOOLS: line, rectangle, circle, polyline, polygon
      onZoomAction,
      drawingHandlers.cancelAllOperations // ✅ CANCEL: Stop any ongoing drawing/measurement
    );
  }, [toolbarState, canvasActions, drawingHandlers]);

  // Enhanced action handler
  const handleAction = useCallback((action: string, data?: number | string | Record<string, unknown>) => {
    switch (action) {
      case 'grid':
        toolbarState.toggleGrid();
        break;
      case 'toggle-layers':
      case 'layering':
        toolbarState.toggleLayers();
        break;
      case 'toggle-calibration':
        toolbarState.toggleCalibration();
        break;
      case 'toggle-cursor-settings':
        toolbarState.toggleCursorSettings();
        break;
      case 'toggle-snap':
        setSnapEnabled(!snapEnabled);
        break;
      case 'undo':
        canvasActions.undo();
        break;
      case 'redo':
        canvasActions.redo();
        break;
      case 'fit-to-view':
      case 'zoom-extents':
        canvasActions.fitToView();
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
      case 'set-zoom':
        // 🏢 ENTERPRISE: Direct scale setting from ZoomControls input
        // data is a decimal value (e.g., 1.0 = 100%, 0.5 = 50%)
        if (typeof data === 'number' && !isNaN(data)) {
          const currentTransform = canvasActions.getTransform();
          canvasActions.setTransform({
            ...currentTransform,
            scale: data
          });
        }
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
  }, [toolbarState, canvasActions, snapEnabled, setSnapEnabled, handleToolChange]);

  return {
    ...sceneState,
    ...toolbarState,
    gripSettings,
    activeTool,
    setActiveTool,
    handleToolChange,
    onToolChange: handleToolChange, // 🔧 ALIAS: For backward compatibility with components expecting onToolChange
    handleAction,
    onAction: handleAction, // 🔧 ALIAS: For backward compatibility with components expecting onAction
    canvasOps,
    // ✅ CENTRALIZED: Drawing/Measurement handlers from useDrawingHandlers
    drawingState: drawingHandlers.drawingState,
    onDrawingPoint: drawingHandlers.onDrawingPoint,
    onDrawingHover: drawingHandlers.onDrawingHover,
    onDrawingCancel: drawingHandlers.onDrawingCancel,
    onDrawingDoubleClick: drawingHandlers.onDrawingDoubleClick,
    // Measurement handlers (same as drawing - unified system)
    onMeasurementPoint: drawingHandlers.onDrawingPoint,
    onMeasurementHover: drawingHandlers.onDrawingHover,
    onMeasurementCancel: drawingHandlers.onDrawingCancel,
    // ✅ CENTRALIZED: Snap system from SnapContext
    snapEnabled,
    // 🏢 ENTERPRISE (2026-01-26): Undo/Redo from Command History - ADR-032
    canUndo,
    canRedo,
    currentZoom: 1, // TODO: Get from ZoomManager
    handleCalibrationToggle: toolbarState.toggleCalibration
  };
}