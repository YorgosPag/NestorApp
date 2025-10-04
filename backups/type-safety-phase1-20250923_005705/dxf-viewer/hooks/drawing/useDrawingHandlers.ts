/**
 * useDrawingHandlers
 * Manages drawing and measurement interaction handlers
 */

'use client';

// DEBUG FLAG
const DEBUG_DRAWING_HANDLERS = false;

import { useCallback } from 'react';
import type { DxfCanvasRef } from '../../canvas/DxfCanvas';
import type { ToolType } from '../../ui/toolbar/types';
import { useUnifiedDrawing } from './useUnifiedDrawing';
import { useSnapContext } from '../../snapping/context/SnapContext';
import { useSnapManager } from '../../snapping/hooks/useSnapManager';

type Pt = { x: number, y: number };

export function useDrawingHandlers(
  dxfCanvasRef: React.RefObject<DxfCanvasRef>,
  activeTool: ToolType,
  onEntityCreated: (entity: any) => void,
  onToolChange: (tool: ToolType) => void,
  currentScene?: any
) {
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
  const { snapManager, findSnapPoint } = useSnapManager(dxfCanvasRef, {
    scene: currentScene,
    onSnapPoint: (point) => {
      if (DEBUG_DRAWING_HANDLERS) console.log('🎯 Drawing snap point found:', point);
    }
  });

  // Unified snap function
  const applySnap = useCallback((point: Pt): Pt => {
    if (!snapEnabled || !findSnapPoint) {
      if (DEBUG_DRAWING_HANDLERS) console.log('🎯 Drawing snap disabled or no engine, using raw point:', point);
      return point;
    }
    
    try {
      const snapResult = findSnapPoint(point.x, point.y);
      if (snapResult && snapResult.found && snapResult.snappedPoint) {
        if (DEBUG_DRAWING_HANDLERS) console.log('🎯 Drawing snap applied:', snapResult.snappedPoint, 'from:', point, 'full result:', snapResult);
        return snapResult.snappedPoint;
      } else {
        if (DEBUG_DRAWING_HANDLERS) console.log('🎯 Drawing snap failed:', snapResult, 'for point:', point);
      }
    } catch (error) {
      if (DEBUG_DRAWING_HANDLERS) console.warn('🎯 Drawing snap error:', error, 'falling back to raw point');
    }
    
    if (DEBUG_DRAWING_HANDLERS) console.log('🎯 No drawing snap found, using raw point:', point);
    return point;
  }, [snapEnabled, findSnapPoint]);


  // Drawing handlers
  const onDrawingPoint = useCallback((p: Pt) => {
    if (DEBUG_DRAWING_HANDLERS) console.log('🎨 Drawing point requested:', p);
    const snappedPoint = applySnap(p);
    const transform = dxfCanvasRef.current?.getTransform() || { scale: 1, offsetX: 0, offsetY: 0 };
    addPoint(snappedPoint, transform);
    if (DEBUG_DRAWING_HANDLERS) console.log('🎨 Drawing point added (snapped):', snappedPoint, 'from:', p);
  }, [addPoint, dxfCanvasRef, applySnap]);
  
  const onDrawingHover = useCallback((p: Pt | null) => {
    if (p) {
      const transform = dxfCanvasRef.current?.getTransform() || { scale: 1, offsetX: 0, offsetY: 0 };
      updatePreview(p, transform);
    }
  }, [updatePreview, dxfCanvasRef]);
  
  const onDrawingCancel = useCallback(() => {
    cancelDrawing();
    onToolChange('select');
  }, [cancelDrawing, onToolChange]);

  // Double click handler for finishing operations
  const onDrawingDoubleClick = useCallback(() => {
    if (DEBUG_DRAWING_HANDLERS) console.log('🔄 [useDrawingHandlers] onDrawingDoubleClick called with activeTool:', activeTool);
    
    if (activeTool === 'polyline' || activeTool === 'polygon' || activeTool === 'measure-area' || activeTool === 'measure-angle') {
      // Check for overlay completion callback first
      const { toolStyleStore } = require('../../stores/ToolStyleStore');
      const isOverlayCompletion = toolStyleStore.triggerOverlayCompletion();

      if (!isOverlayCompletion) {
        // Standard DXF polyline completion
        if (DEBUG_DRAWING_HANDLERS) console.log('🔄 [useDrawingHandlers] No overlay callback, using standard finishPolyline()');
        const newEntity = finishPolyline();
        if(newEntity) {
          if (DEBUG_DRAWING_HANDLERS) console.log('🔄 [useDrawingHandlers] Created entity:', newEntity.type, 'calling onEntityCreated');
          onEntityCreated(newEntity);
        }
        onToolChange('select');
      } else {
        if (DEBUG_DRAWING_HANDLERS) console.log('🔄 [useDrawingHandlers] Overlay completion handled, not calling finishPolyline');
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