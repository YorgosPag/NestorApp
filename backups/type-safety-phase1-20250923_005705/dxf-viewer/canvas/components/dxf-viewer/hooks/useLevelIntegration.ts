'use client';

import { useMemo } from 'react';
import type { SceneModel } from '../../../../types/scene';

interface Level {
  id: string;
  name: string;
  [key: string]: any;
}

interface LevelIntegrationOptions {
  levels: Level[];
  currentLevelId: string;
  selectedEntityIds: string[];
  getLevelScene: (levelId: string) => SceneModel | null;
}

export function useLevelIntegration({
  levels,
  currentLevelId,
  selectedEntityIds,
  getLevelScene
}: LevelIntegrationOptions) {
  
  // ============================================================================
  // ALL LEVELS SCENE - Συλλογή από όλα τα επίπεδα
  // ============================================================================
  const allLevelsScene = useMemo(() => {
    const allEntities: any[] = [];
    const allLayers: any = {};
    let bounds = null;
    
    // Συλλογή όλων των entities και layers από όλα τα επίπεδα
    levels.forEach((level, levelIndex) => {
      const levelScene = getLevelScene(level.id);
      if (levelScene) {
        // Προσθήκη entities με level prefix στο layer name
        levelScene.entities.forEach((entity: any) => {
          allEntities.push({
            ...entity,
            layer: `${level.name}_${entity.layer}`, // Prefix με όνομα επιπέδου
            originalLayer: entity.layer,
            levelId: level.id,
            levelName: level.name,
            levelIndex: levelIndex
          });
        });
        
        // Προσθήκη layers με level prefix
        Object.entries(levelScene.layers).forEach(([layerName, layer]) => {
          allLayers[`${level.name}_${layerName}`] = {
            ...layer,
            originalName: layerName,
            levelId: level.id,
            levelName: level.name,
            levelIndex: levelIndex
          };
        });
        
        // Ενημέρωση bounds
        if (levelScene.bounds) {
          if (!bounds) {
            bounds = { ...levelScene.bounds };
          } else {
            bounds.min.x = Math.min(bounds.min.x, levelScene.bounds.min.x);
            bounds.min.y = Math.min(bounds.min.y, levelScene.bounds.min.y);
            bounds.max.x = Math.max(bounds.max.x, levelScene.bounds.max.x);
            bounds.max.y = Math.max(bounds.max.y, levelScene.bounds.max.y);
          }
        }
      }
    });
    
    return {
      entities: allEntities,
      layers: allLayers,
      bounds: bounds,
      units: 'mm'
    };
  }, [levels, getLevelScene]);

  // ============================================================================
  // ENHANCED CURRENT SCENE - Τρέχον επίπεδο + επιλεγμένα από άλλα
  // ============================================================================
  const createEnhancedCurrentScene = useMemo(() => {
    return (currentScene: SceneModel | null) => {
      if (!currentScene) return null;
      if (!selectedEntityIds.length || !allLevelsScene) return currentScene;
      
      // console.log(`🔧 [enhancedCurrentScene] Selected entities: ${selectedEntityIds.length}`, selectedEntityIds);
      // console.log(`🔧 [enhancedCurrentScene] Current level: ${currentLevelId}`);
      // console.log(`🔧 [enhancedCurrentScene] All levels entities: ${allLevelsScene.entities.length}`);
      
      // Βρες τα επιλεγμένα entities από άλλα επίπεδα
      const selectedFromOtherLevels = allLevelsScene.entities.filter((entity: any) => 
        selectedEntityIds.includes(entity.id) && entity.levelId !== currentLevelId
      );
      
      // console.log(`🔧 [enhancedCurrentScene] Selected from other levels: ${selectedFromOtherLevels.length}`, selectedFromOtherLevels.map(e => `${e.id}(${e.levelName})`));
      
      if (selectedFromOtherLevels.length === 0) return currentScene;
      
      // Συνδύασε το current scene με τα επιλεγμένα από άλλα επίπεδα
      const enhancedEntities = [
        ...currentScene.entities,
        ...selectedFromOtherLevels.map((entity: any) => ({
          ...entity,
          layer: entity.originalLayer, // Επαναφορά στο original layer name
          fromOtherLevel: true // Flag για rendering
        }))
      ];
      
      // console.log(`🔧 [enhancedCurrentScene] Final enhanced scene: ${enhancedEntities.length} entities (${currentScene.entities.length} current + ${selectedFromOtherLevels.length} from other levels)`);
      
      return {
        ...currentScene,
        entities: enhancedEntities,
        layers: {
          ...currentScene.layers,
          // Προσθήκη των layers από άλλα επίπεδα αν χρειάζεται
          ...selectedFromOtherLevels.reduce((acc: any, entity: any) => {
            const layerKey = entity.originalLayer;
            if (!acc[layerKey] && allLevelsScene.layers[entity.layer]) {
              acc[layerKey] = {
                ...allLevelsScene.layers[entity.layer],
                name: entity.originalLayer,
                fromOtherLevel: true
              };
            }
            return acc;
          }, {})
        }
      };
    };
  }, [selectedEntityIds, allLevelsScene, currentLevelId]);

  return {
    // Computed scenes
    allLevelsScene,
    createEnhancedCurrentScene,
    
    // Helper functions
    getLevelScene,
  };
}