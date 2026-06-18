'use client';

/**
 * ADR-463 — SSoT writer για foundation params από το docked Properties panel.
 *
 * Mirror του `useColumnParamsDispatcher`: κάθε αλλαγή περνά από το
 * `UpdateFoundationParamsCommand` (undoable + geometry/validation recompute
 * atomically)· `useFoundationPersistence` την παραλαμβάνει μέσω debounced auto-save.
 *
 * ADR-484 — cross-level aware: αν το επιλεγμένο πέδιλο ΔΕΝ ζει στον ενεργό όροφο
 * (cross-level, στον foundation level του κτιρίου), το undoable command θα έγραφε
 * στο λάθος scope (το `LevelSceneManagerAdapter` του ενεργού ορόφου δεν θα το έβρισκε
 * → σιωπηλό no-op). Σε αυτή την περίπτωση γράφουμε μέσω του υπάρχοντος
 * `foundation-cross-level-writer` (foundation scope), κάνοντας το geometry/validation
 * recompute με τις **ΙΔΙΕΣ** pure SSoT συναρτήσεις που χρησιμοποιεί το command (μηδέν
 * duplication). Trade-off: cross-level edit = fire-and-forget (μη-undoable), συνεπές
 * με το υπάρχον cross-level auto-design pattern.
 *
 * Το panel επεξεργάζεται **geometry-neutral** πεδία (οπλισμός/υλικό) → δεν χρειάζεται
 * το junction-recompute του ribbon bridge (που αφορά πλάτος/justification γραμμικού
 * πεδίλου)· έτσι το `useRibbonFoundationBridge` μένει αμετάβλητο (surgical, shared-tree).
 *
 * @see ./foundation-bridge-combobox-resolvers.ts
 * @see ../../../../bim/foundations/foundation-cross-level-writer.ts
 */

import { useCallback } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type {
  FoundationEntity,
  FoundationParams,
} from '../../../../bim/types/foundation-types';
import { useCommandHistory } from '../../../../core/commands';
import { UpdateFoundationParamsCommand } from '../../../../core/commands/entity-commands/UpdateFoundationParamsCommand';
import { LevelSceneManagerAdapter } from '../../../../systems/entity-creation/LevelSceneManagerAdapter';
import { computeFoundationGeometry } from '../../../../bim/geometry/foundation-geometry';
import { validateFoundationParams } from '../../../../bim/validators/foundation-validator';
import {
  createFoundationCrossLevelWriter,
  type FoundationWriteScope,
} from '../../../../bim/foundations/foundation-cross-level-writer';
import { useFoundationLevelStore } from '../../../../state/foundation-level-store';
import type { useLevels } from '../../../../systems/levels';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId' | 'levels'
>;

/** Writer: εφαρμόζει νέα params σε ένα θεμελιακό στοιχείο (undoable command + persist). */
export type DispatchFoundationParams = (
  foundation: FoundationEntity,
  nextParams: FoundationParams,
) => void;

export interface UseFoundationParamsDispatcherProps {
  readonly levelManager: LevelManagerLike;
}

/**
 * ADR-484 — cross-level write: recompute (ΙΔΙΕΣ pure SSoT με το command) + foundation-
 * level writer. Επιστρέφει `true` αν έγραψε cross-level, `false` αν δεν υπήρχε στόχος.
 */
function dispatchCrossLevelParams(
  foundation: FoundationEntity,
  nextParams: FoundationParams,
  scope: FoundationWriteScope,
  levelManager: LevelManagerLike,
): boolean {
  const target = useFoundationLevelStore.getState().target;
  if (!target) return false;
  const writer = createFoundationCrossLevelWriter(scope, target, levelManager);
  if (!writer) return false;
  writer.update({
    ...foundation,
    kind: nextParams.kind,
    params: nextParams,
    geometry: computeFoundationGeometry(nextParams),
    validation: validateFoundationParams(nextParams).bimValidation,
  });
  return true;
}

export function useFoundationParamsDispatcher(
  { levelManager }: UseFoundationParamsDispatcherProps,
): DispatchFoundationParams {
  const { execute: executeCommand } = useCommandHistory();
  const { user } = useAuth();
  const companyId = user?.companyId ?? null;
  const userId = user?.uid ?? null;

  return useCallback(
    (foundation: FoundationEntity, nextParams: FoundationParams): void => {
      const currentLevelId = levelManager.currentLevelId;
      if (!currentLevelId) return;
      // Active-level πέδιλο → undoable command (ιστορικό + atomic recompute).
      const activeScene = levelManager.getLevelScene(currentLevelId);
      const inActive = activeScene?.entities.some((e) => e.id === foundation.id) ?? false;
      if (inActive) {
        const sm = new LevelSceneManagerAdapter(
          levelManager.getLevelScene,
          levelManager.setLevelScene,
          currentLevelId,
        );
        executeCommand(
          new UpdateFoundationParamsCommand(foundation.id, nextParams, foundation.params, sm, false),
        );
        return;
      }
      // ADR-484 — cross-level πέδιλο (foundation level): write στο σωστό scope.
      const projectId = levelManager.levels.find((l) => l.id === currentLevelId)?.projectId;
      dispatchCrossLevelParams(
        foundation,
        nextParams,
        { companyId, projectId, userId },
        levelManager,
      );
    },
    [executeCommand, levelManager, companyId, userId],
  );
}
