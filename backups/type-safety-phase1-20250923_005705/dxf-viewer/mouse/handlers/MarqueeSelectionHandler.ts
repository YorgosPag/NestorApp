/**
 * Marquee Selection Handler - Medium Priority
 * Handles window/crossing selection
 */

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_MARQUEE_SELECTION_HANDLER = false;

import React from 'react';

import type { MouseInteractionHandler, MouseState } from '../MouseStateManager';
import { MouseMode } from '../MouseStateManager';
import type { Point2D, SceneModel } from '../../types/scene';

export interface MarqueeSelectionData {
  startPoint: Point2D;
  currentPoint: Point2D;
  selectionType: 'window' | 'crossing'; // window = left-to-right, crossing = right-to-left
}

export interface MarqueeSelectionHandlerOptions {
  scene: SceneModel | null;
  selectedIdsRef: React.MutableRefObject<Set<string>>;
  activeTool: string;
  onSelectionChange: (entityIds: string[]) => void;
  marqueeOverlayRef: React.MutableRefObject<{ start: Point2D; end: Point2D } | null>;
  render: (scene: SceneModel) => void;
}

export function createMarqueeSelectionHandler(options: MarqueeSelectionHandlerOptions): MouseInteractionHandler {
  const {
    scene,
    selectedIdsRef,
    activeTool,
    onSelectionChange,
    marqueeOverlayRef,
    render
  } = options;

  const isInsideRect = (point: Point2D, rect: { x: number; y: number; width: number; height: number }): boolean => {
    return point.x >= rect.x && 
           point.x <= rect.x + rect.width && 
           point.y >= rect.y && 
           point.y <= rect.y + rect.height;
  };

  const isIntersectingRect = (entityBounds: any, rect: any): boolean => {
    // Simple bounding box intersection
    return !(entityBounds.right < rect.x || 
             entityBounds.left > rect.x + rect.width ||
             entityBounds.bottom < rect.y || 
             entityBounds.top > rect.y + rect.height);
  };

  const getEntityBounds = (entity: any): any => {
    if (entity.type === 'rectangle') {
      const { corner1, corner2 } = entity;
      return {
        left: Math.min(corner1.x, corner2.x),
        right: Math.max(corner1.x, corner2.x),
        top: Math.min(corner1.y, corner2.y),
        bottom: Math.max(corner1.y, corner2.y),
      };
    }
    // Add other entity types as needed
    return null;
  };

  const performSelection = (startPoint: Point2D, endPoint: Point2D): string[] => {
    if (!scene) return [];

    const x = Math.min(startPoint.x, endPoint.x);
    const y = Math.min(startPoint.y, endPoint.y);
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);
    
    const selectionRect = { x, y, width, height };
    const isWindow = endPoint.x >= startPoint.x; // Left-to-right = window selection
    
    if (DEBUG_MARQUEE_SELECTION_HANDLER) console.log(`🎯 [MarqueeSelectionHandler] Performing ${isWindow ? 'window' : 'crossing'} selection`);

    const selectedIds: string[] = [];

    for (const entity of scene.entities) {
      const bounds = getEntityBounds(entity);
      if (!bounds) continue;

      let isSelected = false;
      
      if (isWindow) {
        // Window selection: entity must be completely inside
        isSelected = bounds.left >= selectionRect.x &&
                    bounds.right <= selectionRect.x + selectionRect.width &&
                    bounds.top >= selectionRect.y &&
                    bounds.bottom <= selectionRect.y + selectionRect.height;
      } else {
        // Crossing selection: entity can intersect
        isSelected = isIntersectingRect(bounds, selectionRect);
      }

      if (isSelected) {
        selectedIds.push(entity.id);
      }
    }

    if (DEBUG_MARQUEE_SELECTION_HANDLER) console.log(`🎯 [MarqueeSelectionHandler] Selected ${selectedIds.length} entities:`, selectedIds);
    return selectedIds;
  };

  return {
    mode: MouseMode.MARQUEE,
    priority: 30, // Medium priority

    canActivate: (state: MouseState, point: Point2D, event?: any): boolean => {
      // Only activate for selection tool on empty space
      if (activeTool !== 'select') return false;
      if (!scene) return false;

      // Don't activate if clicking on selected entity or grip
      if (selectedIdsRef.current.size > 0) {
        // This should be handled by other handlers (grip, hover)
        return false;
      }

      // Don't activate with modifier keys (handled by other selection logic)
      if (event && (event.shiftKey || event.ctrlKey || event.metaKey)) {
        return false;
      }

      return true;
    },

    onActivate: (state: MouseState, point: Point2D): MarqueeSelectionData => {
      if (DEBUG_MARQUEE_SELECTION_HANDLER) console.log(`🎯 [MarqueeSelectionHandler] Activated - starting marquee selection at`, point);

      // Initialize marquee overlay
      marqueeOverlayRef.current = {
        start: point,
        end: point,
      };

      return {
        startPoint: point,
        currentPoint: point,
        selectionType: 'window', // Will be determined based on drag direction
      };
    },

    onMove: (state: MouseState, point: Point2D): boolean => {
      const dragData = state.dragData as MarqueeSelectionData;
      if (!dragData) return false;

      // Update current point and determine selection type
      dragData.currentPoint = point;
      dragData.selectionType = point.x >= dragData.startPoint.x ? 'window' : 'crossing';

      // Update marquee overlay
      marqueeOverlayRef.current = {
        start: dragData.startPoint,
        end: point,
      };

      if (DEBUG_MARQUEE_SELECTION_HANDLER) console.log(`🎯 [MarqueeSelectionHandler] Marquee ${dragData.selectionType} selection in progress`);

      // Trigger render to show marquee
      try {
        if (scene) render(scene);
      } catch (error) {
        console.error('🚨 [MarqueeSelectionHandler] Render failed:', error);
      }

      return true;
    },

    onEnd: (state: MouseState): void => {
      const dragData = state.dragData as MarqueeSelectionData;
      if (!dragData) return;

      if (DEBUG_MARQUEE_SELECTION_HANDLER) console.log(`🎯 [MarqueeSelectionHandler] Ending marquee selection`);

      // Perform selection
      const selectedIds = performSelection(dragData.startPoint, dragData.currentPoint);
      onSelectionChange(selectedIds);

      // Clear marquee overlay
      marqueeOverlayRef.current = null;

      // Final render to clear marquee
      try {
        if (scene) render(scene);
      } catch (error) {
        console.error('🚨 [MarqueeSelectionHandler] Final render failed:', error);
      }
    },

    onCancel: (state: MouseState): void => {
      if (DEBUG_MARQUEE_SELECTION_HANDLER) console.log(`🎯 [MarqueeSelectionHandler] Canceling marquee selection`);

      // Clear marquee overlay
      marqueeOverlayRef.current = null;

      // Render to clear marquee
      try {
        if (scene) render(scene);
      } catch (error) {
        console.error('🚨 [MarqueeSelectionHandler] Cancel render failed:', error);
      }
    }
  };
}