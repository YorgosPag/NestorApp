'use client';

/**
 * ADR-344 Phase 6.D — Current scene selector.
 *
 * Resolves the active level's SceneModel via the LevelsSystem. Returns
 * `null` when no level is selected or no scene is loaded yet. Kept as
 * a dedicated hook so panel-side consumers do not pull in the full
 * `useSceneState` surface (which depends on canvas ops, notifications,
 * i18n, clipboard, …).
 */

import { useMemo } from 'react';
import { useLevels } from '../../../systems/levels';
import type { SceneModel } from '../../../types/scene';

export function useCurrentSceneModel(): SceneModel | null {
  const { currentLevelId, getLevelScene } = useLevels();
  return useMemo(() => {
    if (!currentLevelId) return null;
    return getLevelScene(currentLevelId) ?? null;
  }, [currentLevelId, getLevelScene]);
}
