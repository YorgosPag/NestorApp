import { useSyncExternalStore, useMemo } from 'react';
import type { SceneModel } from '../../types/scene';
import type { SceneWriteOrigin } from './scene-write-origin';
import { SceneStore, subscribeScene, getSceneRecord } from '../../systems/scene/SceneStore';

export interface SceneManagerState {
  levelScenes: Record<string, SceneModel>;
  /**
   * ADR-040: optional `origin` is the SSoT provenance consumed by the auto-save
   * override (`useAutoSaveSceneManager`). The base manager IGNORES it for state —
   * it only stores the scene. Optional → backward-compatible, no call site breaks.
   */
  setLevelScene: (levelId: string, scene: SceneModel, origin?: SceneWriteOrigin) => void;
  getLevelScene: (levelId: string) => SceneModel | null;
  clearLevelScene: (levelId: string) => void;
  clearAllScenes: () => void;
  hasSceneForLevel: (levelId: string) => boolean;
  getSceneEntityCount: (levelId: string) => number;
}

/**
 * ADR-547 Stage 0 — thin adapter over the zero-React {@link SceneStore} SSoT.
 *
 * Previously this hook owned a per-instance `useState<Record<levelId, SceneModel>>`,
 * which meant each `useSceneManager()` call site had its OWN scene record (the
 * `useProSnapIntegration` site held a permanently-empty one — a latent two-source
 * SSoT violation). The state now lives in the module-level `SceneStore`, so every
 * call site shares ONE source of truth and later stages can subscribe to granular
 * slices (per-type / per-entity) instead of the whole record.
 *
 * Behaviour-preserving: the reactive `levelScenes` snapshot still changes on every
 * scene mutation (so existing consumers re-render exactly as before — zero perf win
 * here, that lands in Stage 1+). The mutators/getters are stable module functions,
 * and `getLevelScene` reads the store synchronously so a sequential CompoundCommand
 * still sees its own prior write within the tick (the old `levelScenesRef`
 * invariant). `setLevelScene`'s `origin` is accepted for signature compatibility
 * and ignored by the base manager (the auto-save override reads it).
 */
export function useSceneManager(): SceneManagerState {
  const levelScenes = useSyncExternalStore(subscribeScene, getSceneRecord, getSceneRecord);

  return useMemo<SceneManagerState>(() => ({
    levelScenes,
    setLevelScene: SceneStore.setLevelScene,
    getLevelScene: SceneStore.getLevelScene,
    clearLevelScene: SceneStore.clearLevelScene,
    clearAllScenes: SceneStore.clearAllScenes,
    hasSceneForLevel: SceneStore.hasSceneForLevel,
    getSceneEntityCount: SceneStore.getSceneEntityCount,
  }), [levelScenes]);
}
