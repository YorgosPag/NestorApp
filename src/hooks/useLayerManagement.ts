'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAutoSave } from '@/hooks/useAutoSave';
import type {
  Layer,
  LayerGroup,
  LayerState,
  AnyLayerElement,
  LayerHistoryEntry,
  LayerFilter,
  LayerExportOptions,
  LayerValidationResult
} from '@/types/layers';
import { createModuleLogger } from '@/lib/telemetry';
import { INITIAL_LAYER_FILTER, createInitialLayerState } from '@/hooks/layer-management/layer-management-defaults';
import { appendHistoryEntry, clearHistoryState } from '@/hooks/layer-management/layer-management-history';
import { filterLayers } from '@/hooks/layer-management/layer-management-filters';
import {
  createElementRecord,
  createLayerRecord,
  duplicateLayerRecord,
  updateLayerRecord
} from '@/hooks/layer-management/layer-management-operations';
import {
  loadLayerManagementData,
  saveLayerManagementData,
  subscribeToLayerManagement
} from '@/hooks/layer-management/layer-management-persistence';
import { createStaleCache } from '@/lib/stale-cache';

const logger = createModuleLogger('useLayerManagement');

type LayerDataCache = { layers: Layer[]; groups: LayerGroup[] };
const layerManagementCache = createStaleCache<LayerDataCache>('dxf-layer-management');

export interface UseLayerManagementOptions {
  floorId: string;
  buildingId: string;
  userId: string;
  companyId: string;
  autoSave?: boolean;
  maxHistorySize?: number;
  enableRealtime?: boolean;
}

