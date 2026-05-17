'use client';

import React, { useMemo, useSyncExternalStore } from 'react';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { useLayerManagerState } from './layer-manager/useLayerManagerState';
import { useLayerFiltering } from './layer-manager/useLayerFiltering';
import { useLayerStatistics } from './layer-manager/useLayerStatistics';
import { LayerHeader } from './layer-manager/LayerHeader';
import { LayerSearchBar } from './layer-manager/LayerSearchBar';
import { LayerStatisticsDisplay } from './layer-manager/LayerStatisticsDisplay';
import { LayerList } from './layer-manager/LayerList';
import { LayerFiltersSidebar } from './layer-manager/LayerFiltersSidebar';
import {
  getFilteredLayerIds,
  getLayerFiltersStoreSnapshot,
  subscribeLayerFiltersStore,
} from '../../stores/LayerFiltersStore';
import type { AdminLayerManagerProps } from './layer-manager/types';

export function AdminLayerManager({
  className,
  projectId = null,
  projectName = '',
}: AdminLayerManagerProps): React.ReactElement {
  const { state, actions, layers, categories } = useLayerManagerState();
  const { statistics } = useLayerStatistics(layers);

  // Subscribe to LayerFiltersStore so AdminLayerManager re-renders on combo changes.
  const filterStoreSnapshot = useSyncExternalStore(
    subscribeLayerFiltersStore,
    getLayerFiltersStoreSnapshot,
    getLayerFiltersStoreSnapshot,
  );
  const activeFilteredLayerIds = useMemo(
    () => getFilteredLayerIds(),
    // Recompute when either active filter combo or the filter set itself changes.
    // LayerStore version invalidation is handled inside the store's cache.
    [filterStoreSnapshot.activeFilters, filterStoreSnapshot.allFiltersById, layers],
  );

  const { filtering } = useLayerFiltering(
    layers,
    state.searchQuery,
    state.selectedCategory,
    actions.setSearchQuery,
    actions.setSelectedCategory,
    activeFilteredLayerIds,
  );

  const handleAddLayer = (): void => {};
  const handleSettings = (): void => {};
  const handleLayerAction = (layerId: string, action: string): void => {
    if (action === 'setAsCurrent') actions.setCurrentLayer(layerId);
  };

  return (
    <article className={`${PANEL_LAYOUT.SPACING.GAP_LG} ${className ?? ''} flex`}>
      <LayerFiltersSidebar projectId={projectId} projectName={projectName} />

      <section className={`${PANEL_LAYOUT.SPACING.GAP_LG} flex-1`}>
        <LayerHeader
          isConnected={state.isConnected}
          onAddLayer={handleAddLayer}
          onSettings={handleSettings}
        />

        <LayerSearchBar
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
      </section>
    </article>
  );
}
