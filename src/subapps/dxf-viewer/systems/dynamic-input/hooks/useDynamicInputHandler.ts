import { useEffect } from 'react';
import type { Point2D as Point, AnySceneEntity } from '../../../rendering/types/Types';
// 🏢 ADR-065: Centralized Distance Calculation
import { calculateDistance } from '../../../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ADR-067: Centralized Radians/Degrees Conversion
import { degToRad } from '../../../rendering/entities/shared/geometry-utils';
// 🏢 ADR-065: Centralized ID Generation (crypto-secure, collision-resistant)
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DXF_DEFAULT_LAYER } from '../../../config/layer-config';

interface UseDynamicInputHandlerProps {
  activeTool: string;
  onDrawingPoint?: (worldPoint: Point) => void;
  onEntityCreated: (entity: AnySceneEntity) => void;
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
          // 🏢 ADR-067: Use centralized angle conversion
          const angleRad = degToRad(angle);
          const secondPoint = {
            x: coordinates.x + length * Math.cos(angleRad),
            y: coordinates.y + length * Math.sin(angleRad)
          };

          if (onEntityCreated) {
            const lineEntity: AnySceneEntity = {
              // 🏢 ADR-065: Crypto-secure ID generation
              id: generateEntityId(),
              type: 'line',
              start: { x: coordinates.x, y: coordinates.y },
              end: { x: secondPoint.x, y: secondPoint.y },
              layer: DXF_DEFAULT_LAYER
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
          // 🏢 ADR-065: Use centralized distance calculation
          const diameter = calculateDistance(p1, p2);
          const radius = diameter / 2;
          
          const circleEntity: AnySceneEntity = {
            // 🏢 ADR-065: Crypto-secure ID generation
            id: generateEntityId(),
            type: 'circle',
            center: { x: center.x, y: center.y },
            radius: radius,
            layer: DXF_DEFAULT_LAYER
          };

          onEntityCreated(circleEntity);
        } else if (onEntityCreated && typeof length === 'number' && Number.isFinite(length)) {
          // Circle completion - create circle entity with radius (length is already radius for both tools)
          const circleEntity: AnySceneEntity = {
            // 🏢 ADR-065: Crypto-secure ID generation
            id: generateEntityId(),
            type: 'circle',
            center: { x: coordinates.x, y: coordinates.y },
            radius: length, // For circle: direct radius, for circle-diameter: converted from diameter to radius
            layer: DXF_DEFAULT_LAYER
          };

          onEntityCreated(circleEntity);
        }
      } else if (onEntityCreated) {
        // Create a point entity for other tools
        const pointEntity: AnySceneEntity = {
          // 🏢 ADR-065: Crypto-secure ID generation
          id: generateEntityId(),
          type: 'point',
          position: { x: coordinates.x, y: coordinates.y },
          layer: DXF_DEFAULT_LAYER
        };

        onEntityCreated(pointEntity);
      }
    };
    
    window.addEventListener('dynamic-input-coordinate-submit', handleDynamicInputSubmit as EventListener);
    return () => window.removeEventListener('dynamic-input-coordinate-submit', handleDynamicInputSubmit as EventListener);
  }, [onDrawingPoint, onEntityCreated, activeTool]);

  return {};
}
