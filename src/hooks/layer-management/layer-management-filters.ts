import type { Layer, LayerFilter } from '@/types/layers';

export function filterLayers(layers: Layer[], filter: LayerFilter): Layer[] {
  return layers.filter((layer) => {
    if (!filter.showVisible && layer.isVisible) return false;
    if (!filter.showHidden && !layer.isVisible) return false;
    if (!filter.showLocked && layer.isLocked) return false;
    if (!filter.showUnlocked && !layer.isLocked) return false;

    if (filter.categories.length > 0 && !filter.categories.includes(layer.metadata?.category || '')) {
      return false;
    }

    if (filter.searchTerm && !layer.name.toLowerCase().includes(filter.searchTerm.toLowerCase())) {
      return false;
    }

    return true;
  });
}
