/**
 * Grip Drag Handler - Highest Priority
 * Handles grip dragging with exclusive control
 * NOW INTEGRATED with PhaseManager and GripInteractionManager for centralized measurements
 */

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_GRIP_DRAG_HANDLER = false;

import React from 'react';

import type { MouseInteractionHandler, MouseState } from '../MouseStateManager';
import { MouseMode } from '../MouseStateManager';
import { generateEdgeMidpoints } from '../../utils/renderers/shared/geometry-rendering-utils';
import type { Point2D, SceneModel } from '../../types/scene';
import { GripInteractionManager, type GripInteractionOptions } from '../../systems/grip-interaction/GripInteractionManager';
import { PhaseManager, type PhaseManagerOptions } from '../../systems/phase-manager/PhaseManager';

export interface GripDragData {
  entityId: string;
  gripIndex: number;
  originalGeometry: any;
  currentGeometry: any;
}

export interface GripDragHandlerOptions {
  scene: SceneModel | null;
  selectedIdsRef: React.MutableRefObject<Set<string>>;
  transformRef: React.MutableRefObject<any>;
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  gripSettings: any;
  onGeometryUpdate: (entityId: string, geometry: any) => void;
  onCommit: (entityId: string, geometry: any) => void;
  setCursor: (cursor: string) => void;
  render: (scene: SceneModel) => void;
}

interface EnhancedGripDragData extends GripDragData {
  gripInteractionManager: GripInteractionManager;
  phaseManager: PhaseManager;
}

