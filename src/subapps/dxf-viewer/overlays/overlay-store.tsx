'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '../../../lib/firebase';
import { collection, doc, onSnapshot, addDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { useAuth } from '@/auth/hooks/useAuth';
import type { Overlay, CreateOverlayData, UpdateOverlayData, Status, OverlayKind } from './types';
// 🏢 ENTERPRISE: Debug system for production-silent logging
import { dlog, dwarn, derr } from '../debug';

interface OverlayStoreState {
  overlays: Record<string, Overlay>;
  // 🏢 ENTERPRISE (2026-01-25): Selection state REMOVED - ADR-030
  // Selection is now handled by the universal selection system in systems/selection/
  // Use useUniversalSelection() hook instead
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
  setCurrentLevel: (levelId: string | null) => void;
  // 🏢 ENTERPRISE (2026-01-25): Vertex manipulation for polygon editing
  addVertex: (id: string, insertIndex: number, vertex: [number, number]) => Promise<void>;
  updateVertex: (id: string, vertexIndex: number, newPosition: [number, number]) => Promise<void>;
  removeVertex: (id: string, vertexIndex: number) => Promise<boolean>;
  // 🏢 ENTERPRISE (2026-01-26): Restore overlay for undo support - ADR-032
  restore: (overlay: Overlay) => Promise<void>;
  // 🏢 ENTERPRISE (2026-01-25): Selection REMOVED - ADR-030
  // Selection is now handled by systems/selection/
  // Use useUniversalSelection() hook for: select, selectMultiple, deselect, toggle, clearAll, clearByType, isSelected, getAll, getByType
  // Legacy getSelectedOverlay kept for backward compatibility during migration
  getSelectedOverlay: () => Overlay | null;
}

const OverlayStoreContext = createContext<(OverlayStoreState & OverlayStoreActions) | null>(null);
const COLLECTION_PREFIX = 'dxf-overlay-levels';

export function OverlayStoreProvider({ children }: { children: React.ReactNode }) {
  // 🔧 FIX (2026-02-13): Get authenticated user for companyId/createdBy — Firestore rules require these
  const { user } = useAuth();

  const [state, setState] = useState<OverlayStoreState>({
    overlays: {},
    // 🏢 ENTERPRISE (2026-01-25): Selection state REMOVED - ADR-030
    // Use useUniversalSelection() from systems/selection/ instead
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
    // 🔧 FIX (2026-02-13): Include companyId + createdBy from auth — Firestore rules require these
    const newOverlay: Record<string, unknown> = {
      levelId: state.currentLevelId,
      companyId: user?.companyId ?? null,
      status: overlayData.status || 'for-sale',
      kind: overlayData.kind || 'unit',
      polygon: polygonForFirestore,
      createdBy: user?.uid ?? 'unknown',
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
  }, [state.currentLevelId, user]);

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

  /**
   * 🏢 ENTERPRISE (2026-01-26): Restore overlay for undo support - ADR-032
   * Uses setDoc to restore overlay with its ORIGINAL ID
   * Pattern: SAP/Salesforce - Soft delete with restore capability
   */
  const restore = useCallback(async (overlay: Overlay): Promise<void> => {
    if (!overlay.levelId) {
      derr('OverlayStore', '❌ restore: Overlay has no levelId');
      return;
    }

    // 🔧 Convert polygon to Firebase-compatible format
    const polygonForFirestore = overlay.polygon.map(([x, y]) => ({ x, y }));

    // 🏢 ENTERPRISE: Build clean document without undefined values
    // 🔧 FIX (2026-02-13): Include companyId for Firestore rules compliance
    const overlayDoc: Record<string, unknown> = {
      levelId: overlay.levelId,
      companyId: user?.companyId ?? null,
      status: overlay.status || 'for-sale',
      kind: overlay.kind || 'unit',
      polygon: polygonForFirestore,
      createdBy: overlay.createdBy || user?.uid || 'unknown',
      restoredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Add optional fields if they exist
    if (overlay.label !== undefined) overlayDoc.label = overlay.label;
    if (overlay.linked !== undefined) overlayDoc.linked = overlay.linked;
    if (overlay.createdAt !== undefined) overlayDoc.createdAt = overlay.createdAt;

    // 🏢 CRITICAL: Use setDoc with original ID to restore exact document
    const docRef = doc(db, `${COLLECTION_PREFIX}/${overlay.levelId}/items`, overlay.id);
    await setDoc(docRef, overlayDoc);

    dlog('OverlayStore', `✅ restore: Overlay ${overlay.id} restored successfully`);
  }, [user]);

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

  // 🏢 ENTERPRISE (2026-01-25): getSelectedOverlay kept for backward compatibility - ADR-030
  // Returns null - use useUniversalSelection().getPrimaryId() to get selected overlay ID
  // then use overlayStore.overlays[id] to get the overlay object
  const getSelectedOverlay = useCallback((): Overlay | null => {
    dwarn('OverlayStore', '⚠️ DEPRECATED: getSelectedOverlay() - Use useUniversalSelection() instead');
    return null;
  }, []);

  const setCurrentLevel = useCallback((levelId: string | null) => {
    setState(prev => ({
      ...prev,
      currentLevelId: levelId,
      // 🏢 ENTERPRISE (2026-01-25): Selection clearing moved to universal selection system
      // Components should call universalSelection.clearByType('overlay') when level changes
      overlays: {},
    }));
  }, []);

  // 🏢 ENTERPRISE (2026-01-25): Add vertex to polygon at specified index
  const addVertex = useCallback(async (id: string, insertIndex: number, vertex: [number, number]) => {
    const overlay = state.overlays[id];
    if (!overlay) {
      derr('OverlayStore', '❌ addVertex: Overlay not found:', id);
      return;
    }

    const currentPolygon = overlay.polygon;
    if (!Array.isArray(currentPolygon)) {
      derr('OverlayStore', '❌ addVertex: Invalid polygon format');
      return;
    }

    // Insert vertex at specified index
    const newPolygon = [...currentPolygon];
    newPolygon.splice(insertIndex, 0, vertex);

    // Use existing update function
    await update(id, { polygon: newPolygon });
    dlog('OverlayStore', '✅ addVertex: Vertex added at index', insertIndex);
  }, [state.overlays, update]);

  // 🏢 ENTERPRISE (2026-01-25): Update vertex position (for drag operations)
  const updateVertex = useCallback(async (id: string, vertexIndex: number, newPosition: [number, number]) => {
    const overlay = state.overlays[id];
    if (!overlay) {
      derr('OverlayStore', '❌ updateVertex: Overlay not found:', id);
      return;
    }

    const currentPolygon = overlay.polygon;
    if (!Array.isArray(currentPolygon)) {
      derr('OverlayStore', '❌ updateVertex: Invalid polygon format');
      return;
    }

    if (vertexIndex < 0 || vertexIndex >= currentPolygon.length) {
      derr('OverlayStore', '❌ updateVertex: Invalid vertex index:', vertexIndex);
      return;
    }

    // Update vertex at specified index
    const newPolygon = [...currentPolygon];
    newPolygon[vertexIndex] = newPosition;

    // Use existing update function
    await update(id, { polygon: newPolygon });
  }, [state.overlays, update]);

  // 🏢 ENTERPRISE (2026-01-25): Remove vertex from polygon at specified index
  // 🏢 ADR-145: Use centralized MIN_POLY_POINTS from tolerance-config
  const removeVertex = useCallback(async (id: string, vertexIndex: number): Promise<boolean> => {
    // Import dynamically to avoid circular dependencies at module level
    const { MIN_POLY_POINTS } = await import('../config/tolerance-config');

    const overlay = state.overlays[id];
    if (!overlay) {
      derr('OverlayStore', '❌ removeVertex: Overlay not found:', id);
      return false;
    }

    const currentPolygon = overlay.polygon;
    if (!Array.isArray(currentPolygon)) {
      derr('OverlayStore', '❌ removeVertex: Invalid polygon format');
      return false;
    }

    // 🏢 ADR-145: Minimum vertices for valid polygon - centralized constant
    if (currentPolygon.length <= MIN_POLY_POINTS) {
      dwarn('OverlayStore', '⚠️ removeVertex: Cannot remove - minimum vertices reached');
      return false;
    }

    if (vertexIndex < 0 || vertexIndex >= currentPolygon.length) {
      derr('OverlayStore', '❌ removeVertex: Invalid vertex index:', vertexIndex);
      return false;
    }

    // Remove vertex at specified index
    const newPolygon = [...currentPolygon];
    newPolygon.splice(vertexIndex, 1);

    // Use existing update function
    await update(id, { polygon: newPolygon });
    dlog('OverlayStore', '✅ removeVertex: Vertex removed at index', vertexIndex);
    return true;
  }, [state.overlays, update]);

  // ============================================================================
  // 🏢 ENTERPRISE (2026-01-25): Selection Functions REMOVED - ADR-030
  // Selection is now handled by the universal selection system in systems/selection/
  //
  // MIGRATION GUIDE:
  // OLD: overlayStore.setSelectedOverlays(ids)  → NEW: universalSelection.selectMultiple(ids.map(id => ({id, type: 'overlay'})))
  // OLD: overlayStore.addToSelection(id)        → NEW: universalSelection.add(id, 'overlay')
  // OLD: overlayStore.removeFromSelection(id)   → NEW: universalSelection.deselect(id)
  // OLD: overlayStore.toggleSelection(id)       → NEW: universalSelection.toggle(id, 'overlay')
  // OLD: overlayStore.clearSelection()          → NEW: universalSelection.clearByType('overlay')
  // OLD: overlayStore.getSelectedOverlays()     → NEW: universalSelection.getByType('overlay').map(e => overlays[e.id])
  // OLD: overlayStore.isSelected(id)            → NEW: universalSelection.isSelected(id)
  // OLD: overlayStore.selectedOverlayId         → NEW: universalSelection.getPrimaryId()
  // OLD: overlayStore.selectedOverlayIds        → NEW: new Set(universalSelection.getIdsByType('overlay'))
  // ============================================================================

  const contextValue = {
    ...state,
    getByLevel,
    add,
    update,
    remove,
    restore, // 🏢 ENTERPRISE (2026-01-26): Restore for undo support - ADR-032
    duplicate,
    setStatus,
    setLabel,
    setKind,
    getSelectedOverlay,
    setCurrentLevel,
    // 🏢 ENTERPRISE (2026-01-25): Vertex manipulation
    addVertex,
    updateVertex,
    removeVertex,
    // 🏢 ENTERPRISE (2026-01-25): Selection REMOVED - ADR-030
    // Use useUniversalSelection() from systems/selection/ for all selection operations
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
// 🏢 ENTERPRISE (2026-01-25): Selection Logic REMOVED - ADR-030
//
// Selection is now fully handled by the universal selection system.
// For all selection operations, use useUniversalSelection() from systems/selection/
//
// MIGRATION COMPLETE - Phase 3 done (2026-01-25)
// ============================================================================
