import { useMemo } from 'react';
import type { Layer, LayerFiltering } from './types';

export interface LayerFilteringHook {
  filtering: LayerFiltering;
}

export function useLayerFiltering(
  layers: Layer[],
  searchQuery: string,
  selectedCategory: string,
  setSearchQuery: (query: string) => void,
  setSelectedCategory: (category: string) => void
): LayerFilteringHook {

  const filteredLayers = useMemo(() => {
    return layers.filter(layer => {
      // Search query filter
      if (searchQuery && !layer.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Category filter
      if (selectedCategory !== 'all' && layer.category !== selectedCategory) {
        return false;
      }
      
      return true;
    });
  }, [layers, searchQuery, selectedCategory]);

  const filtering: LayerFiltering = {
    filteredLayers,
    searchQuery,
    selectedCategory,
    setSearchQuery,
    setSelectedCategory,
  };

  return {
    filtering,
  };
}