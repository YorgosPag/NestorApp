import { useState, useCallback } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { RegionStatus } from '../../types/overlay';

export interface DrawingState {
  isDrawing: boolean;
  drawingVertices: Point2D[];
  drawingRegionStatus: RegionStatus;
}

export interface DrawingActions {
  startDrawing: (status?: RegionStatus) => void;
  addDrawingVertex: (point: Point2D) => void;
  finishDrawing: () => Point2D[] | null;
  cancelDrawing: () => void;
  updateDrawingStatus: (status: RegionStatus) => void;
  canFinishDrawing: () => boolean;
  getDrawingProgress: () => { vertexCount: number; isComplete: boolean };
}

export function useDrawingSystem(): DrawingState & DrawingActions {
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingVertices, setDrawingVertices] = useState<Point2D[]>([]);
  const [drawingRegionStatus, setDrawingRegionStatus] = useState<RegionStatus>('for-sale');

  const startDrawing = useCallback((status: RegionStatus = 'for-sale') => {

    setIsDrawing(true);
    setDrawingVertices([]);
    setDrawingRegionStatus(status);
  }, []);

  const addDrawingVertex = useCallback((point: Point2D) => {
    setDrawingVertices(prev => {
      const newVertices = [...prev, { x: point.x, y: point.y }];

      return newVertices;
    });
  }, []);

  const canFinishDrawing = useCallback(() => {
    return drawingVertices.length >= 3;
  }, [drawingVertices.length]);

  const finishDrawing = useCallback(() => {
    if (drawingVertices.length >= 3) {
      const vertices = [...drawingVertices];

      setIsDrawing(false);
      setDrawingVertices([]);
      
      return vertices;
    }
    
    console.warn('🎨 Cannot finish drawing: insufficient vertices');
    return null;
  }, [drawingVertices]);

  const cancelDrawing = useCallback(() => {

    setIsDrawing(false);
    setDrawingVertices([]);
  }, []);

  const updateDrawingStatus = useCallback((status: RegionStatus) => {
    setDrawingRegionStatus(status);
  }, []);

  const getDrawingProgress = useCallback(() => {
    return {
      vertexCount: drawingVertices.length,
      isComplete: drawingVertices.length >= 3
    };
  }, [drawingVertices.length]);

  return {
    // State
    isDrawing,
    drawingVertices,
    drawingRegionStatus,
    
    // Actions
    startDrawing,
    addDrawingVertex,
    finishDrawing,
    cancelDrawing,
    updateDrawingStatus,
    canFinishDrawing,
    getDrawingProgress
  };
}
