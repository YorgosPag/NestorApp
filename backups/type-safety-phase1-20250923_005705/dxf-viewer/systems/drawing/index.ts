/**
 * Drawing System - Re-export unified drawing functionality
 * Fixes broken imports by providing singleton drawingSystem object
 */

import { useUnifiedDrawing } from '../../hooks/drawing/useUnifiedDrawing';

// Create singleton drawing system instance
let _drawingSystemInstance: ReturnType<typeof useUnifiedDrawing> | null = null;

export const drawingSystem = {
  // Lazy initialization - will be set by the main component
  getInstance: () => _drawingSystemInstance,
  setInstance: (instance: ReturnType<typeof useUnifiedDrawing>) => {
    _drawingSystemInstance = instance;
  },
  
  // Delegate methods to instance
  startDrawing: (tool: any) => _drawingSystemInstance?.setTool(tool),
  cancelDrawing: () => _drawingSystemInstance?.setTool('select'),
  addPoint: (point: any, transform: any) => _drawingSystemInstance?.addPoint(point),
  updatePreview: (point: any, transform: any) => _drawingSystemInstance?.updatePreview(point),
  finishPolyline: () => _drawingSystemInstance?.finishDrawing(),
  finishDrawing: () => _drawingSystemInstance?.finishDrawing()
};

// Re-export types and hooks
export type { DrawingTool, DrawingState } from '../../hooks/drawing/useUnifiedDrawing';
export { useUnifiedDrawing } from '../../hooks/drawing/useUnifiedDrawing';