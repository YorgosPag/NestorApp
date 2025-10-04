/**
 * Hover Handler - Low Priority
 * Handles entity hover effects and measurements
 */

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_HOVER_HANDLER = false;

import React from 'react';

import type { MouseInteractionHandler, MouseState } from '../MouseStateManager';
import { MouseMode } from '../MouseStateManager';
import type { Point2D, SceneModel } from '../../types/scene';

export interface HoverData {
  entityId: string | null;
  showMeasurements: boolean;
}

export interface HoverHandlerOptions {
  scene: SceneModel | null;
  selectedIdsRef: React.MutableRefObject<Set<string>>;
  hoverIdRef: React.MutableRefObject<string | null>;
  transformRef: React.MutableRefObject<any>;
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  onHoverChange: (entityId: string | null) => void;
  render: (scene: SceneModel) => void;
  setCursor: (cursor: string) => void;
}

export function createHoverHandler(options: HoverHandlerOptions): MouseInteractionHandler {
  const {
    scene,
    selectedIdsRef,
    hoverIdRef,
    transformRef,
    canvasRef,
    onHoverChange,
    render,
    setCursor
  } = options;

  const findEntityAtPoint = (point: Point2D): string | null => {
    if (!scene || !transformRef.current || !canvasRef.current) return null;

    // Simple hit testing for rectangles
    for (const entity of scene.entities) {
      if (entity.type === 'rectangle') {
        const { corner1, corner2 } = entity as any;
        if (!corner1 || !corner2) continue;

        const minX = Math.min(corner1.x, corner2.x);
        const maxX = Math.max(corner1.x, corner2.x);
        const minY = Math.min(corner1.y, corner2.y);
        const maxY = Math.max(corner1.y, corner2.y);

        // Simple tolerance for edge detection
        const tolerance = 5 / transformRef.current.scale;
        
        // Check if point is near rectangle edges
        if (point.x >= minX - tolerance && point.x <= maxX + tolerance &&
            point.y >= minY - tolerance && point.y <= maxY + tolerance) {
          
          // Check if it's near the edges (not inside)
          const nearLeft = Math.abs(point.x - minX) <= tolerance;
          const nearRight = Math.abs(point.x - maxX) <= tolerance;
          const nearTop = Math.abs(point.y - minY) <= tolerance;
          const nearBottom = Math.abs(point.y - maxY) <= tolerance;
          
          if (nearLeft || nearRight || nearTop || nearBottom) {
            return entity.id;
          }
        }
      }
    }

    return null;
  };

  return {
    mode: MouseMode.HOVER,
    priority: 10, // Low priority

    canActivate: (state: MouseState, point: Point2D): boolean => {
      // Only activate when not pressing mouse (pure hover)
      if (state.isPressed) return false;
      
      // Find entity at point
      const entityId = findEntityAtPoint(point);
      
      // Only activate if hover state changed
      return hoverIdRef.current !== entityId;
    },

    onActivate: (state: MouseState, point: Point2D): HoverData => {
      const entityId = findEntityAtPoint(point);
      
      if (DEBUG_HOVER_HANDLER) console.log(`🎯 [HoverHandler] Activated - hovering entity: ${entityId}`);

      // Update hover state
      hoverIdRef.current = entityId;
      onHoverChange(entityId);

      // Set appropriate cursor
      if (entityId) {
        // Check if it's a selected entity (could show grip cursor)
        if (selectedIdsRef.current.has(entityId)) {
          setCursor('move'); // Could show grip handles
        } else {
          setCursor('pointer'); // Hovering unselected entity
        }
      } else {
        setCursor('crosshair'); // Default cursor
      }

      // Determine if we should show measurements
      const showMeasurements = entityId !== null && !selectedIdsRef.current.has(entityId);

      return {
        entityId,
        showMeasurements,
      };
    },

    onMove: (state: MouseState, point: Point2D): boolean => {
      // For hover, we don't handle move events during "drag" 
      // (since hover should only happen when not pressing)
      return false;
    },

    onEnd: (state: MouseState): void => {
      // Hover doesn't have an "end" in the traditional sense
      // since it's not a drag operation
    },

    onCancel: (state: MouseState): void => {
      if (DEBUG_HOVER_HANDLER) console.log(`🎯 [HoverHandler] Canceled - clearing hover`);
      
      hoverIdRef.current = null;
      onHoverChange(null);
      setCursor('crosshair');
    }
  };
}