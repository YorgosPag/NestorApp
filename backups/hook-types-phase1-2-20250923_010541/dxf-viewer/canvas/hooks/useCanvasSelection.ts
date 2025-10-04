/**
 * Canvas Selection Hook
 * Handles entity selection logic for the DXF canvas
 */

import { useCallback } from 'react';
import { UnifiedEntitySelection } from '../../utils/unified-entity-selection';
import { publishHighlight } from '../../events/selection-bus';
import { createSelectionUtils } from '../../utils/canvas-core';
import type { SceneModel } from '../../types/scene';
import type { Point2D as Point } from '../../types/scene';

interface UseCanvasSelectionOptions {
  scene: SceneModel | null;
  selectedEntityIds: string[];
  onSelectEntity?: (ids: string[]) => void;
  rendererRef: React.RefObject<any>;
  activeTool?: string;
}

const HIT_TEST_RADIUS_PX = 5; // Default hit test radius in pixels

export function useCanvasSelection(options: UseCanvasSelectionOptions) {
  const {
    scene,
    selectedEntityIds,
    onSelectEntity,
    rendererRef,
    activeTool = 'select'
  } = options;

  const handleEntitySelection = useCallback((screenPoint: Point, additive = false) => {
    if (!scene || !rendererRef.current) return;
    const cm = rendererRef.current.getCoordinateManager?.();
    if (!cm) return;

    const worldPoint  = cm.screenToWorld(screenPoint);
    const scale       = cm.getScale?.() ?? 1;
    const worldRadius = HIT_TEST_RADIUS_PX / scale;

    const selector = new UnifiedEntitySelection(scene);
    const hit = selector.getEntityAtPoint(worldPoint, worldRadius);

    if (hit) {
      let newSelection: string[];

      if (additive) {
        newSelection = selectedEntityIds.includes(hit.entityId)
          ? selectedEntityIds.filter(id => id !== hit.entityId)
          : [...selectedEntityIds, hit.entityId]; // ✅ σωστό spread
      } else {
        newSelection = [hit.entityId];
      }

      onSelectEntity?.(newSelection);
      publishHighlight({ ids: newSelection });
    } else if (!additive) {
      // καθάρισε μόνο όταν δεν είμαστε σε additive
      onSelectEntity?.([]);
      publishHighlight({ ids: [] });
    }
  }, [scene, selectedEntityIds, onSelectEntity, rendererRef]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool !== 'select') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    // Ctrl (Win/Linux) ή Cmd (macOS) ή Shift → additive toggle
    const additive = e.ctrlKey || e.metaKey || e.shiftKey;
    handleEntitySelection(screenPoint, additive);
  }, [activeTool, handleEntitySelection]);

  const selectEntities = useCallback((ids: string[]) => {
    onSelectEntity?.(ids);
    publishHighlight({ ids });
  }, [onSelectEntity]);

  const clearSelection = useCallback(() => {
    onSelectEntity?.([]);
    publishHighlight({ ids: [] });
  }, [onSelectEntity]);

  // Use shared selection utilities to eliminate duplicate code
  const selectionUtils = createSelectionUtils();
  
  const toggleEntitySelection = useCallback((entityId: string) => {
    const newSelection = selectionUtils.toggleEntitySelection(entityId, selectedEntityIds);
    
    onSelectEntity?.(newSelection);
    publishHighlight({ ids: newSelection });
  }, [selectedEntityIds, onSelectEntity]);

  return {
    handleClick,
    handleEntitySelection,
    selectEntities,
    clearSelection,
    toggleEntitySelection,
    selectedEntityIds
  };
}