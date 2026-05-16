import { useState, useCallback, useSyncExternalStore, useMemo } from 'react';
import { DXF_LAYER_CATEGORY_LABELS } from '@/constants/property-statuses-enterprise';
import {
  subscribeLayerStore,
  getLayerStoreSnapshot,
  upsertLayer,
} from '../../../stores/LayerStore';
import type { SceneLayer } from '../../../types/entities';
import type { Layer, Category, LayerManagerState, LayerManagerActions } from './types';

export interface LayerManagerStateHook {
  state: LayerManagerState;
  actions: LayerManagerActions;
  layers: Layer[];
  categories: Category[];
}

// ADR-358 §5.3.quinquies (Q7) cleanup target: remove these mock entries in Phase 6
// when AdminLayerManager wires AEC categories + tags from the real store.
const MOCK_LAYERS: Layer[] = [
  { id: '1', name: 'Ηλεκτρολογικά', category: 'electrical', visible: true, elements: 25 },
  { id: '2', name: 'Υδραυλικά', category: 'plumbing', visible: true, elements: 18 },
  { id: '3', name: 'HVAC', category: 'hvac', visible: false, elements: 12 },
];

function sceneLayerToUi(layer: SceneLayer): Layer {
  return {
    id: layer.id ?? layer.name,
    name: layer.name,
    category: layer.category ?? 'general',
    visible: layer.visible,
    elements: 0,
  };
}

export function useLayerManagerState(): LayerManagerStateHook {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isConnected, setIsConnected] = useState(true);
  const [lastSyncTime] = useState(new Date());

  const storeSnapshot = useSyncExternalStore(
    subscribeLayerStore,
    getLayerStoreSnapshot,
    getLayerStoreSnapshot,
  );

  const [mockLayers, setMockLayers] = useState<Layer[]>(MOCK_LAYERS);

  const layers = useMemo<Layer[]>(() => {
    if (storeSnapshot.layers.length > 0) {
      return storeSnapshot.layers.map(sceneLayerToUi);
    }
    return mockLayers;
  }, [storeSnapshot.layers, mockLayers]);

  const categories: Category[] = [
    { value: 'all', label: DXF_LAYER_CATEGORY_LABELS.all },
    { value: 'electrical', label: DXF_LAYER_CATEGORY_LABELS.electrical },
    { value: 'plumbing', label: DXF_LAYER_CATEGORY_LABELS.plumbing },
    { value: 'hvac', label: DXF_LAYER_CATEGORY_LABELS.hvac },
  ];

  const toggleLayerVisibility = useCallback(
    (layerId: string) => {
      if (storeSnapshot.layers.length > 0) {
        const target = storeSnapshot.layers.find(
          (l) => (l.id ?? l.name) === layerId,
        );
        if (!target) return;
        upsertLayer({ ...target, visible: !target.visible });
        return;
      }
      setMockLayers((prev) =>
        prev.map((layer) =>
          layer.id === layerId ? { ...layer, visible: !layer.visible } : layer,
        ),
      );
    },
    [storeSnapshot.layers],
  );

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
