'use client';

/**
 * 🗑️ PropertyTrashActionsBar
 *
 * Toolbar for the properties trash view.
 * Shows restore/permanent-delete actions + 30-day auto-purge warning.
 * Διάταξη: η ΜΙΑ `shared/trash/TrashActionsBar` (ADR-867 2026-09-22) — εδώ μόνο η επαναφορά + τα κείμενα.
 *
 * @module components/properties/trash/PropertyTrashActionsBar
 */

import '@/lib/design-system';
import { EntityTrashActionsBar } from '@/components/shared/trash/EntityTrashActionsBar';
import { useTranslation } from '@/i18n';
import { TrashService } from '@/services/trash.service';

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

const restoreProperties = (ids: string[]) => TrashService.bulkRestore('property', ids);

export function PropertyTrashActionsBar({ activePropertyId, ...bar }: PropertyTrashActionsBarProps) {
  const { t } = useTranslation('properties-viewer');
  return (
    <EntityTrashActionsBar
      {...bar}
      activeId={activePropertyId}
      entity="properties"
      restore={restoreProperties}
      text={{
        back: t('trash.backToProperties'),
        warning: t('trash.autoDeleteWarning'),
        restoreSuccess: (count) => t('trash.restoreSuccess', { count }),
        restoreFailed: t('trash.restoreFailed'),
      }}
    />
  );
}
