"use client";

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import '@/lib/design-system';

interface DocumentFooterProps {
  sectionsCount: number;
  articlesCount: number;
  paragraphsCount: number;
  zoomDisplay: number;
}

export function DocumentFooter({ sectionsCount, articlesCount, paragraphsCount, zoomDisplay }: DocumentFooterProps) {
  const { t } = useTranslation('obligations');
  const colors = useSemanticColors();

  return (
    <div className={cn("flex items-center justify-between p-4 border-t bg-muted/30 text-sm", colors.text.muted)}>
      <div>
        {sectionsCount} {t('footer.sections')} - {articlesCount} {t('footer.articles')} - {paragraphsCount} {t('footer.paragraphs')}
      </div>
      <div className="flex items-center gap-2">
        <span>{t('footer.zoom')}: {zoomDisplay}%</span>
      </div>
    </div>
  );
}

