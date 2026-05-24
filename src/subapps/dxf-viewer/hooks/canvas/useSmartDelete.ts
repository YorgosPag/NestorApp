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
import { requestWallCascadeDelete } from '../../bim/walls/wall-cascade-delete-store';
// ADR-363 Phase 7A — centralized cascade resolver SSoT (Boy Scout N.0.2:
// replaces the inline wall→opening sweep that previously lived here; adds
// slab→slab-opening cascade alongside).
import { findHostedOpenings, findHostedSlabOpenings } from '../../bim/cascade/bim-cascade-resolver';
// ADR-363 Phase 3.8 — slab vertex removal
import { removeVertexFromSlab } from '../../bim/slabs/slab-grips';
import { UpdateSlabParamsCommand } from '../../core/commands/entity-commands/UpdateSlabParamsCommand';
import type { SlabEntity } from '../../bim/types/slab-types';
import type { SelectedGrip, UnifiedGripInfo } from '../grips/unified-grip-types';
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
  /**
   * ADR-363 Phase 3.8 — currently hovered DXF grip. When set and it resolves
   * to a slab vertex, Delete removes that vertex (PRIORITY 0.5).
   */
  hoveredDxfGrip?: UnifiedGripInfo | null;
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
  hoveredDxfGrip,
}: UseSmartDeleteParams): UseSmartDeleteReturn {

  const handleSmartDelete = useCallback(async () => {
    const overlayStoreInstance = overlayStoreRef.current;

    // PRIORITY 0.5: ADR-363 Phase 3.8 — Delete hovered slab vertex
    if (hoveredDxfGrip?.slabGripKind?.startsWith('slab-vertex-') && hoveredDxfGrip.entityId && levelManager.currentLevelId) {
      const idx = parseInt(hoveredDxfGrip.slabGripKind.slice('slab-vertex-'.length), 10);
      if (Number.isFinite(idx)) {
        const adapter = new LevelSceneManagerAdapter(
          levelManager.getLevelScene,
          levelManager.setLevelScene,
          levelManager.currentLevelId,
        );
        const raw = adapter.getEntity(hoveredDxfGrip.entityId);
        const candidate = raw as unknown as Partial<SlabEntity>;
        if (candidate?.type === 'slab' && candidate.params) {
          const slab = candidate as SlabEntity;
          const newParams = removeVertexFromSlab(slab.params, idx);
          if (newParams !== slab.params) {
            const command = new UpdateSlabParamsCommand(
              hoveredDxfGrip.entityId,
              newParams,
              slab.params,
              adapter,
              false,
            );
            if (command.validate() === null) {
              executeCommand(command);
              return true;
            }
          }
        }
      }
    }

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
    const selectedDxfEntityIds = universalSelectionRef.current.getSelectedEntityIds();
    if (selectedDxfEntityIds.length > 0 && levelManager.currentLevelId) {
      const adapter = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );

      // ADR-363 Phase 7A — BIM cascade via centralized resolver (SSoT).
      // wall→opening: prompts user (existing wall-cascade-delete dialog).
      // slab→slab-opening: cascades automatically (orphan prevention, no
      // prompt — slab-openings are structurally less surprising to lose with
      // their host than wall openings). Phase 8 may add a unified dialog.
      const deletingWallIds = new Set(
        selectedDxfEntityIds.filter((id) => adapter.getEntity(id)?.type === 'wall'),
      );
      const deletingSlabIds = new Set(
        selectedDxfEntityIds.filter((id) => adapter.getEntity(id)?.type === 'slab'),
      );
      const needsScene = deletingWallIds.size > 0 || deletingSlabIds.size > 0;
      const scene = needsScene
        ? levelManager.getLevelScene(levelManager.currentLevelId)
        : null;
      const selectionSet = new Set(selectedDxfEntityIds);
      const orphanedOpeningIds = scene != null
        ? findHostedOpenings(deletingWallIds, scene.entities, selectionSet)
        : [];
      const orphanedSlabOpeningIds = scene != null
        ? findHostedSlabOpenings(deletingSlabIds, scene.entities, selectionSet)
        : [];

      let idsToDelete = selectedDxfEntityIds;
      if (orphanedOpeningIds.length > 0) {
        const action = await requestWallCascadeDelete(orphanedOpeningIds.length);
        if (action === 'cancel') return false;
        idsToDelete = [...idsToDelete, ...orphanedOpeningIds];
      }
      if (orphanedSlabOpeningIds.length > 0) {
        idsToDelete = [...idsToDelete, ...orphanedSlabOpeningIds];
      }

      // Collect stair IDs BEFORE executeCommand removes them from scene.
      const stairIdsInBatch = idsToDelete.filter(
        (id) => adapter.getEntity(id)?.type === 'stair',
      );

      if (idsToDelete.length === 1) {
        executeCommand(new DeleteEntityCommand(idsToDelete[0], adapter));
      } else {
        executeCommand(new DeleteMultipleEntitiesCommand(idsToDelete, adapter));
      }
      universalSelectionRef.current.clearByType('dxf-entity');
      setSelectedEntityIds([]);

      // ADR-358 Phase 9C-3 — trigger Firestore deleteDoc for each deleted stair.
      for (const stairId of stairIdsInBatch) {
        eventBus.emit('bim:stair-delete-requested', { stairId });
      }

      return true;
    }

    return false;
  }, [selectedGrips, executeCommand, levelManager, overlayStoreRef, universalSelectionRef, setSelectedGrips, setSelectedEntityIds, hoveredDxfGrip]);

  // Listen for delete command from floating toolbar
  useEffect(() => {
    const cleanupDelete = eventBus.on('toolbar:delete', () => {
      handleSmartDelete();
    });
    return () => { cleanupDelete(); };
  }, [eventBus, handleSmartDelete]);

  return { handleSmartDelete };
}
