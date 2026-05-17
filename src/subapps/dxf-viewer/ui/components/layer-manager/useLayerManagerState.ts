import { useState, useCallback, useSyncExternalStore, useMemo } from 'react';
import { useTranslation } from '@/i18n';
import {
  subscribeLayerStore,
  getLayerStoreSnapshot,
  upsertLayer,
  setCurrentLayerId,
  // ADR-358 Phase 9D-5a: id-first reader SSoT (LayerStore lookup + legacy name fallback).
  resolveEntityLayerName,
} from '../../../stores/LayerStore';
// ADR-358 Phase 9D-5b-ii Sub-E — scene access via `getLevelScene(levelId)` SSoT action (Level interface has no `scene` field; storage lives in `LevelsSystem.sceneManagerRef`).
import { useLevels } from '../../../systems/levels/useLevels';
import type { SceneLayer, AecLayerCategory, AnySceneEntity } from '../../../types/entities';
import type { Layer, Category, LayerManagerState, LayerManagerActions } from './types';

export interface LayerManagerStateHook {
  state: LayerManagerState;
  actions: LayerManagerActions;
  layers: Layer[];
  categories: Category[];
}

function sceneLayerToUi(layer: SceneLayer, isCurrent: boolean, elementCount: number): Layer {
  return {
    id: layer.id ?? layer.name,
    name: layer.name,
    category: layer.category ?? 'general',
    visible: layer.visible,
    elements: elementCount,
    isCurrent,
  };
}

function getUniqueCategories(layers: readonly SceneLayer[]): Set<AecLayerCategory> {
  const cats = new Set<AecLayerCategory>();
  for (const layer of layers) {
    const cat = (layer.category ?? 'general') as AecLayerCategory;
    cats.add(cat);
  }
  return cats;
}

export function useLayerManagerState(): LayerManagerStateHook {
  const { t } = useTranslation(['dxf-viewer-shell']);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isConnected, setIsConnected] = useState(true);
  const [lastSyncTime] = useState(new Date());

  const storeSnapshot = useSyncExternalStore(
    subscribeLayerStore,
    getLayerStoreSnapshot,
    getLayerStoreSnapshot,
  );

  const { currentLevelId, getLevelScene } = useLevels();

  const layers = useMemo<Layer[]>(() => {
    if (storeSnapshot.layers.length === 0) return [];

    const scene = currentLevelId ? getLevelScene(currentLevelId) : null;
    return storeSnapshot.layers.map((layer) => {
      const elementCount = scene
        // ADR-358 Phase 9D-5a: id-first resolution via LayerStore (post-rename stale-name guard).
        ? scene.entities.filter((e: AnySceneEntity) => resolveEntityLayerName(e) === layer.name).length
        : 0;
      const isCurrent = storeSnapshot.currentLayerId === (layer.id ?? layer.name);
      return sceneLayerToUi(layer, isCurrent, elementCount);
    });
  }, [storeSnapshot.layers, storeSnapshot.currentLayerId, currentLevelId, getLevelScene]);

  const categories = useMemo<Category[]>(() => {
    const uniqueCats = getUniqueCategories(storeSnapshot.layers);
    const result: Category[] = [
      { value: 'all', label: t('layerPicker.category.all') || 'All' },
    ];
    uniqueCats.forEach((cat) => {
      const key = `layerPicker.category.${cat}`;
      result.push({ value: cat, label: t(key) || cat });
    });
    return result;
  }, [storeSnapshot.layers, t]);

  const toggleLayerVisibility = useCallback(
    (layerId: string) => {
      const target = storeSnapshot.layers.find(
        (l) => (l.id ?? l.name) === layerId,
      );
      if (!target) return;
      upsertLayer({ ...target, visible: !target.visible });
    },
    [storeSnapshot.layers],
  );

  const setCurrentLayer = useCallback(
    (layerId: string) => {
      setCurrentLayerId(layerId);
    },
    [],
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
    setCurrentLayer,
  };

  return {
    state,
    actions,
    layers,
    categories,
  };
}
