import { useCallback } from 'react';
import type { SceneModel } from '../../../../types/scene';
// ADR-129: Centralized entity layer filtering
import { getEntitiesByLayer } from '../../../../services/shared/layer-operation-utils';

export function useSearchFilter(scene: SceneModel | null, searchTerm: string) {
  // Filter entities for search - ADR-129: Using centralized layer filtering
  const getFilteredEntities = useCallback((layerName: string) => {
    if (!scene?.entities) return [];

    // Get base entities for layer using centralized utility
    const layerEntities = getEntitiesByLayer(scene.entities, layerName);

    // Apply search filter if needed
    if (searchTerm === '') return layerEntities;

    const lowerSearch = searchTerm.toLowerCase();
    return layerEntities.filter(e =>
      e.name?.toLowerCase().includes(lowerSearch) ||
      e.id.toLowerCase().includes(lowerSearch) ||
      e.type?.toLowerCase().includes(lowerSearch)
    );
  }, [scene?.entities, searchTerm]);

  return { getFilteredEntities };
}