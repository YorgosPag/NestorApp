'use client';

/**
 * ADR-407 Φ9 — SSoT writer for railing param mutations originating from the
 * left-sidebar Properties tab.
 *
 * Mirrors `useStairParamsDispatcher` (ADR-358 Phase 7b2a) so the panel writes
 * through the same `UpdateRailingParamsCommand` pipeline (ADR-031
 * command-history, ADR-407 associative geometry recompute on every commit).
 * `isDragging=false` — each panel mutation is a discrete undo step (no
 * merging window, no implicit chain).
 *
 * Unlike the stair dispatcher (shallow-merge `Partial<StairParams>`), the
 * caller here already computes the FULL next `RailingParams` via
 * `patchRailingField` (the railing read/patch SSoT) — so this dispatcher
 * takes the complete `next` object, not a patch fragment.
 */

import { useCallback } from 'react';
import { useCommandHistory } from '../../../core/commands';
import { UpdateRailingParamsCommand } from '../../../core/commands/entity-commands/UpdateRailingParamsCommand';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import type { RailingEntity, RailingParams } from '../../../bim/types/railing-types';
import type { LevelSceneWriter } from '../../../systems/levels/level-scene-accessor';

export interface UseRailingParamsDispatcherProps {
  readonly levelManager: LevelSceneWriter;
}

export type DispatchRailingParamPatch = (
  railing: RailingEntity,
  next: RailingParams,
) => void;

export function useRailingParamsDispatcher(
  props: UseRailingParamsDispatcherProps,
): DispatchRailingParamPatch {
  const { levelManager } = props;
  const { execute: executeCommand } = useCommandHistory();

  return useCallback<DispatchRailingParamPatch>(
    (railing, next) => {
      if (!levelManager.currentLevelId) return;
      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateRailingParamsCommand(railing.id, next, railing.params, sm, false),
      );
    },
    [executeCommand, levelManager],
  );
}
