'use client';

/**
 * ADR-344 Phase 6.D — Current scene selector (panel-side alias).
 *
 * Thin alias over the levels SSoT `useCurrentLevelScene` (ADR-557). Kept as a named
 * panel-side hook so text-toolbar consumers (and their `__mocks__`) keep a stable import,
 * but the derivation itself lives in ONE place. Returns `null` when no level is active.
 */

import { useCurrentLevelScene } from '../../../systems/levels';
import type { SceneModel } from '../../../types/scene';

export function useCurrentSceneModel(): SceneModel | null {
  return useCurrentLevelScene();
}
