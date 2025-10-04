/**
 * Canvas Tools Hook
 * Manages tool-specific interactions (drawing, measuring, selecting)
 */

// ✅ Debug flag for canvas tools logging
const DEBUG_CANVAS_CORE = false;

import { useCallback, useEffect } from 'react';
import { UnifiedEntitySelection } from '../../utils/unified-entity-selection';
import { publishHighlight } from '../../events/selection-bus';
import { createSelectionUtils } from '../../utils/canvas-core';
import type { Point2D as Point } from '../../types/scene';
import type { SceneModel } from '../../types/scene';
import type { DrawingState } from '../../hooks/drawing/useUnifiedDrawing';
import type { CanvasInteractionCallbacks } from './shared/canvas-callback-types';

interface UseCanvasToolsOptions extends CanvasInteractionCallbacks {
  scene: SceneModel | null;
  selectedEntityIds: string[];
  activeTool: string;
  drawingState?: DrawingState;
  rendererRef: React.RefObject<any>;
  snapResult: any;
  
  // Callbacks
  onSelectEntity?: (ids: string[]) => void;
}

const HIT_TEST_RADIUS_PX = 5;

// Tool type checkers
const isDrawingTool = (tool?: string): boolean => {
  if (!tool) return false;
  if (tool.startsWith('draw-')) return true;
  const t = tool.toLowerCase();
  return [
    'line', 'polyline', 'polygon', 'circle', 'circle-diameter', 'arc', 'rectangle', 
    'rect', 'ellipse', 'spline', 'freehand', 'measure-distance', 'measure-area', 'measure-angle',
    'layering' // 🎯 ΔΙΟΡΘΩΣΗ: Προσθήκη layering ως drawing tool για unified system
  ].includes(t);
};

const isMeasurementTool = (tool?: string): boolean => {
  return tool?.startsWith('measure-') && tool !== 'measure-distance' && tool !== 'measure-area' && tool !== 'measure-angle' || false;
};

const isSelectionTool = (tool?: string): boolean => {
  return tool === 'select';
};

export function useCanvasTools(options: UseCanvasToolsOptions) {
  const {
    scene,
    selectedEntityIds,
    activeTool,
    drawingState,
    rendererRef,
    snapResult,
    onSelectEntity,
    onMeasurementPoint,
    onMeasurementHover,
    onMeasurementCancel,
    onDrawingPoint,
    onDrawingHover,
    onDrawingCancel,
    onDrawingDoubleClick
  } = options;

  // Handle hover events based on active tool
  const handleToolHover = useCallback((worldPoint: Point | null) => {
    if (isMeasurementTool(activeTool)) {
      onMeasurementHover?.(worldPoint);
    } else if (isDrawingTool(activeTool) || drawingState?.isDrawing) {
      onDrawingHover?.(worldPoint);
    }
  }, [activeTool, drawingState, onMeasurementHover, onDrawingHover]);

  // Handle click events based on active tool
  const handleToolClick = useCallback((screenPoint: Point): boolean => {
    if (!rendererRef.current) return false;
    
    const cm = rendererRef.current.getCoordinateManager?.();
    const worldPoint = cm?.screenToWorld?.(screenPoint);
    
    if (!worldPoint) return false;
    
    // Use snapped point if available
    const finalPoint = snapResult?.snappedPoint || worldPoint;
    
    // Handle tool-specific clicks
    if (isMeasurementTool(activeTool)) {
      onMeasurementPoint?.(finalPoint);
      return true;
    }
    
    if (isDrawingTool(activeTool) || drawingState?.isDrawing) {
      onDrawingPoint?.(finalPoint);
      return true;
    }
    
    if (isSelectionTool(activeTool)) {
      // ✅ Αφήνουμε το DxfCanvasCore να χειριστεί το selection (συμπεριλαμβανομένου του Ctrl multi-select)
      if (DEBUG_CANVAS_CORE) console.log('🎯 Selection tool detected - delegating to DxfCanvasCore');
      return false; // δεν το χειριζόμαστε εδώ
    }
    
    return false;
  }, [
    rendererRef, 
    snapResult, 
    activeTool, 
    drawingState, 
    scene,
    onMeasurementPoint,
    onDrawingPoint,
    onSelectEntity
  ]);

  // Handle double-click events
  const handleToolDoubleClick = useCallback(() => {
    if (isMeasurementTool(activeTool)) {
      // console.log(`🔄 Double-click detected for measurement tool: ${activeTool}`);
      onDrawingDoubleClick?.(); // This will call finishMeasurement for area tool
    } else if (isDrawingTool(activeTool) || drawingState?.isDrawing) {
      onDrawingDoubleClick?.();
    }
  }, [activeTool, drawingState, onDrawingDoubleClick]);

  // Handle escape key for canceling operations
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isMeasurementTool(activeTool)) {
          onMeasurementCancel?.();
        }
        if (isDrawingTool(activeTool) || drawingState?.isDrawing) {
          onDrawingCancel?.();
        }
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [activeTool, drawingState, onMeasurementCancel, onDrawingCancel]);

  // Selection utilities
  const selectEntities = useCallback((ids: string[]) => {
    onSelectEntity?.(ids);
    publishHighlight({ ids, mode: 'select' });
  }, [onSelectEntity]);

  const clearSelection = useCallback(() => {
    onSelectEntity?.([]);
    publishHighlight({ ids: [], mode: 'select' });
  }, [onSelectEntity]);

  // Use shared selection utilities to eliminate duplicate code
  const selectionUtils = createSelectionUtils();
  
  const toggleEntitySelection = useCallback((entityId: string) => {
    const newSelection = selectionUtils.toggleEntitySelection(entityId, selectedEntityIds);
    selectEntities(newSelection);
  }, [selectedEntityIds, selectEntities]);

  return {
    // Tool state
    isDrawingMode: isDrawingTool(activeTool) || drawingState?.isDrawing,
    isMeasurementMode: isMeasurementTool(activeTool),
    isSelectionMode: isSelectionTool(activeTool),
    
    // Event handlers
    handleToolHover,
    handleToolClick,
    handleToolDoubleClick,
    
    // Selection methods
    selectEntities,
    clearSelection,
    toggleEntitySelection
  };
}