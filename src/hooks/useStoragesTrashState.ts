'use client';

/**
 * 🗑️ useStoragesTrashState — storages binding for the trash engine.
 *
 * Storages additionally keep the bin live: a storage soft-deleted from the
 * active list refreshes the trash view over realtime (ADR-281).
 *
 * @module hooks/useStoragesTrashState
 * @enterprise ADR-281 — SSOT Soft-Delete System · ADR-584 — Anti-Duplication
 */

import { useMemo } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useEntityTrashState, type EntityTrashSpec } from '@/hooks/trash/useEntityTrashState';
import type { Storage } from '@/types/storage/contracts';

interface UseStoragesTrashStateParams {
  forceDataRefresh: () => void;
  clearSelection?: () => void;
}

const STORAGES_TRASH_SPEC: EntityTrashSpec<Storage> = {
  entityKind: 'storage',
  trashRoute: API_ROUTES.STORAGES.TRASH,
  selectItems: response => response.storages as Storage[] | undefined,
  refreshOn: 'STORAGE_DELETED',
};

export function useStoragesTrashState({
  forceDataRefresh,
  clearSelection,
}: UseStoragesTrashStateParams) {
  const { success: showSuccess } = useNotifications();
  const { t } = useTranslation('trash');

  const trash = useEntityTrashState(STORAGES_TRASH_SPEC, {
    forceDataRefresh,
    clearSelection,
    notifyRestored: count =>
      showSuccess(count === 1 ? t('restoreSuccess_one') : t('restoreSuccess', { count })),
    notifyPermanentlyDeleted: count =>
      showSuccess(
        count === 1 ? t('permanentDeleteSuccess_one') : t('permanentDeleteSuccess', { count }),
      ),
  });

  return useMemo(
    () => ({
      showTrash: trash.showTrash,
      trashCount: trash.trashCount,
      trashedStorages: trash.items,
      loadingTrash: trash.loadingTrash,
      showPermanentDeleteDialog: trash.showPermanentDeleteDialog,
      pendingPermanentDeleteIds: trash.pendingPermanentDeleteIds,
      handleToggleTrash: trash.handleToggleTrash,
      handleTrashActionComplete: trash.handleTrashActionComplete,
      handleRestoreStorages: trash.handleRestore,
      handlePermanentDeleteStorages: trash.handlePermanentDelete,
      handleConfirmPermanentDelete: trash.handleConfirmPermanentDelete,
      handleCancelPermanentDelete: trash.handleCancelPermanentDelete,
      fetchTrashedStorages: trash.fetchTrashedItems,
    }),
    [trash],
  ) as const;
}
