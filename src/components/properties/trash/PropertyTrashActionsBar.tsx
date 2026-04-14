'use client';

/**
 * 🗑️ PropertyTrashActionsBar
 *
 * Toolbar for the properties trash view.
 * Shows restore/permanent-delete actions + 30-day auto-purge warning.
 * Follows the pattern of contacts/trash/TrashActionsBar (ADR-191).
 *
 * @module components/properties/trash/PropertyTrashActionsBar
 */

import '@/lib/design-system';
import { createModuleLogger } from '@/lib/telemetry';
import { Trash2, RotateCcw, ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { TrashService } from '@/services/trash.service';
import { useNotifications } from '@/providers/NotificationProvider';

const logger = createModuleLogger('PropertyTrashActionsBar');

interface PropertyTrashActionsBarProps {
  selectedIds: string[];
  onBack: () => void;
  /** Called after restore/error to refresh both trash and main list */
  onRefresh: () => void;
  onPermanentDelete: (ids?: string[]) => void;
  trashCount: number;
  /** Fallback when no multi-select active */
  activePropertyId?: string | null;
}

export function PropertyTrashActionsBar({
  selectedIds,
  onBack,
  onRefresh,
  onPermanentDelete,
  trashCount,
  activePropertyId,
}: PropertyTrashActionsBarProps) {
  const { t } = useTranslation('properties-viewer');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { notify } = useNotifications();

  const effectiveIds = selectedIds.length > 0
    ? selectedIds
    : activePropertyId ? [activePropertyId] : [];

  const canAct = effectiveIds.length > 0;

  const handleRestore = async () => {
    if (!canAct) return;
    logger.info('Restoring properties', { effectiveIds });
    try {
      await TrashService.bulkRestore('property', effectiveIds);
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
      onRefresh();
    }
  };

  return (
    <section
      className="flex flex-col gap-2 px-3 py-2 border-b"
      role="toolbar"
      aria-label={t('trash.viewTrash')}
    >
      {/* 30-day auto-purge warning */}
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
          {t('trash.backToProperties')}
        </Button>

        <span className={`text-sm ${colors.text.muted} px-2`}>
          {t('trash.trashCount', { count: trashCount })}
        </span>

        <div className="flex-1" />

        <Button
          size="sm"
          variant="outline"
          onClick={handleRestore}
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
