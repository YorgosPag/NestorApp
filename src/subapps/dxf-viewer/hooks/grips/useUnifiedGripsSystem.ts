/**
 * useUnifiedGripsSystem - Refactored
 * Main grip system orchestrator using specialized hooks
 */

'use client';

import { useCallback } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Region } from '../../types/overlay';
import type { SceneModel } from '../../types/scene';
import type { ViewTransform } from '../../rendering/types/Types';
import type { GripSettings, GripState } from '../../types/gripSettings';
import { useGripDragging, type DragState } from './useGripDragging';
import { useGripDetection } from './useGripDetection';
import { useGripSettings } from './useGripSettings';
import { useEntityGripInteraction, type EntityGripInteraction } from './useEntityGripInteraction';

// === GRIP INTERACTION STATE ===
interface GripInteraction {
  hoveredGrip: GripState | null;
  selectedGrips: GripState[];
  isMultiSelect: boolean;
}

// === ENHANCED HOOK RETURN TYPE ===
interface UseUnifiedGripsSystemReturn {
  // === ΥΠΑΡΧΟΝΤΑ (διατηρούμε compatibility) ===
  dragState: DragState;
  startVertexDrag: (regionId: string, vertexIndex: number, startPoint: Point2D) => void;
  startRegionDrag: (regionId: string, startPoint: Point2D) => void;
  handleDragMove: (
    currentPoint: Point2D,
    renderer: {
      renderGrips?: ((grips: unknown[]) => void) | undefined;
      getCoordinateManager?: (() => unknown) | undefined;
    },
    transform: ViewTransform,
    regions: Region[],
    onUpdateRegion: (regionId: string, updates: Partial<Region>) => void
  ) => void;
  stopDrag: () => void;
  getCursor: (isDrawing: boolean, isDrawingMode: boolean) => string;
  
  // === ΝΕΑ AutoCAD-style FEATURES ===
  gripSettings: GripSettings;
  updateGripSettings: (updates: Partial<GripSettings>) => void;
  gripInteraction: GripInteraction;
  
  // Grip detection & interaction (legacy regions)
  findGripAtPoint: (point: Point2D, regions: Region[], tolerance?: number) => GripState | null;
  handleGripHover: (point: Point2D, regions: Region[]) => void;
  handleGripClick: (grip: GripState, isMultiSelect: boolean) => void;
  clearGripSelection: () => void;
  
  // Entity-level grip interaction (new)
  entityGripInteraction: EntityGripInteraction;
  handleEntityHover: (point: Point2D) => void;
  handleEntityClick: (point: Point2D, isMultiSelect?: boolean) => void;
  clearEntityGripInteraction: () => void;
  
  // Visual helpers
  getGripSize: (state: 'cold' | 'warm' | 'hot') => number;
  getGripColor: (state: 'cold' | 'warm' | 'hot') => string;
}

// === MAIN ENHANCED HOOK ===
export function useUnifiedGripsSystem(
  scene?: SceneModel | null,
  onSceneChange?: (scene: SceneModel) => void
): UseUnifiedGripsSystemReturn {
  // Use specialized hooks
  const gripSettings = useGripSettings();
  const gripDragging = useGripDragging();
  const gripDetection = useGripDetection(gripSettings.getGripSize);
  
  // Entity-level grip interaction (optional - only if scene and callback provided)
  const entityGripInteraction = useEntityGripInteraction({
    scene: scene || null,
    onSceneChange: onSceneChange || (() => {}),
    tolerance: 8
  });

  // Cursor logic
  const getCursor = useCallback((isDrawing: boolean, isDrawingMode: boolean) => {
    if (gripDragging.dragState.isDragging) return 'grabbing';
    if (gripDetection.gripInteraction.hoveredGrip) return 'grab';
    if (entityGripInteraction.gripInteraction.hoveredGrip) return 'grab';
    if (entityGripInteraction.gripInteraction.hoveredLineEdge) return 'copy'; // Indicates new grip can be added
    if (isDrawing && isDrawingMode) return 'crosshair';
    return 'default';
  }, [
    gripDragging.dragState.isDragging, 
    gripDetection.gripInteraction.hoveredGrip,
    entityGripInteraction.gripInteraction.hoveredGrip,
    entityGripInteraction.gripInteraction.hoveredLineEdge
  ]);

  return {
    // === ΥΠΑΡΧΟΝΤΑ (backward compatibility) ===
    dragState: gripDragging.dragState,
    startVertexDrag: gripDragging.startVertexDrag,
    startRegionDrag: gripDragging.startRegionDrag,
    handleDragMove: gripDragging.handleDragMove,
    stopDrag: gripDragging.stopDrag,
    getCursor,
    
    // === ΝΕΑ AutoCAD features (legacy regions) ===
    gripSettings: gripSettings.gripSettings,
    updateGripSettings: gripSettings.updateGripSettings,
    gripInteraction: gripDetection.gripInteraction,
    findGripAtPoint: gripDetection.findGripAtPoint,
    handleGripHover: gripDetection.handleGripHover,
    handleGripClick: gripDetection.handleGripClick,
    clearGripSelection: gripDetection.clearGripSelection,
    
    // === ΝΕΑ Entity-level grip features ===
    entityGripInteraction: entityGripInteraction.gripInteraction,
    handleEntityHover: entityGripInteraction.handleHover,
    handleEntityClick: entityGripInteraction.handleClick,
    clearEntityGripInteraction: entityGripInteraction.clearGripInteraction,
    
    // Visual helpers
    getGripSize: gripSettings.getGripSize,
    getGripColor: gripSettings.getGripColor
  };
}
