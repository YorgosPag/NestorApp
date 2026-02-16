/**
 * 🏢 ENTERPRISE: useSmartDelete Hook
 *
 * @description Context-aware deletion with intelligent priority:
 * 1. Selected grip vertices → delete vertices (highest index first)
 * 2. Selected overlays → delete entire overlays
 * 3. Selected DXF entities → delete entities via LevelSceneManagerAdapter
 *
 * All deletions go through Command History for Ctrl+Z undo support.
 *
 * EXTRACTED FROM: CanvasSection.tsx — ~85 lines of delete logic + event bus listener
 *
 * @see ADR-030: Universal Selection System
 * @see ADR-032: Command History / Undo-Redo
 */

'use client';

import { useCallback, useEffect, type MutableRefObject } from 'react';

import {
  DeleteOverlayCommand,
  DeleteMultipleOverlaysCommand,
  DeleteOverlayVertexCommand,
  DeleteMultipleOverlayVerticesCommand,
  DeleteEntityCommand,
  DeleteMultipleEntitiesCommand,
  type ICommand,
} from '../../core/commands';
import { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import type { SelectedGrip } from '../grips/useGripSystem';
import type { useOverlayStore } from '../../overlays/overlay-store';
import type { UniversalSelectionHook } from '../../systems/selection/SelectionSystem';
import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import type { useEventBus } from '../../systems/events';

// ============================================================================
// TYPES
// ============================================================================

export interface UseSmartDeleteParams {
  /** Selected grip vertices */
  selectedGrips: SelectedGrip[];
  /** Clear grip selection after vertex deletion */
  setSelectedGrips: (grips: SelectedGrip[]) => void;
  /** Command history execute function */
  executeCommand: (command: ICommand) => void;
  /** Overlay store ref (avoids stale closures) */
  overlayStoreRef: MutableRefObject<ReturnType<typeof useOverlayStore>>;
  /** Universal selection ref (avoids stale closures) */
  universalSelectionRef: MutableRefObject<UniversalSelectionHook>;
  /** Level manager for DXF entity deletion */
  levelManager: LevelsHookReturn;
  /** Clear selected entity IDs after DXF deletion */
  setSelectedEntityIds: (ids: string[]) => void;
  /** Event bus for toolbar:delete event */
  eventBus: ReturnType<typeof useEventBus>;
}

export interface UseSmartDeleteReturn {
  /** Smart delete handler — call from keyboard shortcuts or toolbar */
  handleSmartDelete: () => Promise<boolean>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useSmartDelete({
  selectedGrips,
  setSelectedGrips,
  executeCommand,
  overlayStoreRef,
  universalSelectionRef,
  levelManager,
  setSelectedEntityIds,
  eventBus,
}: UseSmartDeleteParams): UseSmartDeleteReturn {

  const handleSmartDelete = useCallback(async () => {
    const overlayStoreInstance = overlayStoreRef.current;

    // PRIORITY 1: Delete selected grips (vertices) with UNDO SUPPORT
    if (selectedGrips.length > 0) {
      // Sort by index DESCENDING to avoid index shifting
      const vertexGrips = selectedGrips
        .filter(g => g.type === 'vertex')
        .sort((a, b) => {
          if (a.overlayId !== b.overlayId) return a.overlayId.localeCompare(b.overlayId);
          return b.index - a.index;
        });

      if (vertexGrips.length > 0) {
        if (vertexGrips.length === 1) {
          executeCommand(new DeleteOverlayVertexCommand(
            vertexGrips[0].overlayId,
            vertexGrips[0].index,
            overlayStoreInstance,
          ));
        } else {
          executeCommand(new DeleteMultipleOverlayVerticesCommand(
            vertexGrips.map(g => ({ overlayId: g.overlayId, vertexIndex: g.index })),
            overlayStoreInstance,
          ));
        }
        setSelectedGrips([]);
        return true;
      }
    }

    // PRIORITY 2: Delete selected overlays (entire entities) with UNDO SUPPORT
    const selectedOverlayIds = universalSelectionRef.current.getIdsByType('overlay');
    if (selectedOverlayIds.length > 0) {
      if (selectedOverlayIds.length === 1) {
        executeCommand(new DeleteOverlayCommand(selectedOverlayIds[0], overlayStoreInstance));
      } else {
        executeCommand(new DeleteMultipleOverlaysCommand(selectedOverlayIds, overlayStoreInstance));
      }
      universalSelectionRef.current.clearAll();
      return true;
    }

    // PRIORITY 3: Delete selected DXF entities with UNDO SUPPORT
    const selectedDxfEntityIds = universalSelectionRef.current.getIdsByType('dxf-entity');
    if (selectedDxfEntityIds.length > 0 && levelManager.currentLevelId) {
      const adapter = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      if (selectedDxfEntityIds.length === 1) {
        executeCommand(new DeleteEntityCommand(selectedDxfEntityIds[0], adapter));
      } else {
        executeCommand(new DeleteMultipleEntitiesCommand(selectedDxfEntityIds, adapter));
      }
      universalSelectionRef.current.clearByType('dxf-entity');
      setSelectedEntityIds([]);
      return true;
    }

    return false;
  }, [selectedGrips, executeCommand, levelManager, overlayStoreRef, universalSelectionRef, setSelectedGrips, setSelectedEntityIds]);

  // Listen for delete command from floating toolbar
  useEffect(() => {
    const cleanupDelete = eventBus.on('toolbar:delete', () => {
      handleSmartDelete();
    });
    return () => { cleanupDelete(); };
  }, [eventBus, handleSmartDelete]);

  return { handleSmartDelete };
}
