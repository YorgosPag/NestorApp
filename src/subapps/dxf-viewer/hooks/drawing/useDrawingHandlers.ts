/**
 * useDrawingHandlers
 * Manages drawing and measurement interaction handlers
 */

'use client';

// DEBUG FLAG
const DEBUG_DRAWING_HANDLERS = false;

import { useCallback } from 'react';
import type { ToolType } from '../../ui/toolbar/types';
import type { Entity } from '../../types/entities';
import type { SceneModel } from '../../types/scene';
import { useUnifiedDrawing } from './useUnifiedDrawing';
import { useSnapContext } from '../../snapping/context/SnapContext';
import { useSnapManager } from '../../snapping/hooks/useSnapManager';
import { useCanvasOperations } from '../interfaces/useCanvasOperations';

type Pt = { x: number, y: number };

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
  const { snapEnabled, enabledModes } = useSnapContext();
  const canvasElement = canvasOps.getCanvas();
  const canvasRef = { current: canvasElement };
  const { snapManager, findSnapPoint } = useSnapManager(canvasRef, {
    scene: currentScene,
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
    const transform = canvasOps.getTransform();
    addPoint(snappedPoint, transform);

  }, [addPoint, canvasOps, applySnap]);
  
  const onDrawingHover = useCallback((p: Pt | null) => {
    if (p) {
      const transform = canvasOps.getTransform();
      updatePreview(p, transform);
    }
  }, [updatePreview, canvasOps]);
  
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

          onEntityCreated(newEntity);
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