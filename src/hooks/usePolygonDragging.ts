
'use client';

import { useState, useCallback, useRef, useEffect } from "react";
import type { Property } from '@/types/property-viewer';
import type { LayerState } from '@/components/property-viewer/useLayerStates';
import { toSvgPointFromMouse } from '@/lib/coords';


interface FloorData {
  id: string;
  name: string;
  level: number;
  buildingId: string;
  floorPlanUrl?: string;
  properties: Property[];
}

interface DragState {
  isDragging: boolean;
  dragType: 'vertex' | 'polygon' | 'edge' | null;
  polygonId: string | null;
  dragIndex?: number;
  startPos: { x: number; y: number };
  offset: { x: number; y: number };
}

interface UsePolygonDraggingProps {
  floorData: FloorData;
  selectedPolygonId: string | null;
  onPolygonUpdate: (polygonId: string, vertices: Array<{ x: number; y: number }>) => void;
  snapToGrid: boolean;
  gridSize: number;
  layerStates: Record<string, LayerState>;
}

export function usePolygonDragging({
  floorData,
  selectedPolygonId,
  onPolygonUpdate,
  snapToGrid,
  gridSize,
  layerStates,
}: UsePolygonDraggingProps) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    dragType: null,
    polygonId: null,
    startPos: { x: 0, y: 0 },
    offset: { x: 0, y: 0 }
  });
  
  const svgRef = useRef<SVGGElement>(null);

  const snapPoint = useCallback((point: { x: number; y: number }) => {
    if (!snapToGrid) return point;
    return {
      x: Math.round(point.x / gridSize) * gridSize,
      y: Math.round(point.y / gridSize) * gridSize,
    };
  }, [snapToGrid, gridSize]);

  const handleVertexMouseDown = useCallback((polygonId: string, vertexIndex: number, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    const polygon = floorData.properties.find(p => p.id === polygonId);
    if (!polygon) return;
    
    if (event.shiftKey && polygon.vertices.length > 3) {
      const newVertices = polygon.vertices.filter((_, i) => i !== vertexIndex);
      onPolygonUpdate(polygonId, newVertices);
      return;
    }

    setDragState({
      isDragging: true,
      dragType: 'vertex',
      polygonId,
      dragIndex: vertexIndex,
      startPos: { x: event.clientX, y: event.clientY },
      offset: { x: 0, y: 0 }
    });
  }, [floorData.properties, onPolygonUpdate]);
  
  const handleEdgeMouseDown = useCallback((polygonId: string, edgeIndex: number, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    const polygon = floorData.properties.find(p => p.id === polygonId);
    if (!polygon || !svgRef.current) return;
    
    const newPos = snapPoint(toSvgPointFromMouse(event, svgRef.current.ownerSVGElement || null));
    
    const newVertices = [...polygon.vertices];
    newVertices.splice(edgeIndex + 1, 0, newPos);
    onPolygonUpdate(polygonId, newVertices);

    // Immediately start dragging the new vertex
    setDragState({
        isDragging: true,
        dragType: 'vertex',
        polygonId,
        dragIndex: edgeIndex + 1,
        startPos: { x: event.clientX, y: event.clientY },
        offset: { x: 0, y: 0 }
    });

  }, [floorData.properties, onPolygonUpdate, snapPoint]);

  useEffect(() => {
    const svgEl = svgRef.current?.ownerSVGElement || null;
    if (!dragState.isDragging || !dragState.polygonId || !svgEl) return;

    const handleMouseMove = (event: MouseEvent) => {
      const polygon = floorData.properties.find(p => p.id === dragState.polygonId);
      if(!polygon || layerStates[polygon.id]?.locked) return;

      const currentPos = snapPoint(toSvgPointFromMouse(event, svgEl));
      
      if (dragState.dragType === 'vertex' && dragState.dragIndex !== undefined) {
        const newVertices = [...polygon.vertices];
        newVertices[dragState.dragIndex] = currentPos;
        if (dragState.polygonId) onPolygonUpdate(dragState.polygonId, newVertices);
      }
    };

    const handleMouseUp = () => {
      setDragState({
        isDragging: false,
        dragType: null,
        polygonId: null,
        startPos: { x: 0, y: 0 },
        offset: { x: 0, y: 0 }
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, floorData.properties, layerStates, onPolygonUpdate, snapPoint]);

  return {
    svgRef,
    handleVertexMouseDown,
    handleEdgeMouseDown
  };
}
