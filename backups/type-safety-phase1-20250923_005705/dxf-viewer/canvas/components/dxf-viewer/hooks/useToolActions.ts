'use client';

import { useCallback } from 'react';
import type { ToolType } from '../../../../ui/toolbar/types';

interface ToolActionsOptions {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  setIsZoomWindowActive: (active: boolean) => void;
  onMeasurementCancel: () => void;
  onDrawingCancel: () => void;
  onZoomWindowActivate: () => void;
  onZoomWindowDeactivate: () => void;
}

export function useToolActions({
  activeTool,
  setActiveTool,
  setIsZoomWindowActive,
  onMeasurementCancel,
  onDrawingCancel,
  onZoomWindowActivate,
  onZoomWindowDeactivate
}: ToolActionsOptions) {
  
  // ============================================================================
  // TOOL CHANGE HANDLER
  // ============================================================================
  const handleToolChange = useCallback((tool: ToolType) => {
    // Reset systems when changing tool
    onMeasurementCancel();
    onDrawingCancel();

    if (tool === 'zoom-window') {
      setActiveTool('zoom-window');
      setIsZoomWindowActive(true);
      onZoomWindowActivate();
      return;
    }
    
    // Handle measurement tools
    if (tool === 'measure' || tool.startsWith('measure-')) {
      setActiveTool(tool);
      onZoomWindowDeactivate();
      return;
    }

    // Handle drawing tools
    const isDrawingTool = ['line', 'rectangle', 'circle', 'polyline', 'polygon'].includes(tool);
    if (isDrawingTool) {
      setActiveTool(tool);
      onZoomWindowDeactivate();
      return;
    }

    // Default tool handling
    setIsZoomWindowActive(false);
    onZoomWindowDeactivate();
    setActiveTool(tool);
  }, [
    setActiveTool,
    setIsZoomWindowActive,
    onMeasurementCancel,
    onDrawingCancel,
    onZoomWindowActivate,
    onZoomWindowDeactivate
  ]);

  // ============================================================================
  // ZOOM WINDOW MODE HANDLER
  // ============================================================================
  const handleZoomWindowModeChange = useCallback((active: boolean) => {
    setIsZoomWindowActive(active);
    if (!active) {
      setActiveTool('select');
    }
  }, [setIsZoomWindowActive, setActiveTool]);

  return {
    // Current state
    activeTool,
    
    // Actions
    handleToolChange,
    handleZoomWindowModeChange,
  };
}