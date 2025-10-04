import { useMemo } from 'react';
import type { Layer, LayerStatistics } from './types';

export interface LayerStatisticsHook {
  statistics: LayerStatistics;
}

export function useLayerStatistics(layers: Layer[]): LayerStatisticsHook {
  
  const statistics = useMemo((): LayerStatistics => {
    const totalLayers = layers.length;
    const visibleLayers = layers.filter(layer => layer.visible).length;
    const totalElements = layers.reduce((acc, layer) => acc + layer.elements, 0);

    return {
      totalLayers,
      visibleLayers,
      totalElements,
    };
  }, [layers]);

  return {
    statistics,
  };
}