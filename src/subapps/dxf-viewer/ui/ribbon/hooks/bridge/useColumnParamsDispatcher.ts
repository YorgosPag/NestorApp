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
      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      // ADR-496 — έξυπνη ευθυγράμμιση στο/στα πλαισιωτικό/-ά δοκάρι/-α όταν αλλάζει ο τύπος
      // σε ασύμμετρη διατομή: το νέο σχήμα μπαίνει αλλιώς έκκεντρο γύρω από το ίδιο insertion
      // point. Phase 1 = L-shape (1 δοκάρι, bearing arm)· Phase 2 = T-shape (2 κάθετα δοκάρια,
      // T-junction — κάθε σκέλος συνέχεια του δοκαριού του). Command-time fit ΠΡΙΝ το command —
      // ΕΝΑ command/emit, ΟΧΙ reactive (μάθημα ADR-492 freeze). Ο proactive κύκλος (organism/
      // foundation/loads/reinforce) ακούει ήδη το `bim:column-params-updated` → πλήρης αυτόματη
      // επανα-μελέτη (διατομές/οπλισμός κολώνας + πέδιλο + δοκάρια).
      let fittedParams = nextParams;
      if (nextParams.kind !== column.params.kind) {
        const entities = sm.getEntities() as unknown as readonly Entity[];
        const framingBeams = findBeamsFramingColumn(column, entities);
        const aligned = alignColumnOnTypeChange(column, nextParams, framingBeams);
        if (aligned) fittedParams = aligned;
      }
      // ADR-401 Phase F.3 — manual height/baseOffset edit breaks the matching
      // top/base structural attach first (Revit «edit breaks attach»), so the
      // explicit numeric value wins over the host follow. Detach + edit collapse
      // into one undo step.
      const next = detachSidesAffectedByVerticalEdit(column.params, fittedParams);
      // ADR-503 Slice 2 — safety-gated lock: χειροκίνητη διατομή ≥ επαρκές → lock (autoSized:false)·
      // < επαρκές → ΜΠΛΟΚ (μένει AUTO, σύστημα κρατά την ελάχιστη επαρκή + toast). ΕΝΑ SSoT.
      const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);
      const lock = resolveColumnSectionLock(provider, column.params, next, resolveActiveColumnDesignMoment(column.id));
      executeCommand(
        new UpdateColumnParamsCommand(column.id, lock.params, column.params, sm, false),
      );
      EventBus.emit('bim:column-params-updated', { columnId: column.id });
      if (lock.rejected) {
        EventBus.emit('bim:column-section-rejected', {
          columnId: column.id, w: next.width, d: next.depth, minW: lock.minWidthMm, minD: lock.minDepthMm,
        });
      }
    },
    [executeCommand, levelManager],
  );
}
