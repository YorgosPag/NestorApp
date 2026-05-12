'use client';

/**
 * ADR-344 Phase 10 — DraftRecoveryBanner.
 *
 * Non-blocking notification banner shown when IndexedDB contains a draft
 * newer than the last cloud save. Positioned at the top of the text editor
 * area; caller mounts it only when `draft` is non-null.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/intl-formatting';
import type { DraftEntry } from '../../text-engine/draft';

export interface DraftRecoveryBannerProps {
  readonly draft: DraftEntry;
  readonly onRestore: () => void;
  readonly onDiscard: () => void;
}

export function DraftRecoveryBanner({ draft, onRestore, onDiscard }: DraftRecoveryBannerProps) {
  const { t } = useTranslation(['textDraft']);

  const dateLabel = formatDateTime(draft.savedAt, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <aside
      role="status"
      aria-label={t('textDraft:banner.ariaLabel')}
      className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-700 dark:bg-amber-950/40"
    >
      <span className="text-amber-800 dark:text-amber-300">
        {t('textDraft:banner.message', { date: dateLabel })}
      </span>
      <div className="flex shrink-0 gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={onDiscard}
          className="h-7 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300"
          aria-label={t('textDraft:banner.discard')}
        >
          <Trash2 className="mr-1 h-3 w-3" />
          {t('textDraft:banner.discard')}
        </Button>
        <Button
          size="sm"
          onClick={onRestore}
          className="h-7 bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600"
          aria-label={t('textDraft:banner.restore')}
        >
          <RotateCcw className="mr-1 h-3 w-3" />
          {t('textDraft:banner.restore')}
        </Button>
      </div>
    </aside>
  );
}
