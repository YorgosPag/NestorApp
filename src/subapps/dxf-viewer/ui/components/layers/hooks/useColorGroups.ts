import { useMemo } from 'react';
import type { SceneModel } from '../../../../types/scene';
import { DEFAULT_LAYER_COLOR } from '../../../../config/color-config';
// 🏢 ADR-358 Phase 9D-3: id-first reader SSoT
import { resolveEntityLayerName } from '../../../../stores/LayerStore';

export function useColorGroups(scene: SceneModel | null, searchTerm: string) {
  const colorGroups = useMemo(() => {

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
        // ADR-358 Phase 9D-3b: id-first via LayerStore, name fallback
        resolveEntityLayerName(entity) === layerName && (
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

    return groups;
  }, [scene?.layers, scene?.entities, searchTerm]);

  return colorGroups;
}