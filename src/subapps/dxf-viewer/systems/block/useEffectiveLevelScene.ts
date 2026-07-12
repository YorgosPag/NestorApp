'use client';

/**
 * useEffectiveLevelScene — ADR-641 Φ2: the EXCLUSIVE-render-scope scene source for the canvas
 * (SSoT). A micro-leaf hook (ADR-040) that returns the {@link SceneModel} the canvas should
 * ACTUALLY render for `levelId`:
 *
 * - not inside a Block Editor → the raw world scene (`useLevelScene`), reference-identical.
 * - inside a Block Editor (`getActiveBlockEditId() !== null`) → that block's block-local synthetic
 *   scene (`resolveBlockEditScene` → `buildBlockEditScene`): ONLY the block's members, base @ origin.
 *
 * It composes two LOW-frequency leaf subscriptions — the level's scene SSoT (`useLevelScene`, new
 * ref only on a real mutation) and the single active-block-edit id (`useActiveBlockEditId`, one
 * transition per enter/exit gesture) — so ONLY the leaf that reads this re-renders; the CanvasSection
 * / CanvasLayerStack orchestrators never do (ADR-040 cardinal rule #1). Entering / exiting the editor
 * flips the returned scene WITHOUT touching the world SceneStore.
 *
 * Every «current scene» consumer that must scope to the entered block (canvas display, whole-
 * container highlight) reads THIS one result, so hit-test / hover / grips scope to the members «for
 * free» and no path applies `expandBlockInstance` to the active block inside BEDIT (ADR-641 §7).
 */

import { useMemo } from 'react';
import type { SceneModel } from '../../types/scene';
import { useLevelScene } from '../scene/useSceneSelectors';
import { useActiveBlockEditId } from './useActiveBlockEdit';
import { resolveBlockEditScene } from './block-edit-scene';

/**
 * The scene the canvas should render for `levelId`: the raw world scene, or — while a Block Editor
 * session is open — that block's block-local synthetic scene (ADR-641 Φ2). Falls back to the raw
 * scene when the active id no longer resolves to a block (deleted / level switched), so the canvas
 * never blanks.
 */
export function useEffectiveLevelScene(levelId: string | null): SceneModel | null {
  const rawScene = useLevelScene(levelId);
  const activeBlockEditId = useActiveBlockEditId();
  return useMemo(
    () => resolveBlockEditScene(rawScene, activeBlockEditId),
    [rawScene, activeBlockEditId],
  );
}
