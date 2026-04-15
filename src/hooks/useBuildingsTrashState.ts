'use client';

/**
 * 🗑️ useBuildingsTrashState
 *
 * Manages the trash view for the buildings page.
 * Follows the same pattern as useProjectsTrashState (ADR-308).
 *
 * @module hooks/useBuildingsTrashState
 * @enterprise ADR-308 — Buildings Soft-Delete Trash
 */

import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { TrashService } from '@/services/trash.service';
import { createModuleLogger } from '@/lib/telemetry';
import type { Building } from '@/types/building/contracts';

const logger = createModuleLogger('useBuildingsTrashState');

interface UseBuildingsTrashStateParams {
  forceDataRefresh: () => void;
}

interface TrashApiResponse {
  success: boolean;
  buildings: Building[];
  count: number;
}

export function useBuildingsTrashState({
  forceDataRefresh,
}: UseBuildingsTrashStateParams) {
  const [showTrash, setShowTrash] = useState(false);
  const [trashedBuildings, setTrashedBuildings] = useState<Building[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [showPermanentDeleteDialog, setShowPermanentDeleteDialog] = useState(false);
  const [pendingPermanentDeleteIds, setPendingPermanentDeleteIds] = useState<string[]>([]);

  const trashCount = trashedBuildings.length;

  const fetchTrashedBuildings = useCallback(async () => {
    setLoadingTrash(true);
    try {
      const response = await apiClient.get<TrashApiResponse>(API_ROUTES.BUILDINGS.TRASH);
      setTrashedBuildings(response.buildings ?? []);
    } catch (error) {
      logger.error('Failed to fetch deleted buildings', { error });
      setTrashedBuildings([]);
    } finally {
      setLoadingTrash(false);
    }
  }, []);

  const handleToggleTrash = useCallback(async () => {
    const next = !showTrash;
    setShowTrash(next);
    if (next) {
      await fetchTrashedBuildings();
    }
  }, [showTrash, fetchTrashedBuildings]);

  const handleTrashActionComplete = useCallback(() => {
    forceDataRefresh();
    void fetchTrashedBuildings();
  }, [forceDataRefresh, fetchTrashedBuildings]);

  const handleRestoreBuildings = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    logger.info('Restoring buildings from trash', { ids });
    try {
      await TrashService.bulkRestore('building', ids);
      handleTrashActionComplete();
    } catch (error) {
      logger.error('Failed to restore buildings', { ids, error });
    }
  }, [handleTrashActionComplete]);

  const handlePermanentDeleteBuildings = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setPendingPermanentDeleteIds(ids);
    setShowPermanentDeleteDialog(true);
  }, []);

  const handleConfirmPermanentDelete = useCallback(async () => {
    if (pendingPermanentDeleteIds.length === 0) return;
    logger.info('Permanently deleting buildings', { ids: pendingPermanentDeleteIds });
    try {
      await TrashService.bulkPermanentDelete('building', pendingPermanentDeleteIds);
      setShowPermanentDeleteDialog(false);
      setPendingPermanentDeleteIds([]);
      handleTrashActionComplete();
    } catch (error) {
      logger.error('Failed to permanently delete buildings', { ids: pendingPermanentDeleteIds, error });
      setShowPermanentDeleteDialog(false);
      setPendingPermanentDeleteIds([]);
    }
  }, [pendingPermanentDeleteIds, handleTrashActionComplete]);

  const handleCancelPermanentDelete = useCallback(() => {
    setShowPermanentDeleteDialog(false);
    setPendingPermanentDeleteIds([]);
  }, []);

  useEffect(() => {
    void fetchTrashedBuildings();
  }, [fetchTrashedBuildings]);

  return {
    showTrash,
    trashCount,
    trashedBuildings,
    loadingTrash,
    showPermanentDeleteDialog,
    pendingPermanentDeleteIds,
    handleToggleTrash,
    handleTrashActionComplete,
    handleRestoreBuildings,
    handlePermanentDeleteBuildings,
    handleConfirmPermanentDelete,
    handleCancelPermanentDelete,
    fetchTrashedBuildings,
  } as const;
}
