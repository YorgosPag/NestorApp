import { useMemo } from 'react';
import type { Layer, LayerFiltering } from './types';

export interface LayerFilteringHook {
  filtering: LayerFiltering;
}

/**
 * useLayerFiltering — merges quick search + category select with the active
 * Q11 filter result (`activeFilteredLayerIds`, ADR-358 Phase 11). `null` means
 * pass-through (no filter from the sidebar).
 */
export function useLayerFiltering(
  layers: Layer[],
  searchQuery: string,
  selectedCategory: string,
  setSearchQuery: (query: string) => void,
  setSelectedCategory: (category: string) => void,
  activeFilteredLayerIds: ReadonlySet<string> | null = null,
): LayerFilteringHook {

  const filteredLayers = useMemo(() => {
    return layers.filter((layer) => {
      if (searchQuery && !layer.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (selectedCategory !== 'all' && layer.category !== selectedCategory) {
        return false;
      }
      if (activeFilteredLayerIds && !activeFilteredLayerIds.has(layer.id)) {
        return false;
      }
      return true;
    });
  }, [layers, searchQuery, selectedCategory, activeFilteredLayerIds]);

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
