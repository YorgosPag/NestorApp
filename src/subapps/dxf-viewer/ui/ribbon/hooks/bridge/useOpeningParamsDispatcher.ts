'use client';

/**
 * ADR-363 Phase 2.5 / ADR-611 — SSoT writer for opening param mutations.
 *
 * Extracted out of `useRibbonOpeningBridge.dispatchParams` (boy-scout
 * centralization, CLAUDE.md N.0.2) so every opening-param writer — the
 * contextual ribbon tab AND the new ADR-611 frame-profile widget — commits
 * through ONE `UpdateOpeningParamsCommand` dispatch, not two copies of the
 * same adapter-plumbing. Mirrors `useColumnParamsDispatcher` /
 * `useWallParamsDispatcher` (same-folder siblings).
 *
 * `isDragging=false` — each ribbon/widget edit is its own undo entry (drag
 * merging lives in the grip-commit path, untouched by this hook).
 *
 * @see ../useRibbonOpeningBridge.ts — wraps this with the `bim:opening-params-updated` emit
 */

import { useCallback } from 'react';
import { useCommandHistory } from '../../../../core/commands';
import { UpdateOpeningParamsCommand } from '../../../../core/commands/entity-commands/UpdateOpeningParamsCommand';
import { createLevelSceneManagerAdapter } from '../../../../systems/entity-creation/LevelSceneManagerAdapter';
import type { OpeningEntity, OpeningParams } from '../../../../bim/types/opening-types';
import type { LevelSceneWriter } from '../../../../systems/levels/level-scene-accessor';

/** Writer: applies new params to an opening (undoable command + persist). */
export type DispatchOpeningParams = (opening: OpeningEntity, nextParams: OpeningParams) => void;

export interface UseOpeningParamsDispatcherProps {
  readonly levelManager: LevelSceneWriter;
}

export function useOpeningParamsDispatcher(
  { levelManager }: UseOpeningParamsDispatcherProps,
): DispatchOpeningParams {
  const { execute: executeCommand } = useCommandHistory();

  return useCallback<DispatchOpeningParams>(
    (opening, nextParams) => {
      if (!levelManager.currentLevelId) return;
      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateOpeningParamsCommand(opening.id, nextParams, opening.params, sm, false),
      );
    },
    [executeCommand, levelManager],
  );
}
