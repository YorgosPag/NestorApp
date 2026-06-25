'use client';

/**
 * ADR-358 Phase 7b2a — SSoT writer for stair param mutations originating
 * from the Floating Advanced Properties panel.
 *
 * Mirrors `useRibbonStairBridge.dispatchParams` (Phase 7a) so the panel
 * and the ribbon write through the same `UpdateStairParamsCommand`
 * pipeline (ADR-031 command-history, ADR-358 §5.1 associative geometry
 * recompute on every commit). `isDragging=false` — each panel mutation
 * is a discrete undo step (no merging window, no implicit chain).
 *
 * Patch semantics: shallow merge over `StairParams`. Callers compose
 * nested patches (e.g. `materials`, `perTreadOverrides`) before calling.
 * Idempotency guarantees live in `UpdateStairParamsCommand`.
 */

import { useCallback } from 'react';
import { useCommandHistory } from '../../../core/commands';
import { UpdateStairParamsCommand } from '../../../core/commands/entity-commands/UpdateStairParamsCommand';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import type { StairEntity } from '../../../types/entities';
import type { StairParams } from '../../../bim/types/stair-types';
import type { useLevels } from '../../../systems/levels';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseStairParamsDispatcherProps {
  readonly levelManager: LevelManagerLike;
}

export type StairParamsPatch = Partial<StairParams>;

export type DispatchStairParamPatch = (
  stair: StairEntity,
  patch: StairParamsPatch,
) => void;

export function useStairParamsDispatcher(
  props: UseStairParamsDispatcherProps,
): DispatchStairParamPatch {
  const { levelManager } = props;
  const { execute: executeCommand } = useCommandHistory();

  return useCallback<DispatchStairParamPatch>(
    (stair, patch) => {
      if (!levelManager.currentLevelId) return;
      const next: StairParams = { ...stair.params, ...patch };
      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateStairParamsCommand(stair.id, next, stair.params, sm, false),
      );
    },
    [executeCommand, levelManager],
  );
}
