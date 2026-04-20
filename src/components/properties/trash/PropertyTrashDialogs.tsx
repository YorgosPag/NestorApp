'use client';

/**
 * 🗑️ PropertyTrashDialogs
 *
 * Thin bundle of the confirm + blocked dialogs rendered from the properties
 * trash view. Kept as a separate component so `UnitsPageContent` stays under
 * the Google 500-line limit (N.7.1).
 *
 * @module components/properties/trash/PropertyTrashDialogs
 * @enterprise ADR-281 (permanent-delete) + ADR-226 (deletion guard)
 */

import type { ReactNode } from 'react';
import { DeleteConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface PropertyTrashDialogsProps {
  showPermanentDeleteDialog: boolean;
  pendingPermanentDeleteIds: string[];
  isDeleting: boolean;
  onConfirmPermanentDelete: () => void;
  onCancelPermanentDelete: () => void;
  blockedDialog: ReactNode;
}

export function PropertyTrashDialogs({
  showPermanentDeleteDialog,
  pendingPermanentDeleteIds,
  isDeleting,
  onConfirmPermanentDelete,
  onCancelPermanentDelete,
  blockedDialog,
}: PropertyTrashDialogsProps) {
  const { t } = useTranslation(['trash']);
  return (
    <>
      <DeleteConfirmDialog
        open={showPermanentDeleteDialog}
        onOpenChange={(open) => { if (!open) onCancelPermanentDelete(); }}
        title={t('permanentDeleteDialog.title', { ns: 'trash' })}
        description={t('permanentDeleteDialog.body', { ns: 'trash' })}
        onConfirm={onConfirmPermanentDelete}
        loading={isDeleting}
        disabled={pendingPermanentDeleteIds.length === 0}
      />
      {blockedDialog}
    </>
  );
}
