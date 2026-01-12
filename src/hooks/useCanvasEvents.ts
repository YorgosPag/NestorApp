'use client';

import { useCallback } from 'react';
import type { Property } from '@/types/property-viewer';
import { distanceToLineSegment } from '@/lib/geometry';
import { toSvgPoint } from './utils/coords';

interface Point {
  x: number;
  y: number;
}

interface FloorData {
  id: string;
  name: string;
  level: number;
  buildingId: string;
  floorPlanUrl?: string;
  properties: Property[];
}

interface UseCanvasEventsProps {
    activeTool: 'create' | 'edit_nodes' | 'measure' | 'polyline' | null;
    creatingVertices: Point[];
    setCreatingVertices: React.Dispatch<React.SetStateAction<Point[]>>;
    onPolygonCreated: (newProperty: Omit<Property, 'id'>) => void;
    measurementStart: Point | null;
    setMeasurementStart: React.Dispatch<React.SetStateAction<Point | null>>;
    onPolygonSelect: (propertyId: string, isShiftClick: boolean) => void;
    onPolygonHover: (propertyId: string | null) => void;
    setMousePosition: React.Dispatch<React.SetStateAction<Point | null>>;
    pan: { x: number; y: number };
    svgRef: React.RefObject<SVGSVGElement>;
    snapToGrid: boolean;
    gridSize: number;
    onPolygonUpdated: (polygonId: string, vertices: Array<{ x: number; y: number }>) => void;
    floorData: FloorData;
    primarySelectedPolygon: string | null;
    polylinePoints: Point[];
    setPolylinePoints: React.Dispatch<React.SetStateAction<Point[]>>;
    setCurrentPolylines: React.Dispatch<React.SetStateAction<Point[][]>>;
}

const findClosestEdge = (polygon: Property, point: Point) => {
    let minDistance = Infinity;
    let closestEdgeIndex = -1;

    for (let i = 0; i < polygon.vertices.length; i++) {
        const p1 = polygon.vertices[i];
        const p2 = polygon.vertices[(i + 1) % polygon.vertices.length];
        const distance = distanceToLineSegment(point, p1, p2);
        
        if (distance < minDistance) {
            minDistance = distance;
            closestEdgeIndex = i;
        }
    }
    return { index: closestEdgeIndex, distance: minDistance };
}


export function useCanvasEvents({
    activeTool,
    creatingVertices,
    setCreatingVertices,
    onPolygonCreated,
    measurementStart,
    setMeasurementStart,
    onPolygonSelect,
    onPolygonHover,
    setMousePosition,
    pan,
    svgRef,
    snapToGrid,
    gridSize,
    onPolygonUpdated,
    floorData,
    primarySelectedPolygon,
    polylinePoints,
    setPolylinePoints,
    setCurrentPolylines,
}: UseCanvasEventsProps) {

    const snapPoint = useCallback((point: Point) => {
        if (!snapToGrid) return point;
        return {
          x: Math.round(point.x / gridSize) * gridSize,
          y: Math.round(point.y / gridSize) * gridSize,
        };
    }, [snapToGrid, gridSize]);

    const handleCanvasClick = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
        if (event.target !== event.currentTarget && activeTool !== 'create' && activeTool !== 'polyline') {
            return;
        }
    
        const currentPoint = snapPoint(toSvgPoint(event, pan, svgRef.current));
        
        if (activeTool === 'polyline') {
            setPolylinePoints(prev => [...prev, currentPoint]);
        }
        else if (activeTool === 'create') {
          if (creatingVertices.length > 2) {
            const firstVertex = creatingVertices[0];
            const distance = Math.sqrt(
              Math.pow(currentPoint.x - firstVertex.x, 2) +
              Math.pow(currentPoint.y - firstVertex.y, 2)
            );
    
            if (distance < 10) {
              onPolygonCreated({ vertices: creatingVertices } as Omit<Property, 'id'>);
              setCreatingVertices([]);
              return;
            }
          }
          setCreatingVertices(prev => [...prev, currentPoint]);
        } 
        else if (activeTool === 'measure') {
            setMeasurementStart(prev => (prev ? null : currentPoint));
        }
        else {
          if (event.target === event.currentTarget) {
              if (activeTool === 'edit_nodes') {
                  onPolygonSelect('', false);
              }
          }
        }
    }, [activeTool, onPolygonSelect, creatingVertices, onPolygonCreated, snapPoint, pan, svgRef, setPolylinePoints, setCreatingVertices, setMeasurementStart]);

    const handleCanvasDoubleClick = useCallback(() => {
        if (activeTool === 'create' && creatingVertices.length >= 3) {
            onPolygonCreated({ vertices: creatingVertices } as Omit<Property, 'id'>);
            setCreatingVertices([]);
        } else if(activeTool === 'polyline' && polylinePoints.length > 1) {
            setCurrentPolylines(prev => [...prev, polylinePoints]);
            setPolylinePoints([]);
        }
    }, [activeTool, creatingVertices, polylinePoints, onPolygonCreated, setCreatingVertices, setPolylinePoints, setCurrentPolylines]);

    const handleCanvasMouseMove = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
        if (event.target === event.currentTarget) {
          onPolygonHover(null);
        }
        
        if (activeTool === 'create' || activeTool === 'measure' || activeTool === 'polyline') {
            setMousePosition(snapPoint(toSvgPoint(event, pan, svgRef.current)));
        } else {
            setMousePosition(null);
        }
    }, [onPolygonHover, activeTool, snapPoint, pan, svgRef, setMousePosition]);

    const handleRightClick = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
        event.preventDefault();

        if (activeTool === 'create' && creatingVertices.length > 0) {
          setCreatingVertices([]);
        }
        else if (activeTool === 'measure' && measurementStart) {
          setMeasurementStart(null);
        }
        else if (activeTool === 'polyline' && polylinePoints.length > 0) {
          setCurrentPolylines(prev => [...prev, polylinePoints]);
          setPolylinePoints([]);
        }
        else if (activeTool === 'edit_nodes' && primarySelectedPolygon) {
            const polygon = floorData.properties.find(p => p.id === primarySelectedPolygon);
            if (!polygon || !svgRef.current) return;

            const point = snapPoint(toSvgPoint(event, pan, svgRef.current));

            const edge = findClosestEdge(polygon, point);
            if (edge.distance < 10) { 
                const newVertices = [...polygon.vertices];
                newVertices.splice(edge.index + 1, 0, point);
                onPolygonUpdated(polygon.id, newVertices);
            }
        }
    }, [activeTool, creatingVertices.length, measurementStart, polylinePoints, setCreatingVertices, setMeasurementStart, setPolylinePoints, setCurrentPolylines, primarySelectedPolygon, floorData.properties, svgRef, pan, onPolygonUpdated, snapPoint]);

    return {
        handleCanvasClick,
        handleCanvasDoubleClick,
        handleCanvasMouseMove,
        handleRightClick,
    };
}
