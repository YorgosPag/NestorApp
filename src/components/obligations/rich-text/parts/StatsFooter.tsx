"use client";

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import '@/lib/design-system';

interface StatsFooterProps {
  words: number;
  chars: number;
}

export function StatsFooter({ words, chars }: StatsFooterProps) {
  const { t } = useTranslation('obligations');
  const colors = useSemanticColors();

  return (
    <div className={cn("flex items-center justify-between text-xs pt-2 border-t", colors.text.muted)}>
      <div className="space-x-4">
        <span aria-live="polite">{t('richText.stats.words')}: {words}</span>
        <span aria-live="polite">{t('richText.stats.characters')}: {chars}</span>
      </div>

      <div className="text-right">
        <div className="mb-1">
          <strong>{t('richText.stats.shortcuts')}:</strong> {t('richText.stats.shortcutsValue')}
        </div>
        <div>
          <strong>{t('richText.stats.formatting')}:</strong> {t('richText.stats.formattingValue')}
        </div>
      </div>
    </div>
  );
}

