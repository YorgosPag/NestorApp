/**
 * SSOT — useLevelLayersById
 *
 * Returns a stable getter for the current level scene's `layersById` map — the layer table
 * that drives ByLayer / ByBlock style resolution in the REAL entity renderer
 * (`drawRealEntityPreview` → `resolveEntityRenderStyle`). Every WYSIWYG move/reshape/transform
 * preview hook needs exactly this lookup; before this it was copy-pasted inline in each
 * (`useMovePreview`, `useGripGhostPreview`, `useScalePreview`, `useRotationPreview`,
 * `useStretchPreview`). One place owns it now — sibling of `useBimPreviewRenderer`.
 *
 * Read it at draw time (`layersById()`): the level scene swaps by reference when entities
 * change, so a deferred read always sees the live layer table.
 *
 * @see useBimPreviewRenderer — the companion real-renderer-per-ctx SSoT hook
 * @see rendering/ghost/draw-real-entity-preview — the consumer that resolves ByLayer style
 */

import { useCallback } from 'react';
import type { SceneLayer } from '../../types/entities';
import type { useLevels } from '../../systems/levels';

/** The minimal level-manager surface needed to read the active level's layer table. */
type LevelManagerLike = Pick<ReturnType<typeof useLevels>, 'getLevelScene' | 'currentLevelId'>;

export function useLevelLayersById(
  levelManager: LevelManagerLike,
): () => Record<string, SceneLayer> | undefined {
  return useCallback((): Record<string, SceneLayer> | undefined => {
    if (!levelManager.currentLevelId) return undefined;
    return levelManager.getLevelScene(levelManager.currentLevelId)?.layersById;
  }, [levelManager]);
}
