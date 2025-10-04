import { useCallback } from 'react';
import { isAdditiveEvent, findEntityAtPoint, processAdditiveSelection } from '../utils/selection-helpers';
import type { SceneModel } from '../../types/scene';
import type { Point2D as Point } from '../../types/scene';

interface UseSelectionWiringProps {
  activeTool: string;
  scene: SceneModel | null;
  rendererRef: React.RefObject<any>;
  selectedEntityIds: string[];
  commitSelection: (ids: string[]) => void;
  onRequestColorMenu?: (at: {x:number; y:number}) => void;
}

export function useSelectionWiring({
  activeTool, scene, rendererRef, selectedEntityIds, commitSelection, onRequestColorMenu
}: UseSelectionWiringProps) {
  const onMouseDownSelection = useCallback((point: Point, e?: React.MouseEvent) => {
    if (activeTool !== 'select') return false;

    if (isAdditiveEvent(e)) {
      console.debug('🎯 Mouse down', {ctrl:e?.ctrlKey, meta:e?.metaKey, shift:e?.shiftKey, tool: activeTool});
      
      const hit = findEntityAtPoint({ point, scene, rendererRef });
      if (hit?.entityId) {
        const next = processAdditiveSelection({
          currentSelectedIds: selectedEntityIds,
          entityId: hit.entityId,
          isAdditive: true
        });
        commitSelection(next);
      }
      e?.preventDefault?.(); 
      e?.stopPropagation?.();
      return true; // consumed
    }
    return false; // let other handlers run
  }, [activeTool, scene, rendererRef, selectedEntityIds, commitSelection]);

  const onContextMenuSelection = useCallback((e: React.MouseEvent) => {
    onRequestColorMenu?.({ x: e.clientX, y: e.clientY });
  }, [onRequestColorMenu]);

  return { onMouseDownSelection, onContextMenuSelection };
}