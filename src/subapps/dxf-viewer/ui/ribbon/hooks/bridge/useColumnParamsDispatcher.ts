'use client';

/**
 * ADR-363 Phase 4 / Properties-palette split — SSoT writer για column params.
 *
 * Εξάχθηκε από το `useRibbonColumnBridge.dispatchParams` ώστε ΚΑΙ το contextual
 * ribbon tab ΚΑΙ το docked Properties panel (`ColumnPropertiesTab`) να γράφουν
 * από ΕΝΑ σημείο — μηδέν διπλή λογική write. Κάθε αλλαγή περνά από το
 * `UpdateColumnParamsCommand` (undoable + geometry/validation recompute
 * atomically)· `useColumnPersistence` την παραλαμβάνει μέσω debounced auto-save.
 *
 * Mirror του `useWallParamsDispatcher` / `useStairParamsDispatcher` pattern.
 *
 * @see ./column-bridge-combobox-resolvers.ts
 */

import { useCallback } from 'react';
import type { ColumnEntity, ColumnParams } from '../../../../bim/types/column-types';
import { useCommandHistory } from '../../../../core/commands';
import { UpdateColumnParamsCommand } from '../../../../core/commands/entity-commands/UpdateColumnParamsCommand';
import { detachSidesAffectedByVerticalEdit } from '../../../../bim/entities/entity-attach-detach';
import { LevelSceneManagerAdapter } from '../../../../systems/entity-creation/LevelSceneManagerAdapter';
import { EventBus } from '../../../../systems/events/EventBus';
import type { useLevels } from '../../../../systems/levels';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

/** Writer: εφαρμόζει νέα params σε μια κολώνα (undoable command + persist). */
export type DispatchColumnParams = (column: ColumnEntity, nextParams: ColumnParams) => void;

export interface UseColumnParamsDispatcherProps {
  readonly levelManager: LevelManagerLike;
}

export function useColumnParamsDispatcher(
  { levelManager }: UseColumnParamsDispatcherProps,
): DispatchColumnParams {
  const { execute: executeCommand } = useCommandHistory();

  return useCallback(
    (column: ColumnEntity, nextParams: ColumnParams): void => {
      if (!levelManager.currentLevelId) return;
      // ADR-401 Phase F.3 — manual height/baseOffset edit breaks the matching
      // top/base structural attach first (Revit «edit breaks attach»), so the
      // explicit numeric value wins over the host follow. Detach + edit collapse
      // into one undo step.
      const next = detachSidesAffectedByVerticalEdit(column.params, nextParams);
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateColumnParamsCommand(column.id, next, column.params, sm, false),
      );
      EventBus.emit('bim:column-params-updated', { columnId: column.id });
    },
    [executeCommand, levelManager],
  );
}
