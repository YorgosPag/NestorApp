'use client';

/**
 * ADR-363 Phase 1D — SSoT writer for wall param mutations originating from
 * the Floating Advanced Properties panel (DNA editor).
 *
 * Mirrors `dispatchStairParamPatch` (ADR-358 Phase 7b2a). All panel writes
 * go through `UpdateWallParamsCommand` (ADR-031 command-history) — same
 * pipeline as `useRibbonWallBridge` (Phase 1B) so undo/redo + geometry
 * recompute behave identically regardless of write origin. `isDragging=false`
 * — each panel mutation is a discrete undo step.
 *
 * Patch semantics: shallow merge over `WallParams`. Callers compose nested
 * patches (e.g. `dna`, `thickness`) before calling.
 *
 * Idempotency + geometry recompute live in `UpdateWallParamsCommand`.
 */

import { useCallback } from 'react';
import { useCommandHistory } from '../../../core/commands';
import { UpdateWallParamsCommand } from '../../../core/commands/entity-commands/UpdateWallParamsCommand';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import type { WallEntity, WallParams } from '../../../bim/types/wall-types';
import { detachSidesAffectedByVerticalEdit } from '../../../bim/walls/wall-attach-detach';
import type { useLevels } from '../../../systems/levels';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseWallParamsDispatcherProps {
  readonly levelManager: LevelManagerLike;
}

export type WallParamsPatch = Partial<WallParams>;

export type DispatchWallParamPatch = (
  wall: WallEntity,
  patch: WallParamsPatch,
) => void;

export function useWallParamsDispatcher(
  props: UseWallParamsDispatcherProps,
): DispatchWallParamPatch {
  const { levelManager } = props;
  const { execute: executeCommand } = useCommandHistory();

  return useCallback<DispatchWallParamPatch>(
    (wall, patch) => {
      if (!levelManager.currentLevelId) return;
      // ADR-401 Phase E.4 — a manual height/baseOffset edit breaks the matching
      // top/base structural attach first (Revit «edit breaks attach»), so the
      // explicit numeric value wins over the host follow. Detach + edit collapse
      // into one undo step (prevParams below restores both). Merge first, then let
      // the full-params SSoT reset any side whose driving scalar the patch changed.
      const merged: WallParams = { ...wall.params, ...patch };
      const next = detachSidesAffectedByVerticalEdit(wall.params, merged);
      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateWallParamsCommand(wall.id, next, wall.params, sm, false, wall.kind),
      );
    },
    [executeCommand, levelManager],
  );
}
