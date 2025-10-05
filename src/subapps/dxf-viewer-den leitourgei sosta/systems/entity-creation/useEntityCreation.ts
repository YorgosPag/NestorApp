/**
 * ENTITY CREATION SYSTEM HOOK
 * Unified hook for accessing entity creation functionality
 */

// Re-export existing hooks and utilities
export { useUnifiedDrawing } from '../../hooks/drawing/useUnifiedDrawing';
export { useEntityCreationContext } from './EntityCreationSystem';

// Import for additional functionality
import { useUnifiedDrawing } from '../../hooks/drawing/useUnifiedDrawing';
import { useEntityCreationContext } from './EntityCreationSystem';

/**
 * Main entity creation hook that provides all drawing functionality
 */
export function useEntityCreation() {
  return useUnifiedDrawing();
}

/**
 * Hook for entity creation context (high-level creation methods)
 */
export function useEntityCreationMethods() {
  return useEntityCreationContext();
}

/**
 * Hook for drawing state management
 */
export function useDrawingState() {
  const drawing = useUnifiedDrawing();
  return {
    isDrawing: drawing.state.isDrawing,
    currentTool: drawing.state.currentTool,
    tempPoints: drawing.state.tempPoints,
    previewEntity: drawing.state.previewEntity,
    startDrawing: drawing.startDrawing,
    cancelDrawing: drawing.cancelDrawing,
  };
}

/**
 * Hook for drawing interactions (points, preview, completion)
 */
export function useDrawingInteraction() {
  const drawing = useUnifiedDrawing();
  return {
    addPoint: drawing.addPoint,
    updatePreview: drawing.updatePreview,
    finishEntity: drawing.finishEntity,
    finishPolyline: drawing.finishPolyline,
    snapConfig: drawing.snapConfig,
  };
}

// Backward compatibility
export const useDrawing = useEntityCreation;
export const useDrawingSystem = useEntityCreation;