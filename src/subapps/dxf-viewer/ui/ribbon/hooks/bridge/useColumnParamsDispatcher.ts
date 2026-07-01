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
import type { Entity } from '../../../../types/entities';
import { useCommandHistory } from '../../../../core/commands';
import { UpdateColumnParamsCommand } from '../../../../core/commands/entity-commands/UpdateColumnParamsCommand';
import { detachSidesAffectedByVerticalEdit } from '../../../../bim/entities/entity-attach-detach';
import { findBeamsFramingColumn } from '../../../../bim/columns/column-structural-attach-coordinator';
import { alignColumnOnTypeChange } from '../../../../bim/columns/column-beam-align';
import { resolveColumnSectionLock } from '../../../../bim/structural/sizing/column-size-patch';
import { resolveActiveColumnDesignMoment } from '../../../../bim/structural/active-reinforcement';
import { resolveStructuralCode } from '../../../../bim/structural/codes';
import { runColumnEditGuards } from '../../../../bim/columns/column-edit-guard-flow';
import { useStructuralSettingsStore } from '../../../../state/structural-settings-store';
import { createLevelSceneManagerAdapter } from '../../../../systems/entity-creation/LevelSceneManagerAdapter';
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

      const commit = (finalParams: ColumnParams): void => {
        const sm = createLevelSceneManagerAdapter(
          levelManager.getLevelScene,
          levelManager.setLevelScene,
          levelManager.currentLevelId!,
        );
        // ADR-496 — έξυπνη ευθυγράμμιση στο/στα πλαισιωτικό/-ά δοκάρι/-α όταν αλλάζει ο τύπος
        // σε ασύμμετρη διατομή (L-shape/T-shape): command-time fit ΠΡΙΝ το command (ΕΝΑ command/
        // emit, ΟΧΙ reactive — μάθημα ADR-492 freeze). Ο proactive κύκλος ακούει το
        // `bim:column-params-updated` → πλήρης αυτόματη επανα-μελέτη (κολώνα + πέδιλο + δοκάρια).
        let fittedParams = finalParams;
        if (finalParams.kind !== column.params.kind) {
          const entities = sm.getEntities() as unknown as readonly Entity[];
          const framingBeams = findBeamsFramingColumn(column, entities);
          const aligned = alignColumnOnTypeChange(column, finalParams, framingBeams);
          if (aligned) fittedParams = aligned;
        }
        // ADR-401 Phase F.3 — manual height/baseOffset edit breaks the matching top/base
        // structural attach first (Revit «edit breaks attach»). Detach + edit → one undo step.
        const next = detachSidesAffectedByVerticalEdit(column.params, fittedParams);
        // ADR-503 Slice 2 — safety-gated lock: χειροκίνητη διατομή ≥ επαρκές → lock· < επαρκές →
        // ΜΠΛΟΚ (μένει AUTO, το σύστημα κρατά την ελάχιστη επαρκή + toast). ΕΝΑ SSoT.
        const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);
        const lock = resolveColumnSectionLock(provider, column.params, next, resolveActiveColumnDesignMoment(column.id));
        executeCommand(new UpdateColumnParamsCommand(column.id, lock.params, column.params, sm, false));
        EventBus.emit('bim:column-params-updated', { columnId: column.id });
        if (lock.rejected) {
          EventBus.emit('bim:column-section-rejected', {
            columnId: column.id, w: next.width, d: next.depth, minW: lock.minWidthMm, minD: lock.minDepthMm,
          });
        }
      };

      // ADR-363 §5.6/§5.6b — edit-time guards (κολόνα→τοιχίο aspect + shear-wall extent) μέσω
      // του SSoT `runColumnEditGuards` (ΕΝΑ σημείο αλήθειας, κοινό με το grip-resize path).
      runColumnEditGuards(column.params, nextParams, commit);
    },
    [executeCommand, levelManager],
  );
}
