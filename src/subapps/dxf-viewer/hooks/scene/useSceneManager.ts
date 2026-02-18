import { useState, useCallback, useRef } from 'react';
import type { SceneModel } from '../../types/scene';

export interface SceneManagerState {
  levelScenes: Record<string, SceneModel>;
  setLevelScene: (levelId: string, scene: SceneModel) => void;
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

  const setLevelScene = useCallback((levelId: string, scene: SceneModel) => {
    setLevelScenes(prev => {
      // No-op if pointer unchanged (avoids rerender loops)
      if (prev[levelId] === scene) return prev;
      return { ...prev, [levelId]: scene };
    });
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getLevelScene = useCallback((levelId: string): SceneModel | null => {
    // Read from ref → safe even when called from stale closures (after await)
    return levelScenesRef.current[levelId] || null;
  }, [levelScenes]); // Dependency kept so reference changes → triggers dependent useMemos/useEffects

  const clearLevelScene = useCallback((levelId: string) => {

    setLevelScenes(prev => {
      const { [levelId]: removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearAllScenes = useCallback(() => {

    setLevelScenes({});
  }, []);

  const hasSceneForLevel = (levelId: string): boolean => {
    return !!levelScenes[levelId];
  };

  const getSceneEntityCount = (levelId: string): number => {
    const scene = levelScenes[levelId];
    return scene?.entities.length || 0;
  };

  return {
    levelScenes,
    setLevelScene,
    getLevelScene,
    clearLevelScene,
    clearAllScenes,
    hasSceneForLevel,
    getSceneEntityCount
  };
}
