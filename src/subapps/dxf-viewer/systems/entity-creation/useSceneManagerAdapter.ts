/**
 * USE SCENE MANAGER ADAPTER — SSoT (ADR-577 / ADR-527)
 *
 * The ONE memoized builder that every interactive tool hook uses to obtain an
 * `ISceneManager` bound to the CURRENT level. Before this, the identical
 * `useCallback` block
 *
 *   const getSceneManager = useCallback(() => {
 *     if (!levelManager.currentLevelId) return null;
 *     return createLevelSceneManagerAdapter(
 *       levelManager.getLevelScene, levelManager.setLevelScene, levelManager.currentLevelId);
 *   }, [levelManager]);
 *
 * was copy-pasted verbatim into 17 tool hooks (copy/move/mirror/rotation/scale/
 * trim/stretch/offset/fillet/chamfer/extend/array/entity-clipboard + the four
 * wall-pick tools). This hook is that block, extracted once — behaviour is
 * byte-identical (same null-guard, same `[levelManager]` dependency, same
 * `createLevelSceneManagerAdapter` SSoT factory which itself returns the cached
 * ADR-527 singleton adapter per (accessor, levelId)).
 *
 * Storage-agnostic: accepts anything with the three level accessors, so both the
 * `Pick` consumers and the full-`LevelsHookReturn` consumer (useWallGapOpeningTool)
 * pass through unchanged.
 *
 * @see systems/entity-creation/LevelSceneManagerAdapter.ts — the cached factory SSoT
 * @see hooks/tools/useMoveTool.ts — a representative consumer
 */
'use client';

import { useCallback } from 'react';
import { createLevelSceneManagerAdapter } from './LevelSceneManagerAdapter';
import type { ISceneManager } from '../../core/commands/interfaces';
import type { LevelsHookReturn } from '../levels';

/**
 * The subset of the levels hook this adapter builder needs. Consumers may pass a
 * full `LevelsHookReturn` (structurally assignable) — the three accessors are all
 * that `createLevelSceneManagerAdapter` reads.
 */
export type SceneAdapterLevelManager = Pick<
  LevelsHookReturn,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

/**
 * Returns a stable `getSceneManager()` bound to the current level.
 * Yields `null` while no level is active; otherwise the ADR-527 singleton adapter.
 */
export function useSceneManagerAdapter(
  levelManager: SceneAdapterLevelManager,
): () => ISceneManager | null {
  return useCallback(() => {
    if (!levelManager.currentLevelId) return null;
    return createLevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelManager.currentLevelId,
    );
  }, [levelManager]);
}
