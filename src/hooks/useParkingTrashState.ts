'use client';

/**
 * 🗑️ useParkingTrashState
 *
 * Manages the trash view for the parking page.
 * Follows the same pattern as useBuildingsTrashState (ADR-281).
 *
 * @module hooks/useParkingTrashState
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { TrashService } from '@/services/trash.service';
import { createModuleLogger } from '@/lib/telemetry';
import type { ParkingSpot } from '@/types/parking';

const logger = createModuleLogger('useParkingTrashState');

interface UseParkingTrashStateParams {
  forceDataRefresh: () => void;
}

interface TrashApiResponse {
  success: boolean;
  parkingSpots: ParkingSpot[];
  count: number;
}

export function useParkingTrashState({
  forceDataRefresh,
}: UseParkingTrashStateParams) {
  const [showTrash, setShowTrash] = useState(false);
  const [trashedParkingSpots, setTrashedParkingSpots] = useState<ParkingSpot[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [showPermanentDeleteDialog, setShowPermanentDeleteDialog] = useState(false);
  const [pendingPermanentDeleteIds, setPendingPermanentDeleteIds] = useState<string[]>([]);

  const trashCount = trashedParkingSpots.length;

  const fetchTrashedParkingSpots = useCallback(async () => {
    setLoadingTrash(true);
    try {
      const response = await apiClient.get<TrashApiResponse>(API_ROUTES.PARKING.TRASH);
      setTrashedParkingSpots(response.parkingSpots ?? []);
    } catch (error) {
      logger.error('Failed to fetch deleted parking spots', { error });
      setTrashedParkingSpots([]);
    } finally {
      setLoadingTrash(false);
    }
  }, []);

  const handleToggleTrash = useCallback(async () => {
    const next = !showTrash;
    setShowTrash(next);
    if (next) {
      await fetchTrashedParkingSpots();
    }
  }, [showTrash, fetchTrashedParkingSpots]);

  const handleTrashActionComplete = useCallback(() => {
    forceDataRefresh();
    void fetchTrashedParkingSpots();
  }, [forceDataRefresh, fetchTrashedParkingSpots]);

  const handleRestoreParkingSpots = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    logger.info('Restoring parking spots from trash', { ids });
    try {
      await TrashService.bulkRestore('parking', ids);
      handleTrashActionComplete();
    } catch (error) {
      logger.error('Failed to restore parking spots', { ids, error });
    }
  }, [handleTrashActionComplete]);

  const handlePermanentDeleteParkingSpots = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setPendingPermanentDeleteIds(ids);
    setShowPermanentDeleteDialog(true);
  }, []);

  const handleConfirmPermanentDelete = useCallback(async () => {
    if (pendingPermanentDeleteIds.length === 0) return;
    logger.info('Permanently deleting parking spots', { ids: pendingPermanentDeleteIds });
    try {
      await TrashService.bulkPermanentDelete('parking', pendingPermanentDeleteIds);
      setShowPermanentDeleteDialog(false);
      setPendingPermanentDeleteIds([]);
      handleTrashActionComplete();
    } catch (error) {
      logger.error('Failed to permanently delete parking spots', { ids: pendingPermanentDeleteIds, error });
      setShowPermanentDeleteDialog(false);
      setPendingPermanentDeleteIds([]);
    }
  }, [pendingPermanentDeleteIds, handleTrashActionComplete]);

  const handleCancelPermanentDelete = useCallback(() => {
    setShowPermanentDeleteDialog(false);
    setPendingPermanentDeleteIds([]);
  }, []);

  useEffect(() => {
    void fetchTrashedParkingSpots();
  }, [fetchTrashedParkingSpots]);

  return {
    showTrash,
    trashCount,
    trashedParkingSpots,
    loadingTrash,
    showPermanentDeleteDialog,
    pendingPermanentDeleteIds,
    handleToggleTrash,
    handleTrashActionComplete,
    handleRestoreParkingSpots,
    handlePermanentDeleteParkingSpots,
    handleConfirmPermanentDelete,
    handleCancelPermanentDelete,
    fetchTrashedParkingSpots,
  } as const;
}
