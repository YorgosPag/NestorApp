'use client';

/**
 * 🔷 OVERLAY STORE (ADR-340 Phase 9 STEP G — multi-kind backend)
 *
 * Layering tool's local state holder. Subscribes via the shared
 * `useFloorOverlays(floorId)` hook (single `floorplan_overlays` collection,
 * companyId auto-injected by the tenant-aware query service) and writes via
 * `floorplan-overlay-mutation-gateway` (sole client write path enforced by
 * SSoT registry module `floorplan-overlay-gateway`).
 *
 * Public surface remains the legacy `Overlay`/`UpdateOverlayData` API so that
 * the 33 existing callers keep compiling. Mappers in `overlay-store-mappers.ts`
 * translate between the two shapes — the store itself is plumbing only.
 *
 * Non-polygon kinds (line/circle/arc/measurement/text) are persisted via
 * `completeEntity({ persistToOverlays })` and never enter this store.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import {
  createFloorplanOverlay,
  updateFloorplanOverlay,
  deleteFloorplanOverlay,
  upsertFloorplanOverlay,
} from '@/services/floorplan-overlay-mutation-gateway';
import { useFloorOverlays } from '@/hooks/useFloorOverlays';
import { useLevels } from '../systems/levels';
import { useFloorplanBackgroundStore } from '../floorplan-background/stores/floorplanBackgroundStore';
import { dlog, dwarn, derr } from '../debug';
import {
  buildCreatePayload,
  buildUpdatePayload,
  buildUpsertPayload,
  floorItemToLegacyOverlay,
} from './overlay-store-mappers';
import type {
  CreateOverlayData,
  Overlay,
  OverlayKind,
  Status,
  UpdateOverlayData,
} from './types';

interface OverlayStoreState {
  overlays: Record<string, Overlay>;
  isLoading: boolean;
  currentLevelId: string | null;
  hiddenOverlayIds: Set<string>;
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
  addVertex: (id: string, insertIndex: number, vertex: [number, number]) => Promise<void>;
  updateVertex: (id: string, vertexIndex: number, newPosition: [number, number]) => Promise<void>;
  removeVertex: (id: string, vertexIndex: number) => Promise<boolean>;
  restore: (overlay: Overlay) => Promise<void>;
  toggleHidden: (id: string) => void;
  /** @deprecated ADR-030 — universal selection system replaces overlay-local selection. */
  getSelectedOverlay: () => Overlay | null;
}

