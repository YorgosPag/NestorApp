'use client';

/**
 * ADR-476 — SSoT writer για slab params.
 *
 * Δίνει στο docked Properties panel (`SlabPropertiesTab`) τον ΙΔΙΟ write-path με το
 * contextual ribbon tab (`useRibbonSlabBridge.dispatchParams`) — μηδέν διπλή λογική:
 * κάθε αλλαγή περνά από το ΥΠΑΡΧΟΝ `UpdateSlabParamsCommand` (undoable + geometry/
 * validation recompute atomically)· το `useSlabPersistence` την παραλαμβάνει μέσω
 * debounced auto-save· το `bim:slab-params-updated` event πυροδοτεί το proactive
 * re-study του οπλισμού (ADR-476 S1). `isDragging=false` ⇒ κάθε edit δικό του undo entry.
 *
 * Mirror του `useBeamParamsDispatcher` (η πλάκα δεν έχει auto-size lock).
 *
 * @see ./slab-structural-bridge.ts
 */

import { useCallback } from 'react';
import type { SlabEntity, SlabParams } from '../../../../bim/types/slab-types';
import { useCommandHistory } from '../../../../core/commands';
import { UpdateSlabParamsCommand } from '../../../../core/commands/entity-commands/UpdateSlabParamsCommand';
import { LevelSceneManagerAdapter } from '../../../../systems/entity-creation/LevelSceneManagerAdapter';
import { EventBus } from '../../../../systems/events/EventBus';
import type { useLevels } from '../../../../systems/levels';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

/** Writer: εφαρμόζει νέα params σε μια πλάκα (undoable command + persist + re-study event). */
export type DispatchSlabParams = (slab: SlabEntity, nextParams: SlabParams) => void;

export interface UseSlabParamsDispatcherProps {
  readonly levelManager: LevelManagerLike;
}

export function useSlabParamsDispatcher(
  { levelManager }: UseSlabParamsDispatcherProps,
): DispatchSlabParams {
  const { execute: executeCommand } = useCommandHistory();

  return useCallback(
    (slab: SlabEntity, nextParams: SlabParams): void => {
      if (!levelManager.currentLevelId) return;
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateSlabParamsCommand(slab.id, nextParams, slab.params, sm, false),
      );
      EventBus.emit('bim:slab-params-updated', { slabId: slab.id });
    },
    [executeCommand, levelManager],
  );
}
