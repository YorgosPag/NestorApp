import { useMemo } from 'react';
import type { SceneModel } from '../../../../types/scene';
import { DEFAULT_LAYER_COLOR } from '../../../../config/color-config';

export function useColorGroups(scene: SceneModel | null, searchTerm: string) {
  const colorGroups = useMemo(() => {
    console.log('🎯 useColorGroups calculation:', { 
      hasScene: !!scene, 
      hasLayers: !!scene?.layers,
      layersCount: scene?.layers ? Object.keys(scene.layers).length : 0,
      searchTerm 
    });
    if (!scene?.layers) return new Map();
    
    const groups = new Map<string, string[]>();
    Object.keys(scene.layers).forEach((layerName: string) => {
      const layer = scene.layers[layerName];
      const color = layer.color || DEFAULT_LAYER_COLOR;
      const colorName = `Color ${color}`;
      
      // Check if layer name or color name matches search
      const layerNameMatches = searchTerm === '' || 
        layerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        colorName.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Check if any entities in this layer match search
      const hasMatchingEntities = searchTerm !== '' && scene?.entities?.some(entity => 
        entity.layer === layerName && (
          entity.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entity.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entity.type?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
        
      if (layerNameMatches || hasMatchingEntities) {
        if (!groups.has(colorName)) {
          groups.set(colorName, []);
        }
        groups.get(colorName)!.push(layerName);
      }
    });
    
    console.log('🎯 useColorGroups result:', { 
      groupsSize: groups.size, 
      groupNames: Array.from(groups.keys()),
      totalLayers: Array.from(groups.values()).flat().length
    });
    return groups;
  }, [scene?.layers, scene?.entities, searchTerm]);

  return colorGroups;
}