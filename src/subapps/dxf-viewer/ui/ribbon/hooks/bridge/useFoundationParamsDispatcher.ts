'use client';

/**
 * ADR-463 — SSoT writer για foundation params από το docked Properties panel.
 *
 * Mirror του `useColumnParamsDispatcher`: κάθε αλλαγή περνά από το
 * `UpdateFoundationParamsCommand` (undoable + geometry/validation recompute
 * atomically)· `useFoundationPersistence` την παραλαμβάνει μέσω debounced auto-save.
 *
 * Το panel επεξεργάζεται **geometry-neutral** πεδία (οπλισμός/υλικό) → δεν χρειάζεται
 * το junction-recompute του ribbon bridge (που αφορά πλάτος/justification γραμμικού
 * πεδίλου)· έτσι το `useRibbonFoundationBridge` μένει αμετάβλητο (surgical, shared-tree).
 *
 * @see ./foundation-bridge-combobox-resolvers.ts
 */

import { useCallback } from 'react';
import type {
  FoundationEntity,
  FoundationParams,
} from '../../../../bim/types/foundation-types';
import { useCommandHistory } from '../../../../core/commands';
import { UpdateFoundationParamsCommand } from '../../../../core/commands/entity-commands/UpdateFoundationParamsCommand';
import { LevelSceneManagerAdapter } from '../../../../systems/entity-creation/LevelSceneManagerAdapter';
import type { useLevels } from '../../../../systems/levels';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

/** Writer: εφαρμόζει νέα params σε ένα θεμελιακό στοιχείο (undoable command + persist). */
export type DispatchFoundationParams = (
  foundation: FoundationEntity,
  nextParams: FoundationParams,
) => void;

export interface UseFoundationParamsDispatcherProps {
  readonly levelManager: LevelManagerLike;
}

export function useFoundationParamsDispatcher(
  { levelManager }: UseFoundationParamsDispatcherProps,
): DispatchFoundationParams {
  const { execute: executeCommand } = useCommandHistory();

  return useCallback(
    (foundation: FoundationEntity, nextParams: FoundationParams): void => {
      if (!levelManager.currentLevelId) return;
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateFoundationParamsCommand(foundation.id, nextParams, foundation.params, sm, false),
      );
    },
    [executeCommand, levelManager],
  );
}
