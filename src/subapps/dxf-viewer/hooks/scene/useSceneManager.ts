// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_SCENE_MANAGER = false;

import { useState, useCallback } from 'react';
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

  const setLevelScene = useCallback((levelId: string, scene: SceneModel) => {
    // 🔍 DEBUG (2026-01-31): Log setLevelScene call
    console.log('🗄️ [useSceneManager] setLevelScene called', {
      levelId,
      entityCount: scene?.entities?.length || 0
    });

    // Μικρό warning για άδειες σκηνές που δημιουργούνται
    if (!scene.entities?.length) {
      if (DEBUG_SCENE_MANAGER) console.debug(`🏢 [SceneManager] Setting empty scene for level ${levelId} (${scene.entities.length} entities)`);
    }

    setLevelScenes(prev => {
      const prevScene = prev[levelId];
      // No-op αν δεν αλλάζει ο pointer (γλιτώνουμε rerender loops)
      if (prevScene === scene) {
        console.log('🗄️ [useSceneManager] Scene pointer unchanged - skipping update');
        return prev;
      }
      console.log('🗄️ [useSceneManager] Updating levelScenes state', {
        levelId,
        prevEntityCount: prevScene?.entities?.length || 0,
        newEntityCount: scene?.entities?.length || 0
      });
      return { ...prev, [levelId]: scene };
    });
  }, []);

  const getLevelScene = useCallback((levelId: string): SceneModel | null => {
    return levelScenes[levelId] || null;
  }, [levelScenes]);

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
