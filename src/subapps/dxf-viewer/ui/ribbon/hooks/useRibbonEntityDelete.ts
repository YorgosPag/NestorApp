'use client';

/**
 * Shared SSoT «Διαγραφή» for the contextual structural ribbons (column / beam /
 * wall / slab / roof / opening).
 *
 * Before this hook each bridge raw-emitted `bim:X-delete-requested`, which the
 * persistence hook turned into a Firestore delete + hand-rolled scene removal —
 * NOT undoable and running NO cascades (orphan openings, ADR-401 host-detach,
 * MEP integrity). That was a parallel delete path, divergent from the keyboard
 * Delete (`useSmartDelete` PRIORITY 3).
 *
 * This hook routes the ribbon delete through the SAME command-based core
 * (`deleteEntitiesById`) the keyboard path uses, so a ribbon delete is now
 * undoable (Ctrl+Z) + cascades + zero race. Every structural bridge owns
 * `{ levelManager, universalSelection }` props and a `useCommandHistory()`
 * execute already, so no new plumbing is needed — they just call `deleteEntity`.
 *
 * @see ../../../hooks/canvas/delete-entities-core.ts (the SSoT)
 * @see ../../../hooks/canvas/useSmartDelete.ts (keyboard trigger of the same core)
 */

import { useCallback, useMemo } from 'react';

import { useCommandHistory } from '../../../core/commands';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import { deleteEntitiesById } from '../../../hooks/canvas/delete-entities-core';
import type { LevelSceneWriter } from '../../../systems/levels/level-scene-accessor';
import type { useUniversalSelection } from '../../../systems/selection';

type UniversalSelectionLike = Pick<
  ReturnType<typeof useUniversalSelection>,
  'clearByType'
>;

export interface UseRibbonEntityDeleteParams {
  readonly levelManager: LevelSceneWriter;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonEntityDelete {
  /**
   * Delete one entity by id through the canonical command path (undoable +
   * cascades). Fire-and-forget — the wall→opening cascade prompt is awaited
   * internally; on success the contextual tab closes (dxf-entity selection
   * cleared, mirroring the keyboard path).
   */
  readonly deleteEntity: (id: string) => void;
}

export function useRibbonEntityDelete(
  params: UseRibbonEntityDeleteParams,
): RibbonEntityDelete {
  const { levelManager, universalSelection } = params;
  const { execute: executeCommand } = useCommandHistory();

  const deleteEntity = useCallback(
    (id: string): void => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const adapter = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelId,
      );
      const scene = levelManager.getLevelScene(levelId);
      void deleteEntitiesById([id], {
        adapter,
        sceneEntities: scene?.entities ?? [],
        executeCommand,
      }).then((ok) => {
        // Close the contextual ribbon tab on success — the deleted entity is the
        // contextual selection; clearing the dxf-entity selection deselects it
        // (same clear the keyboard PRIORITY 3 path performs).
        if (ok) universalSelection.clearByType('dxf-entity');
      });
    },
    [levelManager, universalSelection, executeCommand],
  );

  return useMemo(() => ({ deleteEntity }), [deleteEntity]);
}
