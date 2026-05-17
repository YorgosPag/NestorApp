import { useMemo } from 'react';
import type { SceneModel, SceneLayer } from '../../../../types/scene';
import { DEFAULT_LAYER_COLOR } from '../../../../config/color-config';

export function useColorGroups(scene: SceneModel | null, searchTerm: string) {
  const colorGroups = useMemo(() => {

    if (!scene?.layersById) return new Map();

    const groups = new Map<string, string[]>();
    (Object.values(scene.layersById) as SceneLayer[]).forEach((layer: SceneLayer) => {
      const layerName = layer.name;
      const color = layer.color || DEFAULT_LAYER_COLOR;
      const colorName = `Color ${color}`;

      const layerNameMatches = searchTerm === '' ||
        layerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        colorName.toLowerCase().includes(searchTerm.toLowerCase());

      const hasMatchingEntities = searchTerm !== '' && scene?.entities?.some(entity =>
        entity.layerId === layer.id && (
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
  }, [scene?.layersById, scene?.entities, searchTerm]);

  return colorGroups;
}