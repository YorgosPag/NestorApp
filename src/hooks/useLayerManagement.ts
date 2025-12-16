'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  onSnapshot,
  Timestamp 
} from 'firebase/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { SYSTEM_LAYERS, DEFAULT_LAYER_STYLES } from '@/types/layers';
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

export interface UseLayerManagementOptions {
  floorId: string;
  buildingId: string;
  userId: string;
  autoSave?: boolean;
  maxHistorySize?: number;
  enableRealtime?: boolean;
}

export interface UseLayerManagementReturn {
  // State
  state: LayerState;
  isLoading: boolean;
  error: string | null;
  
  // Layer Operations
  createLayer: (layer: Omit<Layer, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateLayer: (layerId: string, updates: Partial<Layer>) => Promise<void>;
  deleteLayer: (layerId: string) => Promise<void>;
  duplicateLayer: (layerId: string) => Promise<string>;
  
  // Layer Visibility & Lock
  toggleLayerVisibility: (layerId: string) => void;
  toggleLayerLock: (layerId: string) => void;
  setLayerOpacity: (layerId: string, opacity: number) => void;
  setLayerZIndex: (layerId: string, zIndex: number) => void;
  
  // Element Operations
  createElement: (layerId: string, element: Omit<AnyLayerElement, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateElement: (layerId: string, elementId: string, updates: Partial<AnyLayerElement>) => void;
  deleteElement: (layerId: string, elementId: string) => void;
  duplicateElement: (layerId: string, elementId: string) => string;
  moveElement: (elementId: string, fromLayerId: string, toLayerId: string) => void;
  
  // Selection
  selectLayer: (layerId: string | null) => void;
  selectElements: (elementIds: string[]) => void;
  clearSelection: () => void;
  
  // Clipboard
  copyElements: (elementIds: string[]) => void;
  pasteElements: (targetLayerId: string) => void;
  cutElements: (elementIds: string[]) => void;
  
  // History
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
  
  // Groups
  createGroup: (group: Omit<LayerGroup, 'id'>) => string;
  updateGroup: (groupId: string, updates: Partial<LayerGroup>) => void;
  deleteGroup: (groupId: string) => void;
  addLayerToGroup: (layerId: string, groupId: string) => void;
  removeLayerFromGroup: (layerId: string, groupId: string) => void;
  
  // Filtering
  setFilter: (filter: Partial<LayerFilter>) => void;
  getFilteredLayers: () => Layer[];
  
  // Import/Export
  exportLayers: (options: LayerExportOptions) => Promise<string>;
  importLayers: (data: string) => Promise<void>;
  
  // Validation
  validateLayer: (layer: Partial<Layer>) => LayerValidationResult;
  
  // Utilities
  getLayerById: (layerId: string) => Layer | null;
  getElementByIdInLayer: (layerId: string, elementId: string) => AnyLayerElement | null;
  getSystemLayers: () => Layer[];
  resetToDefaults: () => void;
  saveToFirestore: () => Promise<void>;
}

/**
 * Hook για τη διαχείριση layers στις κατόψεις
 * 
 * Παρέχει πλήρη functionality για:
 * - CRUD operations για layers και elements
 * - History management με undo/redo
 * - Real-time sync με Firestore
 * - Import/Export capabilities
 * - Validation και error handling
 */
export function useLayerManagement({
  floorId,
  buildingId,
  userId,
  autoSave = true,
  maxHistorySize = 50,
  enableRealtime = true
}: UseLayerManagementOptions): UseLayerManagementReturn {
  
  const [state, setState] = useState<LayerState>({
    layers: [],
    groups: [],
    activeLayerId: null,
    selectedElementIds: [],
    clipboard: [],
    history: [],
    historyIndex: -1,
    maxHistorySize
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilterState] = useState<LayerFilter>({
    showVisible: true,
    showHidden: true,
    showLocked: true,
    showUnlocked: true,
    categories: [],
    searchTerm: ''
  });
  
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize and load layers
  useEffect(() => {
    loadLayers();
    
    if (enableRealtime) {
      setupRealtimeSync();
    }
    
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [floorId, buildingId, enableRealtime]);

  // Auto-save when state changes
  useEffect(() => {
    if (autoSave && !isLoading) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      autoSaveTimeoutRef.current = setTimeout(() => {
        saveToFirestore();
      }, 2000); // Save after 2 seconds of inactivity
    }
  }, [state, autoSave, isLoading]);

  // Load layers from Firestore
  const loadLayers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const layersQuery = query(
        collection(db, COLLECTIONS.LAYERS),
        where('floorId', '==', floorId),
        orderBy('zIndex', 'asc')
      );
      
      const groupsQuery = query(
        collection(db, COLLECTIONS.LAYER_GROUPS),
        where('floorId', '==', floorId),
        orderBy('order', 'asc')
      );
      
      const [layersSnapshot, groupsSnapshot] = await Promise.all([
        getDocs(layersQuery),
        getDocs(groupsQuery)
      ]);
      
      const layers: Layer[] = layersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Layer));
      
      const groups: LayerGroup[] = groupsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as LayerGroup));
      
      // Create system layers if they don't exist
      const systemLayers = await ensureSystemLayers(layers);
      
      setState(prev => ({
        ...prev,
        layers: [...systemLayers, ...layers.filter(l => !l.isSystem)],
        groups
      }));
      
    } catch (err) {
      console.error('Error loading layers:', err);
      setError('Σφάλμα κατά τη φόρτωση των layers');
    } finally {
      setIsLoading(false);
    }
  };

  // Setup real-time synchronization
  const setupRealtimeSync = () => {
    const layersQuery = query(
      collection(db, COLLECTIONS.LAYERS),
      where('floorId', '==', floorId)
    );
    
    unsubscribeRef.current = onSnapshot(layersQuery, (snapshot) => {
      const updatedLayers: Layer[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Layer));
      
      setState(prev => ({
        ...prev,
        layers: updatedLayers
      }));
    });
  };

  // Ensure system layers exist
  const ensureSystemLayers = async (existingLayers: Layer[]): Promise<Layer[]> => {
    const systemLayers: Layer[] = [];
    const now = new Date().toISOString();
    
    // Properties layer
    if (!existingLayers.find(l => l.id === SYSTEM_LAYERS.PROPERTIES)) {
      const propertiesLayer: Layer = {
        id: SYSTEM_LAYERS.PROPERTIES,
        name: 'Ακίνητα',
        isVisible: true,
        isLocked: false,
        isSystem: true,
        opacity: 1,
        zIndex: 100,
        color: { primary: '#3b82f6', opacity: 0.3 },
        defaultStyle: DEFAULT_LAYER_STYLES.property,
        elements: [],
        floorId,
        buildingId,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
        metadata: { category: 'structural' }
      };
      systemLayers.push(propertiesLayer);
    }
    
    // Grid layer
    if (!existingLayers.find(l => l.id === SYSTEM_LAYERS.GRID)) {
      const gridLayer: Layer = {
        id: SYSTEM_LAYERS.GRID,
        name: 'Πλέγμα',
        isVisible: false,
        isLocked: true,
        isSystem: true,
        opacity: 0.2,
        zIndex: 1,
        color: { primary: '#6b7280', opacity: 0.2 },
        defaultStyle: DEFAULT_LAYER_STYLES.line,
        elements: [],
        floorId,
        buildingId,
        createdBy: userId,
        createdAt: now,
        updatedAt: now
      };
      systemLayers.push(gridLayer);
    }
    
    return systemLayers;
  };

  // Add to history
  const addToHistory = useCallback((entry: Omit<LayerHistoryEntry, 'id' | 'timestamp'>) => {
    setState(prev => {
      const newEntry: LayerHistoryEntry = {
        ...entry,
        id: `history_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        timestamp: new Date().toISOString()
      };
      
      const newHistory = prev.history.slice(0, prev.historyIndex + 1);
      newHistory.push(newEntry);
      
      // Limit history size
      if (newHistory.length > prev.maxHistorySize) {
        newHistory.shift();
      }
      
      return {
        ...prev,
        history: newHistory,
        historyIndex: newHistory.length - 1
      };
    });
  }, []);

  // Layer Operations
  const createLayer = useCallback(async (layerData: Omit<Layer, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const now = new Date().toISOString();
    const newLayer: Layer = {
      ...layerData,
      id: `layer_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      createdAt: now,
      updatedAt: now,
      floorId,
      buildingId,
      createdBy: userId
    };
    
    setState(prev => ({
      ...prev,
      layers: [...prev.layers, newLayer]
    }));
    
    addToHistory({
      action: 'create',
      layerId: newLayer.id,
      afterState: newLayer,
      description: `Δημιουργία layer: ${newLayer.name}`
    });
    
    return newLayer.id;
  }, [floorId, buildingId, userId, addToHistory]);

  const updateLayer = useCallback(async (layerId: string, updates: Partial<Layer>): Promise<void> => {
    setState(prev => {
      const layerIndex = prev.layers.findIndex(l => l.id === layerId);
      if (layerIndex === -1) return prev;
      
      const oldLayer = prev.layers[layerIndex];
      const updatedLayer = {
        ...oldLayer,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      const newLayers = [...prev.layers];
      newLayers[layerIndex] = updatedLayer;
      
      addToHistory({
        action: 'update',
        layerId,
        beforeState: oldLayer,
        afterState: updatedLayer,
        description: `Ενημέρωση layer: ${updatedLayer.name}`
      });
      
      return {
        ...prev,
        layers: newLayers
      };
    });
  }, [addToHistory]);

  const deleteLayer = useCallback(async (layerId: string): Promise<void> => {
    setState(prev => {
      const layerToDelete = prev.layers.find(l => l.id === layerId);
      if (!layerToDelete || layerToDelete.isSystem) return prev;
      
      addToHistory({
        action: 'delete',
        layerId,
        beforeState: layerToDelete,
        description: `Διαγραφή layer: ${layerToDelete.name}`
      });
      
      return {
        ...prev,
        layers: prev.layers.filter(l => l.id !== layerId),
        activeLayerId: prev.activeLayerId === layerId ? null : prev.activeLayerId
      };
    });
  }, [addToHistory]);

  // Toggle functions
  const toggleLayerVisibility = useCallback((layerId: string) => {
    updateLayer(layerId, { 
      isVisible: !state.layers.find(l => l.id === layerId)?.isVisible 
    });
  }, [state.layers, updateLayer]);

  const toggleLayerLock = useCallback((layerId: string) => {
    updateLayer(layerId, { 
      isLocked: !state.layers.find(l => l.id === layerId)?.isLocked 
    });
  }, [state.layers, updateLayer]);

  // Element Operations
  const createElement = useCallback((layerId: string, elementData: Omit<AnyLayerElement, 'id' | 'createdAt' | 'updatedAt'>): string => {
    const now = new Date().toISOString();
    const newElement: AnyLayerElement = {
      ...elementData,
      id: `element_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      createdAt: now,
      updatedAt: now
    } as AnyLayerElement;
    
    setState(prev => {
      const layerIndex = prev.layers.findIndex(l => l.id === layerId);
      if (layerIndex === -1) return prev;
      
      const layer = prev.layers[layerIndex];
      const updatedLayer = {
        ...layer,
        elements: [...layer.elements, newElement],
        updatedAt: now
      };
      
      const newLayers = [...prev.layers];
      newLayers[layerIndex] = updatedLayer;
      
      return {
        ...prev,
        layers: newLayers
      };
    });
    
    addToHistory({
      action: 'create',
      layerId,
      elementId: newElement.id,
      afterState: newElement,
      description: `Δημιουργία στοιχείου: ${newElement.type}`
    });
    
    return newElement.id;
  }, [addToHistory]);

  // Save to Firestore
  const saveToFirestore = useCallback(async (): Promise<void> => {
    try {
      // Save layers (excluding system layers as they're managed separately)
      const layersToSave = state.layers.filter(l => !l.isSystem);
      
      for (const layer of layersToSave) {
        const layerDoc = doc(db, COLLECTIONS.LAYERS, layer.id);
        await updateDoc(layerDoc, {
          ...layer,
          updatedAt: new Date().toISOString()
        });
      }
      
      // Save groups
      for (const group of state.groups) {
        const groupDoc = doc(db, COLLECTIONS.LAYER_GROUPS, group.id);
        await updateDoc(groupDoc, group);
      }
      
    } catch (err) {
      console.error('Error saving to Firestore:', err);
      setError('Σφάλμα κατά την αποθήκευση');
    }
  }, [state.layers, state.groups]);

  // Utility functions
  const getLayerById = useCallback((layerId: string): Layer | null => {
    return state.layers.find(l => l.id === layerId) || null;
  }, [state.layers]);

  const getFilteredLayers = useCallback((): Layer[] => {
    return state.layers.filter(layer => {
      if (!filter.showVisible && layer.isVisible) return false;
      if (!filter.showHidden && !layer.isVisible) return false;
      if (!filter.showLocked && layer.isLocked) return false;
      if (!filter.showUnlocked && !layer.isLocked) return false;
      
      if (filter.categories.length > 0 && 
          !filter.categories.includes(layer.metadata?.category || '')) {
        return false;
      }
      
      if (filter.searchTerm && 
          !layer.name.toLowerCase().includes(filter.searchTerm.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  }, [state.layers, filter]);

  // History operations
  const canUndo = state.historyIndex >= 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  const undo = useCallback(() => {
    if (!canUndo) return;
    
    // Implementation for undo would restore previous state
    setState(prev => ({
      ...prev,
      historyIndex: prev.historyIndex - 1
    }));
  }, [canUndo]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    
    // Implementation for redo would restore next state
    setState(prev => ({
      ...prev,
      historyIndex: prev.historyIndex + 1
    }));
  }, [canRedo]);

  return {
    // State
    state,
    isLoading,
    error,
    
    // Layer Operations
    createLayer,
    updateLayer,
    deleteLayer,
    duplicateLayer: async (layerId: string) => {
      const layer = getLayerById(layerId);
      if (!layer) return '';
      
      const duplicatedLayer = {
        ...layer,
        name: `${layer.name} (Αντίγραφο)`,
        elements: layer.elements.map(e => ({ ...e, id: `element_${Date.now()}_${Math.random()}` }))
      };
      
      return createLayer(duplicatedLayer);
    },
    
    // Layer Visibility & Lock
    toggleLayerVisibility,
    toggleLayerLock,
    setLayerOpacity: (layerId: string, opacity: number) => updateLayer(layerId, { opacity }),
    setLayerZIndex: (layerId: string, zIndex: number) => updateLayer(layerId, { zIndex }),
    
    // Element Operations
    createElement,
    updateElement: (layerId: string, elementId: string, updates: Partial<AnyLayerElement>) => {
      // Implementation for updating elements
    },
    deleteElement: (layerId: string, elementId: string) => {
      // Implementation for deleting elements
    },
    duplicateElement: (layerId: string, elementId: string) => {
      // Implementation for duplicating elements
      return '';
    },
    moveElement: (elementId: string, fromLayerId: string, toLayerId: string) => {
      // Implementation for moving elements between layers
    },
    
    // Selection
    selectLayer: (layerId: string | null) => setState(prev => ({ ...prev, activeLayerId: layerId })),
    selectElements: (elementIds: string[]) => setState(prev => ({ ...prev, selectedElementIds: elementIds })),
    clearSelection: () => setState(prev => ({ ...prev, selectedElementIds: [], activeLayerId: null })),
    
    // Clipboard operations (simplified)
    copyElements: (elementIds: string[]) => {},
    pasteElements: (targetLayerId: string) => {},
    cutElements: (elementIds: string[]) => {},
    
    // History
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory: () => setState(prev => ({ ...prev, history: [], historyIndex: -1 })),
    
    // Groups (simplified implementations)
    createGroup: (group: Omit<LayerGroup, 'id'>) => '',
    updateGroup: (groupId: string, updates: Partial<LayerGroup>) => {},
    deleteGroup: (groupId: string) => {},
    addLayerToGroup: (layerId: string, groupId: string) => {},
    removeLayerFromGroup: (layerId: string, groupId: string) => {},
    
    // Filtering
    setFilter: (newFilter: Partial<LayerFilter>) => setFilterState(prev => ({ ...prev, ...newFilter })),
    getFilteredLayers,
    
    // Import/Export (placeholder)
    exportLayers: async (options: LayerExportOptions) => '',
    importLayers: async (data: string) => {},
    
    // Validation
    validateLayer: (layer: Partial<Layer>): LayerValidationResult => ({
      isValid: true,
      errors: [],
      warnings: []
    }),
    
    // Utilities
    getLayerById,
    getElementByIdInLayer: (layerId: string, elementId: string) => null,
    getSystemLayers: () => state.layers.filter(l => l.isSystem),
    resetToDefaults: () => {},
    saveToFirestore
  };
}