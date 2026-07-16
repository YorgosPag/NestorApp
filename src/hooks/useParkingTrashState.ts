'use client';

/**
 * 🗑️ useParkingTrashState — parking binding for the trash engine.
 *
 * @module hooks/useParkingTrashState
 * @enterprise ADR-281 — SSOT Soft-Delete System · ADR-584 — Anti-Duplication
 */

import { useMemo } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import { useEntityTrashState, type EntityTrashSpec } from '@/hooks/trash/useEntityTrashState';
import type { ParkingSpot } from '@/types/parking';

interface UseParkingTrashStateParams {
  forceDataRefresh: () => void;
  clearSelection?: () => void;
}

const PARKING_TRASH_SPEC: EntityTrashSpec<ParkingSpot> = {
  entityKind: 'parking',
  trashRoute: API_ROUTES.PARKING.TRASH,
  selectItems: response => response.parkingSpots as ParkingSpot[] | undefined,
};

export function useParkingTrashState({
  forceDataRefresh,
  clearSelection,
}: UseParkingTrashStateParams) {
  const trash = useEntityTrashState(PARKING_TRASH_SPEC, { forceDataRefresh, clearSelection });

  return useMemo(
    () => ({
      showTrash: trash.showTrash,
      trashCount: trash.trashCount,
      trashedParkingSpots: trash.items,
      loadingTrash: trash.loadingTrash,
      showPermanentDeleteDialog: trash.showPermanentDeleteDialog,
      pendingPermanentDeleteIds: trash.pendingPermanentDeleteIds,
      handleToggleTrash: trash.handleToggleTrash,
      handleTrashActionComplete: trash.handleTrashActionComplete,
      handleRestoreParkingSpots: trash.handleRestore,
      handlePermanentDeleteParkingSpots: trash.handlePermanentDelete,
      handleConfirmPermanentDelete: trash.handleConfirmPermanentDelete,
      handleCancelPermanentDelete: trash.handleCancelPermanentDelete,
      fetchTrashedParkingSpots: trash.fetchTrashedItems,
    }),
    [trash],
  ) as const;
}
