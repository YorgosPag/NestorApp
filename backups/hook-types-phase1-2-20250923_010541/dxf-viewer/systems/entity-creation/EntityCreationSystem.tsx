'use client';

import React, { createContext, useContext, useRef } from 'react';

// Import the main unified drawing hook
import { useUnifiedDrawing } from '../../hooks/drawing/useUnifiedDrawing';

// Context type for entity creation system
interface EntityCreationContextType {
  createLine: (start: { x: number; y: number }, end: { x: number; y: number }) => void;
  createRectangle: (corner1: { x: number; y: number }, corner2: { x: number; y: number }) => void;
  createCircle: (center: { x: number; y: number }, radius: number) => void;
  createPolyline: (points: { x: number; y: number }[]) => void;
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
  const createLine = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    drawingSystem.startDrawing('line');
    drawingSystem.addPoint(start, { scale: 1, offsetX: 0, offsetY: 0 });
    drawingSystem.addPoint(end, { scale: 1, offsetX: 0, offsetY: 0 });
  };

  const createRectangle = (corner1: { x: number; y: number }, corner2: { x: number; y: number }) => {
    drawingSystem.startDrawing('rectangle');
    drawingSystem.addPoint(corner1, { scale: 1, offsetX: 0, offsetY: 0 });
    drawingSystem.addPoint(corner2, { scale: 1, offsetX: 0, offsetY: 0 });
  };

  const createCircle = (center: { x: number; y: number }, radius: number) => {
    const edge = { x: center.x + radius, y: center.y };
    drawingSystem.startDrawing('circle');
    drawingSystem.addPoint(center, { scale: 1, offsetX: 0, offsetY: 0 });
    drawingSystem.addPoint(edge, { scale: 1, offsetX: 0, offsetY: 0 });
  };

  const createPolyline = (points: { x: number; y: number }[]) => {
    if (points.length < 2) return;
    
    drawingSystem.startDrawing('polyline');
    points.forEach(point => {
      drawingSystem.addPoint(point, { scale: 1, offsetX: 0, offsetY: 0 });
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