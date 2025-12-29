/**
 * useGripDragging
 * Handles grip dragging operations and drag state management
 */

'use client';

import { useState, useCallback } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { Region } from '../../types/overlay';
import type { GripState } from '../../types/gripSettings';

// === ENHANCED DRAG STATE ===
export interface DragState {
  isDragging: boolean;
  type: 'vertex' | 'region' | 'multi-grip' | null;
  regionId: string | null;
  vertexIndex?: number;
  startPoint: Point2D;
  offset: Point2D;
  selectedGrips?: GripState[];
  constraintMode?: 'none' | 'ortho';
}

const initialDragState: DragState = {
  isDragging: false,
  type: null,
  regionId: null,
  startPoint: { x: 0, y: 0 },
  offset: { x: 0, y: 0 },
  selectedGrips: [],
  constraintMode: 'none'
};

export function useGripDragging() {
  const [dragState, setDragState] = useState<DragState>(initialDragState);

  // Start vertex dragging
  const startVertexDrag = useCallback((regionId: string, vertexIndex: number, startPoint: Point2D) => {
    setDragState({
      isDragging: true,
      type: 'vertex',
      regionId,
      vertexIndex,
      startPoint,
      offset: { x: 0, y: 0 },
      selectedGrips: [],
      constraintMode: 'none'
    });
  }, []);

  // Start region dragging
  const startRegionDrag = useCallback((regionId: string, startPoint: Point2D) => {
    setDragState({
      isDragging: true,
      type: 'region',
      regionId,
      startPoint,
      offset: { x: 0, y: 0 },
      selectedGrips: [],
      constraintMode: 'none'
    });
  }, []);

  // Handle drag movement
  const handleDragMove = useCallback((
    currentPoint: Point2D,
    renderer: { renderGrips?: ((grips: unknown[]) => void) | undefined; getCoordinateManager?: (() => unknown) | undefined },
    transform: ViewTransform,
    regions: Region[],
    onUpdateRegion: (regionId: string, updates: Partial<Region>) => void
  ) => {
    if (!dragState.isDragging || !dragState.regionId) return;

    // ✅ ENTERPRISE FIX: Use currentPoint directly since screenToWorld is not available in new interface
    const currentWorldPoint = currentPoint;
    const startWorldPoint = dragState.startPoint;
      
    const delta = {
      x: currentWorldPoint.x - startWorldPoint.x,
      y: currentWorldPoint.y - startWorldPoint.y,
    };

    const region = regions.find(r => r.id === dragState.regionId);
    if (!region) return;

    if (dragState.type === 'vertex' && dragState.vertexIndex !== undefined) {
      const newVertices = [...region.vertices];
      newVertices[dragState.vertexIndex] = {
        x: region.vertices[dragState.vertexIndex].x + delta.x,
        y: region.vertices[dragState.vertexIndex].y + delta.y,
      };
      onUpdateRegion(region.id, { vertices: newVertices });
    } else if (dragState.type === 'region') {
      const newVertices = region.vertices.map(v => ({
        x: v.x + delta.x,
        y: v.y + delta.y,
      }));
      onUpdateRegion(region.id, { vertices: newVertices });
    }

    setDragState(prev => ({ ...prev, startPoint: currentPoint }));
  }, [dragState]);

  // Stop dragging
  const stopDrag = useCallback(() => {
    setDragState(initialDragState);
  }, []);

  return {
    dragState,
    startVertexDrag,
    startRegionDrag,
    handleDragMove,
    stopDrag
  };
}