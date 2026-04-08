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
import { createModuleLogger } from '@/lib/telemetry';
import { Trash2, RotateCcw, ArrowLeft, AlertTriangle } from 'lucide-react';

const logger = createModuleLogger('TrashActionsBar');
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { restoreMultipleDeletedContactsWithPolicy } from '@/services/contact-mutation-gateway';
import { useNotifications } from '@/providers/NotificationProvider';

interface TrashActionsBarProps {
  selectedIds: string[];
  onBack: () => void;
  /** Called after restore/error to refresh list AND clear stale selection */
  onRefresh: () => void;
  onPermanentDelete: (ids?: string[]) => void;
  trashCount: number;
  /** ID of the contact currently viewed in the detail panel (fallback when no multi-select) */
  activeContactId?: string | null;
}

export function TrashActionsBar({
  selectedIds,
  onBack,
  onRefresh,
  onPermanentDelete,
  trashCount,
  activeContactId,
}: TrashActionsBarProps) {
  const { t } = useTranslation('contacts');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { notify } = useNotifications();

  /** Effective IDs to act on: multi-selected, or the single active contact */
  const effectiveIds = selectedIds.length > 0
    ? selectedIds
    : activeContactId ? [activeContactId] : [];

  const canAct = effectiveIds.length > 0;

  const handleRestoreSelected = async () => {
    if (!canAct) return;
    logger.info('Restoring contacts', { effectiveIds });
    try {
      await restoreMultipleDeletedContactsWithPolicy({ ids: effectiveIds });
      logger.info('Restore succeeded', { effectiveIds });
      notify(
        effectiveIds.length === 1
          ? t('trash.restoreSuccess_one')
          : t('trash.restoreSuccess', { count: effectiveIds.length }),
        { type: 'success' },
      );
      onRefresh();
    } catch (err) {
      logger.error('Restore failed', { effectiveIds, error: err });
      notify(t('trash.restoreFailed'), { type: 'error' });
      // Refresh anyway — contact may already be restored (409 = not in trash anymore)
      onRefresh();
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
          disabled={!canAct}
          className="gap-1.5"
        >
          <RotateCcw className={iconSizes.xs} />
          {t('trash.restoreSelected')}
          {effectiveIds.length > 0 && ` (${effectiveIds.length})`}
        </Button>

        <Button
          size="sm"
          variant="destructive"
          onClick={() => onPermanentDelete(effectiveIds.length > 0 ? effectiveIds : undefined)}
          disabled={!canAct}
          className="gap-1.5"
        >
          <Trash2 className={iconSizes.xs} />
          {t('trash.permanentDelete')}
        </Button>
      </nav>
    </section>
  );
}
