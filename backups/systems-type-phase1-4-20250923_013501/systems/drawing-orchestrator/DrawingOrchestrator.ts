/**
 * Drawing Orchestrator - Centralized workflow coordination
 * Unifies drawing processes scattered across multiple components
 */

import { useCallback, useRef } from 'react';
import { useUnifiedDrawing } from '../../hooks/drawing/useUnifiedDrawing';
import { useDynamicInputHandler } from '../dynamic-input/hooks/useDynamicInputHandler';
import type { DrawingTool } from '../../hooks/drawing/useUnifiedDrawing';
import type { Point2D } from '../../types/scene';

interface DrawingOrchestratorOptions {
  activeTool: string;
  onToolChange?: (tool: string) => void;
  onEntityCreated?: (entity: any) => void;
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
    console.log('🎨 DrawingOrchestrator: Starting drawing with tool:', tool);
    drawingSystem.setTool(tool);
    onToolChange?.(tool);
  }, [drawingSystem, onToolChange]);
  
  const cancelDrawing = useCallback(() => {
    console.log('🎨 DrawingOrchestrator: Cancelling drawing');
    drawingSystem.setTool('select');
    onToolChange?.('select');
  }, [drawingSystem, onToolChange]);
  
  const addPoint = useCallback((point: Point2D, transform?: any) => {
    console.log('🎨 DrawingOrchestrator: Adding point:', point);
    if (transform) {
      transformRef.current = transform;
    }
    
    // Add point to drawing system
    const result = drawingSystem.addPoint(point);
    
    // Notify drawing point handler
    onDrawingPoint?.(point);
    
    return result;
  }, [drawingSystem, onDrawingPoint]);
  
  const updatePreview = useCallback((point: Point2D, transform?: any) => {
    if (transform) {
      transformRef.current = transform;
    }
    drawingSystem.updatePreview(point);
  }, [drawingSystem]);
  
  const finishDrawing = useCallback(() => {
    console.log('🎨 DrawingOrchestrator: Finishing drawing');
    const result = drawingSystem.finishDrawing();
    
    if (result && onEntityCreated) {
      onEntityCreated(result);
    }
    
    // Return to select tool after completion
    onToolChange?.('select');
    
    return result;
  }, [drawingSystem, onEntityCreated, onToolChange]);
  
  const finishPolyline = useCallback(() => {
    console.log('🎨 DrawingOrchestrator: Finishing polyline');
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
    setTransform: (transform: any) => {
      transformRef.current = transform;
    },
    getTransform: () => transformRef.current
  };
}