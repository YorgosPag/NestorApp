/**
 * useDxfViewerState - Refactored for New Architecture
 * Main hook that orchestrates all DXF viewer functionality using useCanvasOperations
 */

'use client';

import { useCallback } from 'react';
import { useCanvasOperations } from './interfaces/useCanvasOperations';
import type { ToolType } from '../ui/toolbar/types';
import type { DrawingTool } from './drawing/useUnifiedDrawing';
import { useGripContext } from '../providers/GripProvider';
import { useToolbarState } from './common/useToolbarState';
import { useSceneState } from './scene/useSceneState';
import { useDrawingHandlers } from './drawing/useDrawingHandlers';
import { useSnapContext } from '../snapping/context/SnapContext';
import type { MeasurementType } from '../types/measurements';
// 🏢 ENTERPRISE (2026-01-26): Command History for Undo/Redo - ADR-032
import { useCommandHistory } from '../core/commands';
// 🏢 ENTERPRISE (2026-01-30): Centralized Tool State Store - ADR Tool Persistence
import { useToolState, toolStateStore } from '../stores/ToolStateStore';
// 🏢 ENTERPRISE FIX (2026-02-02): Get reactive transform from CanvasContext
import { useCanvasContext } from '../contexts/CanvasContext';
// 📐 ADR-189: Guide visibility toggle via keyboard chord (G → V)
import { getGlobalGuideStore } from '../systems/guides';
// 🏢 FIX: Grid visibility toggle — use RulersGridContext (single source of truth)
import { useRulersGridContext } from '../systems/rulers-grid/RulersGridSystem';

export function useDxfViewerState() {
  const { gripSettings } = useGripContext();
  const canvasOps = useCanvasOperations();
  // 🏢 ENTERPRISE FIX (2026-02-02): Get reactive transform for zoom display
  const canvasContext = useCanvasContext();
  // 🏢 ENTERPRISE (2026-01-26): Command History for Undo/Redo - ADR-032
  const { undo, redo, canUndo, canRedo } = useCommandHistory();

  // 🏢 ENTERPRISE (2026-01-30): Centralized Tool State from ToolStateStore
  // SINGLE SOURCE OF TRUTH: All components subscribe to this store
  // Pattern: AutoCAD/BricsCAD - tools stay active after entity creation (allowsContinuous)
  const { activeTool } = useToolState();

  // Wrapper to update tool state via store
  const setActiveTool = useCallback((tool: ToolType) => {
    toolStateStore.selectTool(tool);
  }, []);

  // Use specialized hooks
  const toolbarState = useToolbarState();
  const sceneState = useSceneState();

  // 🎯 CENTRALIZED SNAP SYSTEM
  const { snapEnabled, setSnapEnabled } = useSnapContext();

  // 🏢 FIX: Grid visibility from RulersGridContext (single source of truth)
  // Previously, toolbar used a disconnected local state (useToolbarState.showGrid)
  // while the settings panel used RulersGridContext — they were never synchronized.
  const rulersGridContext = useRulersGridContext();
  const gridVisible = rulersGridContext.state.grid?.visual?.enabled ?? true;

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

    const onMeasurementStart = (type: MeasurementType) => {
      const measurementTool: DrawingTool | null = (() => {
        if (type === 'distance') return 'measure-distance';
        if (type === 'distance-continuous') return 'measure-distance-continuous';
        if (type === 'area') return 'measure-area';
        if (type === 'angle') return 'measure-angle';
        if (type === 'linear') return 'measure-distance';
        if (type === 'angular') return 'measure-angle';
        return null;
      })();

      if (measurementTool) {
        drawingHandlers.startDrawing(measurementTool);
      }
    };

    // 🏢 ENTERPRISE (2026-01-27): Connect drawing/measurement tools to unified drawing system
    // Both onMeasurementStart and onDrawingStart call the same startDrawing from useUnifiedDrawing
    // This enables measure-angle, measure-area, measure-distance, line, rectangle, etc.
    toolbarState.handleToolChange(
      tool,
      onMeasurementStart, // ✅ MEASUREMENT TOOLS: measure-angle, measure-area, measure-distance
      drawingHandlers.startDrawing, // ✅ DRAWING TOOLS: line, rectangle, circle, polyline, polygon
      onZoomAction,
      drawingHandlers.cancelAllOperations // ✅ CANCEL: Stop any ongoing drawing/measurement
    );
  }, [toolbarState, canvasActions, drawingHandlers, setActiveTool]);

  // Enhanced action handler
  const handleAction = useCallback((action: string, data?: number | string | Record<string, unknown>) => {
    switch (action) {
      case 'grid':
        // 🏢 FIX: Toggle via RulersGridContext (same source as settings panel)
        rulersGridContext.setGridVisibility(!gridVisible);
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
      // 📐 ADR-189: Toggle construction guide visibility (chord: G → V)
      case 'toggle-guides': {
        const guideStore = getGlobalGuideStore();
        guideStore.setVisible(!guideStore.isVisible());
        break;
      }
      default:
        console.warn('Unknown action:', action);
    }
  }, [toolbarState, canvasActions, snapEnabled, setSnapEnabled, handleToolChange, rulersGridContext, gridVisible]);

  return {
    ...sceneState,
    ...toolbarState,
    // 🏢 FIX: Override showGrid with actual source of truth (RulersGridContext)
    // This ensures the toolbar button label/icon reflects the real grid state
    showGrid: gridVisible,
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
    // 🏢 ENTERPRISE FIX (2026-02-02): Get REACTIVE zoom from CanvasContext transform
    // Using canvasContext.transform directly (not getTransform()) for proper re-renders
    currentZoom: canvasContext?.transform?.scale ?? 1,
    handleCalibrationToggle: toolbarState.toggleCalibration
  };
}
