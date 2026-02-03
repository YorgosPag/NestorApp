'use client';

import React, { createContext, useContext, useRef } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import { IDENTITY_COORDINATE_TRANSFORM } from '../../rendering/core/CoordinateTransforms';

// Import the main unified drawing hook
import { useUnifiedDrawing } from '../../hooks/drawing/useUnifiedDrawing';

// Context type for entity creation system
interface EntityCreationContextType {
  createLine: (start: Point2D, end: Point2D) => void;
  createRectangle: (corner1: Point2D, corner2: Point2D) => void;
  createCircle: (center: Point2D, radius: number) => void;
  createPolyline: (points: Point2D[]) => void;
  isDrawing: boolean;
  currentTool: string | null;
  cancelDrawing: () => void;
}

// Create context
const EntityCreationContext = createContext<EntityCreationContextType | null>(null);

// Main entity creation system component
export function EntityCreationSystem({ children }: { children: React.ReactNode }) {
  const drawingSystem = useUnifiedDrawing();
  
  // Entity creation methods
  const createLine = (start: Point2D, end: Point2D) => {
    drawingSystem.startDrawing('line');
    drawingSystem.addPoint(start, IDENTITY_COORDINATE_TRANSFORM);
    drawingSystem.addPoint(end, IDENTITY_COORDINATE_TRANSFORM);
  };

  const createRectangle = (corner1: Point2D, corner2: Point2D) => {
    drawingSystem.startDrawing('rectangle');
    drawingSystem.addPoint(corner1, IDENTITY_COORDINATE_TRANSFORM);
    drawingSystem.addPoint(corner2, IDENTITY_COORDINATE_TRANSFORM);
  };

  const createCircle = (center: Point2D, radius: number) => {
    const edge = { x: center.x + radius, y: center.y };
    drawingSystem.startDrawing('circle');
    drawingSystem.addPoint(center, IDENTITY_COORDINATE_TRANSFORM);
    drawingSystem.addPoint(edge, IDENTITY_COORDINATE_TRANSFORM);
  };

  const createPolyline = (points: Point2D[]) => {
    if (points.length < 2) return;
    
    drawingSystem.startDrawing('polyline');
    points.forEach(point => {
      drawingSystem.addPoint(point, IDENTITY_COORDINATE_TRANSFORM);
    });
    drawingSystem.finishPolyline();
  };

  const contextValue: EntityCreationContextType = {
    createLine,
    createRectangle,
    createCircle,
    createPolyline,
    isDrawing: drawingSystem.state.isDrawing,
    currentTool: drawingSystem.state.currentTool,
    cancelDrawing: drawingSystem.cancelDrawing
  };

  return (
    <EntityCreationContext.Provider value={contextValue}>
      {children}
    </EntityCreationContext.Provider>
  );
}

// Hook to access entity creation context
export function useEntityCreationContext(): EntityCreationContextType {
  const context = useContext(EntityCreationContext);
  
  if (!context) {
    throw new Error('useEntityCreationContext must be used within an EntityCreationSystem');
  }
  
  return context;
}

// Backward compatibility exports
export const DrawingProvider = EntityCreationSystem;
export const DrawingSystem = EntityCreationSystem;
