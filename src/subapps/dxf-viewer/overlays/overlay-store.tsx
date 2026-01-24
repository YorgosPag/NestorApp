'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '../../../lib/firebase';
import { collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import type { Overlay, CreateOverlayData, UpdateOverlayData, Status, OverlayKind } from './types';

interface OverlayStoreState {
  overlays: Record<string, Overlay>;
  selectedOverlayId: string | null;
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
}

const OverlayStoreContext = createContext<(OverlayStoreState & OverlayStoreActions) | null>(null);
const COLLECTION_PREFIX = 'dxf-overlay-levels';

export function OverlayStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OverlayStoreState>({
    overlays: {},
    selectedOverlayId: null,
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
    setState(prev => ({ ...prev, selectedOverlayId: id }));
  }, []);

  const getSelectedOverlay = useCallback((): Overlay | null => {
    return state.selectedOverlayId ? state.overlays[state.selectedOverlayId] || null : null;
  }, [state.selectedOverlayId, state.overlays]);

  const setCurrentLevel = useCallback((levelId: string | null) => {
    setState(prev => ({ 
      ...prev, 
      currentLevelId: levelId,
      selectedOverlayId: null,
      overlays: {},
    }));
  }, []);

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
