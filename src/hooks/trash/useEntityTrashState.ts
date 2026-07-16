'use client';

/**
 * 🗑️ useEntityTrashState — the trash view engine, once.
 *
 * ADR-281 decided "ENAS kentrikopoiimenos mixanismos, oxi copy-paste ana entity"
 * and delivered exactly that on the server (soft-delete-engine) and in the
 * service layer (TrashService). The client hooks never followed: Buildings,
 * Parking, Projects and Storages each grew their own copy of the same state
 * machine. This module is the missing half — the same decision, applied to the
 * hook layer.
 *
 * Each entity keeps a thin binding hook that owns its {@link EntityTrashSpec}
 * (route, kind, response key) and re-exports the engine under its own domain
 * names. The engine owns everything that was identical: fetch, toggle, restore,
 * staged permanent-delete with confirm/cancel, and the auth-gated initial load.
 *
 * @module hooks/trash/useEntityTrashState
 * @enterprise ADR-281 — SSOT Soft-Delete System · ADR-584 — Anti-Duplication
 */

import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { TrashService } from '@/services/trash.service';
import { createModuleLogger } from '@/lib/telemetry';
import { useAuth } from '@/auth/hooks/useAuth';
import { RealtimeService } from '@/services/realtime';
import type { RealtimeEventMap } from '@/services/realtime/event-payload-definitions';
import type { SoftDeletableEntityType } from '@/types/soft-deletable';

const logger = createModuleLogger('useEntityTrashState');

/**
 * What genuinely differs between the entity bins. Everything not named here was
 * identical across all four hooks and lives in the engine.
 */
export interface EntityTrashSpec<TItem> {
  /** Entity kind handed to {@link TrashService} — decides the restore/delete route. */
  entityKind: SoftDeletableEntityType;
  /** Route serving this entity's trash list. */
  trashRoute: string;
  /** Unwraps the entity list from its response envelope (`response.buildings`, …). */
  selectItems: (response: TrashApiResponse<TItem>) => TItem[] | undefined;
  /** Realtime event that means "an item of this kind was soft-deleted elsewhere". */
  refreshOn?: keyof RealtimeEventMap;
}

/** Every trash endpoint answers with the same envelope, under a per-entity key. */
export type TrashApiResponse<TItem> = {
  success: boolean;
  count: number;
} & Record<string, TItem[] | boolean | number | undefined>;

export interface EntityTrashOptions {
  /** Refreshes the *active* list — the bin refreshes itself. */
  forceDataRefresh: () => void;
  /**
   * Drops any selection that a trash action would leave dangling. Called on view
   * switch and after every completed action — the selected row is gone from the
   * list by then either way.
   */
  clearSelection?: () => void;
  /** Announces a restore. Left unbound, the entity stays silent. */
  notifyRestored?: (count: number) => void;
  /** Announces a permanent delete. Left unbound, the entity stays silent. */
  notifyPermanentlyDeleted?: (count: number) => void;
}

export interface EntityTrashState<TItem> {
  showTrash: boolean;
  items: TItem[];
  trashCount: number;
  loadingTrash: boolean;
  showPermanentDeleteDialog: boolean;
  pendingPermanentDeleteIds: string[];
  fetchTrashedItems: () => Promise<void>;
  handleToggleTrash: () => Promise<void>;
  handleTrashActionComplete: () => void;
  handleRestore: (ids: string[]) => Promise<void>;
  handlePermanentDelete: (ids: string[]) => void;
  handleConfirmPermanentDelete: () => Promise<void>;
  handleCancelPermanentDelete: () => void;
  trackMovedToTrash: (item: TItem & { id?: string }) => void;
}

