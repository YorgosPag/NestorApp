import { useCallback } from 'react';
import type { SceneModel } from '../../../../types/scene';

export function useSearchFilter(scene: SceneModel | null, searchTerm: string) {
  // Filter entities for search
  const getFilteredEntities = useCallback((layerName: string) => {
    if (!scene?.entities || searchTerm === '') {
      return scene?.entities?.filter(e => e.layer === layerName) || [];
    }
    
    return scene.entities.filter(e => 
      e.layer === layerName && (
        e.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.type?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [scene?.entities, searchTerm]);

  return { getFilteredEntities };
}