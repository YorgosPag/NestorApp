/**
 * useEntityGripInteraction
 * Handles grip interactions with actual scene entities (not just regions)
 * Supports adding new grips to lines to convert them to polylines
 */

'use client';

import { useState, useCallback } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { AnySceneEntity, LineEntity, RectangleEntity, SceneModel } from '../../types/scene';
import { generateEdgeMidpoints, calculateMidpoint, calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import { convertLineToPolyline, getClosestPointOnLineSegment, isPointNearLineSegment } from '../../utils/entity-conversion';
import type { GripInfo } from '../../systems/phase-manager/PhaseManager';

export interface EntityGripInteraction {
  hoveredGrip: GripInfo | null;
  selectedGrips: GripInfo[];
  hoveredLineEdge: {
    entityId: string;
    insertPoint: Point2D;
    insertIndex: number;
  } | null;
  dragState: {
    isDragging: boolean;
    draggedGrip: GripInfo | null;
    startPoint: Point2D | null;
  };
}

interface UseEntityGripInteractionProps {
  scene: SceneModel | null;
  onSceneChange: (scene: SceneModel) => void;
  tolerance?: number;
}

import { DEFAULT_TOLERANCE } from '../../config/tolerance-config';

export function useEntityGripInteraction({
  scene,
  onSceneChange,
  tolerance = DEFAULT_TOLERANCE
}: UseEntityGripInteractionProps) {
  const [gripInteraction, setGripInteraction] = useState<EntityGripInteraction>({
    hoveredGrip: null,
    selectedGrips: [],
    hoveredLineEdge: null,
    dragState: {
      isDragging: false,
      draggedGrip: null,
      startPoint: null
    }
  });

  // Find existing grip at point
  const findGripAtPoint = useCallback((point: Point2D): GripInfo | null => {
    if (!scene) return null;

    // This would need to be implemented with proper renderer access
    // For now, we'll simulate basic grip detection for lines and rectangles
    for (const entity of scene.entities) {
      if (entity.type === 'line') {
        const line = entity as LineEntity;
        
        // Check start grip
        const startDistance = Math.sqrt(
          Math.pow(point.x - line.start.x, 2) + Math.pow(point.y - line.start.y, 2)
        );
        if (startDistance <= tolerance) {
          return {
            id: `${entity.id}-start`,
            entityId: entity.id,
            type: 'vertex',
            gripIndex: 0,
            position: line.start,
            isVisible: true,
            isHovered: true,
            gripType: 'vertex' // Backward compatibility alias
          };
        }

        // Check end grip
        const endDistance = Math.sqrt(
          Math.pow(point.x - line.end.x, 2) + Math.pow(point.y - line.end.y, 2)
        );
        if (endDistance <= tolerance) {
          return {
            id: `${entity.id}-end`,
            entityId: entity.id,
            type: 'vertex',
            gripIndex: 1,
            position: line.end,
            isVisible: true,
            isHovered: true,
            gripType: 'vertex' // Backward compatibility alias
          };
        }

        // Check midpoint grip
        const midpoint = calculateMidpoint(line.start, line.end);
        const midDistance = Math.sqrt(
          Math.pow(point.x - midpoint.x, 2) + Math.pow(point.y - midpoint.y, 2)
        );
        if (midDistance <= tolerance) {
          return {
            id: `${entity.id}-mid`,
            entityId: entity.id,
            type: 'midpoint',
            gripIndex: 2,
            position: midpoint,
            isVisible: true,
            isHovered: true,
            gripType: 'midpoint' // Backward compatibility alias
          };
        }
      }
      
      // Rectangle grip detection
      if (entity.type === 'rectangle') {
        const rectangle = entity as RectangleEntity;
        
        // ✅ ENTERPRISE FIX: Add null checks for optional corners
        if (!rectangle.corner1 || !rectangle.corner2) {
          return null; // Skip if corners are not defined
        }

        // ✅ ENTERPRISE FIX: Type-safe corner access with assertion
        const corner1 = rectangle.corner1 as Point2D;
        const corner2 = rectangle.corner2 as Point2D;

        // Calculate all 4 vertices from corners
        const vertices: Point2D[] = [
          corner1,
          { x: corner2.x, y: corner1.y },
          corner2,
          { x: corner1.x, y: corner2.y }
        ];
        
        // Check corner grips (vertices)
        for (let i = 0; i < vertices.length; i++) {
          const vertex = vertices[i];
          const distance = Math.sqrt(
            Math.pow(point.x - vertex.x, 2) + Math.pow(point.y - vertex.y, 2)
          );
          if (distance <= tolerance) {
            return {
              id: `${entity.id}-corner-${i}`,
              entityId: entity.id,
              type: 'corner',
              gripIndex: i,
              position: vertex,
              isVisible: true,
              isHovered: true,
              gripType: 'corner' // Backward compatibility alias
            };
          }
        }
        
        // Check edge midpoint grips using shared utility
        const midpoints = generateEdgeMidpoints(vertices);
        for (let j = 0; j < midpoints.length; j++) {
          const midpoint = midpoints[j];
          const distance = Math.sqrt(
            Math.pow(point.x - midpoint.x, 2) + Math.pow(point.y - midpoint.y, 2)
          );
          if (distance <= tolerance) {
            return {
              id: `${entity.id}-edge-${j}`,
              entityId: entity.id,
              type: 'edge',
              gripIndex: vertices.length + j, // Offset to avoid collision with corner indices
              position: midpoint,
              isVisible: true,
              isHovered: true,
              gripType: 'edge' // Backward compatibility alias
            };
          }
        }
      }
    }

    return null;
  }, [scene, tolerance]);

  // Find line edge for potential grip insertion
  const findLineEdgeAtPoint = useCallback((point: Point2D) => {
    if (!scene) return null;

    for (const entity of scene.entities) {
      if (entity.type === 'line') {
        const line = entity as LineEntity;
        
        if (isPointNearLineSegment(point, line.start, line.end, tolerance)) {
          const insertPoint = getClosestPointOnLineSegment(point, line.start, line.end);
          
          // Don't allow insertion too close to existing grips using shared geometry utility
          const startDist = calculateDistance(insertPoint, line.start);
          const endDist = calculateDistance(insertPoint, line.end);
          
          if (startDist > tolerance * 2 && endDist > tolerance * 2) {
            return {
              entityId: entity.id,
              insertPoint,
              insertIndex: 1 // Insert between start and end
            };
          }
        }
      }
    }

    return null;
  }, [scene, tolerance]);

  // Handle hover over grips or line edges
  const handleHover = useCallback((point: Point2D) => {
    const hoveredGrip = findGripAtPoint(point);
    const hoveredLineEdge = hoveredGrip ? null : findLineEdgeAtPoint(point);

    setGripInteraction(prev => ({
      ...prev,
      hoveredGrip,
      hoveredLineEdge
    }));
  }, [findGripAtPoint, findLineEdgeAtPoint]);

  // Handle click on grip or line edge
  const handleClick = useCallback((point: Point2D, isMultiSelect: boolean = false) => {
    const clickedGrip = findGripAtPoint(point);
    
    if (clickedGrip) {
      // Handle existing grip selection
      setGripInteraction(prev => {
        const isAlreadySelected = prev.selectedGrips.some(g => 
          g.entityId === clickedGrip.entityId && g.gripIndex === clickedGrip.gripIndex
        );
        
        let newSelectedGrips: GripInfo[];
        
        if (isMultiSelect) {
          if (isAlreadySelected) {
            newSelectedGrips = prev.selectedGrips.filter(g => 
              !(g.entityId === clickedGrip.entityId && g.gripIndex === clickedGrip.gripIndex)
            );
          } else {
            newSelectedGrips = [...prev.selectedGrips, { ...clickedGrip, isSelected: true }];
          }
        } else {
          newSelectedGrips = isAlreadySelected ? [] : [{ ...clickedGrip, isSelected: true }];
        }
        
        return {
          ...prev,
          selectedGrips: newSelectedGrips,
          hoveredLineEdge: null
        };
      });
    } else {
      // Check if we're clicking on a line edge to add a new grip
      const lineEdge = findLineEdgeAtPoint(point);
      
      if (lineEdge && scene) {
        // Convert line to polyline with new grip point
        const lineEntity = scene.entities.find(e => e.id === lineEdge.entityId) as LineEntity;
        if (lineEntity) {
          const newPolyline = convertLineToPolyline(lineEntity, lineEdge.insertPoint);
          
          // Update the scene
          const updatedScene: SceneModel = {
            ...scene,
            entities: scene.entities.map(e => 
              e.id === lineEntity.id ? newPolyline : e
            )
          };
          
          onSceneChange(updatedScene);
          
          // Clear interaction state
          setGripInteraction(prev => ({
            ...prev,
            hoveredLineEdge: null,
            selectedGrips: [],
            hoveredGrip: null
          }));
        }
      } else {
        // Clear selection if clicking empty space
        setGripInteraction(prev => ({
          ...prev,
          selectedGrips: [],
          hoveredGrip: null,
          hoveredLineEdge: null
        }));
      }
    }
  }, [findGripAtPoint, findLineEdgeAtPoint, scene, onSceneChange]);

  // Start grip dragging
  const startGripDrag = useCallback((grip: GripInfo, startPoint: Point2D) => {
    setGripInteraction(prev => ({
      ...prev,
      dragState: {
        isDragging: true,
        draggedGrip: grip,
        startPoint
      }
    }));
  }, []);

  // Handle grip drag movement
  const handleGripDrag = useCallback((currentPoint: Point2D) => {
    if (!gripInteraction.dragState.isDragging || !gripInteraction.dragState.draggedGrip || !gripInteraction.dragState.startPoint || !scene) {
      return;
    }

    const draggedGrip = gripInteraction.dragState.draggedGrip;
    const entity = scene.entities.find(e => e.id === draggedGrip.entityId);
    
    if (!entity) return;

    const delta = {
      x: currentPoint.x - gripInteraction.dragState.startPoint.x,
      y: currentPoint.y - gripInteraction.dragState.startPoint.y
    };

    let updatedEntity: AnySceneEntity | null = null;

    // Handle rectangle grip dragging
    if (entity.type === 'rectangle' && draggedGrip.type === 'corner') {
      const rectangle = entity as RectangleEntity;
      const { corner1, corner2 } = rectangle;
      
      // Determine which corner is being dragged and update accordingly
      if (draggedGrip.gripIndex === 0) {
        // corner1 (top-left)
        updatedEntity = {
          ...rectangle,
          corner1: {
            x: corner1.x + delta.x,
            y: corner1.y + delta.y
          }
        };
      } else if (draggedGrip.gripIndex === 2) {
        // corner2 (bottom-right)
        updatedEntity = {
          ...rectangle,
          corner2: {
            x: corner2.x + delta.x,
            y: corner2.y + delta.y
          }
        };
      } else if (draggedGrip.gripIndex === 1) {
        // top-right corner
        updatedEntity = {
          ...rectangle,
          corner1: { x: corner1.x, y: corner1.y + delta.y },
          corner2: { x: corner2.x + delta.x, y: corner2.y }
        };
      } else if (draggedGrip.gripIndex === 3) {
        // bottom-left corner
        updatedEntity = {
          ...rectangle,
          corner1: { x: corner1.x + delta.x, y: corner1.y },
          corner2: { x: corner2.x, y: corner2.y + delta.y }
        };
      }
    }
    
    // Handle rectangle edge grip dragging (resize along one dimension)
    else if (entity.type === 'rectangle' && draggedGrip.type === 'edge') {
      const rectangle = entity as RectangleEntity;
      const { corner1, corner2 } = rectangle;
      const edgeIndex = draggedGrip.gripIndex - 4; // Offset by 4 since corners are 0-3
      
      if (edgeIndex === 0) {
        // Top edge
        updatedEntity = {
          ...rectangle,
          corner1: { x: corner1.x, y: corner1.y + delta.y }
        };
      } else if (edgeIndex === 1) {
        // Right edge
        updatedEntity = {
          ...rectangle,
          corner2: { x: corner2.x + delta.x, y: corner2.y }
        };
      } else if (edgeIndex === 2) {
        // Bottom edge
        updatedEntity = {
          ...rectangle,
          corner2: { x: corner2.x, y: corner2.y + delta.y }
        };
      } else if (edgeIndex === 3) {
        // Left edge
        updatedEntity = {
          ...rectangle,
          corner1: { x: corner1.x + delta.x, y: corner1.y }
        };
      }
    }

    // Update the scene if entity was modified
    if (updatedEntity) {
      const updatedScene: SceneModel = {
        ...scene,
        entities: scene.entities.map(e => 
          e.id === entity.id ? updatedEntity! : e
        )
      };
      onSceneChange(updatedScene);
    }

    // Update start point for next drag calculation
    setGripInteraction(prev => ({
      ...prev,
      dragState: {
        ...prev.dragState,
        startPoint: currentPoint
      }
    }));
  }, [gripInteraction.dragState, scene, onSceneChange]);

  // Stop grip dragging
  const stopGripDrag = useCallback(() => {
    setGripInteraction(prev => ({
      ...prev,
      dragState: {
        isDragging: false,
        draggedGrip: null,
        startPoint: null
      }
    }));
  }, []);

  // Clear all grip interactions
  const clearGripInteraction = useCallback(() => {
    setGripInteraction({
      hoveredGrip: null,
      selectedGrips: [],
      hoveredLineEdge: null,
      dragState: {
        isDragging: false,
        draggedGrip: null,
        startPoint: null
      }
    });
  }, []);

  return {
    gripInteraction,
    handleHover,
    handleClick,
    startGripDrag,
    handleGripDrag,
    stopGripDrag,
    clearGripInteraction,
    findGripAtPoint,
    findLineEdgeAtPoint
  };
}