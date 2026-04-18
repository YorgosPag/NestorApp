'use client';

/**
 * 🗑️ useStoragesTrashState
 *
 * Manages the trash view for the storages page.
 * Follows the same pattern as useBuildingsTrashState (ADR-281).
 *
 * @module hooks/useStoragesTrashState
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { TrashService } from '@/services/trash.service';
import { createModuleLogger } from '@/lib/telemetry';
import { useAuth } from '@/auth/hooks/useAuth';
import type { Storage } from '@/types/storage/contracts';

const logger = createModuleLogger('useStoragesTrashState');

interface UseStoragesTrashStateParams {
  forceDataRefresh: () => void;
}

interface TrashApiResponse {
  success: boolean;
  storages: Storage[];
  count: number;
}

export function useStoragesTrashState({
  forceDataRefresh,
}: UseStoragesTrashStateParams) {
  const { user, loading: authLoading } = useAuth();
  const [showTrash, setShowTrash] = useState(false);
  const [trashedStorages, setTrashedStorages] = useState<Storage[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [showPermanentDeleteDialog, setShowPermanentDeleteDialog] = useState(false);
  const [pendingPermanentDeleteIds, setPendingPermanentDeleteIds] = useState<string[]>([]);

  const trashCount = trashedStorages.length;

  const fetchTrashedStorages = useCallback(async () => {
    setLoadingTrash(true);
    try {
      const response = await apiClient.get<TrashApiResponse>(API_ROUTES.STORAGES.TRASH);
      setTrashedStorages(response.storages ?? []);
    } catch (error) {
      logger.error('Failed to fetch deleted storage units', { error });
      setTrashedStorages([]);
    } finally {
      setLoadingTrash(false);
    }
  }, []);

  const handleToggleTrash = useCallback(async () => {
    const next = !showTrash;
    setShowTrash(next);
    if (next) {
      await fetchTrashedStorages();
    }
  }, [showTrash, fetchTrashedStorages]);

  const handleTrashActionComplete = useCallback(() => {
    forceDataRefresh();
    void fetchTrashedStorages();
  }, [forceDataRefresh, fetchTrashedStorages]);

  const handleRestoreStorages = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    logger.info('Restoring storage units from trash', { ids });
    try {
      await TrashService.bulkRestore('storage', ids);
      handleTrashActionComplete();
    } catch (error) {
      logger.error('Failed to restore storage units', { ids, error });
    }
  }, [handleTrashActionComplete]);

  const handlePermanentDeleteStorages = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setPendingPermanentDeleteIds(ids);
    setShowPermanentDeleteDialog(true);
  }, []);

  const handleConfirmPermanentDelete = useCallback(async () => {
    if (pendingPermanentDeleteIds.length === 0) return;
    logger.info('Permanently deleting storage units', { ids: pendingPermanentDeleteIds });
    try {
      await TrashService.bulkPermanentDelete('storage', pendingPermanentDeleteIds);
      setShowPermanentDeleteDialog(false);
      setPendingPermanentDeleteIds([]);
      handleTrashActionComplete();
    } catch (error) {
      logger.error('Failed to permanently delete storage units', { ids: pendingPermanentDeleteIds, error });
      setShowPermanentDeleteDialog(false);
      setPendingPermanentDeleteIds([]);
    }
  }, [pendingPermanentDeleteIds, handleTrashActionComplete]);

  const handleCancelPermanentDelete = useCallback(() => {
    setShowPermanentDeleteDialog(false);
    setPendingPermanentDeleteIds([]);
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    void fetchTrashedStorages();
  }, [fetchTrashedStorages, authLoading, user]);

  return {
    showTrash,
    trashCount,
    trashedStorages,
    loadingTrash,
    showPermanentDeleteDialog,
    pendingPermanentDeleteIds,
    handleToggleTrash,
    handleTrashActionComplete,
    handleRestoreStorages,
    handlePermanentDeleteStorages,
    handleConfirmPermanentDelete,
    handleCancelPermanentDelete,
    fetchTrashedStorages,
  } as const;
}
