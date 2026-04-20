'use client';

/**
 * 🗑️ usePropertiesTrashState
 *
 * Manages the trash view for the properties page.
 * Follows the same pattern as useParkingTrashState/useBuildingsTrashState (ADR-281),
 * plus ADR-226 deletion-guard pre-check before permanent delete (property has
 * the most blocking dependencies: accounting_invoices, opportunities, communications,
 * contact_links, boq_items, obligations).
 *
 * @module hooks/usePropertiesTrashState
 * @enterprise ADR-281 — SSOT Soft-Delete System + ADR-226 — Deletion Guard
 */

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { TrashService } from '@/services/trash.service';
import { useDeletionGuard } from '@/hooks/useDeletionGuard';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import type { Property } from '@/types/property-viewer';

const logger = createModuleLogger('usePropertiesTrashState');

interface UsePropertiesTrashStateParams {
  selectedPropertyIds: string[];
  setSelectedProperties: (ids: string[]) => void;
  forceDataRefresh: () => void;
}

interface TrashApiResponse {
  success: boolean;
  properties: Property[];
  count: number;
}

export function usePropertiesTrashState({
  selectedPropertyIds,
  setSelectedProperties,
  forceDataRefresh,
}: UsePropertiesTrashStateParams) {
  const { t } = useTranslation(['trash']);
  const { notify } = useNotifications();
  const { checkBeforeDelete, BlockedDialog } = useDeletionGuard('property');

  const [showTrash, setShowTrash] = useState(false);
  const [trashedProperties, setTrashedProperties] = useState<Property[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [showPermanentDeleteDialog, setShowPermanentDeleteDialog] = useState(false);
  const [pendingPermanentDeleteIds, setPendingPermanentDeleteIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const trashCount = trashedProperties.length;

  const fetchTrashedProperties = useCallback(async () => {
    setLoadingTrash(true);
    try {
      const response = await apiClient.get<TrashApiResponse>(API_ROUTES.PROPERTIES.TRASH);
      setTrashedProperties(response.properties ?? []);
    } catch (error) {
      logger.error('Failed to fetch deleted properties', { error });
      setTrashedProperties([]);
    } finally {
      setLoadingTrash(false);
    }
  }, []);

  const handleToggleTrash = useCallback(async () => {
    const next = !showTrash;
    setShowTrash(next);
    setSelectedProperties([]);
    if (next) {
      await fetchTrashedProperties();
    }
  }, [showTrash, setSelectedProperties, fetchTrashedProperties]);

  const handleTrashActionComplete = useCallback(() => {
    setSelectedProperties([]);
    forceDataRefresh();
    void fetchTrashedProperties();
  }, [setSelectedProperties, forceDataRefresh, fetchTrashedProperties]);

  const handleRestoreProperties = useCallback((ids?: string[]) => {
    const targets = ids ?? (selectedPropertyIds.length > 0 ? selectedPropertyIds : []);
    if (targets.length > 0) {
      setSelectedProperties(targets);
    }
  }, [selectedPropertyIds, setSelectedProperties]);

  const handlePermanentDeleteProperties = useCallback(async (ids?: string[]) => {
    const targets = ids ?? (selectedPropertyIds.length > 0 ? selectedPropertyIds : []);
    if (targets.length === 0) return;

    if (targets.length === 1) {
      const allowed = await checkBeforeDelete(targets[0]);
      if (!allowed) return;
    }

    setPendingPermanentDeleteIds(targets);
    setShowPermanentDeleteDialog(true);
  }, [selectedPropertyIds, checkBeforeDelete]);

  const handleConfirmPermanentDelete = useCallback(async () => {
    if (pendingPermanentDeleteIds.length === 0) return;
    setIsDeleting(true);
    logger.info('Permanently deleting properties', { ids: pendingPermanentDeleteIds });

    const results = await Promise.allSettled(
      pendingPermanentDeleteIds.map((id) => TrashService.permanentDelete('property', id)),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;

    setShowPermanentDeleteDialog(false);
    setPendingPermanentDeleteIds([]);
    setIsDeleting(false);

    if (failed === 0 && succeeded > 0) {
      notify(
        t('permanentDeleteSuccess', { ns: 'trash', count: succeeded }),
        { type: 'success' },
      );
    } else if (succeeded > 0 && failed > 0) {
      logger.error('Partial permanent-delete failure', { succeeded, failed, results });
      notify(
        t('permanentDeletePartial', { ns: 'trash', succeeded, failed }),
        { type: 'warning' },
      );
    } else {
      logger.error('Permanent-delete failed for all targets', { results });
      notify(t('permanentDeleteFailed', { ns: 'trash' }), { type: 'error' });
    }

    handleTrashActionComplete();
  }, [pendingPermanentDeleteIds, handleTrashActionComplete, notify, t]);

  const handleCancelPermanentDelete = useCallback(() => {
    setShowPermanentDeleteDialog(false);
    setPendingPermanentDeleteIds([]);
  }, []);

  const handlePermanentDeleted = useCallback(() => {
    setShowPermanentDeleteDialog(false);
    setPendingPermanentDeleteIds([]);
    setSelectedProperties([]);
    void fetchTrashedProperties();
    forceDataRefresh();
  }, [setSelectedProperties, fetchTrashedProperties, forceDataRefresh]);

  return {
    showTrash,
    trashCount,
    trashedProperties,
    loadingTrash,
    showPermanentDeleteDialog,
    pendingPermanentDeleteIds,
    isDeleting,
    BlockedDialog,
    setShowPermanentDeleteDialog,
    handleToggleTrash,
    handleTrashActionComplete,
    handleRestoreProperties,
    handlePermanentDeleteProperties,
    handleConfirmPermanentDelete,
    handleCancelPermanentDelete,
    handlePermanentDeleted,
    fetchTrashedProperties,
  } as const;
}