export function createGripDragHandler(options: GripDragHandlerOptions): MouseInteractionHandler {
  const {
    scene,
    selectedIdsRef,
    transformRef,
    canvasRef,
    gripSettings,
    onGeometryUpdate,
    onCommit,
    setCursor,
    render
  } = options;

  // 🎯 CREATE CENTRALIZED MANAGERS (created once, reused throughout)
  let gripInteractionManager: GripInteractionManager | null = null;
  let phaseManager: PhaseManager | null = null;

  const initializeManagers = (): { gripManager: GripInteractionManager; phaseManager: PhaseManager } => {
    if (!canvasRef.current) throw new Error('Canvas not available for grip managers');
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    const transform = transformRef.current || { scale: 1, offsetX: 0, offsetY: 0 };
    
    const worldToScreen = (point: Point2D): Point2D => {
      // TODO: Implement proper coordinate transformation
      return point; // Simple 1:1 for now
    };
    
    const screenToWorld = (point: Point2D): Point2D => {
      // TODO: Implement proper coordinate transformation  
      return point; // Simple 1:1 for now
    };

    const gripOptions: GripInteractionOptions = {
      ctx,
      transform,
      worldToScreen,
      screenToWorld
    };

    const phaseOptions: PhaseManagerOptions = {
      ctx,
      transform,
      worldToScreen
    };

    gripInteractionManager = new GripInteractionManager(gripOptions);
    phaseManager = new PhaseManager(phaseOptions);
    // Pass grip settings to PhaseManager for proper grip rendering
    phaseManager.setGripSettings(gripSettings);

    // 🎯 CONNECT GRIP MANAGER TO GEOMETRY UPDATES
    gripInteractionManager.setCallbacks({
      onGeometryUpdate,
      onGripStateChange: (state) => {
        if (DEBUG_GRIP_DRAG_HANDLER) console.log(`🎯 [GripDragHandler] Grip state changed:`, state);
        // Could trigger re-render or other updates here
      }
    });

    return { gripManager: gripInteractionManager, phaseManager };
  };

  const hitTestGrip = (point: Point2D, entityId: string): { entityId: string; gripIndex: number } | null => {
    if (!scene) return null;
    
    const entity = scene.entities.find(e => e.id === entityId);
    if (!entity) return null;

    // Rectangle grip testing
    if (entity.type === 'rectangle') {
      const { corner1, corner2 } = entity as any;
      if (!corner1 || !corner2) return null;

      // Calculate all 8 grips (4 corners + 4 edges)
      const vertices = [
        corner1,                         // 0: top-left
        { x: corner2.x, y: corner1.y }, // 1: top-right
        corner2,                         // 2: bottom-right
        { x: corner1.x, y: corner2.y }   // 3: bottom-left
      ];

      const grips = [];
      
      // Corner grips (0-3)
      vertices.forEach((vertex, index) => {
        grips.push({ pos: vertex, idx: index });
      });

      // Edge midpoint grips using shared utility
      const midpoints = generateEdgeMidpoints(vertices);
      midpoints.forEach((midpoint, i) => {
        grips.push({ pos: midpoint, idx: vertices.length + i });
      });

      // Hit test all grips
      const aperture = gripSettings.apertureSize || 60;
      for (const grip of grips) {
        const screenGrip = worldToScreen(grip.pos);
        const screenPoint = worldToScreen(point);
        const dx = screenPoint.x - screenGrip.x;
        const dy = screenPoint.y - screenGrip.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        if (distance <= aperture) {
          console.log(`✅ [GripDragHandler] GRIP HIT: entity ${entityId}, grip ${grip.idx}, distance ${distance}`);
          return { entityId, gripIndex: grip.idx };
        }
      }
    }

    return null;
  };

  const worldToScreen = (point: Point2D): Point2D => {
    // Simple 1:1 mapping for now - will be improved later
    return point;
  };

  const screenToWorld = (point: Point2D): Point2D => {
    // Simple 1:1 mapping for now - will be improved later
    return point;
  };

  const updateRectangleGeometry = (originalGeometry: any, gripIndex: number, worldPoint: Point2D): any => {
    const { corner1, corner2 } = originalGeometry;
    let updatedCorner1 = { ...corner1 };
    let updatedCorner2 = { ...corner2 };

    if (gripIndex < 4) {
      // Corner grips (0-3)
      switch (gripIndex) {
        case 0: // Top-left
          updatedCorner1 = worldPoint;
          break;
        case 1: // Top-right
          updatedCorner1 = { x: corner1.x, y: worldPoint.y };
          updatedCorner2 = { x: worldPoint.x, y: corner2.y };
          break;
        case 2: // Bottom-right
          updatedCorner2 = worldPoint;
          break;
        case 3: // Bottom-left
          updatedCorner1 = { x: worldPoint.x, y: corner1.y };
          updatedCorner2 = { x: corner2.x, y: worldPoint.y };
          break;
      }
    } else {
      // Edge grips (4-7)
      switch (gripIndex) {
        case 4: // Top edge
          updatedCorner1 = { x: corner1.x, y: worldPoint.y };
          updatedCorner2 = { x: corner2.x, y: corner2.y };
          break;
        case 5: // Right edge
          updatedCorner1 = { x: corner1.x, y: corner1.y };
          updatedCorner2 = { x: worldPoint.x, y: corner2.y };
          break;
        case 6: // Bottom edge
          updatedCorner1 = { x: corner1.x, y: corner1.y };
          updatedCorner2 = { x: corner2.x, y: worldPoint.y };
          break;
        case 7: // Left edge
          updatedCorner1 = { x: worldPoint.x, y: corner1.y };
          updatedCorner2 = { x: corner2.x, y: corner2.y };
          break;
      }
    }

    return { corner1: updatedCorner1, corner2: updatedCorner2 };
  };

  const updateLineGeometry = (originalGeometry: any, gripIndex: number, worldPoint: Point2D): any => {
    const { start, end } = originalGeometry;
    
    if (gripIndex === 0) {
      // Start point grip
      return { start: worldPoint, end };
    } else if (gripIndex === 1) {
      // End point grip  
      return { start, end: worldPoint };
    } else if (gripIndex === 2) {
      // Midpoint grip - move entire line
      const dx = worldPoint.x - (start.x + end.x) / 2;
      const dy = worldPoint.y - (start.y + end.y) / 2;
      return {
        start: { x: start.x + dx, y: start.y + dy },
        end: { x: end.x + dx, y: end.y + dy }
      };
    }
    
    return originalGeometry;
  };

  const updateCircleGeometry = (originalGeometry: any, gripIndex: number, worldPoint: Point2D): any => {
    const { center, radius } = originalGeometry;
    
    if (gripIndex === 0) {
      // Center grip - move entire circle
      return { center: worldPoint, radius };
    } else {
      // Radius grips - change radius
      const newRadius = Math.sqrt(
        Math.pow(worldPoint.x - center.x, 2) + Math.pow(worldPoint.y - center.y, 2)
      );
      return { center, radius: newRadius };
    }
  };

  return {
    mode: MouseMode.GRIP_DRAG,
    priority: 100, // Highest priority

    canActivate: (state: MouseState, point: Point2D): boolean => {
      if (!scene || selectedIdsRef.current.size === 0) return false;
      
      // Check if clicking on a grip of selected entity
      const selectedId = Array.from(selectedIdsRef.current)[0];
      const hit = hitTestGrip(point, selectedId);
      
      return hit !== null;
    },

    onActivate: (state: MouseState, point: Point2D): EnhancedGripDragData => {
      if (DEBUG_GRIP_DRAG_HANDLER) console.log(`🎯 [GripDragHandler] Activated - grip drag starting with centralized managers`);
      
      // 🎯 INITIALIZE CENTRALIZED MANAGERS
      const { gripManager, phaseManager: pmManager } = initializeManagers();
      
      const selectedId = Array.from(selectedIdsRef.current)[0];
      const hit = hitTestGrip(point, selectedId);
      
      if (!hit || !scene) throw new Error('Grip hit test failed during activation');
      
      const entity = scene.entities.find(e => e.id === hit.entityId);
      if (!entity) throw new Error('Entity not found during grip activation');

      // 🎯 START CENTRALIZED GRIP DRAGGING
      const success = gripManager.startDragging(entity as any, hit.gripIndex, point);
      if (!success) {
        throw new Error('Failed to start centralized grip dragging');
      }

      // Store original geometry
      const originalGeometry = entity.type === 'rectangle' 
        ? { corner1: entity.corner1, corner2: entity.corner2 }
        : entity.type === 'line'
        ? { start: entity.start, end: entity.end }
        : entity.type === 'circle'
        ? { center: entity.center, radius: entity.radius }
        : {};

      setCursor('grabbing');

      return {
        entityId: hit.entityId,
        gripIndex: hit.gripIndex,
        originalGeometry,
        currentGeometry: originalGeometry,
        gripInteractionManager: gripManager,
        phaseManager: pmManager
      };
    },

    onMove: (state: MouseState, point: Point2D): boolean => {
      const dragData = state.dragData as EnhancedGripDragData;
      if (!dragData || !scene) return false;

      if (DEBUG_GRIP_DRAG_HANDLER) console.log(`🎯 [GripDragHandler] Moving grip ${dragData.gripIndex} with CENTRALIZED SYSTEM`);

      const worldPoint = screenToWorld(point);
      const entity = scene.entities.find(e => e.id === dragData.entityId);
      if (!entity) return false;

      // 🎯 UPDATE CENTRALIZED GRIP DRAG POSITION
      const success = dragData.gripInteractionManager.updateDragPosition(entity as any, worldPoint);
      if (!success) {
        console.warn('Failed to update centralized grip drag position');
        return false;
      }

      // 🎯 NO DUPLICATE MEASUREMENTS - individual renderers handle measurements already
      console.log(`📏 GripDragHandler: ${entity.type} grip ${dragData.gripIndex} at (${worldPoint.x.toFixed(2)}, ${worldPoint.y.toFixed(2)}) - measurements handled by renderer`);
      
      // Update geometry based on entity type (this logic could also be moved to managers)
      let newGeometry;
      switch (entity.type) {
        case 'rectangle':
          newGeometry = updateRectangleGeometry(dragData.originalGeometry, dragData.gripIndex, worldPoint);
          break;
        case 'line':
          newGeometry = updateLineGeometry(dragData.originalGeometry, dragData.gripIndex, worldPoint);
          break;
        case 'circle':
          newGeometry = updateCircleGeometry(dragData.originalGeometry, dragData.gripIndex, worldPoint);
          break;
        default:
          console.warn(`🚨 [GripDragHandler] Unknown entity type: ${entity.type}`);
          return false;
      }

      // Update drag data
      dragData.currentGeometry = newGeometry;

      // Preview update (real-time)
      onGeometryUpdate(dragData.entityId, newGeometry);

      console.log(`📏 [GripDragHandler] CENTRALIZED Live measurements: ${entity.type} grip ${dragData.gripIndex} at (${worldPoint.x.toFixed(2)}, ${worldPoint.y.toFixed(2)})`);

      // Re-render scene
      try {
        render(scene);
      } catch (error) {
        console.error('🚨 [GripDragHandler] Render failed:', error);
      }

      return true; // Handled
    },

    onEnd: (state: MouseState): void => {
      const dragData = state.dragData as EnhancedGripDragData;
      if (!dragData) return;

      if (DEBUG_GRIP_DRAG_HANDLER) console.log(`🎯 [GripDragHandler] Ending CENTRALIZED grip drag for entity ${dragData.entityId}`);

      // 🎯 END CENTRALIZED GRIP DRAGGING
      const success = dragData.gripInteractionManager.endDragging();
      if (!success) {
        console.warn('Failed to end centralized grip dragging');
      }

      // Commit final geometry
      onCommit(dragData.entityId, dragData.currentGeometry);

      setCursor('crosshair');
    },

    onCancel: (state: MouseState): void => {
      const dragData = state.dragData as EnhancedGripDragData;
      if (!dragData) return;

      if (DEBUG_GRIP_DRAG_HANDLER) console.log(`🎯 [GripDragHandler] Canceling CENTRALIZED grip drag for entity ${dragData.entityId}`);

      // 🎯 END CENTRALIZED GRIP DRAGGING (cancel)
      const success = dragData.gripInteractionManager.endDragging();
      if (!success) {
        console.warn('Failed to cancel centralized grip dragging');
      }

      // Restore original geometry
      onGeometryUpdate(dragData.entityId, dragData.originalGeometry);

      setCursor('crosshair');
    }
  };
}