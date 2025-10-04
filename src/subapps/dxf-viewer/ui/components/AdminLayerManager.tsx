'use client';

import React from 'react';
import { useLayerManagerState } from './layer-manager/useLayerManagerState';
import { useLayerFiltering } from './layer-manager/useLayerFiltering';
import { useLayerStatistics } from './layer-manager/useLayerStatistics';
import { LayerHeader } from './layer-manager/LayerHeader';
import { LayerFilters } from './layer-manager/LayerFilters';
import { LayerStatisticsDisplay } from './layer-manager/LayerStatisticsDisplay';
import { LayerList } from './layer-manager/LayerList';
import type { AdminLayerManagerProps } from './layer-manager/types';

export function AdminLayerManager({ className }: AdminLayerManagerProps) {
  const { state, actions, layers, categories } = useLayerManagerState();
  const { statistics } = useLayerStatistics(layers);
  const { filtering } = useLayerFiltering(
    layers,
    state.searchQuery,
    state.selectedCategory,
    actions.setSearchQuery,
    actions.setSelectedCategory
  );

  const handleAddLayer = () => {

  };

  const handleSettings = () => {

  };

  const handleLayerAction = (layerId: string, action: string) => {

  };

  return (
    <div className={`space-y-4 ${className}`}>
      <LayerHeader
        isConnected={state.isConnected}
        onAddLayer={handleAddLayer}
        onSettings={handleSettings}
      />

      <LayerFilters
        searchQuery={filtering.searchQuery}
        selectedCategory={filtering.selectedCategory}
        categories={categories}
        onSearchChange={filtering.setSearchQuery}
        onCategoryChange={filtering.setSelectedCategory}
      />

      <LayerStatisticsDisplay
        statistics={statistics}
        isConnected={state.isConnected}
        lastSyncTime={state.lastSyncTime}
      />

      <LayerList
        layers={filtering.filteredLayers}
        onToggleVisibility={actions.toggleLayerVisibility}
        onLayerAction={handleLayerAction}
      />
    </div>
  );
}