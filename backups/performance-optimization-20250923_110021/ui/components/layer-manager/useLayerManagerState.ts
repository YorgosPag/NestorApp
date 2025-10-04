import { useState, useCallback } from 'react';
import type { Layer, Category, LayerManagerState, LayerManagerActions } from './types';

export interface LayerManagerStateHook {
  state: LayerManagerState;
  actions: LayerManagerActions;
  layers: Layer[];
  categories: Category[];
}

export function useLayerManagerState(): LayerManagerStateHook {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isConnected, setIsConnected] = useState(true);
  const [lastSyncTime] = useState(new Date());

  // Mock data - θα αντικατασταθεί με πραγματικά δεδομένα
  const [layers, setLayers] = useState<Layer[]>([
    { id: '1', name: 'Ηλεκτρολογικά', category: 'electrical', visible: true, elements: 25 },
    { id: '2', name: 'Υδραυλικά', category: 'plumbing', visible: true, elements: 18 },
    { id: '3', name: 'HVAC', category: 'hvac', visible: false, elements: 12 }
  ]);

  const categories: Category[] = [
    { value: 'all', label: 'Όλες οι κατηγορίες' },
    { value: 'electrical', label: 'Ηλεκτρολογικά' },
    { value: 'plumbing', label: 'Υδραυλικά' },
    { value: 'hvac', label: 'HVAC' }
  ];

  const toggleLayerVisibility = useCallback((layerId: string) => {
    setLayers(prevLayers =>
      prevLayers.map(layer =>
        layer.id === layerId
          ? { ...layer, visible: !layer.visible }
          : layer
      )
    );
  }, []);

  const updateSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const updateSelectedCategory = useCallback((category: string) => {
    setSelectedCategory(category);
  }, []);

  const updateConnectionStatus = useCallback((connected: boolean) => {
    setIsConnected(connected);
  }, []);

  const state: LayerManagerState = {
    searchQuery,
    selectedCategory,
    isConnected,
    lastSyncTime,
  };

  const actions: LayerManagerActions = {
    setSearchQuery: updateSearchQuery,
    setSelectedCategory: updateSelectedCategory,
    setIsConnected: updateConnectionStatus,
    toggleLayerVisibility,
  };

  return {
    state,
    actions,
    layers,
    categories,
  };
}