export function useEntityTrashState<TItem extends { id?: string }>(
  spec: EntityTrashSpec<TItem>,
  options: EntityTrashOptions,
): EntityTrashState<TItem> {
  const { entityKind, trashRoute, selectItems, refreshOn } = spec;
  const { forceDataRefresh, clearSelection, notifyRestored, notifyPermanentlyDeleted } = options;

  const { user, loading: authLoading } = useAuth();
  const [showTrash, setShowTrash] = useState(false);
  const [items, setItems] = useState<TItem[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [showPermanentDeleteDialog, setShowPermanentDeleteDialog] = useState(false);
  const [pendingPermanentDeleteIds, setPendingPermanentDeleteIds] = useState<string[]>([]);

  const trashCount = items.length;

  const fetchTrashedItems = useCallback(async () => {
    setLoadingTrash(true);
    try {
      const response = await apiClient.get<TrashApiResponse<TItem>>(trashRoute);
      setItems(selectItems(response) ?? []);
    } catch (error) {
      logger.error('Failed to fetch trashed entities', { entityKind, error });
      setItems([]);
    } finally {
      setLoadingTrash(false);
    }
  }, [trashRoute, selectItems, entityKind]);

  const handleToggleTrash = useCallback(async () => {
    clearSelection?.();
    const next = !showTrash;
    setShowTrash(next);
    if (next) {
      await fetchTrashedItems();
    }
  }, [showTrash, fetchTrashedItems, clearSelection]);

  const handleTrashActionComplete = useCallback(() => {
    clearSelection?.();
    forceDataRefresh();
    void fetchTrashedItems();
  }, [clearSelection, forceDataRefresh, fetchTrashedItems]);

  const handleRestore = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    logger.info('Restoring entities from trash', { entityKind, ids });
    try {
      await TrashService.bulkRestore(entityKind, ids);
      handleTrashActionComplete();
      notifyRestored?.(ids.length);
    } catch (error) {
      logger.error('Failed to restore entities from trash', { entityKind, ids, error });
    }
  }, [entityKind, handleTrashActionComplete, notifyRestored]);

  const handlePermanentDelete = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setPendingPermanentDeleteIds(ids);
    setShowPermanentDeleteDialog(true);
  }, []);

  const handleConfirmPermanentDelete = useCallback(async () => {
    if (pendingPermanentDeleteIds.length === 0) return;
    const count = pendingPermanentDeleteIds.length;
    logger.info('Permanently deleting entities', { entityKind, ids: pendingPermanentDeleteIds });
    try {
      await TrashService.bulkPermanentDelete(entityKind, pendingPermanentDeleteIds);
      setShowPermanentDeleteDialog(false);
      setPendingPermanentDeleteIds([]);
      handleTrashActionComplete();
      notifyPermanentlyDeleted?.(count);
    } catch (error) {
      logger.error('Failed to permanently delete entities', {
        entityKind,
        ids: pendingPermanentDeleteIds,
        error,
      });
      setShowPermanentDeleteDialog(false);
      setPendingPermanentDeleteIds([]);
    }
  }, [entityKind, pendingPermanentDeleteIds, handleTrashActionComplete, notifyPermanentlyDeleted]);

  const handleCancelPermanentDelete = useCallback(() => {
    setShowPermanentDeleteDialog(false);
    setPendingPermanentDeleteIds([]);
  }, []);

  /** Adds an item the caller just binned, sparing a round-trip. Idempotent. */
  const trackMovedToTrash = useCallback((item: TItem & { id?: string }) => {
    setItems(prev => (prev.some(existing => existing.id === item.id) ? prev : [...prev, item]));
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    void fetchTrashedItems();
  }, [fetchTrashedItems, authLoading, user]);

  // Keeps the bin honest when an item is soft-deleted from the active list (ADR-281)
  useEffect(() => {
    if (!refreshOn) return;
    return RealtimeService.subscribe(refreshOn, () => {
      void fetchTrashedItems();
    });
  }, [refreshOn, fetchTrashedItems]);

  return {
    showTrash,
    items,
    trashCount,
    loadingTrash,
    showPermanentDeleteDialog,
    pendingPermanentDeleteIds,
    fetchTrashedItems,
    handleToggleTrash,
    handleTrashActionComplete,
    handleRestore,
    handlePermanentDelete,
    handleConfirmPermanentDelete,
    handleCancelPermanentDelete,
    trackMovedToTrash,
  };
}
