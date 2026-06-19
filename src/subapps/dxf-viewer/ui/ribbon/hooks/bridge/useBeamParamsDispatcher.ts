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
import { resolveBeamSectionLock } from '../../../../bim/structural/sizing/beam-size-patch';
import {
  resolveActiveBeamSupportType,
  resolveActiveBeamTorsion,
  resolveActiveBeamSpanMm,
} from '../../../../bim/structural/active-reinforcement';
import { resolveStructuralCode } from '../../../../bim/structural/codes';
import { useStructuralSettingsStore } from '../../../../state/structural-settings-store';
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
      // ADR-503 Slice 3 — safety-gated lock (ίδιο SSoT με grip, mirror κολώνας): χειροκίνητη
      // διατομή ≥ επαρκές → lock (`autoSized:false`)· < επαρκές → ΜΠΛΟΚ (μένει AUTO, το σύστημα
      // κρατά το ελάχιστο επαρκές ύψος + toast). Μη-section edits (supportType/material/…) → pass-through.
      const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);
      const lock = resolveBeamSectionLock(
        provider, beam, beam.params, nextParams,
        resolveActiveBeamSupportType(beam.id), resolveActiveBeamTorsion(beam.id),
        resolveActiveBeamSpanMm(beam.id),
      );
      executeCommand(
        new UpdateBeamParamsCommand(beam.id, lock.params, beam.params, sm, false),
      );
      EventBus.emit('bim:beam-params-updated', { beamId: beam.id });
      if (lock.rejected) {
        EventBus.emit('bim:beam-section-rejected', {
          beamId: beam.id, depth: nextParams.depth, minDepth: lock.minDepthMm,
        });
      }
    },
    [executeCommand, levelManager],
  );
}
