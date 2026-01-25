'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '../../../lib/firebase';
import { collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import type { Overlay, CreateOverlayData, UpdateOverlayData, Status, OverlayKind } from './types';

interface OverlayStoreState {
  overlays: Record<string, Overlay>;
  selectedOverlayId: string | null;
  // 🏢 ENTERPRISE (2026-01-25): Multi-selection support for marquee selection
  selectedOverlayIds: Set<string>;
  isLoading: boolean;
  currentLevelId: string | null;
}

interface OverlayStoreActions {
  getByLevel: (levelId: string) => Overlay[];
  add: (overlay: CreateOverlayData) => Promise<string>;
  update: (id: string, patch: UpdateOverlayData) => Promise<void>;
  remove: (id: string) => Promise<void>;
  duplicate: (id: string) => Promise<string | null>;
  setStatus: (id: string, status: Status) => Promise<void>;
  setLabel: (id: string, label: string) => Promise<void>;
  setKind: (id: string, kind: OverlayKind) => Promise<void>;
  setSelectedOverlay: (id: string | null) => void;
  getSelectedOverlay: () => Overlay | null;
  setCurrentLevel: (levelId: string | null) => void;
  // 🏢 ENTERPRISE (2026-01-25): Vertex manipulation for polygon editing
  addVertex: (id: string, insertIndex: number, vertex: [number, number]) => Promise<void>;
  updateVertex: (id: string, vertexIndex: number, newPosition: [number, number]) => Promise<void>;
  removeVertex: (id: string, vertexIndex: number) => Promise<boolean>;
  // 🏢 ENTERPRISE (2026-01-25): Multi-selection support for marquee selection
  setSelectedOverlays: (ids: string[]) => void;
  addToSelection: (id: string) => void;
  removeFromSelection: (id: string) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  getSelectedOverlays: () => Overlay[];
  isSelected: (id: string) => boolean;
}

const OverlayStoreContext = createContext<(OverlayStoreState & OverlayStoreActions) | null>(null);
const COLLECTION_PREFIX = 'dxf-overlay-levels';

export function OverlayStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OverlayStoreState>({
    overlays: {},
    selectedOverlayId: null,
    // 🏢 ENTERPRISE (2026-01-25): Multi-selection support
    selectedOverlayIds: new Set<string>(),
    isLoading: false,
    currentLevelId: null,
  });

  // Firestore subscription
  useEffect(() => {
    if (!state.currentLevelId) {

      return;
    }

    setState(prev => ({ ...prev, isLoading: true }));
    const collectionRef = collection(db, `${COLLECTION_PREFIX}/${state.currentLevelId}/items`);
    const q = query(collectionRef, orderBy('createdAt', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const overlays: Record<string, Overlay> = {};
      snapshot.docs.forEach(doc => {
        // 🎯 TYPE-SAFE: Firestore returns DocumentData - cast to expected structure
        const data = doc.data() as Record<string, unknown>;
        let polygon = data.polygon;

        // 🔧 FIX (2026-01-24): Normalize polygon format from various storage formats
        if (Array.isArray(polygon) && polygon.length > 0) {
          const firstElement = (polygon as unknown[])[0];

          // Format 1: Array of {x, y} objects (new Firebase-compatible format)
          if (typeof firstElement === 'object' && firstElement !== null && 'x' in firstElement) {
            polygon = (polygon as Array<{x: number, y: number}>).map(p => [p.x, p.y] as [number, number]);
          }
          // Format 2: Flat array [x1, y1, x2, y2, ...] (legacy format)
          else if (typeof firstElement === 'number') {
            const nums = polygon as unknown as number[];
            const coordPairs: [number, number][] = [];
            for (let i = 0; i < nums.length; i += 2) {
              coordPairs.push([nums[i], nums[i + 1]]);
            }
            polygon = coordPairs;
          }
          // Format 3: Already [[x,y], [x,y], ...] - use as-is
        }

        // ✅ ENTERPRISE FIX: Type-safe overlay creation with proper polygon type
        overlays[doc.id] = {
          ...data,
          id: doc.id,
          polygon: polygon as [number, number][]
        } as Overlay;
      });

      setState(prev => ({ ...prev, overlays, isLoading: false }));
    });

    return () => unsubscribe();
  }, [state.currentLevelId]);

  // Actions
  const getByLevel = useCallback((levelId: string): Overlay[] => {
    return Object.values(state.overlays).filter(overlay => overlay.levelId === levelId);
  }, [state.overlays]);

  const add = useCallback(async (overlayData: CreateOverlayData): Promise<string> => {
    if (!state.currentLevelId) throw new Error('No current level selected');

    // 🔧 FIX (2026-01-24): Convert nested array [[x,y], ...] to array of objects [{x,y}, ...]
    // Firebase doesn't support nested arrays, but supports array of objects
    const polygonForFirestore = overlayData.polygon.map(([x, y]) => ({ x, y }));

    // 🔧 FIX (2026-01-24): Build object without undefined values - Firebase rejects undefined
    const newOverlay: Record<string, unknown> = {
      levelId: state.currentLevelId,
      status: overlayData.status || 'for-sale',
      kind: overlayData.kind || 'unit',
      polygon: polygonForFirestore,
      createdBy: 'user@example.com',
    };

    // Only add optional fields if they have values
    if (overlayData.label !== undefined) newOverlay.label = overlayData.label;
    if (overlayData.linked !== undefined) newOverlay.linked = overlayData.linked;

    const collectionRef = collection(db, `${COLLECTION_PREFIX}/${state.currentLevelId}/items`);
    const docRef = await addDoc(collectionRef, {
      ...newOverlay,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }, [state.currentLevelId]);

  const update = useCallback(async (id: string, patch: UpdateOverlayData): Promise<void> => {
    if (!state.currentLevelId) return;
    const docRef = doc(db, `${COLLECTION_PREFIX}/${state.currentLevelId}/items`, id);

    // Filter out undefined values to prevent Firebase errors
    // 🎯 TYPE-SAFE: Build clean patch object without undefined values
    const cleanPatch = Object.entries(patch).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        // 🔧 FIX (2026-01-24): Convert polygon to Firebase-compatible format
        if (key === 'polygon' && Array.isArray(value)) {
          acc[key] = (value as [number, number][]).map(([x, y]) => ({ x, y }));
        } else {
          acc[key] = value;
        }
      }
      return acc;
    }, {} as Record<string, unknown>);

    await updateDoc(docRef, { ...cleanPatch, updatedAt: serverTimestamp() });
  }, [state.currentLevelId]);

  const remove = useCallback(async (id: string): Promise<void> => {
    if (!state.currentLevelId) return;
    const docRef = doc(db, `${COLLECTION_PREFIX}/${state.currentLevelId}/items`, id);
    await deleteDoc(docRef);
  }, [state.currentLevelId]);

  const duplicate = useCallback(async (id: string): Promise<string | null> => {
    const overlay = state.overlays[id];
    if (!overlay) return null;

    const offsetPolygon = overlay.polygon.map(([x, y]) => [x + 10, y + 10] as [number, number]);
    const duplicateData: CreateOverlayData = {
      levelId: overlay.levelId,
      kind: overlay.kind,
      polygon: offsetPolygon,
      status: overlay.status,
      label: overlay.label ? `${overlay.label}_copy` : undefined,
      ...(overlay.linked && { linked: overlay.linked }), // Only include linked if it exists
    };

    return await add(duplicateData);
  }, [state.overlays, add]);

  const setStatus = useCallback(async (id: string, status: Status): Promise<void> => {
    await update(id, { status });
  }, [update]);

  const setLabel = useCallback(async (id: string, label: string): Promise<void> => {
    await update(id, { label });
  }, [update]);

  const setKind = useCallback(async (id: string, kind: OverlayKind): Promise<void> => {
    await update(id, { kind });
  }, [update]);

  const setSelectedOverlay = useCallback((id: string | null) => {
    setState(prev => ({
      ...prev,
      selectedOverlayId: id,
      // 🏢 ENTERPRISE (2026-01-25): Sync single selection with multi-selection
      // If id is null, clear all selections. If id is set, make it the only selection.
      selectedOverlayIds: id ? new Set([id]) : new Set<string>()
    }));
  }, []);

  const getSelectedOverlay = useCallback((): Overlay | null => {
    return state.selectedOverlayId ? state.overlays[state.selectedOverlayId] || null : null;
  }, [state.selectedOverlayId, state.overlays]);

  const setCurrentLevel = useCallback((levelId: string | null) => {
    setState(prev => ({
      ...prev,
      currentLevelId: levelId,
      selectedOverlayId: null,
      // 🏢 ENTERPRISE (2026-01-25): Clear multi-selection when level changes
      selectedOverlayIds: new Set<string>(),
      overlays: {},
    }));
  }, []);

  // 🏢 ENTERPRISE (2026-01-25): Add vertex to polygon at specified index
  const addVertex = useCallback(async (id: string, insertIndex: number, vertex: [number, number]) => {
    const overlay = state.overlays[id];
    if (!overlay) {
      console.error('❌ addVertex: Overlay not found:', id);
      return;
    }

    const currentPolygon = overlay.polygon;
    if (!Array.isArray(currentPolygon)) {
      console.error('❌ addVertex: Invalid polygon format');
      return;
    }

    // Insert vertex at specified index
    const newPolygon = [...currentPolygon];
    newPolygon.splice(insertIndex, 0, vertex);

    // Use existing update function
    await update(id, { polygon: newPolygon });
    console.log('✅ addVertex: Vertex added at index', insertIndex);
  }, [state.overlays, update]);

  // 🏢 ENTERPRISE (2026-01-25): Update vertex position (for drag operations)
  const updateVertex = useCallback(async (id: string, vertexIndex: number, newPosition: [number, number]) => {
    const overlay = state.overlays[id];
    if (!overlay) {
      console.error('❌ updateVertex: Overlay not found:', id);
      return;
    }

    const currentPolygon = overlay.polygon;
    if (!Array.isArray(currentPolygon)) {
      console.error('❌ updateVertex: Invalid polygon format');
      return;
    }

    if (vertexIndex < 0 || vertexIndex >= currentPolygon.length) {
      console.error('❌ updateVertex: Invalid vertex index:', vertexIndex);
      return;
    }

    // Update vertex at specified index
    const newPolygon = [...currentPolygon];
    newPolygon[vertexIndex] = newPosition;

    // Use existing update function
    await update(id, { polygon: newPolygon });
  }, [state.overlays, update]);

  // 🏢 ENTERPRISE (2026-01-25): Remove vertex from polygon at specified index
  const removeVertex = useCallback(async (id: string, vertexIndex: number): Promise<boolean> => {
    const overlay = state.overlays[id];
    if (!overlay) {
      console.error('❌ removeVertex: Overlay not found:', id);
      return false;
    }

    const currentPolygon = overlay.polygon;
    if (!Array.isArray(currentPolygon)) {
      console.error('❌ removeVertex: Invalid polygon format');
      return false;
    }

    // Minimum 3 vertices for a valid polygon
    const MIN_VERTICES = 3;
    if (currentPolygon.length <= MIN_VERTICES) {
      console.warn('⚠️ removeVertex: Cannot remove - minimum vertices reached');
      return false;
    }

    if (vertexIndex < 0 || vertexIndex >= currentPolygon.length) {
      console.error('❌ removeVertex: Invalid vertex index:', vertexIndex);
      return false;
    }

    // Remove vertex at specified index
    const newPolygon = [...currentPolygon];
    newPolygon.splice(vertexIndex, 1);

    // Use existing update function
    await update(id, { polygon: newPolygon });
    console.log('✅ removeVertex: Vertex removed at index', vertexIndex);
    return true;
  }, [state.overlays, update]);

  // ============================================================================
  // 🏢 ENTERPRISE (2026-01-25): Multi-Selection Functions
  // Supports marquee selection, shift+click, and batch operations
  // ============================================================================

  /**
   * Set multiple overlays as selected (replaces current selection)
   * Used by marquee selection
   */
  const setSelectedOverlays = useCallback((ids: string[]) => {
    setState(prev => ({
      ...prev,
      selectedOverlayIds: new Set(ids),
      // Also set the first one as the "primary" selection for backward compatibility
      selectedOverlayId: ids.length > 0 ? ids[0] : null
    }));
  }, []);

  /**
   * Add an overlay to current selection (for shift+click)
   */
  const addToSelection = useCallback((id: string) => {
    setState(prev => {
      const newSet = new Set(prev.selectedOverlayIds);
      newSet.add(id);
      return {
        ...prev,
        selectedOverlayIds: newSet,
        // Update primary selection to the newly added one
        selectedOverlayId: id
      };
    });
  }, []);

  /**
   * Remove an overlay from current selection
   */
  const removeFromSelection = useCallback((id: string) => {
    setState(prev => {
      const newSet = new Set(prev.selectedOverlayIds);
      newSet.delete(id);
      // If removed the primary selection, update to first remaining or null
      const newPrimary = prev.selectedOverlayId === id
        ? (newSet.size > 0 ? Array.from(newSet)[0] : null)
        : prev.selectedOverlayId;
      return {
        ...prev,
        selectedOverlayIds: newSet,
        selectedOverlayId: newPrimary
      };
    });
  }, []);

  /**
   * Toggle overlay selection (for ctrl+click)
   */
  const toggleSelection = useCallback((id: string) => {
    setState(prev => {
      const newSet = new Set(prev.selectedOverlayIds);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      // Update primary selection
      const newPrimary = newSet.has(id)
        ? id
        : (newSet.size > 0 ? Array.from(newSet)[0] : null);
      return {
        ...prev,
        selectedOverlayIds: newSet,
        selectedOverlayId: newPrimary
      };
    });
  }, []);

  /**
   * Clear all selections
   */
  const clearSelection = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedOverlayIds: new Set<string>(),
      selectedOverlayId: null
    }));
  }, []);

  /**
   * Get all selected overlays
   */
  const getSelectedOverlays = useCallback((): Overlay[] => {
    return Array.from(state.selectedOverlayIds)
      .map(id => state.overlays[id])
      .filter((overlay): overlay is Overlay => overlay !== undefined);
  }, [state.selectedOverlayIds, state.overlays]);

  /**
   * Check if an overlay is selected
   */
  const isSelected = useCallback((id: string): boolean => {
    return state.selectedOverlayIds.has(id);
  }, [state.selectedOverlayIds]);

  const contextValue = {
    ...state,
    getByLevel,
    add,
    update,
    remove,
    duplicate,
    setStatus,
    setLabel,
    setKind,
    setSelectedOverlay,
    getSelectedOverlay,
    setCurrentLevel,
    // 🏢 ENTERPRISE (2026-01-25): Vertex manipulation
    addVertex,
    updateVertex,
    removeVertex,
    // 🏢 ENTERPRISE (2026-01-25): Multi-selection
    setSelectedOverlays,
    addToSelection,
    removeFromSelection,
    toggleSelection,
    clearSelection,
    getSelectedOverlays,
    isSelected,
  };

  return (
    <OverlayStoreContext.Provider value={contextValue}>
      {children}
    </OverlayStoreContext.Provider>
  );
}

