'use client';

// ✅ Debug flag for drawing integration logging
const DEBUG_CANVAS_CORE = false;

import { useEffect, useCallback } from 'react';
import { drawingSystem } from '../../../../systems/drawing';
import type { DrawingTool } from '../../../../systems/drawing';
import type { ToolType } from '../../../../ui/toolbar/types';

interface DrawingIntegrationOptions {
  activeTool: ToolType;
  onDrawingStart?: (tool: DrawingTool) => void;
  onDrawingCancel?: () => void;
}

export function useDrawingIntegration({
  activeTool,
  onDrawingStart,
  onDrawingCancel
}: DrawingIntegrationOptions) {
  
  // ============================================================================
  // DRAWING TOOL DETECTION
  // ============================================================================
  const isDrawingTool = ['line', 'rectangle', 'circle', 'polyline', 'polygon', 'measure-distance', 'measure-area'].includes(activeTool);

  // ============================================================================
  // DRAWING SYSTEM CONTROL
  // ============================================================================
  const startDrawing = useCallback((tool: DrawingTool) => {
    drawingSystem.startDrawing(tool);
    if (DEBUG_CANVAS_CORE) console.log('🎨 Started drawing:', tool);
    onDrawingStart?.(tool);
  }, [onDrawingStart]);

  const cancelDrawing = useCallback(() => {
    drawingSystem.cancelDrawing();
    if (DEBUG_CANVAS_CORE) console.log('🎨 Cancelled drawing');
    onDrawingCancel?.();
  }, [onDrawingCancel]);

  const handleDrawingTool = useCallback((tool: ToolType) => {
    if (isDrawingTool && ['line', 'rectangle', 'circle', 'polyline', 'polygon', 'measure-distance', 'measure-area'].includes(tool)) {
      startDrawing(tool as DrawingTool);
      return true;
    }
    return false;
  }, [isDrawingTool, startDrawing]);

  // ============================================================================
  // DRAWING SYSTEM LIFECYCLE
  // ============================================================================
  useEffect(() => {
    // Cancel drawing when switching away from drawing tools
    if (!isDrawingTool) {
      cancelDrawing();
    }
  }, [isDrawingTool, cancelDrawing]);

  return {
    // State
    isDrawingTool,
    
    // Actions
    startDrawing,
    cancelDrawing,
    handleDrawingTool,
  };
}