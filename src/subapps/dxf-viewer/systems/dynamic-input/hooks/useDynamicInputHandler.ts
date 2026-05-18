import { useEffect } from 'react';
import type { Point2D as Point, AnySceneEntity } from '../../../rendering/types/Types';
// 🏢 ADR-065: Centralized Distance Calculation
import { calculateDistance } from '../../../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ADR-065: Centralized ID Generation (crypto-secure, collision-resistant)
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DXF_DEFAULT_LAYER } from '../../../config/layer-config';
import { getLayer } from '../../../stores/LayerStore';

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
      const { coordinates, tool, length, action } = e.detail;

      // ADR-357 Phase 2a §4 G2 — Line tool routes through the canonical drawing
      // pipeline (`onDrawingPoint`) so snap, ortho, polar, layer SSoT, styling,
      // CommandHistory and persistence all apply. No direct entity creation
      // here for `line` — that was the regression flagged in ADR §4 G2.
      if (tool === 'line' && onDrawingPoint) {
        onDrawingPoint(coordinates);
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
            layerId: getLayer(DXF_DEFAULT_LAYER)?.id ?? ''
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
            layerId: getLayer(DXF_DEFAULT_LAYER)?.id ?? ''
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
          layerId: getLayer(DXF_DEFAULT_LAYER)?.id ?? ''
        };

        onEntityCreated(pointEntity);
      }
    };
    
    window.addEventListener('dynamic-input-coordinate-submit', handleDynamicInputSubmit as EventListener);
    return () => window.removeEventListener('dynamic-input-coordinate-submit', handleDynamicInputSubmit as EventListener);
  }, [onDrawingPoint, onEntityCreated, activeTool]);

  return {};
}
