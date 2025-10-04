/**
 * Canvas Interactions Hook
 * Combines all canvas interaction hooks and handlers
 */

import { useCallback } from 'react';
import { useCanvasMouseHandling } from './useCanvasMouseHandling';
import { useCanvasSelection } from './useCanvasSelection';
import type { SceneModel } from '../../types/scene';
import type { Point2D as Point } from '../../types/scene';
import type { CanvasInteractionCallbacks } from './shared/canvas-callback-types';
import type { DrawingState } from '../../hooks/drawing/useUnifiedDrawing';

interface UseCanvasInteractionsOptions extends CanvasInteractionCallbacks {
  scene: SceneModel | null;
  selectedEntityIds: string[];
  onSelectEntity?: (ids: string[]) => void;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  rendererRef: React.RefObject<any>;
  snapManager: any;
  activeTool?: string;
  drawingState?: DrawingState;
  isZoomWindowActive?: boolean;
  onZoomWindowModeChange?: (active: boolean) => void;
}

export function useCanvasInteractions(options: UseCanvasInteractionsOptions) {
  const {
    scene,
    selectedEntityIds,
    onSelectEntity,
    canvasRef,
    rendererRef,
    snapManager,
    activeTool = 'select',
    drawingState,
    isZoomWindowActive = false,
    onMeasurementPoint,
    onMeasurementHover,
    onMeasurementCancel,
    onDrawingPoint,
    onDrawingHover,
    onDrawingCancel,
    onDrawingDoubleClick,
    onZoomWindowModeChange
  } = options;

  // Mouse handling
  const {
    mouseCss,
    mouseWorld,
    snapResult,
    handleMouseMove,
    handleMouseLeave,
    getSnapPoint
  } = useCanvasMouseHandling({
    canvasRef,
    rendererRef,
    snapManager,
    activeTool,
    drawingState,
    onMeasurementHover,
    onDrawingHover
  });

  // Selection handling
  const {
    handleClick: handleSelectionClick,
    selectEntities,
    clearSelection,
    toggleEntitySelection
  } = useCanvasSelection({
    scene,
    selectedEntityIds,
    onSelectEntity,
    rendererRef,
    activeTool
  });

  // Check if current tool is a drawing tool
  const isDrawingTool = useCallback((tool?: string) => {
    if (!tool) return false;
    if (tool.startsWith('draw-')) return true;
    const t = tool.toLowerCase();
    return ['line', 'polyline', 'polygon', 'circle', 'arc', 'rectangle', 'rect', 'ellipse', 'spline', 'freehand'].includes(t);
  }, []);

  // Combined click handler
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const screenPoint = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    // Get snap point if available
    const clickPoint = getSnapPoint(screenPoint) || (() => {
      const cm = rendererRef.current?.getCoordinateManager?.();
      return cm?.screenToWorld(screenPoint) || null;
    })();

    if (!clickPoint) return;

    // Handle based on active tool
    if (isZoomWindowActive) {
      // Zoom window mode - let the overlay handle it
      return;
    }
    
    if (activeTool?.startsWith('measure-')) {
      // Measurement mode
      onMeasurementPoint?.(clickPoint);
    } else if (isDrawingTool(activeTool) || drawingState?.isDrawing) {
      // Drawing mode
      onDrawingPoint?.(clickPoint);
    } else if (activeTool === 'select') {
      // Selection mode
      handleSelectionClick(e);
    }
  }, [
    activeTool,
    isZoomWindowActive,
    drawingState,
    isDrawingTool,
    getSnapPoint,
    rendererRef,
    onMeasurementPoint,
    onDrawingPoint,
    handleSelectionClick
  ]);

  // Double-click handler
  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDrawingTool(activeTool) || drawingState?.isDrawing) {
      onDrawingDoubleClick?.();
    }
  }, [activeTool, drawingState, isDrawingTool, onDrawingDoubleClick]);

  // Right-click (context menu) handler
  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    if (activeTool?.startsWith('measure-')) {
      onMeasurementCancel?.();
    } else if (isDrawingTool(activeTool) || drawingState?.isDrawing) {
      onDrawingCancel?.();
    }
  }, [activeTool, drawingState, isDrawingTool, onMeasurementCancel, onDrawingCancel]);

  // Wheel handler for zoom
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!rendererRef.current) return;
    
    e.preventDefault();
    
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const mousePos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    rendererRef.current.zoom(zoomFactor, mousePos);
  }, [rendererRef]);

  return {
    // Mouse state
    mouseCss,
    mouseWorld,
    snapResult,
    
    // Event handlers
    handleClick,
    handleDoubleClick,
    handleContextMenu,
    handleMouseMove,
    handleMouseLeave,
    handleWheel,
    
    // Selection methods
    selectEntities,
    clearSelection,
    toggleEntitySelection,
    
    // Utility methods
    getSnapPoint
  };
}