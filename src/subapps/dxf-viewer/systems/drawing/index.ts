/**
 * Drawing System - Re-export unified drawing functionality
 * Fixes broken imports by providing singleton drawingSystem object
 */

import { useUnifiedDrawing } from '../../hooks/drawing/useUnifiedDrawing';
import type { DrawingTool } from '../../hooks/drawing/useUnifiedDrawing';
import type { Point2D } from '../../rendering/types/Types';

// Transform interface for coordinate conversion
interface DrawingTransform {
  worldToScreen: (point: Point2D) => Point2D;
  screenToWorld: (point: Point2D) => Point2D;
}

// Create singleton drawing system instance
let _drawingSystemInstance: ReturnType<typeof useUnifiedDrawing> | null = null;

export const drawingSystem = {
  // Lazy initialization - will be set by the main component
  getInstance: () => _drawingSystemInstance,
  setInstance: (instance: ReturnType<typeof useUnifiedDrawing>) => {
    _drawingSystemInstance = instance;
  },
  
  // Delegate methods to instance
  startDrawing: (tool: DrawingTool) => _drawingSystemInstance?.setTool(tool),
  cancelDrawing: () => _drawingSystemInstance?.setTool('select'),
  addPoint: (point: Point2D, transform: DrawingTransform) => _drawingSystemInstance?.addPoint(point, transform),
  updatePreview: (point: Point2D, transform: DrawingTransform) => _drawingSystemInstance?.updatePreview(point, transform),
  finishPolyline: () => _drawingSystemInstance?.finishDrawing(),
  finishDrawing: () => _drawingSystemInstance?.finishDrawing()
};

// Re-export types and hooks
export type { DrawingTool, DrawingState } from '../../hooks/drawing/useUnifiedDrawing';
export { useUnifiedDrawing } from '../../hooks/drawing/useUnifiedDrawing';