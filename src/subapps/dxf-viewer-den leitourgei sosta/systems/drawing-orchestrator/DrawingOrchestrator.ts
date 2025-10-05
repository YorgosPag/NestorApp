/**
 * Drawing Orchestrator - Centralized workflow coordination
 * Unifies drawing processes scattered across multiple components
 */

import { useCallback, useRef } from 'react';
import { useUnifiedDrawing } from '../../hooks/drawing/useUnifiedDrawing';
import { useDynamicInputHandler } from '../dynamic-input/hooks/useDynamicInputHandler';
import type { DrawingTool } from '../../hooks/drawing/useUnifiedDrawing';
import type { Point2D, AnySceneEntity, ViewTransform } from '../../rendering/types/Types';

interface DrawingOrchestratorOptions {
  activeTool: string;
  onToolChange?: (tool: string) => void;
  onEntityCreated?: (entity: AnySceneEntity) => void;
  onDrawingPoint?: (point: Point2D) => void;
}

export function useDrawingOrchestrator({
  activeTool,
  onToolChange,
  onEntityCreated,
  onDrawingPoint
}: DrawingOrchestratorOptions) {
  
  // Core drawing system
  const drawingSystem = useUnifiedDrawing();
  
  // Dynamic input integration
  const dynamicInputHandler = useDynamicInputHandler({
    activeTool,
    onDrawingPoint,
    onEntityCreated: onEntityCreated || (() => {})
  });
  
  // Transform reference for coordinate calculations
  const transformRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 });
  
  // ============================================================================
  // WORKFLOW COORDINATION
  // ============================================================================
  
  const startDrawing = useCallback((tool: DrawingTool) => {

    drawingSystem.setTool(tool);
    onToolChange?.(tool);
  }, [drawingSystem, onToolChange]);
  
  const cancelDrawing = useCallback(() => {

    drawingSystem.setTool('select');
    onToolChange?.('select');
  }, [drawingSystem, onToolChange]);
  
  const addPoint = useCallback((point: Point2D, transform?: ViewTransform) => {

    if (transform) {
      transformRef.current = transform;
    }
    
    // Add point to drawing system
    const result = drawingSystem.addPoint(point);
    
    // Notify drawing point handler
    onDrawingPoint?.(point);
    
    return result;
  }, [drawingSystem, onDrawingPoint]);
  
  const updatePreview = useCallback((point: Point2D, transform?: ViewTransform) => {
    if (transform) {
      transformRef.current = transform;
    }
    drawingSystem.updatePreview(point);
  }, [drawingSystem]);
  
  const finishDrawing = useCallback(() => {

    const result = drawingSystem.finishDrawing();
    
    if (result && onEntityCreated) {
      onEntityCreated(result);
    }
    
    // Return to select tool after completion
    onToolChange?.('select');
    
    return result;
  }, [drawingSystem, onEntityCreated, onToolChange]);
  
  const finishPolyline = useCallback(() => {

    const result = drawingSystem.finishDrawing();
    
    if (result && onEntityCreated) {
      onEntityCreated(result);
    }
    
    // Return to select tool after polyline completion
    onToolChange?.('select');
    
    return result;
  }, [drawingSystem, onEntityCreated, onToolChange]);
  
  // ============================================================================
  // TOOL STATE DETECTION
  // ============================================================================
  
  const isDrawingTool = useCallback((tool: string): boolean => {
    return ['line', 'rectangle', 'circle', 'circle-diameter', 'circle-2p-diameter', 'polyline', 'polygon', 'measure-distance', 'measure-area'].includes(tool);
  }, []);
  
  const handleToolActivation = useCallback((tool: string): boolean => {
    if (isDrawingTool(tool)) {
      startDrawing(tool as DrawingTool);
      return true;
    }
    return false;
  }, [isDrawingTool, startDrawing]);
  
  // ============================================================================
  // ORCHESTRATOR API
  // ============================================================================
  
  return {
    // Core workflow methods
    startDrawing,
    cancelDrawing,
    addPoint,
    updatePreview,
    finishDrawing,
    finishPolyline,
    
    // Tool management
    isDrawingTool,
    handleToolActivation,
    
    // State access
    drawingState: drawingSystem.state,
    currentTool: drawingSystem.state.currentTool,
    isDrawing: drawingSystem.state.isDrawing,
    previewEntity: drawingSystem.state.previewEntity,
    
    // Transform management
    setTransform: (transform: ViewTransform) => {
      transformRef.current = transform;
    },
    getTransform: () => transformRef.current
  };
}