/**
 * useDrawingHandlers - Drawing Interaction Handlers
 *
 * @description
 * Κεντρικό hook που διαχειρίζεται όλα τα drawing και measurement interaction handlers.
 * Συνδυάζει unified drawing, snap system, και canvas operations.
 *
 * @features
 * - 🖱️ Mouse event handlers (click, move, right-click)
 * - 🔄 Drawing state management (useUnifiedDrawing)
 * - 📍 Snap system integration (grid, endpoint, midpoint, intersection)
 * - 📏 Measurement tools (distance, area, radius)
 * - 🎨 Settings integration (preview/completion colors)
 * - ✅ Entity creation & lifecycle
 *
 * @handlers
 * - `handleCanvasClick(point)` - Main click handler (snap + drawing)
 * - `handleMouseMove(point)` - Preview update handler
 * - `handleRightClick()` - Finish polyline / Cancel drawing
 * - `handleKeyPress(key)` - ESC to cancel, Enter to finish
 *
 * @integration
 * ```
 * useDrawingHandlers (THIS)
 *   ├── useUnifiedDrawing (drawing state + settings)
 *   ├── useSnapManager (snap point detection)
 *   └── useCanvasOperations (canvas queries)
 * ```
 *
 * @usage
 * ```tsx
 * const {
 *   handleCanvasClick,
 *   handleMouseMove,
 *   handleRightClick
 * } = useDrawingHandlers(activeTool, onEntityCreated, onToolChange, currentScene);
 * ```
 *
 * @see {@link docs/LINE_DRAWING_SYSTEM.md} - Complete line drawing documentation
 * @see {@link docs/settings-system/08-LINE_DRAWING_INTEGRATION.md} - Settings integration
 * @see {@link hooks/drawing/useUnifiedDrawing.ts} - Drawing state hook
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-06
 * @version 1.0.0
 */

'use client';

// DEBUG FLAG
const DEBUG_DRAWING_HANDLERS = false; // 🔍 DISABLED - set to true only for debugging

import { useCallback } from 'react';
import type { ToolType } from '../../ui/toolbar/types';
import type { Entity } from '../../types/entities';
import type { SceneModel } from '../../types/scene';
import { useUnifiedDrawing } from './useUnifiedDrawing';
import { useSnapContext } from '../../snapping/context/SnapContext';
import { useSnapManager } from '../../snapping/hooks/useSnapManager';
import { useCanvasOperations } from '../interfaces/useCanvasOperations';
import { useRulersGridContext } from '../../systems/rulers-grid/RulersGridSystem';

type Pt = { x: number, y: number };

// 🏢 ENTERPRISE: Type-safe entity created callback
export function useDrawingHandlers(
  activeTool: ToolType,
  onEntityCreated: (entity: Entity) => void,
  onToolChange: (tool: ToolType) => void,
  currentScene?: SceneModel
) {
  // Canvas operations hook
  const canvasOps = useCanvasOperations();

  // Drawing system
  const {
    state: drawingState,
    startDrawing,
    addPoint,
    finishEntity,
    finishPolyline,
    cancelDrawing,
    updatePreview
  } = useUnifiedDrawing();

  // Snap functionality
  const { snapEnabled, enabledModes, setCurrentSnapResult } = useSnapContext();
  const canvasElement = canvasOps.getCanvas();
  const canvasRef = { current: canvasElement };

  // 🔲 GRID SNAP: Get grid step from RulersGrid context for grid snapping
  const { state: rulersGridState } = useRulersGridContext();
  const gridStep = rulersGridState?.grid?.visual?.step || 10;

  const { snapManager, findSnapPoint } = useSnapManager(canvasRef, {
    scene: currentScene,
    gridStep, // 🔲 GRID SNAP: Pass grid step for grid snapping
    onSnapPoint: (point) => {

    }
  });

  // Unified snap function
  const applySnap = useCallback((point: Pt): Pt => {
    if (!snapEnabled || !findSnapPoint) {

      return point;
    }
    
    try {
      const snapResult = findSnapPoint(point.x, point.y);
      if (snapResult && snapResult.found && snapResult.snappedPoint) {

        return snapResult.snappedPoint;
      } else {

      }
    } catch (error) {
      if (DEBUG_DRAWING_HANDLERS) console.warn('🔺 Drawing snap error:', error, 'falling back to raw point');
    }

    return point;
  }, [snapEnabled, findSnapPoint]);

  // Drawing handlers
  const onDrawingPoint = useCallback((p: Pt) => {
    const snappedPoint = applySnap(p);
    const transformUtils = canvasOps.getTransformUtils();
    addPoint(snappedPoint, transformUtils);
  }, [addPoint, canvasOps, applySnap]);

  const onDrawingHover = useCallback((p: Pt | null) => {
    if (DEBUG_DRAWING_HANDLERS) console.log('🔍 [onDrawingHover] Called with point:', p);

    if (p) {
      const transformUtils = canvasOps.getTransformUtils();
      updatePreview(p, transformUtils);

      // 🎯 ENTERPRISE: Update snap result for visual feedback (SnapIndicatorOverlay)
      if (DEBUG_DRAWING_HANDLERS) console.log('🔍 [onDrawingHover] snapEnabled:', snapEnabled, 'findSnapPoint:', !!findSnapPoint);

      if (snapEnabled && findSnapPoint) {
        try {
          const snapResult = findSnapPoint(p.x, p.y);
          if (DEBUG_DRAWING_HANDLERS) console.log('🔍 [onDrawingHover] snapResult:', snapResult);

          if (snapResult && snapResult.found) {
            if (DEBUG_DRAWING_HANDLERS) console.log('✅ [onDrawingHover] Setting snap result:', snapResult.snappedPoint, snapResult.activeMode);
            setCurrentSnapResult(snapResult);
          } else {
            setCurrentSnapResult(null);
          }
        } catch (error) {
          console.warn('🔺 Snap detection error:', error);
          setCurrentSnapResult(null);
        }
      } else {
        setCurrentSnapResult(null);
      }
    } else {
      // Mouse left canvas - clear snap result
      setCurrentSnapResult(null);
    }
  }, [updatePreview, canvasOps, snapEnabled, findSnapPoint, setCurrentSnapResult]);
  
  const onDrawingCancel = useCallback(() => {
    cancelDrawing();
    onToolChange('select');
  }, [cancelDrawing, onToolChange]);

  // Double click handler for finishing operations
  const onDrawingDoubleClick = useCallback(() => {

    if (activeTool === 'polyline' || activeTool === 'polygon' || activeTool === 'measure-area' || activeTool === 'measure-angle') {
      // Check for overlay completion callback first
      const { toolStyleStore } = require('../../stores/ToolStyleStore');
      const isOverlayCompletion = toolStyleStore.triggerOverlayCompletion();

      if (!isOverlayCompletion) {
        // Standard DXF polyline completion

        const newEntity = finishPolyline();
        if(newEntity) {
          // Filter out extended types that are not compatible with base Entity type
          if ('type' in newEntity && typeof newEntity.type === 'string') {
            onEntityCreated(newEntity as Entity);
          }
        }
        onToolChange('select');
      } else {

      }
    }
  }, [activeTool, finishPolyline, onEntityCreated, onToolChange]);

  // Cancel all operations
  const cancelAllOperations = useCallback(() => {
    cancelDrawing();
  }, [cancelDrawing]);

  return {
    // Systems
    drawingState,
    
    // Drawing actions
    startDrawing,
    
    // Event handlers
    onDrawingPoint,
    onDrawingHover,
    onDrawingCancel,
    onDrawingDoubleClick,
    cancelAllOperations
  };
}