export function useOverlayStore() {
  const context = useContext(OverlayStoreContext);
  if (!context) {
    throw new Error('useOverlayStore must be used within OverlayStoreProvider');
  }
  return context;
}

// ============================================================================
// 🏢 ENTERPRISE (2026-01-25): Bridge Hook για Migration προς Universal Selection
//
// Αυτό το hook επιτρέπει τη σταδιακή μετάβαση από το overlay-store selection
// προς το κεντρικοποιημένο SelectionSystem.
//
// USAGE:
// 1. Αντικατάσταση: overlayStore.isSelected(id) -> bridge.isSelected(id)
// 2. Αντικατάσταση: overlayStore.setSelectedOverlays(ids) -> bridge.setSelectedOverlays(ids)
//
// MIGRATION PATH:
// - Phase 1 (τώρα): Bridge hook διατηρεί backward compatibility
// - Phase 2 (επόμενο PR): Migrate components να χρησιμοποιούν useUniversalSelection
// - Phase 3 (τελικό PR): Αφαίρεση bridge και selection logic από overlay-store
//
// @see systems/selection/SelectionSystem.tsx για το νέο universal API
// ============================================================================

/**
 * Bridge hook that connects overlay-store selection to the universal selection system
 *
 * @deprecated Για νέο κώδικα, χρησιμοποιήστε useUniversalSelection() από SelectionSystem
 */
export function useOverlaySelectionBridge() {
  const overlayStore = useOverlayStore();

  // 🔄 BRIDGE: Προς το παρόν επιστρέφει τα ίδια functions από το overlay-store
  // Στο Phase 2 θα αντικατασταθούν με calls στο SelectionSystem
  return {
    // Selection mutations
    setSelectedOverlay: overlayStore.setSelectedOverlay,
    setSelectedOverlays: overlayStore.setSelectedOverlays,
    addToSelection: overlayStore.addToSelection,
    removeFromSelection: overlayStore.removeFromSelection,
    toggleSelection: overlayStore.toggleSelection,
    clearSelection: overlayStore.clearSelection,

    // Selection queries
    isSelected: overlayStore.isSelected,
    getSelectedOverlays: overlayStore.getSelectedOverlays,
    selectedOverlayIds: overlayStore.selectedOverlayIds,
    selectedOverlayId: overlayStore.selectedOverlayId,

    // Data access (stays in overlay-store)
    overlays: overlayStore.overlays,
    getByLevel: overlayStore.getByLevel,
  };
}
