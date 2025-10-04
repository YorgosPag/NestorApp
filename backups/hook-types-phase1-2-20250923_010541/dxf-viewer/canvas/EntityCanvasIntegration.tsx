
'use client';
import React, { useEffect, useRef } from 'react';
import { useEntityCreation } from '../hooks/drawing/useEntityCreation';
import type { DrawingTool } from '../hooks/drawing/useEntityCreation';
import type { AnySceneEntity, Point2D } from '../types/scene';

interface EntityCanvasIntegrationProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  currentTool: DrawingTool;
  transform: { scale: number; offsetX: number; offsetY: number };
  onEntityCreated: (entity: AnySceneEntity) => void;
}

// Utility to convert mouse event to canvas coordinates
const getCanvasPoint = (e: MouseEvent, canvas: HTMLCanvasElement): Point2D => {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
};

export function EntityCanvasIntegration({
  canvasRef,
  currentTool,
  transform,
  onEntityCreated,
}: EntityCanvasIntegrationProps) {
  const {
    drawingState: state,
    startDrawing: startEntityCreation,
    addPoint: addCreationPoint,
    finishDrawing: finishPolyline,
    setPreviewEntity: updatePreview,
  } = useEntityCreation();
  
  // Create cancel function
  const cancelCreation = () => {
    finishPolyline(); // Same as finish, just clears the state
  };

  // Handle tool changes - currentTool is handled at the component level

  // Event handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (state.isDrawing) {
        e.preventDefault();
        e.stopPropagation();
        const point = getCanvasPoint(e, canvas);
        // We'll need to convert this to world coordinates
        // For now, let's assume a simple transformation for the sake of structure
        const worldPoint = {
            x: (point.x - transform.offsetX) / transform.scale,
            y: (point.y - transform.offsetY) / transform.scale,
        };
        addCreationPoint(worldPoint);
      }
    };
    
    const handleMouseMove = (e: MouseEvent) => {
        if(state.isDrawing && state.currentPoints.length > 0) {
            const point = getCanvasPoint(e, canvas);
            const worldPoint = {
                x: (point.x - transform.offsetX) / transform.scale,
                y: (point.y - transform.offsetY) / transform.scale,
            };
            updatePreview(null); // TODO: Create proper preview entity
        }
    };

    const handleDoubleClick = (e: MouseEvent) => {
      if (state.currentTool === 'polyline' && state.isDrawing) {
        e.preventDefault();
        e.stopPropagation();
        finishPolyline();
      }
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelCreation();
      }
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('dblclick', handleDoubleClick);
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('dblclick', handleDoubleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    canvasRef, 
    state, 
    transform,
    addCreationPoint, 
    updatePreview,
    finishPolyline,
    cancelCreation
  ]);
  
  // This component doesn't render anything itself, it just handles events.
  return null;
}