export interface UseLayerManagementReturn {
  state: LayerState;
  isLoading: boolean;
  error: string | null;
  createLayer: (layer: Omit<Layer, 'id' | 'createdAt' | 'updatedAt' | 'floorId' | 'buildingId' | 'createdBy'>) => Promise<string>;
  updateLayer: (layerId: string, updates: Partial<Layer>) => Promise<void>;
  deleteLayer: (layerId: string) => Promise<void>;
  duplicateLayer: (layerId: string) => Promise<string>;
  toggleLayerVisibility: (layerId: string) => void;
  toggleLayerLock: (layerId: string) => void;
  setLayerOpacity: (layerId: string, opacity: number) => void;
  setLayerZIndex: (layerId: string, zIndex: number) => void;
  createElement: (layerId: string, element: Omit<AnyLayerElement, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateElement: (layerId: string, elementId: string, updates: Partial<AnyLayerElement>) => void;
  deleteElement: (layerId: string, elementId: string) => void;
  duplicateElement: (layerId: string, elementId: string) => string;
  moveElement: (elementId: string, fromLayerId: string, toLayerId: string) => void;
  selectLayer: (layerId: string | null) => void;
  selectElements: (elementIds: string[]) => void;
  clearSelection: () => void;
  copyElements: (elementIds: string[]) => void;
  pasteElements: (targetLayerId: string) => void;
  cutElements: (elementIds: string[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
  createGroup: (group: Omit<LayerGroup, 'id'>) => string;
  updateGroup: (groupId: string, updates: Partial<LayerGroup>) => void;
  deleteGroup: (groupId: string) => void;
  addLayerToGroup: (layerId: string, groupId: string) => void;
  removeLayerFromGroup: (layerId: string, groupId: string) => void;
  setFilter: (filter: Partial<LayerFilter>) => void;
  getFilteredLayers: () => Layer[];
  exportLayers: (options: LayerExportOptions) => Promise<string>;
  importLayers: (data: string) => Promise<void>;
  validateLayer: (layer: Partial<Layer>) => LayerValidationResult;
  getLayerById: (layerId: string) => Layer | null;
  getElementByIdInLayer: (layerId: string, elementId: string) => AnyLayerElement | null;
  getSystemLayers: () => Layer[];
  resetToDefaults: () => void;
  saveToFirestore: () => Promise<void>;
}

export function useLayerManagement({
  floorId,
  buildingId,
  userId,
  companyId,
  autoSave = true,
  maxHistorySize = 50,
  enableRealtime = true
}: UseLayerManagementOptions): UseLayerManagementReturn {
  const cacheKey = `${floorId}-${buildingId}`;
  const [state, setState] = useState<LayerState>(() => {
    const initial = createInitialLayerState(maxHistorySize);
    const cached = layerManagementCache.get(cacheKey);
    return cached ? { ...initial, layers: cached.layers, groups: cached.groups } : initial;
  });
  const [isLoading, setIsLoading] = useState(!layerManagementCache.hasLoaded(cacheKey));
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilterState] = useState<LayerFilter>(INITIAL_LAYER_FILTER);

  const persistenceContext = useMemo(() => ({ floorId, buildingId, userId, companyId }), [floorId, buildingId, userId, companyId]);

  const loadLayers = useCallback(async () => {
    try {
      if (!layerManagementCache.hasLoaded(cacheKey)) setIsLoading(true);
      setError(null);

      const loadedData = await loadLayerManagementData(persistenceContext);

      layerManagementCache.set({ layers: loadedData.layers, groups: loadedData.groups }, cacheKey);
      setState((prev) => ({
        ...prev,
        layers: loadedData.layers,
        groups: loadedData.groups
      }));
    } catch (err) {
      logger.error('Error loading layers', { error: err });
      setError('Σφάλμα κατά τη φόρτωση των layers');
    } finally {
      setIsLoading(false);
    }
  }, [persistenceContext, cacheKey]);

  useEffect(() => {
    void loadLayers();
  }, [loadLayers]);

  useEffect(() => {
    if (!enableRealtime) {
      return undefined;
    }

    return subscribeToLayerManagement(persistenceContext, {
      onLayers: (layers) => {
        setState((prev) => ({
          ...prev,
          layers
        }));
      },
      onError: (message) => {
        logger.error('Layer subscription error', { error: message });
      }
    });
  }, [enableRealtime, persistenceContext]);

  const persistedState = useMemo(() => ({
    layers: state.layers,
    groups: state.groups
  }), [state.groups, state.layers]);

  const { saveNow } = useAutoSave(persistedState, {
    saveFn: async (data) => {
      await saveLayerManagementData(data.layers, data.groups);
    },
    enabled: autoSave && !isLoading,
    onError: (saveError) => {
      logger.error('Error saving to Firestore', { error: saveError });
      setError('Σφάλμα κατά την αποθήκευση');
    }
  });

  const createLayer = useCallback(async (
    layerData: Omit<Layer, 'id' | 'createdAt' | 'updatedAt' | 'floorId' | 'buildingId' | 'createdBy'>
  ): Promise<string> => {
    const newLayer = createLayerRecord(layerData, persistenceContext);

    setState((prev) => appendHistoryEntry({
      ...prev,
      layers: [...prev.layers, newLayer]
    }, {
      action: 'create',
      layerId: newLayer.id,
      afterState: newLayer,
      description: `Δημιουργία layer: ${newLayer.name}`
    }));

    return newLayer.id;
  }, [persistenceContext]);

  const updateLayer = useCallback(async (layerId: string, updates: Partial<Layer>): Promise<void> => {
    setState((prev) => {
      const layerIndex = prev.layers.findIndex((layer) => layer.id === layerId);
      if (layerIndex === -1) {
        return prev;
      }

      const currentLayer = prev.layers[layerIndex];
      const updatedLayer = updateLayerRecord(currentLayer, updates);
      const nextLayers = [...prev.layers];
      nextLayers[layerIndex] = updatedLayer;

      return appendHistoryEntry({
        ...prev,
        layers: nextLayers
      }, {
        action: 'update',
        layerId,
        beforeState: currentLayer,
        afterState: updatedLayer,
        description: `Ενημέρωση layer: ${updatedLayer.name}`
      });
    });
  }, []);

  const deleteLayer = useCallback(async (layerId: string): Promise<void> => {
    setState((prev) => {
      const layerToDelete = prev.layers.find((layer) => layer.id === layerId);
      if (!layerToDelete || layerToDelete.isSystem) {
        return prev;
      }

      return appendHistoryEntry({
        ...prev,
        layers: prev.layers.filter((layer) => layer.id !== layerId),
        activeLayerId: prev.activeLayerId === layerId ? null : prev.activeLayerId
      }, {
        action: 'delete',
        layerId,
        beforeState: layerToDelete,
        description: `Διαγραφή layer: ${layerToDelete.name}`
      });
    });
  }, []);

  const createElement = useCallback((
    layerId: string,
    elementData: Omit<AnyLayerElement, 'id' | 'createdAt' | 'updatedAt'>
  ): string => {
    const newElement = createElementRecord(elementData);

    setState((prev) => {
      const layerIndex = prev.layers.findIndex((layer) => layer.id === layerId);
      if (layerIndex === -1) {
        return prev;
      }

      const currentLayer = prev.layers[layerIndex];
      const updatedLayer = {
        ...currentLayer,
        elements: [...currentLayer.elements, newElement],
        updatedAt: newElement.updatedAt
      };
      const nextLayers = [...prev.layers];
      nextLayers[layerIndex] = updatedLayer;

      return appendHistoryEntry({
        ...prev,
        layers: nextLayers
      }, {
        action: 'create',
        layerId,
        elementId: newElement.id,
        afterState: newElement,
        description: `Δημιουργία στοιχείου: ${newElement.type}`
      });
    });

    return newElement.id;
  }, []);

  const toggleLayerVisibility = useCallback((layerId: string) => {
    setState((prev) => {
      const currentLayer = prev.layers.find((layer) => layer.id === layerId);
      if (!currentLayer) {
        return prev;
      }

      const nextLayers = prev.layers.map((layer) => layer.id === layerId
        ? updateLayerRecord(layer, { isVisible: !layer.isVisible })
        : layer
      );

      return appendHistoryEntry({
        ...prev,
        layers: nextLayers
      }, {
        action: 'update',
        layerId,
        beforeState: currentLayer,
        afterState: nextLayers.find((layer) => layer.id === layerId),
        description: `Αλλαγή ορατότητας layer: ${currentLayer.name}`
      });
    });
  }, []);

  const toggleLayerLock = useCallback((layerId: string) => {
    setState((prev) => {
      const currentLayer = prev.layers.find((layer) => layer.id === layerId);
      if (!currentLayer) {
        return prev;
      }

      const nextLayers = prev.layers.map((layer) => layer.id === layerId
        ? updateLayerRecord(layer, { isLocked: !layer.isLocked })
        : layer
      );

      return appendHistoryEntry({
        ...prev,
        layers: nextLayers
      }, {
        action: 'update',
        layerId,
        beforeState: currentLayer,
        afterState: nextLayers.find((layer) => layer.id === layerId),
        description: `Αλλαγή κλειδώματος layer: ${currentLayer.name}`
      });
    });
  }, []);

  const getLayerById = useCallback((layerId: string): Layer | null => {
    return state.layers.find((layer) => layer.id === layerId) || null;
  }, [state.layers]);

  const getFilteredLayers = useCallback((): Layer[] => {
    return filterLayers(state.layers, filter);
  }, [filter, state.layers]);

  const canUndo = state.historyIndex >= 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  const undo = useCallback(() => {
    if (!canUndo) {
      return;
    }

    setState((prev) => ({
      ...prev,
      historyIndex: prev.historyIndex - 1
    }));
  }, [canUndo]);

  const redo = useCallback(() => {
    if (!canRedo) {
      return;
    }

    setState((prev) => ({
      ...prev,
      historyIndex: prev.historyIndex + 1
    }));
  }, [canRedo]);

  const saveToFirestore = useCallback(async (): Promise<void> => {
    setError(null);
    await saveNow();
  }, [saveNow]);

  return {
    state,
    isLoading,
    error,
    createLayer,
    updateLayer,
    deleteLayer,
    duplicateLayer: async (layerId: string) => {
      const layer = getLayerById(layerId);
      if (!layer) {
        return '';
      }

      return createLayer(duplicateLayerRecord(layer));
    },
    toggleLayerVisibility,
    toggleLayerLock,
    setLayerOpacity: (layerId: string, opacity: number) => {
      void updateLayer(layerId, { opacity });
    },
    setLayerZIndex: (layerId: string, zIndex: number) => {
      void updateLayer(layerId, { zIndex });
    },
    createElement,
    updateElement: (_layerId: string, _elementId: string, _updates: Partial<AnyLayerElement>) => {
      // Placeholder preserved for backward compatibility.
    },
    deleteElement: (_layerId: string, _elementId: string) => {
      // Placeholder preserved for backward compatibility.
    },
    duplicateElement: (_layerId: string, _elementId: string) => '',
    moveElement: (_elementId: string, _fromLayerId: string, _toLayerId: string) => {
      // Placeholder preserved for backward compatibility.
    },
    selectLayer: (layerId: string | null) => setState((prev) => ({ ...prev, activeLayerId: layerId })),
    selectElements: (elementIds: string[]) => setState((prev) => ({ ...prev, selectedElementIds: elementIds })),
    clearSelection: () => setState((prev) => ({ ...prev, selectedElementIds: [], activeLayerId: null })),
    copyElements: (_elementIds: string[]) => {
      // Placeholder preserved for backward compatibility.
    },
    pasteElements: (_targetLayerId: string) => {
      // Placeholder preserved for backward compatibility.
    },
    cutElements: (_elementIds: string[]) => {
      // Placeholder preserved for backward compatibility.
    },
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory: () => setState((prev) => clearHistoryState(prev)),
    createGroup: (_group: Omit<LayerGroup, 'id'>) => '',
    updateGroup: (_groupId: string, _updates: Partial<LayerGroup>) => {
      // Placeholder preserved for backward compatibility.
    },
    deleteGroup: (_groupId: string) => {
      // Placeholder preserved for backward compatibility.
    },
    addLayerToGroup: (_layerId: string, _groupId: string) => {
      // Placeholder preserved for backward compatibility.
    },
    removeLayerFromGroup: (_layerId: string, _groupId: string) => {
      // Placeholder preserved for backward compatibility.
    },
    setFilter: (nextFilter: Partial<LayerFilter>) => setFilterState((prev) => ({ ...prev, ...nextFilter })),
    getFilteredLayers,
    exportLayers: async (_options: LayerExportOptions) => '',
    importLayers: async (_data: string) => {
      // Placeholder preserved for backward compatibility.
    },
    validateLayer: (_layer: Partial<Layer>): LayerValidationResult => ({
      isValid: true,
      errors: [],
      warnings: []
    }),
    getLayerById,
    getElementByIdInLayer: (layerId: string, elementId: string) => {
      const layer = state.layers.find((candidateLayer) => candidateLayer.id === layerId);
      return layer?.elements.find((element) => element.id === elementId) || null;
    },
    getSystemLayers: () => state.layers.filter((layer) => layer.isSystem),
    resetToDefaults: () => {
      setState((prev) => ({
        ...createInitialLayerState(prev.maxHistorySize),
        maxHistorySize: prev.maxHistorySize
      }));
      setFilterState(INITIAL_LAYER_FILTER);
    },
    saveToFirestore
  };
}
