/* eslint-disable design-system/prefer-design-system-imports -- Uses useDesignTokens (semantic colors + icon sizes) */
/**
 * TrashActionsBar — Generic toolbar for trash view
 *
 * Reusable across ALL entities: contacts, properties, buildings, etc.
 *
 * @component
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft, RotateCcw, Trash2, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useIconSizes, useSemanticColors } from '@/hooks/useDesignTokens';

interface TrashActionsBarProps {
  /** Selected entity IDs in trash view */
  selectedIds: string[];
  /** Navigate back to active view */
  onBack: () => void;
  /** Restore selected items */
  onRestore: (ids: string[]) => void;
  /** Permanently delete selected items */
  onPermanentDelete: (ids: string[]) => void;
  /** Total number of items in trash */
  trashCount: number;
  /** Entity type label for display (e.g., "Contacts", "Properties") */
  entityLabel?: string;
}

export function TrashActionsBar({
  selectedIds,
  onBack,
  onRestore,
  onPermanentDelete,
  trashCount,
}: TrashActionsBarProps) {
  const { t } = useTranslation('trash');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  return (
    <section
      className="flex flex-col gap-2 px-3 py-2 border-b"
      role="toolbar"
      aria-label={t('trashView')}
    >
      {/* Warning banner */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm ${colors.text.muted}`}>
        <AlertTriangle className={`${iconSizes.sm} text-amber-500 shrink-0`} />
        <p>{t('autoDeleteWarning')}</p>
      </div>

      {/* Action buttons */}
      <nav className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={onBack} className="gap-1.5">
          <ArrowLeft className={iconSizes.xs} />
          {t('backToList')}
        </Button>

        <span className={`text-sm ${colors.text.muted} px-2`}>
          {t('trashCount', { count: trashCount })}
        </span>

        <div className="flex-1" />

        <Button
          size="sm"
          variant="outline"
          onClick={() => onRestore(selectedIds)}
          disabled={selectedIds.length === 0}
          className="gap-1.5"
        >
          <RotateCcw className={iconSizes.xs} />
          {t('restoreSelected')}
          {selectedIds.length > 0 && ` (${selectedIds.length})`}
        </Button>

        <Button
          size="sm"
          variant="destructive"
          onClick={() => onPermanentDelete(selectedIds)}
          disabled={selectedIds.length === 0}
          className="gap-1.5"
        >
          <Trash2 className={iconSizes.xs} />
          {t('permanentDelete')}
        </Button>
      </nav>
    </section>
  );
}
