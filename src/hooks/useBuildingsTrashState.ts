'use client';

/**
 * 🗑️ useBuildingsTrashState — buildings binding for the trash engine.
 *
 * @module hooks/useBuildingsTrashState
 * @enterprise ADR-281 — SSOT Soft-Delete System · ADR-584 — Anti-Duplication
 */

import { useMemo } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useEntityTrashState, type EntityTrashSpec } from '@/hooks/trash/useEntityTrashState';
import type { Building } from '@/types/building/contracts';

interface UseBuildingsTrashStateParams {
  forceDataRefresh: () => void;
  clearSelection?: () => void;
}

const BUILDINGS_TRASH_SPEC: EntityTrashSpec<Building> = {
  entityKind: 'building',
  trashRoute: API_ROUTES.BUILDINGS.TRASH,
  selectItems: response => response.buildings as Building[] | undefined,
};

export function useBuildingsTrashState({
  forceDataRefresh,
  clearSelection,
}: UseBuildingsTrashStateParams) {
  const { success: showSuccess } = useNotifications();
  const { t } = useTranslation(['trash']);

  const trash = useEntityTrashState(BUILDINGS_TRASH_SPEC, {
    forceDataRefresh,
    clearSelection,
    notifyRestored: count =>
      showSuccess(count === 1 ? t('restoreSuccess_one') : t('restoreSuccess', { count })),
  });

  return useMemo(
    () => ({
      showTrash: trash.showTrash,
      trashCount: trash.trashCount,
      trashedBuildings: trash.items,
      loadingTrash: trash.loadingTrash,
      showPermanentDeleteDialog: trash.showPermanentDeleteDialog,
      pendingPermanentDeleteIds: trash.pendingPermanentDeleteIds,
      handleToggleTrash: trash.handleToggleTrash,
      handleTrashActionComplete: trash.handleTrashActionComplete,
      handleRestoreBuildings: trash.handleRestore,
      handlePermanentDeleteBuildings: trash.handlePermanentDelete,
      handleConfirmPermanentDelete: trash.handleConfirmPermanentDelete,
      handleCancelPermanentDelete: trash.handleCancelPermanentDelete,
      fetchTrashedBuildings: trash.fetchTrashedItems,
      onBuildingMovedToTrash: trash.trackMovedToTrash,
    }),
    [trash],
  ) as const;
}
