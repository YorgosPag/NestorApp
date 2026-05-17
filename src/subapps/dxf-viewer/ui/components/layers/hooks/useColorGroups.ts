import { useMemo } from 'react';
import type { SceneModel, SceneLayer } from '../../../../types/scene';
import { DEFAULT_LAYER_COLOR } from '../../../../config/color-config';

export function useColorGroups(scene: SceneModel | null, searchTerm: string) {
  const colorGroups = useMemo(() => {

    if (!scene?.layers) return new Map();

    const groups = new Map<string, string[]>();
    // ADR-358 Phase 9E-4: iterate layer objects (layersById preferred, layers fallback).
    (Object.values(scene.layersById ?? scene.layers ?? {}) as SceneLayer[]).forEach((layer: SceneLayer) => {
      const layerName = layer.name;
      const color = layer.color || DEFAULT_LAYER_COLOR;
      const colorName = `Color ${color}`;

      // Check if layer name or color name matches search
      const layerNameMatches = searchTerm === '' ||
        layerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        colorName.toLowerCase().includes(searchTerm.toLowerCase());

      // Check if any entities in this layer match search
      // ADR-358 Phase 9E-4: id-first entity-to-layer match, entity.layer name fallback.
      const hasMatchingEntities = searchTerm !== '' && scene?.entities?.some(entity =>
        (entity.layerId === layer.id || entity.layer === layerName) && (
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
  }, [scene?.layers, scene?.layersById, scene?.entities, searchTerm]);

  return colorGroups;
}