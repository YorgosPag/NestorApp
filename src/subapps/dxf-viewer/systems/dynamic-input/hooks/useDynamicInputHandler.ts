import { useEffect } from 'react';
import type { Point2D as Point } from '../../../rendering/types/Types';

interface UseDynamicInputHandlerProps {
  activeTool: string;
  onDrawingPoint?: (worldPoint: Point) => void;
  onEntityCreated: (entity: unknown) => void;
}

interface UseDynamicInputHandlerReturn {
  // This hook primarily sets up event listeners, no direct returns needed
}

export function useDynamicInputHandler({
  activeTool,
  onDrawingPoint,
  onEntityCreated,
}: UseDynamicInputHandlerProps): UseDynamicInputHandlerReturn {
  
  // Listen for Dynamic Input coordinate submission
  useEffect(() => {
    const handleDynamicInputSubmit = (e: CustomEvent) => {

      const { coordinates, tool, length, action, angle } = e.detail;
      
      if (tool === 'line' && onDrawingPoint) {
        if (action === 'create-line-second-point' && angle !== undefined && length !== undefined) {
          // Complete line with X+Y+Angle+Length: create line entity directly
          const angleRad = (angle * Math.PI) / 180;
          const secondPoint = {
            x: coordinates.x + length * Math.cos(angleRad),
            y: coordinates.y + length * Math.sin(angleRad)
          };

          if (onEntityCreated) {
            const lineEntity = {
              id: `line_${Date.now()}`,
              type: 'LINE',
              startPoint: { x: coordinates.x, y: coordinates.y, z: 0 },
              endPoint: { x: secondPoint.x, y: secondPoint.y, z: 0 },
              layer: 'default',
              color: 'white'
            };

            onEntityCreated(lineEntity);
          }
        } else {

          onDrawingPoint(coordinates);
        }
      } else if (tool === 'circle' || tool === 'circle-diameter' || tool === 'circle-2p-diameter') {
        if (action === 'create-circle-center') {
          // Circle center registered - no point entity needed, just log

        } else if (action === 'create-circle-2p-diameter-first-point') {
          // Circle-2P-Diameter first point - just log it, stored in firstClickPoint

        } else if (action === 'create-circle-2p-diameter' && e.detail.secondPoint) {
          // Circle-2P-Diameter completion - create circle from two diameter points
          const { coordinates: p1, secondPoint: p2 } = e.detail;
          const center = {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2
          };
          const diameter = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
          const radius = diameter / 2;
          
          const circleEntity = {
            id: `circle_${Date.now()}`,
            type: 'circle',
            center: { x: center.x, y: center.y, z: 0 },
            radius: radius,
            layer: 'default',
            color: 'white'
          };

          onEntityCreated(circleEntity);
        } else if (onEntityCreated && typeof length === 'number' && Number.isFinite(length)) {
          // Circle completion - create circle entity with radius (length is already radius for both tools)
          const circleEntity = {
            id: `circle_${Date.now()}`,
            type: 'circle',
            center: { x: coordinates.x, y: coordinates.y, z: 0 },
            radius: length, // For circle: direct radius, for circle-diameter: converted from diameter to radius
            layer: 'default',
            color: 'white'
          };

          onEntityCreated(circleEntity);
        }
      } else if (onEntityCreated) {
        // Create a point entity for other tools
        const pointEntity = {
          id: `point_${Date.now()}`,
          type: 'POINT',
          x: coordinates.x,
          y: coordinates.y,
          z: 0
        };

        onEntityCreated(pointEntity);
      }
    };
    
    window.addEventListener('dynamic-input-coordinate-submit', handleDynamicInputSubmit as EventListener);
    return () => window.removeEventListener('dynamic-input-coordinate-submit', handleDynamicInputSubmit as EventListener);
  }, [onDrawingPoint, onEntityCreated, activeTool]);

  return {};
}