const OverlayStoreContext = createContext<(OverlayStoreState & OverlayStoreActions) | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function OverlayStoreProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { levels } = useLevels();

  const [currentLevelId, setCurrentLevelState] = useState<string | null>(null);
  const [hiddenOverlayIds, setHiddenOverlayIds] = useState<Set<string>>(new Set());

  // ── Resolve floorId + backgroundId from the active level ─────────────────
  const currentLevel = useMemo(
    () => levels.find((l) => l.id === currentLevelId) ?? null,
    [levels, currentLevelId],
  );
  const floorId = currentLevel?.floorId ?? null;
  const backgroundId = useFloorplanBackgroundStore(
    (s) => (floorId ? s.floors[floorId]?.background?.id ?? null : null),
  );

  // ── Subscribe to multi-kind overlays for the active floor ────────────────
  const { overlays: floorItems, loading: subLoading } = useFloorOverlays(floorId);

  // ── Project read items onto the legacy Overlay shape ─────────────────────
  const overlays = useMemo<Record<string, Overlay>>(() => {
    if (!currentLevelId) return {};
    const map: Record<string, Overlay> = {};
    for (const item of floorItems) {
      const legacy = floorItemToLegacyOverlay(item, currentLevelId);
      if (legacy) {
        map[legacy.id] = legacy;
      }
    }
    return map;
  }, [floorItems, currentLevelId]);

  const isLoading = subLoading;

  // ── Actions ──────────────────────────────────────────────────────────────

  const getByLevel = useCallback(
    (levelId: string): Overlay[] => {
      if (levelId !== currentLevelId) return [];
      return Object.values(overlays);
    },
    [overlays, currentLevelId],
  );

  const ensurePersistContext = useCallback((): { backgroundId: string; floorId: string } | null => {
    if (!floorId) {
      dwarn('OverlayStore', '⚠️ No floorId for current level — overlay write skipped');
      return null;
    }
    if (!backgroundId) {
      dwarn('OverlayStore', '⚠️ No backgroundId for current floor — overlay write skipped');
      return null;
    }
    return { backgroundId, floorId };
  }, [floorId, backgroundId]);

  const add = useCallback(
    async (overlayData: CreateOverlayData): Promise<string> => {
      const ctx = ensurePersistContext();
      if (!ctx) throw new Error('Cannot create overlay without floor + background context');
      if (!user?.uid) throw new Error('Cannot create overlay without authenticated user');

      const payload = buildCreatePayload(
        {
          kind: overlayData.kind || 'property',
          polygon: overlayData.polygon,
          ...(overlayData.label !== undefined ? { label: overlayData.label } : {}),
          ...(overlayData.linked ? { linked: overlayData.linked } : {}),
          ...(overlayData.style ? { style: overlayData.style } : {}),
        },
        ctx,
      );

      const result = await createFloorplanOverlay(payload);
      return result.overlayId;
    },
    [ensurePersistContext, user],
  );

  const update = useCallback(
    async (id: string, patch: UpdateOverlayData): Promise<void> => {
      const payload = buildUpdatePayload(id, patch);
      await updateFloorplanOverlay(payload);
    },
    [],
  );

  const remove = useCallback(async (id: string): Promise<void> => {
    await deleteFloorplanOverlay({ overlayId: id });
  }, []);

  const restore = useCallback(
    async (overlay: Overlay): Promise<void> => {
      const ctx = ensurePersistContext();
      if (!ctx) {
        derr('OverlayStore', '❌ restore: missing floor/background context');
        return;
      }
      const payload = buildUpsertPayload(
        { ...overlay, createdBy: overlay.createdBy || user?.uid || 'system' },
        ctx,
      );
      await upsertFloorplanOverlay(payload);
      dlog('OverlayStore', `✅ restore: overlay ${overlay.id} upserted`);
    },
    [ensurePersistContext, user],
  );

  const duplicate = useCallback(
    async (id: string): Promise<string | null> => {
      const overlay = overlays[id];
      if (!overlay) return null;
      const offsetPolygon = overlay.polygon.map(
        ([x, y]) => [x + 10, y + 10] as [number, number],
      );
      return add({
        levelId: overlay.levelId,
        kind: overlay.kind,
        polygon: offsetPolygon,
        ...(overlay.label ? { label: `${overlay.label}_copy` } : {}),
        ...(overlay.linked ? { linked: overlay.linked } : {}),
        ...(overlay.style ? { style: overlay.style } : {}),
      });
    },
    [overlays, add],
  );

  const setStatus = useCallback(
    async (id: string, status: Status): Promise<void> => {
      await update(id, { status });
    },
    [update],
  );

  const setLabel = useCallback(
    async (id: string, label: string): Promise<void> => {
      await update(id, { label });
    },
    [update],
  );

  const setKind = useCallback(
    async (id: string, kind: OverlayKind): Promise<void> => {
      await update(id, { kind });
    },
    [update],
  );

  const getSelectedOverlay = useCallback((): Overlay | null => {
    dwarn('OverlayStore', '⚠️ DEPRECATED: getSelectedOverlay() — use useUniversalSelection()');
    return null;
  }, []);

  const toggleHidden = useCallback((id: string) => {
    setHiddenOverlayIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const setCurrentLevel = useCallback((levelId: string | null) => {
    setCurrentLevelState(levelId);
    setHiddenOverlayIds(new Set());
  }, []);

  // ── Vertex helpers — project on geometry.vertices via update() ───────────

  const addVertex = useCallback(
    async (id: string, insertIndex: number, vertex: [number, number]) => {
      const overlay = overlays[id];
      if (!overlay) {
        derr('OverlayStore', '❌ addVertex: overlay not found:', id);
        return;
      }
      const next = [...overlay.polygon];
      next.splice(insertIndex, 0, vertex);
      await update(id, { polygon: next });
    },
    [overlays, update],
  );

  const updateVertex = useCallback(
    async (id: string, vertexIndex: number, newPosition: [number, number]) => {
      const overlay = overlays[id];
      if (!overlay) return;
      if (vertexIndex < 0 || vertexIndex >= overlay.polygon.length) return;
      const next = [...overlay.polygon];
      next[vertexIndex] = newPosition;
      await update(id, { polygon: next });
    },
    [overlays, update],
  );

  const removeVertex = useCallback(
    async (id: string, vertexIndex: number): Promise<boolean> => {
      const { MIN_POLY_POINTS } = await import('../config/tolerance-config');
      const overlay = overlays[id];
      if (!overlay) return false;
      if (overlay.polygon.length <= MIN_POLY_POINTS) return false;
      if (vertexIndex < 0 || vertexIndex >= overlay.polygon.length) return false;
      const next = [...overlay.polygon];
      next.splice(vertexIndex, 1);
      await update(id, { polygon: next });
      return true;
    },
    [overlays, update],
  );

  // ── Reset on level change ────────────────────────────────────────────────

  useEffect(() => {
    setHiddenOverlayIds(new Set());
  }, [currentLevelId]);

  const contextValue = useMemo(
    () => ({
      overlays,
      isLoading,
      currentLevelId,
      hiddenOverlayIds,
      getByLevel,
      add,
      update,
      remove,
      restore,
      duplicate,
      setStatus,
      setLabel,
      setKind,
      setCurrentLevel,
      toggleHidden,
      addVertex,
      updateVertex,
      removeVertex,
      getSelectedOverlay,
    }),
    [
      overlays,
      isLoading,
      currentLevelId,
      hiddenOverlayIds,
      getByLevel,
      add,
      update,
      remove,
      restore,
      duplicate,
      setStatus,
      setLabel,
      setKind,
      setCurrentLevel,
      toggleHidden,
      addVertex,
      updateVertex,
      removeVertex,
      getSelectedOverlay,
    ],
  );

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
