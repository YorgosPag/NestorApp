import { useState, useCallback, useRef, useMemo } from 'react';
import type { SceneModel } from '../../types/scene';
import type { SceneWriteOrigin } from './scene-write-origin';

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

export function useSceneManager(): SceneManagerState {
  const [levelScenes, setLevelScenes] = useState<Record<string, SceneModel>>({});

  // CRITICAL: Ref ensures getLevelScene ALWAYS reads latest scenes,
  // even when called from stale closures (e.g., after await in AI executor).
  // Without this, getLevelScene captures old levelScenes and returns stale data.
  const levelScenesRef = useRef(levelScenes);
  levelScenesRef.current = levelScenes;

  const setLevelScene = useCallback((levelId: string, scene: SceneModel, _origin?: SceneWriteOrigin) => {
    // ADR-040: base manager ignores `_origin` (state-only); the auto-save override
    // reads it to gate the debounce. Param kept for signature compatibility.
    const prev = levelScenesRef.current;
    // No-op if pointer unchanged (avoids rerender loops)
    if (prev[levelId] === scene) return;
    const next = { ...prev, [levelId]: scene };
    // Update the ref SYNCHRONOUSLY so getLevelScene() reflects this write within
    // the same tick. Critical for multi-entity commands: a CompoundCommand
    // applies its children sequentially (e.g. wall then hosted opening) and each
    // child reads getLevelScene() to rebuild the scene — if the ref still held
    // the pre-write value, the 2nd child would clobber the 1st's change (wall
    // reverted to its original position). React state mirrors the ref to render.
    levelScenesRef.current = next;
    setLevelScenes(next);
  }, []);

  const getLevelScene = useCallback((levelId: string): SceneModel | null => {
    // Read from ref → safe even when called from stale closures (after await)
    return levelScenesRef.current[levelId] || null;
  }, []); // ← STABILE: reads from ref, no deps needed

  const clearLevelScene = useCallback((levelId: string) => {
    const { [levelId]: _removed, ...rest } = levelScenesRef.current;
    levelScenesRef.current = rest;
    setLevelScenes(rest);
  }, []);

  const clearAllScenes = useCallback(() => {
    levelScenesRef.current = {};
    setLevelScenes({});
  }, []);

  const hasSceneForLevel = useCallback((levelId: string): boolean => {
    return !!levelScenes[levelId];
  }, [levelScenes]);

  const getSceneEntityCount = useCallback((levelId: string): number => {
    const scene = levelScenes[levelId];
    return scene?.entities.length || 0;
  }, [levelScenes]);

  return useMemo(() => ({
    levelScenes,
    setLevelScene,
    getLevelScene,
    clearLevelScene,
    clearAllScenes,
    hasSceneForLevel,
    getSceneEntityCount
  }), [levelScenes, setLevelScene, getLevelScene, clearLevelScene, clearAllScenes, hasSceneForLevel, getSceneEntityCount]);
}
