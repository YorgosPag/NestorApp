'use client';

/**
 * ADR-471 — SSoT writer για beam params.
 *
 * Εξάχθηκε (boy-scout, N.0.2) από το inline `useRibbonBeamBridge.dispatchParams`
 * ώστε ΚΑΙ το contextual ribbon tab ΚΑΙ το docked Properties panel
 * (`BeamPropertiesTab`) να γράφουν από ΕΝΑ σημείο — μηδέν διπλή λογική write. Κάθε
 * αλλαγή περνά από το `UpdateBeamParamsCommand` (undoable + geometry/validation
 * recompute atomically)· `useBeamPersistence` την παραλαμβάνει μέσω debounced
 * auto-save. `isDragging=false` ⇒ κάθε edit δικό του undo entry (drag merging ζει
 * στο grip-commit path).
 *
 * Mirror του `useColumnParamsDispatcher` (η δοκός δεν έχει vertical-edit detach).
 *
 * @see ./beam-structural-bridge.ts
 */

import { useCallback } from 'react';
import type { BeamEntity, BeamParams } from '../../../../bim/types/beam-types';
import { useCommandHistory } from '../../../../core/commands';
import { UpdateBeamParamsCommand } from '../../../../core/commands/entity-commands/UpdateBeamParamsCommand';
import { LevelSceneManagerAdapter } from '../../../../systems/entity-creation/LevelSceneManagerAdapter';
import { EventBus } from '../../../../systems/events/EventBus';
import type { useLevels } from '../../../../systems/levels';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

/** Writer: εφαρμόζει νέα params σε ένα δοκάρι (undoable command + persist). */
export type DispatchBeamParams = (beam: BeamEntity, nextParams: BeamParams) => void;

export interface UseBeamParamsDispatcherProps {
  readonly levelManager: LevelManagerLike;
}

export function useBeamParamsDispatcher(
  { levelManager }: UseBeamParamsDispatcherProps,
): DispatchBeamParams {
  const { execute: executeCommand } = useCommandHistory();

  return useCallback(
    (beam: BeamEntity, nextParams: BeamParams): void => {
      if (!levelManager.currentLevelId) return;
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      // ADR-475 — χειροκίνητη αλλαγή ΔΙΑΤΟΜΗΣ (depth/width) = override → lock της auto-size
      // (Revit). Άλλες αλλαγές (supportType/material/…) κρατούν το auto-size ενεργό.
      const sectionChanged =
        nextParams.width !== beam.params.width || nextParams.depth !== beam.params.depth;
      const finalParams: BeamParams = sectionChanged
        ? { ...nextParams, autoSized: false }
        : nextParams;
      executeCommand(
        new UpdateBeamParamsCommand(beam.id, finalParams, beam.params, sm, false),
      );
      EventBus.emit('bim:beam-params-updated', { beamId: beam.id });
    },
    [executeCommand, levelManager],
  );
}
