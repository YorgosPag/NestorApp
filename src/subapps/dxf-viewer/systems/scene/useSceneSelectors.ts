'use client';

/**
 * SCENE SELECTOR HOOKS — React leaf subscriptions over the {@link SceneStore}
 * SSoT (ADR-547 Stage 2/3).
 *
 * These are the reactive counterpart to `scene-selectors.ts`: a component that
 * needs only its own entity type (a persistence host) or only the selected entity
 * (a properties panel) subscribes here instead of receiving the monolithic
 * `currentScene` prop. Because the underlying selectors return reference-stable
 * slices, the component re-renders ONLY when ITS slice changes — editing an
 * unrelated entity is a no-op for it.
 *
 * Mirrors the `useSyncExternalStore` shape already used by
 * `useSceneManager`/`SelectedEntitiesStore` (ADR-040 / ADR-532).
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { AnySceneEntity, SceneModel } from '../../types/scene';
import { subscribeScene, getSceneForLevel } from './SceneStore';
import { getSceneEntitiesByType, getSceneEntityById } from './scene-selectors';

type SliceGuard<T extends AnySceneEntity> = (e: AnySceneEntity) => e is T;

/**
 * Subscribe to a level's FULL scene (the whole `SceneModel`). Re-renders on ANY
 * content change of that level's scene (add / remove / edit of any entity).
 *
 * This is the reactive counterpart of the non-reactive `getLevelScene()` prop
 * (`useSceneState.ts`): a canvas render leaf subscribes here so a committed entity
 * repaints IMMEDIATELY (big-player invalidate-on-model-change) instead of waiting
 * for a coincidental React re-render of the orchestrator. Reference-stable — the
 * `SceneStore` record only mints a new `SceneModel` on a real mutation, so
 * `useSyncExternalStore`'s getSnapshot never tears (ADR-547 caching rule).
 */
export function useLevelScene(levelId: string | null): SceneModel | null {
  const getSnapshot = useCallback(
    () => (levelId ? getSceneForLevel(levelId) : null),
    [levelId],
  );
  return useSyncExternalStore(subscribeScene, getSnapshot, getSnapshot);
}

/**
 * Subscribe to all entities of one type in a level's scene. Re-renders only when
 * THIS type's slice changes (add/remove/edit of this type) — never when another
 * type is edited. Pass a stable, module-level type guard (e.g. `isWallEntity`).
 */
export function useSceneEntitiesByType<T extends AnySceneEntity>(
  levelId: string | null,
  guard: SliceGuard<T>,
): readonly T[] {
  const getSnapshot = useCallback(
    () => getSceneEntitiesByType(levelId, guard),
    [levelId, guard],
  );
  return useSyncExternalStore(subscribeScene, getSnapshot, getSnapshot);
}

/**
 * Subscribe to a single entity by id. Re-renders only when THAT entity changes
 * (or the id changes) — editing another entity leaves the reference stable.
 */
export function useSceneEntityById(
  levelId: string | null,
  entityId: string | null,
): AnySceneEntity | null {
  const getSnapshot = useCallback(
    () => getSceneEntityById(levelId, entityId),
    [levelId, entityId],
  );
  return useSyncExternalStore(subscribeScene, getSnapshot, getSnapshot);
}
