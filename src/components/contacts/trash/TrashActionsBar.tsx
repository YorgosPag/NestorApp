/**
 * 🗑️ Trash Actions Bar — Toolbar for trash view mode
 *
 * Shows restore/permanent-delete actions + auto-purge warning banner.
 * Appears above the contacts list when trash mode is active.
 *
 * @module components/contacts/trash/TrashActionsBar
 * @enterprise ADR-191 pattern — Soft-delete lifecycle management
 */

'use client';

import '@/lib/design-system';
import { Trash2, RotateCcw, ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { restoreMultipleDeletedContactsWithPolicy } from '@/services/contact-mutation-gateway';
import { useNotifications } from '@/providers/NotificationProvider';

interface TrashActionsBarProps {
  selectedIds: string[];
  onBack: () => void;
  onRefresh: () => void;
  onPermanentDelete: (ids?: string[]) => void;
  trashCount: number;
}

export function TrashActionsBar({
  selectedIds,
  onBack,
  onRefresh,
  onPermanentDelete,
  trashCount,
}: TrashActionsBarProps) {
  const { t } = useTranslation('contacts');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { notify } = useNotifications();

  const handleRestoreSelected = async () => {
    if (selectedIds.length === 0) return;
    try {
      await restoreMultipleDeletedContactsWithPolicy({ ids: selectedIds });
      notify(t('trash.restoreSuccess', { count: selectedIds.length }), { type: 'success' });
      onRefresh();
    } catch {
      notify(t('trash.restoreFailed'), { type: 'error' });
    }
  };

  return (
    <section
      className="flex flex-col gap-2 px-3 py-2 border-b"
      role="toolbar"
      aria-label={t('trash.viewTrash')}
    >
      {/* Warning banner */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm ${colors.text.muted}`}>
        <AlertTriangle className={`${iconSizes.sm} text-amber-500 shrink-0`} />
        <p>{t('trash.autoDeleteWarning')}</p>
      </div>

      {/* Action buttons */}
      <nav className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          onClick={onBack}
          className="gap-1.5"
        >
          <ArrowLeft className={iconSizes.xs} />
          {t('trash.backToContacts')}
        </Button>

        <span className={`text-sm ${colors.text.muted} px-2`}>
          {t('trash.trashCount', { count: trashCount })}
        </span>

        <div className="flex-1" />

        <Button
          size="sm"
          variant="outline"
          onClick={handleRestoreSelected}
          disabled={selectedIds.length === 0}
          className="gap-1.5"
        >
          <RotateCcw className={iconSizes.xs} />
          {t('trash.restoreSelected')}
          {selectedIds.length > 0 && ` (${selectedIds.length})`}
        </Button>

        <Button
          size="sm"
          variant="destructive"
          onClick={() => onPermanentDelete(selectedIds.length > 0 ? selectedIds : undefined)}
          disabled={selectedIds.length === 0}
          className="gap-1.5"
        >
          <Trash2 className={iconSizes.xs} />
          {t('trash.permanentDelete')}
        </Button>
      </nav>
    </section>
  );
}
